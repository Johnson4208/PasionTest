"""Run locally in a terminal. Never put email credentials into chat."""
import getpass
import json
from pathlib import Path

print('Configure the SMTP sender for PASION password reset emails.')
host = input('SMTP host [smtp.gmail.com]: ').strip() or 'smtp.gmail.com'
port = int(input('SMTP port [465]: ').strip() or '465')
security = input('Security: ssl or starttls [ssl]: ').strip() or 'ssl'
username = input('Sender email / SMTP username: ').strip()
sender = input('From email [same as username]: ').strip() or username
password = getpass.getpass('SMTP app password (hidden): ')
if not username or not sender or not password or security not in ('ssl', 'starttls'):
    raise SystemExit('Missing or invalid SMTP settings; nothing saved.')
path = Path(__file__).resolve().parent / 'mail-config.json'
path.write_text(json.dumps({'host': host, 'port': port, 'security': security,
                            'username': username, 'from': sender, 'password': password}, indent=2), encoding='utf-8')
print('Email settings saved locally. The server reads these settings on each code request.')
