import http.client
import json
import secrets
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import server


class ChangePasswordTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.original_root = server.ROOT
        server.ROOT = Path(self.temp.name)
        server.SESSIONS.clear()
        self.email = 'test@example.com'
        salt = secrets.token_bytes(16)
        with server.database() as db:
            db.execute('INSERT INTO accounts (email, name, salt, password_hash) VALUES (?, ?, ?, ?)',
                       (self.email, 'Test', salt, server.password_hash('Original123!', salt)))
        server.SESSIONS['active'] = {'email': self.email, 'expires': time.time() + 3600}
        server.SESSIONS['other'] = {'email': self.email, 'expires': time.time() + 3600}
        self.http = server.ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        self.thread = threading.Thread(target=self.http.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.http.shutdown()
        self.http.server_close()
        self.thread.join()
        server.SESSIONS.clear()
        server.ROOT = self.original_root
        self.temp.cleanup()

    def request(self, path, data, token='active'):
        connection = http.client.HTTPConnection('127.0.0.1', self.http.server_port)
        connection.request('POST', path, json.dumps(data),
                           {'Content-Type': 'application/json', 'Cookie': 'solvai_session=' + token})
        response = connection.getresponse()
        status, body = response.status, json.loads(response.read())
        connection.close()
        return status, body

    def change(self, current='Original123!', new='Updated123!', confirm='Updated123!', token='active'):
        return self.request('/api/change-password',
                            {'currentPassword': current, 'newPassword': new, 'confirmPassword': confirm}, token)

    def test_requires_current_session(self):
        self.assertEqual(self.change(token='missing')[0], 401)
        server.SESSIONS['active']['expires'] = 0
        self.assertEqual(self.change()[0], 401)

    def test_profile_contains_only_name_and_email(self):
        status, data = self.request('/api/login', {'email': self.email, 'password': 'Original123!'})
        self.assertEqual(status, 200)
        self.assertEqual(data['user'], {'name': 'Test', 'email': self.email})
        connection = http.client.HTTPConnection('127.0.0.1', self.http.server_port)
        connection.request('GET', '/api/session', headers={'Cookie': 'solvai_session=active'})
        response = connection.getresponse()
        self.assertEqual(json.loads(response.read())['user'], {'name': 'Test', 'email': self.email})
        connection.close()

    def test_rejects_wrong_password_and_invalid_new_password(self):
        for fields in [{'current': 'Wrong123!'}, {'new': 'short', 'confirm': 'short'},
                       {'confirm': 'Different123!'}, {'new': 'Original123!', 'confirm': 'Original123!'}]:
            self.assertEqual(self.change(**fields)[0], 400)
        self.assertEqual(self.request('/api/login', {'email': self.email, 'password': 'Original123!'})[0], 200)

    def test_change_persists_and_revokes_other_sessions(self):
        self.assertEqual(self.change()[0], 200)
        self.assertIn('active', server.SESSIONS)
        self.assertNotIn('other', server.SESSIONS)
        self.assertEqual(self.request('/api/login', {'email': self.email, 'password': 'Original123!'})[0], 401)
        self.assertEqual(self.request('/api/login', {'email': self.email, 'password': 'Updated123!'})[0], 200)
        with server.database() as db:
            salt, hashed = db.execute('SELECT salt, password_hash FROM accounts WHERE email = ?', (self.email,)).fetchone()
        self.assertEqual(hashed, server.password_hash('Updated123!', salt))
        self.assertNotEqual(hashed, b'Updated123!')

    def test_demo_password_can_be_changed(self):
        server.SESSIONS['active']['email'] = server.EMAIL
        self.assertEqual(self.change(current=server.PASSWORD)[0], 200)
        self.assertEqual(self.request('/api/login', {'email': server.EMAIL, 'password': server.PASSWORD})[0], 401)
        self.assertEqual(self.request('/api/login', {'email': server.EMAIL, 'password': 'Updated123!'})[0], 200)


class AdminTests(unittest.TestCase):
    setUp = ChangePasswordTests.setUp
    tearDown = ChangePasswordTests.tearDown
    request = ChangePasswordTests.request

    def authorize(self):
        salt = secrets.token_bytes(16)
        with server.database() as db:
            db.execute('INSERT INTO accounts (email, name, salt, password_hash) VALUES (?, ?, ?, ?)',
                       (server.ADMIN_EMAIL, 'Admin', salt, server.password_hash('AdminTest123!', salt)))
        server.SESSIONS['admin'] = {'email': server.ADMIN_EMAIL, 'expires': time.time() + 3600}

    def get_accounts(self, token='active'):
        connection = http.client.HTTPConnection('127.0.0.1', self.http.server_port)
        connection.request('GET', '/api/admin/accounts', headers={'Cookie': 'solvai_session=' + token})
        response = connection.getresponse()
        result = response.status, json.loads(response.read())
        connection.close()
        return result

    def test_admin_access_and_no_password_disclosure(self):
        self.assertEqual(self.get_accounts('missing')[0], 401)
        self.assertEqual(self.get_accounts()[0], 403)
        self.assertEqual(self.request('/api/admin/accounts', {'email': self.email, 'action': 'delete'})[0], 403)
        self.authorize()
        status, data = self.get_accounts('admin')
        self.assertEqual(status, 200)
        self.assertEqual([a['email'] for a in data['accounts'] if a['isAdmin']], [server.ADMIN_EMAIL])
        self.assertNotIn('password_hash', json.dumps(data))
        self.assertNotIn('salt', json.dumps(data))

    def test_cannot_disable_delete_or_reset_only_admin(self):
        self.authorize()
        for action in ['disable', 'delete', 'reset-password', 'revoke-admin']:
            self.assertEqual(self.request('/api/admin/accounts', {'email': server.ADMIN_EMAIL, 'action': action, 'password': 'NewTest123!'}, 'admin')[0], 400)

    def test_disable_enable_and_session_revocation(self):
        self.authorize()
        self.assertEqual(self.request('/api/admin/accounts', {'email': self.email, 'action': 'disable'}, 'admin')[0], 200)
        self.assertNotIn('active', server.SESSIONS)
        status, data = self.request('/api/login', {'email': self.email, 'password': 'Original123!'})
        self.assertEqual(status, 403)
        self.assertIn('disabled', data['message'])
        self.assertEqual(self.request('/api/login', {'email': self.email, 'password': 'Wrong123!'})[0], 401)
        self.assertEqual(self.request('/api/admin/accounts', {'email': self.email, 'action': 'enable'}, 'admin')[0], 200)
        self.assertEqual(self.request('/api/login', {'email': self.email, 'password': 'Original123!'})[0], 200)

    def test_rename_reset_delete(self):
        self.authorize()
        self.assertEqual(self.request('/api/admin/accounts', {'email': self.email, 'action': 'rename', 'name': 'Renamed'}, 'admin')[0], 200)
        self.assertEqual(self.request('/api/admin/accounts', {'email': self.email, 'action': 'reset-password', 'password': 'ResetTest123!'}, 'admin')[0], 200)
        self.assertNotIn('active', server.SESSIONS)
        self.assertEqual(self.request('/api/login', {'email': self.email, 'password': 'Original123!'})[0], 401)
        self.assertEqual(self.request('/api/login', {'email': self.email, 'password': 'ResetTest123!'})[0], 200)
        self.assertEqual(self.request('/api/admin/accounts', {'email': self.email, 'action': 'delete'}, 'admin')[0], 200)
        self.assertEqual(self.request('/api/login', {'email': self.email, 'password': 'ResetTest123!'})[0], 401)

    def test_registration_cannot_claim_admin(self):
        self.assertEqual(self.request('/api/register', {'email': server.ADMIN_EMAIL, 'name': 'Pretend', 'password': 'Pretend123!'})[0], 409)
        self.assertEqual(self.request('/api/register', {'email': 'member@example.com', 'name': 'Member', 'password': 'Member123!', 'isAdmin': True})[0], 201)
        status, data = self.request('/api/login', {'email': 'member@example.com', 'password': 'Member123!'})
        self.assertEqual(status, 200)
        self.assertFalse(data['isAdmin'])

    def test_grant_and_revoke_admin_permissions(self):
        self.authorize()
        self.assertEqual(self.request('/api/admin/accounts', {'email': self.email, 'action': 'grant-admin'}, 'admin')[0], 200)
        self.assertEqual(self.get_accounts('active')[0], 200)
        status, body = self.request('/api/login', {'email': self.email, 'password': 'Original123!'})
        self.assertEqual(status, 200)
        self.assertTrue(body['isAdmin'])
        self.assertEqual(self.request('/api/admin/accounts', {'email': self.email, 'action': 'revoke-admin'}, 'admin')[0], 200)
        self.assertNotIn('active', server.SESSIONS)
        self.assertEqual(self.get_accounts('active')[0], 401)
        status, body = self.request('/api/login', {'email': self.email, 'password': 'Original123!'})
        self.assertEqual(status, 200)
        self.assertFalse(body['isAdmin'])

    def test_member_cannot_promote_self_and_disabled_accounts_cannot_be_promoted(self):
        self.assertEqual(self.request('/api/admin/accounts', {'email': self.email, 'action': 'grant-admin'})[0], 403)
        self.authorize()
        self.assertEqual(self.request('/api/admin/accounts', {'email': self.email, 'action': 'disable'}, 'admin')[0], 200)
        self.assertEqual(self.request('/api/admin/accounts', {'email': self.email, 'action': 'grant-admin'}, 'admin')[0], 400)


class PasswordResetTests(unittest.TestCase):
    request = ChangePasswordTests.request
    change = ChangePasswordTests.change

    def setUp(self):
        ChangePasswordTests.setUp(self)
        server.RESET_LIMITS.clear()
        self.settings = patch.object(server, 'mail_settings', return_value={'host': 'mock'})
        self.send = patch.object(server, 'send_reset_email')
        self.settings.start()
        self.delivery = self.send.start()

    def tearDown(self):
        self.settings.stop()
        self.send.stop()
        server.RESET_LIMITS.clear()
        ChangePasswordTests.tearDown(self)

    def code(self):
        status, body = self.request('/api/forgot-password', {'email': self.email}, token='missing')
        self.assertEqual(status, 200)
        code = self.delivery.call_args.args[1]
        self.assertRegex(code, r'^[0-9]{6}$')
        self.assertNotIn(code, json.dumps(body))
        return code

    def reset(self, code, **extra):
        return self.request('/api/reset-password', {'email': self.email, 'code': code,
                            'newPassword': 'Recovered123!', 'confirmPassword': 'Recovered123!', **extra}, 'missing')

    def test_without_login_single_use_and_sessions_revoked(self):
        code = self.code()
        with server.database() as db:
            stored = db.execute('SELECT code_hash FROM password_resets WHERE email = ?', (self.email,)).fetchone()[0]
        self.assertNotEqual(stored, code.encode())
        self.assertEqual(self.reset(code)[0], 200)
        self.assertNotIn('active', server.SESSIONS)
        self.assertNotIn('other', server.SESSIONS)
        self.assertEqual(self.reset(code)[0], 400)
        self.assertEqual(self.request('/api/login', {'email': self.email, 'password': 'Original123!'})[0], 401)
        self.assertEqual(self.request('/api/login', {'email': self.email, 'password': 'Recovered123!'})[0], 200)

    def test_expiry_and_five_attempt_limit(self):
        code = self.code()
        wrong = '000000' if code != '000000' else '111111'
        for _ in range(5):
            self.assertEqual(self.reset(wrong)[0], 400)
        self.assertEqual(self.reset(code)[0], 400)
        with server.database() as db:
            db.execute('UPDATE password_resets SET attempts = 0, expires = 0 WHERE email = ?', (self.email,))
        self.assertEqual(self.reset(code)[0], 400)

    def test_resend_cooldown_replaces_old_code(self):
        with patch.object(server.secrets, 'randbelow', side_effect=[123456, 654321]):
            old = self.code()
            self.assertEqual(self.request('/api/forgot-password', {'email': self.email})[0], 429)
            with server.database() as db:
                db.execute('UPDATE password_resets SET sent_at = 0 WHERE email = ?', (self.email,))
            new = self.code()
        self.assertEqual(self.reset(old)[0], 400)
        self.assertEqual(self.reset(new)[0], 200)

    def test_changed_password_invalidates_previous_code(self):
        code = self.code()
        self.assertEqual(self.change()[0], 200)
        self.assertEqual(self.reset(code)[0], 400)

    def test_unknown_and_disabled_accounts_do_not_send(self):
        with server.database() as db:
            db.execute('UPDATE accounts SET disabled = 1 WHERE email = ?', (self.email,))
        first = self.request('/api/forgot-password', {'email': self.email})
        second = self.request('/api/forgot-password', {'email': 'unknown@example.com'})
        self.assertEqual(first, second)
        self.assertEqual(first[0], 200)
        self.delivery.assert_not_called()

    def test_delivery_failure_does_not_claim_email_sent(self):
        self.delivery.side_effect = server.MailUnavailable('Email unavailable.')
        self.assertEqual(self.request('/api/forgot-password', {'email': self.email})[0], 503)
        with server.database() as db:
            self.assertIsNone(db.execute('SELECT 1 FROM password_resets WHERE email = ?', (self.email,)).fetchone())

    def test_ip_rate_limit_and_password_validation(self):
        code = self.code()
        self.assertEqual(self.reset(code, confirmPassword='Mismatch123!')[0], 400)
        self.assertEqual(self.reset(code, newPassword='short', confirmPassword='short')[0], 400)
        for _ in range(9):
            self.assertEqual(self.request('/api/forgot-password', {'email': 'unknown@example.com'})[0], 200)
        self.assertEqual(self.request('/api/forgot-password', {'email': 'unknown@example.com'})[0], 429)


if __name__ == '__main__':
    unittest.main()
