"""SMTP delivery; credentials remain on the backend."""
import json
import os
import smtplib
import ssl
from email.message import EmailMessage


class MailUnavailable(Exception):
    pass


def mail_settings(root):
    path = root / 'mail-config.json'
    try:
        config = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
        if not isinstance(config, dict):
            raise ValueError()
        for key in ('host', 'port', 'username', 'password', 'from', 'security'):
            value = os.environ.get('SMTP_' + key.upper())
            if value:
                config[key] = value
        config.setdefault('port', 465)
        config.setdefault('security', 'ssl')
        config.setdefault('from', config.get('username', ''))
        if not all(isinstance(config.get(key), str) and config[key] for key in ('host', 'username', 'password', 'from')):
            raise ValueError()
        if any('\r' in config[key] or '\n' in config[key] for key in ('host', 'username', 'from')):
            raise ValueError()
        config['port'] = int(config['port'])
        if not 1 <= config['port'] <= 65535:
            raise ValueError()
        if config['security'] not in ('ssl', 'starttls'):
            raise ValueError()
        return config
    except (ValueError, TypeError, OSError):
        raise MailUnavailable('Email delivery is not configured. Please contact the administrator.') from None


def send_reset_email(recipient, code, config):
    message = EmailMessage()
    message['Subject'] = 'Your PASION password reset code'
    message['From'] = config['from']
    message['To'] = recipient
    message.set_content('Your PASION password reset code is: ' + code + '\n\n'
                        'This code expires in 10 minutes and can only be used once.\n'
                        'If you did not request a password reset, ignore this email.\n'
                        'Never share this code with anyone.')
    try:
        connection = smtplib.SMTP_SSL if config['security'] == 'ssl' else smtplib.SMTP
        kwargs = {'timeout': 20}
        if config['security'] == 'ssl':
            kwargs['context'] = ssl.create_default_context()
        with connection(config['host'], config['port'], **kwargs) as smtp:
            if config['security'] == 'starttls':
                smtp.ehlo()
                smtp.starttls(context=ssl.create_default_context())
                smtp.ehlo()
            smtp.login(config['username'], config['password'])
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException, ValueError):
        raise MailUnavailable('Email delivery is temporarily unavailable. Please try again later.') from None
