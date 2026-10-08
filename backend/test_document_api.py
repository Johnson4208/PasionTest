import http.client
import importlib.util
import io
import json
import os
import socket
import time
import unittest
from urllib.parse import quote
from unittest.mock import patch

import document_service
import documents
import server
import test_server as account_tests

EXTRACTED = {'name': 'report.docx', 'type': 'docx', 'method': 'text', 'pageCount': None,
             'wordCount': 12, 'warnings': [], 'text': 'Revenue was 250 million. Operating margin was 18%.',
             'sections': [{'id': 'section-1', 'title': 'Revenue', 'page': None, 'kind': 'text',
                           'text': 'Revenue was 250 million. Operating margin was 18%.'}]}
ORIGINAL = b'PK\x03\x04fixture'


class DocumentApiTests(unittest.TestCase):
    setUp = account_tests.ChangePasswordTests.setUp
    tearDown = account_tests.ChangePasswordTests.tearDown
    authorize = account_tests.AdminTests.authorize

    def request(self, method, path, body=None, token='admin', filename=None):
        headers = {'Cookie': 'solvai_session=' + token}
        if filename is not None:
            headers.update({'Content-Type': 'application/octet-stream', 'X-Document-Name': quote(filename)})
        elif body is not None:
            body = json.dumps(body)
            headers['Content-Type'] = 'application/json'
        connection = http.client.HTTPConnection('127.0.0.1', self.http.server_port)
        connection.request(method, path, body, headers)
        response = connection.getresponse()
        content = response.read()
        result = response.status, (content if response.getheader('Content-Type') == 'application/octet-stream' else json.loads(content))
        connection.close()
        return result

    def upload(self):
        with patch.object(document_service, '_submit_processing') as submit:
            status, result = self.request('POST', '/api/admin/documents', ORIGINAL, filename='report.docx')
        self.assertEqual(status, 202)
        with patch.object(document_service, 'extract_document', return_value=EXTRACTED):
            document_service._extraction_worker(*submit.call_args.args)
        return document_service.get_document(server.ROOT, result['document']['id'])

    def test_upload_acknowledges_saved_original_without_waiting_for_extraction(self):
        self.authorize()
        with patch.object(document_service, '_submit_processing') as submit, patch.object(document_service, 'extract_document') as extract:
            status, result = self.request('POST', '/api/admin/documents', ORIGINAL, filename='report.docx')
            self.assertEqual(status, 202)
            document = result['document']
            self.assertEqual(document['status'], 'processing')
            self.assertEqual(document['processingStage'], 'queued')
            self.assertTrue(document['hasOriginal'])
            self.assertEqual(document['size'], len(ORIGINAL))
            self.assertEqual(document['text'], '')
            self.assertNotIn('_processingToken', document)
            extract.assert_not_called()
            submit.assert_called_once()
        self.assertEqual(document_service.get_original(server.ROOT, document['id']), ('report.docx', ORIGINAL))
        path = '/api/admin/documents/' + document['id']
        self.assertEqual(self.request('GET', path + '/download'), (200, ORIGINAL))
        self.assertEqual(self.request('GET', path + '/search?q=revenue')[0], 409)

    def test_incomplete_upload_has_a_finite_timeout(self):
        self.authorize()
        connection = socket.create_connection(('127.0.0.1', self.http.server_port), timeout=3)
        with patch.object(server, 'UPLOAD_READ_TIMEOUT', .05):
            connection.sendall(b'POST /api/admin/documents HTTP/1.0\r\nCookie: solvai_session=admin\r\nContent-Length: 100\r\nX-Document-Name: report.pdf\r\n\r\n%PDF-')
            response = http.client.HTTPResponse(connection)
            response.begin()
            self.assertEqual(response.status, 408)
            self.assertIn('timed out', json.loads(response.read())['message'])
        connection.close()
        self.assertFalse((server.ROOT / 'documents.sqlite3').exists())

    def wait_until_processed(self, document_id):
        deadline = time.monotonic() + 65
        while time.monotonic() < deadline:
            document = self.request('GET', '/api/admin/documents/' + document_id)[1]['document']
            if document['status'] != 'processing':
                return document
            time.sleep(.5)
        self.fail('Document extraction never finished')

    @unittest.skipUnless(importlib.util.find_spec('pymupdf'), 'PyMuPDF is not installed')
    def test_real_pdf_upload_returns_promptly_then_becomes_ready_and_downloads_original(self):
        import pymupdf
        self.authorize()
        with pymupdf.open() as pdf:
            page = pdf.new_page()
            page.insert_text((72, 72), 'Revenue was 250 million dollars.', fontsize=14)
            content = pdf.tobytes()
        started = time.monotonic()
        status, result = self.request('POST', '/api/admin/documents', content, filename='real.pdf')
        self.assertEqual(status, 202)
        self.assertLess(time.monotonic() - started, 2)
        self.assertEqual(result['document']['status'], 'processing')
        document = self.wait_until_processed(result['document']['id'])
        self.assertEqual(document['status'], 'ready', document['error'])
        self.assertIn('Revenue was 250 million', document['text'])
        self.assertEqual(self.request('GET', '/api/admin/documents/' + document['id'] + '/download'), (200, content))

    @unittest.skipUnless(importlib.util.find_spec('rapidocr_onnxruntime') and importlib.util.find_spec('PIL'), 'Local OCR is not installed')
    def test_real_ocr_worker_process_reads_generated_image(self):
        from PIL import Image, ImageDraw, ImageFont
        self.authorize()
        picture = Image.new('RGB', (1100, 220), 'white')
        font = ImageFont.load_default(size=52)
        ImageDraw.Draw(picture).text((40, 70), 'Revenue 120 million dollars', font=font, fill='black')
        buffer = io.BytesIO()
        picture.save(buffer, format='PNG')
        content = buffer.getvalue()
        status, result = self.request('POST', '/api/admin/documents', content, filename='real-scan.png')
        self.assertEqual(status, 202)
        document = self.wait_until_processed(result['document']['id'])
        self.assertEqual(document['status'], 'ready', document['error'])
        self.assertIn('120', document['text'])
        self.assertIn('million', document['text'])
        self.assertEqual(self.request('GET', '/api/admin/documents/' + document['id'] + '/download'), (200, content))

    def test_every_document_operation_requires_current_admin(self):
        paths = [('GET', '/api/admin/documents', None),
                 ('POST', '/api/admin/documents', b'file'),
                 ('GET', '/api/admin/documents/' + 'a' * 32, None),
                 ('GET', '/api/admin/documents/' + 'a' * 32 + '/search?q=revenue', None),
                 ('POST', '/api/admin/documents/' + 'a' * 32 + '/ask', {'question': 'Revenue?'}),
                 ('POST', '/api/admin/documents/' + 'a' * 32 + '/retry', None),
                 ('GET', '/api/admin/documents/' + 'a' * 32 + '/download', None),
                 ('DELETE', '/api/admin/documents/' + 'a' * 32, None)]
        with patch.object(document_service, 'save_upload') as extract:
            for method, path, body in paths:
                for token, expected in [('missing', 401), ('active', 403)]:
                    filename = 'file.pdf' if isinstance(body, bytes) else None
                    self.assertEqual(self.request(method, path, body, token, filename)[0], expected)
            extract.assert_not_called()
        self.assertFalse((server.ROOT / 'documents.sqlite3').exists())

    def test_upload_persists_metadata_searches_and_deletes(self):
        self.authorize()
        document = self.upload()
        status, result = self.request('GET', '/api/admin/documents')
        self.assertEqual(status, 200)
        self.assertEqual(result['documents'][0]['name'], 'report.docx')
        self.assertNotIn('text', result['documents'][0])
        self.assertNotIn('key', result['capabilities'])
        path = '/api/admin/documents/' + document['id']
        self.assertEqual(self.request('GET', path)[1]['document']['text'], EXTRACTED['text'])
        self.assertEqual(self.request('GET', path + '/download'), (200, ORIGINAL))
        self.assertEqual(self.request('GET', '/api/admin/documents?type=pdf')[1]['documents'], [])
        self.assertEqual(len(self.request('GET', '/api/admin/documents?type=docx&q=250')[1]['documents']), 1)
        status, result = self.request('GET', path + '/search?q=revenue')
        self.assertEqual(status, 200)
        self.assertEqual(result['matches'][0]['sectionId'], 'section-1')
        self.assertEqual(self.request('GET', path + '/search?q=absentvalue')[1]['matches'], [])
        self.assertEqual(self.request('DELETE', path)[0], 200)
        self.assertEqual(self.request('GET', path)[0], 404)
        self.assertEqual(self.request('GET', '/api/admin/documents')[1]['documents'], [])

    def test_rejects_empty_upload_bad_search_and_unconfigured_ai(self):
        self.authorize()
        self.assertEqual(self.request('POST', '/api/admin/documents', b'', filename='report.docx')[0], 413)
        self.assertEqual(self.request('POST', '/api/admin/documents', b'bad magic', filename='report.docx')[0], 400)
        document = self.upload()
        path = '/api/admin/documents/' + document['id']
        self.assertEqual(self.request('GET', path + '/search?q=')[0], 400)
        self.assertEqual(self.request('GET', '/api/admin/documents/../../accounts')[0], 404)
        with patch.dict(os.environ, {}, clear=True), patch.object(document_service, 'request_ai') as ai:
            self.assertFalse(self.request('GET', '/api/admin/documents')[1]['capabilities']['aiAvailable'])
            self.assertEqual(self.request('POST', path + '/ask', {'question': 'What was revenue?'})[0], 503)
            ai.assert_not_called()

    def test_retry_keeps_original_and_returns_processing_state(self):
        self.authorize()
        with patch.object(document_service, '_submit_processing') as submit:
            _, result = self.request('POST', '/api/admin/documents', ORIGINAL, filename='report.docx')
            root, document_id, token = submit.call_args.args
            document_service._update_processing(root, document_id, token, status='failed', processingStage='failed', error='OCR unavailable')
            status, result = self.request('POST', '/api/admin/documents/' + document_id + '/retry')
            self.assertEqual(status, 202)
            self.assertEqual(result['document']['status'], 'processing')
            self.assertIsNone(result['document']['error'])
            self.assertNotEqual(submit.call_args.args[2], token)
            self.assertEqual(self.request('POST', '/api/admin/documents/' + document_id + '/retry')[0], 409)
        self.assertEqual(self.request('GET', '/api/admin/documents/' + document_id + '/download'), (200, ORIGINAL))

    def test_revoked_or_disabled_admin_cannot_read_documents(self):
        self.authorize()
        document = self.upload()
        with server.database() as db:
            db.execute('UPDATE accounts SET is_admin = 1 WHERE email = ?', (self.email,))
        self.assertEqual(self.request('GET', '/api/admin/documents', token='active')[0], 200)
        with server.database() as db:
            db.execute('UPDATE accounts SET is_admin = 0 WHERE email = ?', (self.email,))
        self.assertEqual(self.request('GET', '/api/admin/documents/' + document['id'], token='active')[0], 403)
        self.assertEqual(self.request('GET', '/api/admin/documents/' + document['id'] + '/download', token='active')[0], 403)
        self.assertEqual(self.request('POST', '/api/admin/documents/' + document['id'] + '/retry', token='active')[0], 403)
        with server.database() as db:
            db.execute('UPDATE accounts SET is_admin = 1, disabled = 1 WHERE email = ?', (self.email,))
        self.assertEqual(self.request('GET', '/api/admin/documents', token='active')[0], 401)

    def test_ai_answers_cite_only_excerpts_from_selected_document(self):
        self.authorize()
        document = self.upload()
        config = {'DOCUMENT_AI_PROVIDER': 'openai', 'DOCUMENT_AI_MODEL': 'test-model', 'OPENAI_API_KEY': 'test-secret'}
        with patch.dict(os.environ, config, clear=True), patch.object(document_service, 'request_ai', return_value=json.dumps({
                'answer': 'Revenue was 250 million.', 'sectionIds': ['section-1', 'unknown', 'section-1']})) as ai:
            status, result = self.request('POST', '/api/admin/documents/' + document['id'] + '/ask',
                                          {'question': 'What was revenue?', 'language': 'fr'})
            self.assertEqual(status, 200)
            self.assertEqual(result['citations'], [{'sectionId': 'section-1', 'title': 'Revenue', 'page': None}])
            self.assertIn('250 million', ai.call_args[0][2])
            self.assertIn('untrusted', ai.call_args[0][1])
            self.assertIn('Write the answer in French.', ai.call_args[0][1])
            self.assertEqual(result['warnings'], [])
            self.assertNotIn('test-secret', json.dumps(result))

    def test_partial_summary_keeps_provider_text_and_returns_a_separate_warning(self):
        document = {**EXTRACTED, 'sections': [{**EXTRACTED['sections'][0], 'text': 'Revenue ' * 8000}]}
        config = {'DOCUMENT_AI_PROVIDER': 'ollama', 'DOCUMENT_AI_MODEL': 'test-model'}
        with patch.dict(os.environ, config, clear=True), patch.object(document_service, 'request_ai',
                return_value=json.dumps({'answer': 'Revenus annuels.', 'sectionIds': ['section-1']})) as ai:
            result = document_service.ask_document(document, mode='summary', language='fr')
            self.assertEqual(result['answer'], 'Revenus annuels.')
            self.assertEqual(result['warnings'], [
                'This summary uses selected excerpts. Review the extracted document for complete details.'])
            self.assertIn('Write the answer in French.', ai.call_args[0][1])

    def test_ai_adapter_handles_openai_outputs_and_ollama_json_without_live_calls(self):
        openai_result = {'status': 'completed', 'output': [{'type': 'reasoning'},
                         {'type': 'message', 'content': [{'type': 'output_text', 'text': '{"answer":"Example","sectionIds":[]}'}]}]}
        settings = {'provider': 'openai', 'model': 'test-model', 'key': 'secret', 'url': ''}
        with patch.object(document_service, 'urlopen') as network:
            network.return_value.__enter__.return_value.read.return_value = json.dumps(openai_result).encode()
            answer = document_service.request_ai(settings, 'instructions', 'prompt')
            payload = json.loads(network.call_args[0][0].data)
            self.assertFalse(payload['store'])
            self.assertIn('Example', answer)
        settings.update(provider='ollama', url='http://127.0.0.1:11434')
        with patch.object(document_service, 'urlopen') as network:
            network.return_value.__enter__.return_value.read.return_value = b'{"response":"{\\"answer\\":\\"Local\\",\\"sectionIds\\":[]}"}'
            self.assertIn('Local', document_service.request_ai(settings, 'instructions', 'prompt'))
            self.assertFalse(json.loads(network.call_args[0][0].data)['stream'])


if __name__ == '__main__':
    unittest.main()
