"""Local demonstration API. Run: python backend/server.py"""
import hashlib
import hmac
import json
import os
import re
import secrets
import socket
import sqlite3
import time
import threading
from collections import deque
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from http.cookies import SimpleCookie
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlparse
from mailer import MailUnavailable, mail_settings, send_reset_email
import document_service
from documents import DocumentError, MAX_FILE_SIZE, search_document

ROOT = Path(__file__).resolve().parent
SESSIONS = {}
EMAIL = os.environ.get('SOLVAI_EMAIL', 'demo@solvai.com')
PASSWORD = os.environ.get('SOLVAI_PASSWORD', 'SolvAI2024!')
ADMIN_EMAIL = 'eyyubxankisiyev@gmail.com'
RESET_SECRET = secrets.token_bytes(32)
RESET_LOCK = threading.RLock()
RESET_LIMITS = {}
UPLOAD_READ_TIMEOUT = 30


class ExclusiveHTTPServer(ThreadingHTTPServer):
    # Windows otherwise permits overlapping listeners and requests hit stale APIs.
    allow_reuse_address = False

    def server_bind(self):
        if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()

def reset_hash(email, code):
    return hmac.digest(RESET_SECRET, (email + ':' + code).encode(), 'sha256')

@contextmanager
def database():
    db = sqlite3.connect(ROOT / 'accounts.sqlite3')
    try:
        with db:
            db.execute('CREATE TABLE IF NOT EXISTS accounts (email TEXT PRIMARY KEY, name TEXT NOT NULL, salt BLOB NOT NULL, password_hash BLOB NOT NULL)')
            columns = {row[1] for row in db.execute('PRAGMA table_info(accounts)')}
            if 'disabled' not in columns:
                db.execute('ALTER TABLE accounts ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0')
            if 'created' not in columns:
                db.execute('ALTER TABLE accounts ADD COLUMN created REAL')
            if 'is_admin' not in columns:
                db.execute('ALTER TABLE accounts ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0')
            db.execute('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY)')
            db.execute('CREATE TABLE IF NOT EXISTS password_resets (email TEXT PRIMARY KEY, code_hash BLOB NOT NULL, expires REAL NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, sent_at REAL NOT NULL, account_hash BLOB NOT NULL)')
            if not db.execute("SELECT 1 FROM settings WHERE key = 'demo-initialized'").fetchone():
                salt = secrets.token_bytes(16)
                db.execute('INSERT OR IGNORE INTO accounts (email, name, salt, password_hash, created) VALUES (?, ?, ?, ?, ?)', (EMAIL.casefold(), 'Demo account', salt, password_hash(PASSWORD, salt), time.time()))
                db.execute("INSERT INTO settings VALUES ('demo-initialized')")
            yield db
    finally:
        db.close()

def password_hash(password, salt):
    return hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 600000)

def is_admin_email(email):
    if email.casefold() == ADMIN_EMAIL:
        return True
    with database() as db:
        row = db.execute('SELECT is_admin FROM accounts WHERE email = ?', (email.casefold(),)).fetchone()
    return bool(row and row[0])

def account_profile(email):
    with database() as db:
        row = db.execute('SELECT name FROM accounts WHERE email = ?', (email.casefold(),)).fetchone()
    return {'name': row[0], 'email': email.casefold()} if row else None

class Handler(BaseHTTPRequestHandler):
    def read_document_body(self, size):
        deadline = time.monotonic() + UPLOAD_READ_TIMEOUT
        previous_timeout = self.connection.gettimeout()
        chunks = []
        remaining = size
        try:
            while remaining:
                budget = deadline - time.monotonic()
                if budget <= 0:
                    raise TimeoutError()
                self.connection.settimeout(budget)
                chunk = self.rfile.read1(min(65536, remaining))
                if not chunk:
                    self.close_connection = True
                    raise DocumentError('The document upload did not finish. Please try again.')
                chunks.append(chunk)
                remaining -= len(chunk)
        except TimeoutError:
            self.close_connection = True
            raise DocumentError('The document upload timed out. Check your connection and try again.', 408)
        finally:
            self.connection.settimeout(previous_timeout)
        return b''.join(chunks)

    def admin_documents(self, method):
        if not self.require_admin():
            return
        address = urlparse(self.path)
        segments = address.path.rstrip('/').split('/')[4:]
        try:
            if not segments:
                if method == 'GET':
                    filters = parse_qs(address.query)
                    self.respond(200, {'documents': document_service.list_documents(
                        ROOT, file_type=filters.get('type', [''])[0], query=filters.get('q', [''])[0],
                        start=filters.get('from', [''])[0], end=filters.get('to', [''])[0],
                        order=filters.get('order', ['newest'])[0]),
                                       'capabilities': document_service.capabilities()})
                    return
                if method == 'POST':
                    if self.headers.get('Transfer-Encoding'):
                        raise DocumentError('Upload a document with a known file size.')
                    try:
                        size = int(self.headers.get('Content-Length', '0'))
                    except ValueError:
                        raise DocumentError('Invalid document upload.')
                    if not 0 < size <= MAX_FILE_SIZE:
                        raise DocumentError('Choose a document up to 10 MB.', 413)
                    filename = unquote(self.headers.get('X-Document-Name', ''))
                    content = self.read_document_body(size)
                    self.respond(202, {'document': document_service.save_upload(ROOT, filename, content)})
                    return
            elif len(segments) == 1:
                if method == 'GET':
                    self.respond(200, {'document': document_service.get_document(ROOT, segments[0])})
                    return
                if method == 'DELETE':
                    document_service.delete_document(ROOT, segments[0])
                    self.respond(200, {'message': 'Document deleted.'})
                    return
            elif len(segments) == 2:
                document = document_service.get_document(ROOT, segments[0])
                if method == 'GET' and segments[1] == 'download':
                    name, content = document_service.get_original(ROOT, segments[0])
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/octet-stream')
                    self.send_header('Content-Length', str(len(content)))
                    self.send_header('Content-Disposition', "attachment; filename*=UTF-8''" + quote(name, safe=''))
                    self.send_header('Cache-Control', 'no-store')
                    self.send_header('X-Content-Type-Options', 'nosniff')
                    self.end_headers()
                    self.wfile.write(content)
                    return
                if method == 'POST' and segments[1] == 'retry':
                    self.respond(202, {'document': document_service.retry_document(ROOT, segments[0])})
                    return
                if segments[1] in ('search', 'ask') and document['status'] != 'ready':
                    raise DocumentError(document.get('error') or 'The document is still processing. Try again when it is ready.', 409)
                if method == 'GET' and segments[1] == 'search':
                    query = parse_qs(address.query).get('q', [''])[0].strip()
                    if not 1 <= len(query) <= 300:
                        raise DocumentError('Enter a search of 1 to 300 characters.')
                    self.respond(200, {'matches': search_document(document, query)})
                    return
                if method == 'POST' and segments[1] == 'ask':
                    try:
                        size = int(self.headers.get('Content-Length', '0'))
                        if not 0 < size <= 12000:
                            raise ValueError()
                        data = json.loads(self.read_document_body(size))
                        if not isinstance(data, dict):
                            raise ValueError()
                    except (ValueError, TypeError, UnicodeDecodeError):
                        raise DocumentError('Invalid document question.')
                    result = document_service.ask_document(document, data.get('question', ''), data.get('mode', 'answer'), data.get('language', 'en'))
                    self.respond(200, result)
                    return
            self.respond(404, {'message': 'Not found.'})
        except DocumentError as error:
            self.respond(error.status, {'message': str(error)})
        except (sqlite3.Error, OSError):
            self.respond(500, {'message': 'Unable to save or read the document. Please try again.'})

    def reset_password(self):
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 8192:
                raise ValueError()
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                raise ValueError()
            email = data.get('email')
            if not isinstance(email, str) or len(email) > 254:
                raise ValueError()
            email = email.strip().casefold()
            if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
                raise ValueError()
        except (ValueError, TypeError, UnicodeDecodeError):
            self.respond(400, {'message': 'Please provide a valid email address.'})
            return
        requesting = self.path == '/api/forgot-password'
        with RESET_LOCK:
            now = time.time()
            for key, values in list(RESET_LIMITS.items()):
                while values and values[0] <= now - 600:
                    values.popleft()
                if not values:
                    RESET_LIMITS.pop(key, None)
            key = (self.client_address[0], requesting)
            events = RESET_LIMITS.setdefault(key, deque())
            if len(events) >= (10 if requesting else 30):
                self.respond(429, {'message': 'Too many attempts. Please try again in 10 minutes.'})
                return
            events.append(now)
            if requesting:
                try:
                    config = mail_settings(ROOT)
                except MailUnavailable as error:
                    self.respond(503, {'message': str(error)})
                    return
                with database() as db:
                    account = db.execute('SELECT password_hash, disabled FROM accounts WHERE email = ?', (email,)).fetchone()
                    previous = db.execute('SELECT sent_at FROM password_resets WHERE email = ?', (email,)).fetchone()
                    if previous and previous[0] > now - 60:
                        self.respond(429, {'message': 'Please wait 60 seconds before requesting another code.'})
                        return
                    if account and not account[1]:
                        code = f'{secrets.randbelow(1000000):06d}'
                        try:
                            send_reset_email(email, code, config)
                        except MailUnavailable as error:
                            self.respond(503, {'message': str(error)})
                            return
                        db.execute('INSERT OR REPLACE INTO password_resets (email, code_hash, expires, attempts, sent_at, account_hash) VALUES (?, ?, ?, 0, ?, ?)', (email, reset_hash(email, code), now + 600, now, account[0]))
                self.respond(200, {'message': 'If this email belongs to an active account, a six-digit code has been sent. Check your inbox and spam folder.'})
                return
            code = data.get('code')
            password = data.get('newPassword')
            if not isinstance(code, str) or not re.fullmatch(r'[0-9]{6}', code):
                self.respond(400, {'message': 'Enter the six-digit code from your email.'})
                return
            if not isinstance(password, str) or not 8 <= len(password) <= 1024:
                self.respond(400, {'message': 'Use a new password with 8 to 1024 characters.'})
                return
            if password != data.get('confirmPassword'):
                self.respond(400, {'message': 'Passwords do not match.'})
                return
            with database() as db:
                reset = db.execute('SELECT code_hash, expires, attempts, account_hash FROM password_resets WHERE email = ?', (email,)).fetchone()
                account = db.execute('SELECT password_hash, disabled FROM accounts WHERE email = ?', (email,)).fetchone()
                valid = bool(reset and account and not account[1] and reset[1] > now and reset[2] < 5 and hmac.compare_digest(reset[3], account[0]) and hmac.compare_digest(reset[0], reset_hash(email, code)))
                if not valid:
                    if reset:
                        db.execute('UPDATE password_resets SET attempts = attempts + 1 WHERE email = ?', (email,))
                    self.respond(400, {'message': 'The code is invalid or expired. Request a new code if needed.'})
                    return
                salt = secrets.token_bytes(16)
                result = db.execute('UPDATE accounts SET salt = ?, password_hash = ? WHERE email = ? AND disabled = 0 AND password_hash = ?', (salt, password_hash(password, salt), email, account[0]))
                if not result.rowcount:
                    self.respond(400, {'message': 'The code is no longer valid. Please request a new code.'})
                    return
                db.execute('DELETE FROM password_resets WHERE email = ?', (email,))
            for token, session in list(SESSIONS.items()):
                if session['email'].casefold() == email:
                    SESSIONS.pop(token, None)
            self.respond(200, {'message': 'Your password has been reset. Sign in with your new password.'})

    def current_session(self):
        token = self.session_token()
        session = SESSIONS.get(token)
        if session and session['expires'] > time.time():
            with database() as db:
                row = db.execute('SELECT disabled FROM accounts WHERE email = ?', (session['email'].casefold(),)).fetchone()
            if row and not row[0]:
                return session
        SESSIONS.pop(token, None)
        return None

    def require_admin(self):
        session = self.current_session()
        if not session:
            self.respond(401, {'message': 'Please sign in again.'})
            return False
        if not is_admin_email(session['email']):
            self.respond(403, {'message': 'Administrator access is required.'})
            return False
        return True

    def admin_accounts(self):
        if not self.require_admin():
            return
        with database() as db:
            rows = db.execute('SELECT email, name, disabled, created, is_admin FROM accounts ORDER BY email').fetchall()
        self.respond(200, {'accounts': [{'email': email, 'name': name, 'disabled': bool(disabled), 'created': created, 'isAdmin': bool(is_admin or email == ADMIN_EMAIL), 'isOwner': email == ADMIN_EMAIL} for email, name, disabled, created, is_admin in rows]})

    def admin_action(self):
        if not self.require_admin():
            return
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 8192:
                raise ValueError()
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict) or not isinstance(data.get('email'), str):
                raise ValueError()
            email = data['email'].strip().casefold()
            action = data.get('action')
            if action not in ('rename', 'enable', 'disable', 'reset-password', 'delete', 'grant-admin', 'revoke-admin'):
                raise ValueError()
        except (ValueError, TypeError, UnicodeDecodeError):
            self.respond(400, {'message': 'Invalid account action.'})
            return
        if email == ADMIN_EMAIL and action != 'rename':
            self.respond(400, {'message': 'The owner account is protected. Use Change password to update your own password.'})
            return
        with database() as db:
            if not db.execute('SELECT 1 FROM accounts WHERE email = ?', (email,)).fetchone():
                self.respond(404, {'message': 'Account not found.'})
                return
            if action == 'rename':
                name = data.get('name')
                if not isinstance(name, str) or not 1 <= len(name.strip()) <= 100:
                    self.respond(400, {'message': 'Enter a name of 1 to 100 characters.'})
                    return
                db.execute('UPDATE accounts SET name = ? WHERE email = ?', (name.strip(), email))
            elif action in ('grant-admin', 'revoke-admin'):
                disabled = db.execute('SELECT disabled FROM accounts WHERE email = ?', (email,)).fetchone()[0]
                if action == 'grant-admin' and disabled:
                    self.respond(400, {'message': 'Enable this account before making it an administrator.'})
                    return
                db.execute('UPDATE accounts SET is_admin = ? WHERE email = ?', (int(action == 'grant-admin'), email))
            elif action in ('enable', 'disable'):
                db.execute('UPDATE accounts SET disabled = ? WHERE email = ?', (int(action == 'disable'), email))
            elif action == 'reset-password':
                password = data.get('password')
                if not isinstance(password, str) or not 8 <= len(password) <= 1024:
                    self.respond(400, {'message': 'Use a password with 8 to 1024 characters.'})
                    return
                salt = secrets.token_bytes(16)
                db.execute('UPDATE accounts SET salt = ?, password_hash = ? WHERE email = ?', (salt, password_hash(password, salt), email))
            else:
                db.execute('DELETE FROM accounts WHERE email = ?', (email,))
        if action in ('disable', 'reset-password', 'delete', 'revoke-admin'):
            for token, session in list(SESSIONS.items()):
                if session['email'].casefold() == email:
                    SESSIONS.pop(token, None)
        message = {'delete': 'Account deleted.', 'grant-admin': 'Administrator access granted.', 'revoke-admin': 'Administrator access removed.'}.get(action, 'Account updated.')
        self.respond(200, {'message': message})

    def session_token(self):
        cookie = SimpleCookie()
        cookie.load(self.headers.get('Cookie', ''))
        return cookie['solvai_session'].value if 'solvai_session' in cookie else ''

    def change_password(self):
        token = self.session_token()
        session = self.current_session()
        if not session or session['expires'] <= time.time():
            self.respond(401, {'message': 'Please sign in again to change your password.'})
            return
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 8192:
                raise ValueError()
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                raise ValueError()
            current = data.get('currentPassword', '')
            new = data.get('newPassword', '')
            confirm = data.get('confirmPassword', '')
            if not isinstance(current, str) or not 1 <= len(current) <= 1024:
                raise ValueError()
            if not isinstance(new, str) or not 8 <= len(new) <= 1024:
                self.respond(400, {'message': 'Use a new password with 8 to 1024 characters.'})
                return
            if new != confirm:
                self.respond(400, {'message': 'Passwords do not match.'})
                return
            if current == new:
                self.respond(400, {'message': 'Choose a password different from your current password.'})
                return
        except (ValueError, TypeError, UnicodeDecodeError):
            self.respond(400, {'message': 'Please provide your current and new passwords.'})
            return
        email = session['email'].casefold()
        with database() as db:
            account = db.execute('SELECT salt, password_hash FROM accounts WHERE email = ?', (email,)).fetchone()
            valid = bool(account and hmac.compare_digest(password_hash(current, account[0]), account[1]))
            if not valid:
                self.respond(400, {'message': 'Your current password is incorrect.'})
                return
            salt = secrets.token_bytes(16)
            hashed = password_hash(new, salt)
            if account:
                result = db.execute('UPDATE accounts SET salt = ?, password_hash = ? WHERE email = ? AND password_hash = ?', (salt, hashed, email, account[1]))
                if not result.rowcount:
                    self.respond(409, {'message': 'Your password changed during this request. Please try again.'})
                    return
            else:
                db.execute('INSERT INTO accounts (email, name, salt, password_hash, created) VALUES (?, ?, ?, ?, ?)', (email, 'Demo account', salt, hashed, time.time()))
        for other_token, other_session in list(SESSIONS.items()):
            if other_token != token and other_session['email'].casefold() == email:
                SESSIONS.pop(other_token, None)
        self.respond(200, {'message': 'Your password has been changed.'})

    def respond(self, status, data, cookie=None):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        if cookie:
            self.send_header('Set-Cookie', cookie)
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_GET(self):
        if urlparse(self.path).path == '/api/admin/documents' or urlparse(self.path).path.startswith('/api/admin/documents/'):
            self.admin_documents('GET')
            return
        if self.path == '/api/admin/accounts':
            self.admin_accounts()
            return
        if self.path != '/api/session':
            self.respond(404, {'message': 'Not found.'})
            return
        token = self.session_token()
        session = self.current_session()
        authenticated = bool(session and session['expires'] > time.time())
        if session and not authenticated:
            SESSIONS.pop(token, None)
        self.respond(200, {'authenticated': authenticated, 'isAdmin': bool(authenticated and is_admin_email(session['email'])), 'user': account_profile(session['email']) if authenticated else None})

    def do_POST(self):
        if urlparse(self.path).path == '/api/admin/documents' or urlparse(self.path).path.startswith('/api/admin/documents/'):
            self.admin_documents('POST')
            return
        if self.path in ('/api/forgot-password', '/api/reset-password'):
            self.reset_password()
            return
        if self.path == '/api/admin/accounts':
            self.admin_action()
            return
        if self.path == '/api/change-password':
            self.change_password()
            return
        if self.path == '/api/logout':
            token = self.session_token()
            SESSIONS.pop(token, None)
            self.respond(200, {'message': 'Signed out.'}, 'solvai_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0')
            return
        if self.path not in ('/api/login', '/api/register'):
            self.respond(404, {'message': 'Not found.'})
            return
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 8192:
                raise ValueError()
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                raise ValueError()
            email = data.get('email', '')
            if not isinstance(email, str) or len(email) > 254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
                raise ValueError()
        except (ValueError, TypeError, UnicodeDecodeError):
            self.respond(400, {'message': 'Please provide a valid email address.'})
            return
        password = data.get('password', '')
        if not isinstance(password, str) or not 1 <= len(password) <= 1024:
            self.respond(400, {'message': 'Please provide a password of at most 1024 characters.'})
            return
        if self.path == '/api/login':
            with database() as db:
                account = db.execute('SELECT salt, password_hash, disabled FROM accounts WHERE email = ?', (email.casefold(),)).fetchone()
            valid = bool(account and hmac.compare_digest(password_hash(password, account[0]), account[1]))
            if not valid:
                self.respond(401, {'message': 'Email or password is incorrect.'})
                return
            if account[2]:
                self.respond(403, {'message': 'Your account is disabled. Please contact an administrator.'})
                return
            token = secrets.token_urlsafe(32)
            duration = 604800 if data.get('remember') == 'true' else 3600
            SESSIONS[token] = {'email': email, 'expires': time.time() + duration}
            cookie = f'solvai_session={token}; HttpOnly; SameSite=Strict; Path=/'
            if data.get('remember') == 'true':
                cookie += '; Max-Age=604800'
            self.respond(200, {'message': 'You are signed in to PASION.', 'isAdmin': is_admin_email(email), 'user': account_profile(email)}, cookie)
        else:
            name = data.get('name', '')
            if not isinstance(name, str) or not 1 <= len(name.strip()) <= 100:
                self.respond(400, {'message': 'Please provide your full name.'})
                return
            if len(password) < 8:
                self.respond(400, {'message': 'Use a password with at least 8 characters.'})
                return
            if email.casefold() in (EMAIL.casefold(), ADMIN_EMAIL):
                self.respond(409, {'message': 'An account with this email already exists. Please sign in.'})
                return
            salt = secrets.token_bytes(16)
            hashed = password_hash(password, salt)
            try:
                with database() as db:
                    db.execute('INSERT INTO accounts (email, name, salt, password_hash, created) VALUES (?, ?, ?, ?, ?)', (email.casefold(), name.strip(), salt, hashed, time.time()))
            except sqlite3.IntegrityError:
                self.respond(409, {'message': 'An account with this email already exists. Please sign in.'})
                return
            self.respond(201, {'message': 'Account created. You can now sign in.'})

    def do_DELETE(self):
        if urlparse(self.path).path.startswith('/api/admin/documents/'):
            self.admin_documents('DELETE')
            return
        self.respond(404, {'message': 'Not found.'})

if __name__ == '__main__':
    try:
        http = ExclusiveHTTPServer(('127.0.0.1', 8000), Handler)
    except OSError as error:
        raise SystemExit('Unable to start PASION API on 127.0.0.1:8000. Another backend may already be running. Stop it before starting a new instance. ' + str(error))
    document_service.resume_processing(ROOT)
    print('PASION API running at http://127.0.0.1:8000', flush=True)
    http.serve_forever()
