"""Provision the single admin account; reads its initial password from stdin."""
import secrets
import sys
import time

from server import ADMIN_EMAIL, database, password_hash

password = sys.stdin.readline().rstrip('\r\n')
if not 8 <= len(password) <= 1024:
    raise SystemExit('Admin password must have 8 to 1024 characters.')
salt = secrets.token_bytes(16)
with database() as db:
    db.execute('INSERT INTO accounts (email, name, salt, password_hash, created) VALUES (?, ?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET salt=excluded.salt, password_hash=excluded.password_hash, disabled=0',
               (ADMIN_EMAIL, 'Eyyub Xankisiyev', salt, password_hash(password, salt), time.time()))
print('Administrator account provisioned. Password stored only as a salted hash.')
