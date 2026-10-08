import smtplib
import unittest
from unittest.mock import patch

from mailer import MailUnavailable, send_reset_email


class MailerTests(unittest.TestCase):
    config = {'host': 'smtp.example.com', 'port': 465, 'security': 'ssl',
              'username': 'sender@example.com', 'password': 'test-app-password', 'from': 'sender@example.com'}

    def test_ssl_message_and_recipient(self):
        with patch('mailer.smtplib.SMTP_SSL') as connection:
            smtp = connection.return_value.__enter__.return_value
            send_reset_email('recipient@example.com', '012345', self.config)
            smtp.login.assert_called_once_with('sender@example.com', 'test-app-password')
            message = smtp.send_message.call_args.args[0]
            self.assertEqual(message['To'], 'recipient@example.com')
            self.assertEqual(message['From'], 'sender@example.com')
            self.assertIn('012345', message.get_content())
            self.assertIn('10 minutes', message.get_content())
            self.assertIsNotNone(connection.call_args.kwargs['context'])

    def test_starttls_encrypts_before_login(self):
        with patch('mailer.smtplib.SMTP') as connection:
            smtp = connection.return_value.__enter__.return_value
            send_reset_email('recipient@example.com', '012345', {**self.config, 'security': 'starttls', 'port': 587})
            methods = [call[0] for call in smtp.method_calls]
            self.assertLess(methods.index('starttls'), methods.index('login'))

    def test_authentication_failure_hides_provider_details(self):
        with patch('mailer.smtplib.SMTP_SSL') as connection:
            smtp = connection.return_value.__enter__.return_value
            smtp.login.side_effect = smtplib.SMTPAuthenticationError(535, b'sensitive provider response')
            with self.assertRaises(MailUnavailable) as error:
                send_reset_email('recipient@example.com', '012345', self.config)
            self.assertNotIn('sensitive', str(error.exception))
            smtp.send_message.assert_not_called()


if __name__ == '__main__':
    unittest.main()
