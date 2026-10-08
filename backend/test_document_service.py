import importlib.util
import json
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path
from unittest.mock import Mock, patch

import document_service
from documents import DocumentError
from test_document_api import EXTRACTED, ORIGINAL
from test_documents import docx_fixture


class DocumentStorageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.submit_patch = patch.object(document_service, '_submit_processing')
        self.submit = self.submit_patch.start()

    def tearDown(self):
        self.submit_patch.stop()
        self.temp.cleanup()

    def upload(self, filename='report.docx', content=ORIGINAL):
        document = document_service.save_upload(self.root, filename, content)
        return document, self.submit.call_args.args[2]

    def test_migrates_existing_library_and_preserves_legacy_extracted_documents(self):
        legacy = {**EXTRACTED, 'id': 'a' * 32, 'created': 100}
        with closing(sqlite3.connect(self.root / 'documents.sqlite3')) as database, database:
            database.execute('CREATE TABLE documents (id TEXT PRIMARY KEY, created REAL NOT NULL, content TEXT NOT NULL)')
            database.execute('INSERT INTO documents VALUES (?, ?, ?)', (legacy['id'], 100, json.dumps(legacy)))
        result = document_service.get_document(self.root, legacy['id'])
        self.assertEqual(result['text'], EXTRACTED['text'])
        self.assertEqual(result['status'], 'ready')
        self.assertFalse(result['hasOriginal'])
        with self.assertRaisesRegex(DocumentError, 'original file is unavailable'):
            document_service.get_original(self.root, legacy['id'])
        newer = document_service.save_document(self.root, EXTRACTED)
        self.assertEqual(newer['status'], 'ready')
        self.assertEqual(len(document_service.list_documents(self.root)), 2)
        document_service.delete_document(self.root, legacy['id'])
        self.assertEqual(len(document_service.list_documents(self.root)), 1)

    def test_restart_recovers_durable_pending_upload_and_fences_old_worker(self):
        document, old_token = self.upload()
        document_service._update_processing(self.root, document['id'], old_token, processingStage='extracting')
        self.submit.reset_mock()
        document_service._RECOVERED_ROOTS.discard(str(self.root.resolve()))
        document_service.resume_processing(self.root)
        self.submit.assert_called_once()
        new_token = self.submit.call_args.args[2]
        self.assertNotEqual(old_token, new_token)
        document_service._update_processing(self.root, document['id'], old_token, **EXTRACTED, status='ready')
        self.assertEqual(document_service.get_document(self.root, document['id'])['status'], 'processing')
        with patch.object(document_service, 'extract_document', return_value=EXTRACTED):
            document_service._extraction_worker(self.root, document['id'], new_token)
        result = document_service.get_document(self.root, document['id'])
        self.assertEqual(result['status'], 'ready')
        self.assertEqual(result['text'], EXTRACTED['text'])
        self.assertEqual(document_service.get_original(self.root, document['id'])[1], ORIGINAL)
        document_service.resume_processing(self.root)
        self.submit.assert_called_once()

    def test_processing_failure_keeps_original_and_retry_uses_new_worker_token(self):
        document, token = self.upload()
        with patch.object(document_service, 'extract_document', side_effect=DocumentError('Install the local OCR dependencies.', 503)):
            document_service._extraction_worker(self.root, document['id'], token)
        failed = document_service.get_document(self.root, document['id'])
        self.assertEqual(failed['status'], 'failed')
        self.assertIn('OCR dependencies', failed['error'])
        self.assertEqual(document_service.get_original(self.root, document['id'])[1], ORIGINAL)
        result = document_service.retry_document(self.root, document['id'])
        self.assertEqual(result['status'], 'processing')
        self.assertNotEqual(token, self.submit.call_args.args[2])
        document_service._update_processing(self.root, document['id'], token, status='failed', error='old result')
        self.assertEqual(document_service.get_document(self.root, document['id'])['status'], 'processing')

    def test_deleted_document_cannot_be_recreated_by_a_finishing_worker(self):
        document, token = self.upload()
        document_service.delete_document(self.root, document['id'])
        document_service._update_processing(self.root, document['id'], token, **EXTRACTED, status='ready')
        self.assertEqual(document_service.list_documents(self.root), [])

    def test_library_limit_is_atomic_during_concurrent_uploads(self):
        document_service.resume_processing(self.root)

        def upload(_):
            try:
                document_service.save_upload(self.root, 'report.docx', ORIGINAL)
                return 'saved'
            except DocumentError as error:
                return error.status

        with patch.object(document_service, 'MAX_DOCUMENTS', 1), ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(upload, range(2)))
        self.assertCountEqual(results, ['saved', 409])
        self.assertEqual(len(document_service.list_documents(self.root)), 1)

    def test_date_filters_exclude_next_day_midnight_and_preserve_ordering(self):
        with patch.object(document_service.time, 'time', return_value=1790985600):  # 2026-10-03 00:00 UTC
            first = document_service.save_document(self.root, EXTRACTED)
        with patch.object(document_service.time, 'time', return_value=1791072000):
            second = document_service.save_document(self.root, {**EXTRACTED, 'name': 'later.docx'})
        filtered = document_service.list_documents(self.root, start='2026-10-03', end='2026-10-03')
        self.assertEqual([doc['id'] for doc in filtered], [first['id']])
        self.assertEqual([doc['id'] for doc in document_service.list_documents(self.root, order='oldest')], [first['id'], second['id']])
        with self.assertRaises(DocumentError):
            document_service.list_documents(self.root, start='invalid-date')

    def test_native_worker_timeout_kills_process_and_returns_failed_state(self):
        document, token = self.upload()
        actual_popen = subprocess.Popen
        processes = []

        def hung_worker(_command, **kwargs):
            process = actual_popen([sys.executable, '-c', 'import time; time.sleep(30)'], **kwargs)
            processes.append(process)
            return process

        started = time.monotonic()
        with patch.object(document_service, 'PROCESS_TIMEOUT', .15), patch.object(document_service.subprocess, 'Popen', side_effect=hung_worker):
            document_service._run_processing(self.root, document['id'], token)
        self.assertLess(time.monotonic() - started, 5)
        self.assertIsNotNone(processes[0].poll())
        failed = document_service.get_document(self.root, document['id'])
        self.assertEqual(failed['status'], 'failed')
        self.assertIn('time limit', failed['error'])
        self.assertEqual(document_service.get_original(self.root, document['id'])[1], ORIGINAL)

    def test_worker_crash_and_startup_failure_do_not_leave_processing_spinner(self):
        document, token = self.upload()
        with patch.object(document_service.subprocess, 'Popen', return_value=Mock(returncode=1)):
            document_service._run_processing(self.root, document['id'], token)
        self.assertEqual(document_service.get_document(self.root, document['id'])['status'], 'failed')
        document_service.retry_document(self.root, document['id'])
        token = self.submit.call_args.args[2]
        with patch.object(document_service.subprocess, 'Popen', side_effect=OSError('process unavailable')):
            document_service._run_processing(self.root, document['id'], token)
        self.assertEqual(document_service.get_document(self.root, document['id'])['status'], 'failed')

    @unittest.skipUnless(importlib.util.find_spec('docx'), 'python-docx is not installed')
    def test_real_worker_process_extracts_saved_docx(self):
        content = docx_fixture()
        document, token = self.upload(content=content)
        document_service._run_processing(self.root, document['id'], token)
        result = document_service.get_document(self.root, document['id'])
        self.assertEqual(result['status'], 'ready', result['error'])
        self.assertIn('120 million', result['text'])
        self.assertEqual(document_service.get_original(self.root, document['id'])[1], content)


if __name__ == '__main__':
    unittest.main()
