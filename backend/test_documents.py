import importlib.util
import io
import unittest
import zipfile
from unittest.mock import patch

import documents


WORD_NAMESPACE = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'


def docx_fixture(body=None, extras=None, compression=zipfile.ZIP_DEFLATED):
    body = body or '''<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Financial results</w:t></w:r></w:p>
      <w:p><w:r><w:t>Revenue increased to 120 million dollars.</w:t></w:r></w:p>
      <w:tbl><w:tblPr/><w:tblGrid><w:gridCol w:w="2000"/><w:gridCol w:w="2000"/></w:tblGrid>
        <w:tr><w:tc><w:p><w:r><w:t>Metric</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Value</w:t></w:r></w:p></w:tc></w:tr>
        <w:tr><w:tc><w:p><w:r><w:t>Revenue</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>120 million</w:t></w:r></w:p></w:tc></w:tr>
      </w:tbl><w:p><w:r><w:t>Margin improved after the quarter.</w:t></w:r></w:p>'''
    parts = {
        '[Content_Types].xml': '''<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
          <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
          <Default Extension="xml" ContentType="application/xml"/>
          <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
          <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
        </Types>''',
        '_rels/.rels': '''<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
        </Relationships>''',
        'word/document.xml': f'<w:document xmlns:w="{WORD_NAMESPACE}"><w:body>{body}<w:sectPr/></w:body></w:document>',
        'word/_rels/document.xml.rels': '''<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
        </Relationships>''',
        'word/styles.xml': f'''<w:styles xmlns:w="{WORD_NAMESPACE}">
          <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
          <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/></w:style>
        </w:styles>''',
    }
    parts.update(extras or {})
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', compression=compression) as archive:
        for name, content in parts.items():
            archive.writestr(name, content)
    return buffer.getvalue()


def image_fixture(format='PNG'):
    from PIL import Image, ImageDraw
    image = Image.new('RGB', (600, 140), 'white')
    ImageDraw.Draw(image).text((20, 30), 'Revenue 120 million dollars', fill='black')
    buffer = io.BytesIO()
    image.save(buffer, format=format)
    return buffer.getvalue()


OCR_LINES = [{'text': 'Revenue 120 million dollars', 'confidence': .98, 'bbox': [20, 30, 400, 60]}]


class ValidationTests(unittest.TestCase):
    def test_extension_and_magic_must_agree(self):
        with self.assertRaisesRegex(documents.DocumentError, 'do not match'):
            documents.extract_document('report.pdf', b'plain text pretending to be a PDF')
        with self.assertRaisesRegex(documents.DocumentError, 'Unsupported') as error:
            documents.extract_document('report.exe', b'not a document')
        self.assertEqual(error.exception.status, 415)

    def test_empty_and_oversized_files_are_rejected_before_parsing(self):
        with self.assertRaisesRegex(documents.DocumentError, 'empty'):
            documents.extract_document('report.pdf', b'')
        with self.assertRaisesRegex(documents.DocumentError, '10 MB') as error:
            documents.extract_document('report.pdf', b'%PDF-' + b'x' * documents.MAX_FILE_SIZE)
        self.assertEqual(error.exception.status, 413)

    def test_legacy_word_has_a_useful_conversion_request(self):
        with self.assertRaisesRegex(documents.DocumentError, 'Save the document as .docx or PDF') as error:
            documents.extract_document('legacy.doc', b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1')
        self.assertEqual(error.exception.status, 415)

    def test_docx_rejects_other_archives_and_path_traversal(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w') as archive:
            archive.writestr('hello.txt', 'This is not a Word document')
        with self.assertRaisesRegex(documents.DocumentError, 'not a valid DOCX'):
            documents.extract_document('renamed.docx', buffer.getvalue())
        with self.assertRaisesRegex(documents.DocumentError, 'invalid file paths'):
            documents.extract_document('unsafe.docx', docx_fixture(extras={'../outside.txt': 'escape'}))

    def test_docx_rejects_zip_bomb_and_invalid_xml(self):
        with self.assertRaisesRegex(documents.DocumentError, 'unsafe compression') as error:
            documents.extract_document('bomb.docx', docx_fixture(extras={'word/padding.bin': b'A' * 100_000}))
        self.assertEqual(error.exception.status, 413)
        with self.assertRaisesRegex(documents.DocumentError, 'invalid XML'):
            documents.extract_document('broken.docx', docx_fixture(extras={'word/document.xml': '<broken'}))

    def test_docx_rejects_xml_entities_including_utf16(self):
        entity_xml = '<?xml version="1.0" encoding="UTF-16"?><!DOCTYPE test [<!ENTITY hello "secret">]><test>&hello;</test>'
        with self.assertRaisesRegex(documents.DocumentError, 'entities'):
            documents.extract_document('entity.docx', docx_fixture(extras={'word/entity.xml': entity_xml.encode('utf-16')}))

    def test_macro_content_is_rejected_even_when_renamed_docx(self):
        with self.assertRaisesRegex(documents.DocumentError, 'macro-enabled') as error:
            documents.extract_document('macro.docx', docx_fixture(extras={'word/vbaProject.bin': b'macro'}))
        self.assertEqual(error.exception.status, 415)

    def test_missing_parser_dependency_is_an_honest_service_error(self):
        with patch('documents.importlib.import_module', side_effect=ImportError('missing')):
            with self.assertRaisesRegex(documents.DocumentError, 'PDF extraction is unavailable') as error:
                documents.extract_document('report.pdf', b'%PDF-1.7\n')
        self.assertEqual(error.exception.status, 503)

    def test_missing_ocr_dependency_does_not_generate_placeholder_text(self):
        with patch('documents._OCR_ENGINE', None), patch('documents.importlib.import_module', side_effect=ImportError('missing')):
            with self.assertRaisesRegex(documents.DocumentError, 'Local OCR is unavailable') as error:
                documents._ocr_image(b'valid input would require an installed OCR engine')
        self.assertEqual(error.exception.status, 503)


@unittest.skipUnless(importlib.util.find_spec('docx'), 'python-docx is not installed')
class WordTests(unittest.TestCase):
    def test_real_docx_preserves_headings_tables_and_document_order(self):
        result = documents.extract_document('C:\\uploads\\report.docx', docx_fixture())
        self.assertEqual(result['name'], 'report.docx')
        self.assertEqual((result['type'], result['method'], result['pageCount']), ('docx', 'text', None))
        self.assertEqual([section['kind'] for section in result['sections']], ['text', 'table', 'text'])
        self.assertEqual(result['sections'][0]['title'], 'Financial results')
        self.assertEqual(result['sections'][1]['table'], [['Metric', 'Value'], ['Revenue', '120 million']])
        self.assertTrue(all(section['page'] is None for section in result['sections']))
        self.assertIn('Revenue increased', result['text'])
        self.assertIn('Margin improved', result['text'])
        self.assertTrue(result['warnings'])

    def test_extracted_text_limit_is_enforced_on_real_word_content(self):
        body = '<w:p><w:r><w:t>' + ('word ' * 45_000) + '</w:t></w:r></w:p>'
        with self.assertRaisesRegex(documents.DocumentError, '200,000 character') as error:
            documents.extract_document('too-long.docx', docx_fixture(body=body, compression=zipfile.ZIP_STORED))
        self.assertEqual(error.exception.status, 413)


@unittest.skipUnless(importlib.util.find_spec('PIL'), 'Pillow is not installed')
class ImageTests(unittest.TestCase):
    def test_valid_png_jpeg_webp_are_decoded_before_ocr(self):
        for extension, format in [('.png', 'PNG'), ('.jpg', 'JPEG'), ('.webp', 'WEBP')]:
            with self.subTest(extension=extension):
                with patch('documents._ocr_image', return_value=OCR_LINES) as engine:
                    result = documents.extract_document('scan' + extension, image_fixture(format))
                self.assertEqual((result['type'], result['method'], result['pageCount']), ('image', 'ocr', 1))
                self.assertEqual(result['text'], OCR_LINES[0]['text'])
                self.assertEqual(result['sections'][0]['page'], 1)
                self.assertEqual(engine.call_args.args[0][:8], b'\x89PNG\r\n\x1a\n')

    def test_invalid_image_never_reaches_ocr(self):
        with patch('documents._ocr_image') as engine:
            with self.assertRaisesRegex(documents.DocumentError, 'damaged'):
                documents.extract_document('broken.png', b'\x89PNG\r\n\x1a\nnot-an-image')
        engine.assert_not_called()

    def test_empty_ocr_is_not_reported_as_success(self):
        with patch('documents._ocr_image', return_value=[]):
            with self.assertRaisesRegex(documents.DocumentError, 'No readable text') as error:
                documents.extract_document('empty.png', image_fixture())
        self.assertEqual(error.exception.status, 422)


@unittest.skipUnless(importlib.util.find_spec('pymupdf'), 'PyMuPDF is not installed')
class PdfTests(unittest.TestCase):
    def test_scanned_cover_without_ocr_keeps_text_on_later_pages(self):
        import pymupdf
        with pymupdf.open() as pdf:
            pdf.new_page()
            page = pdf.new_page()
            page.insert_text((72, 72), 'Revenue in the financial statements was 250 million.', fontsize=14)
            content = pdf.tobytes()
        with patch('documents._ocr_image', side_effect=documents.DocumentError('Local OCR is unavailable. Install the OCR dependencies.', 503)):
            result = documents.extract_document('financial-statements.pdf', content)
        self.assertEqual(result['method'], 'text')
        self.assertIn('250 million', result['text'])
        self.assertTrue(any('OCR is unavailable' in warning for warning in result['warnings']))

    def test_real_text_pdf_preserves_pages_and_layout(self):
        import pymupdf
        with pymupdf.open() as pdf:
            for number in [1, 2]:
                page = pdf.new_page()
                page.insert_text((72, 72), f'Quarter {number} results', fontsize=22)
                page.insert_text((72, 110), f'Revenue on page {number} was 120 million dollars.', fontsize=11)
            content = pdf.tobytes()
        with patch('documents._ocr_image') as engine:
            result = documents.extract_document('quarter.pdf', content)
        engine.assert_not_called()
        self.assertEqual((result['type'], result['method'], result['pageCount']), ('pdf', 'text', 2))
        self.assertEqual({section['page'] for section in result['sections']}, {1, 2})
        self.assertTrue(all(len(section['bbox']) == 4 for section in result['sections']))
        self.assertIn('Quarter 1 results', result['text'])

    def test_real_encrypted_and_too_many_page_pdfs_are_rejected(self):
        import pymupdf
        with pymupdf.open() as pdf:
            pdf.new_page()
            encrypted = pdf.tobytes(encryption=pymupdf.PDF_ENCRYPT_AES_256, user_pw='secret', owner_pw='owner')
            for _ in range(documents.MAX_PAGES):
                pdf.new_page()
            too_many_pages = pdf.tobytes()
        with self.assertRaisesRegex(documents.DocumentError, 'Password-protected'):
            documents.extract_document('locked.pdf', encrypted)
        with self.assertRaisesRegex(documents.DocumentError, '50 pages') as error:
            documents.extract_document('long.pdf', too_many_pages)
        self.assertEqual(error.exception.status, 413)

    def test_real_pdf_table_keeps_rows_columns_and_page_layout(self):
        import pymupdf
        with pymupdf.open() as pdf:
            page = pdf.new_page()
            for x in [72, 220, 420]:
                page.draw_line((x, 100), (x, 180))
            for y in [100, 140, 180]:
                page.draw_line((72, y), (420, y))
            for text, x, y in [('Metric', 82, 125), ('Value', 230, 125),
                               ('Revenue', 82, 165), ('120 million', 230, 165)]:
                page.insert_text((x, y), text, fontsize=11)
            content = pdf.tobytes()
        with patch('documents._ocr_image') as engine:
            result = documents.extract_document('table.pdf', content)
        engine.assert_not_called()
        tables = [section for section in result['sections'] if section['kind'] == 'table']
        self.assertEqual(len(tables), 1)
        self.assertEqual(tables[0]['table'], [['Metric', 'Value'], ['Revenue', '120 million']])
        self.assertEqual(tables[0]['page'], 1)
        self.assertEqual(len(tables[0]['bbox']), 4)
        self.assertEqual(result['text'].count('120 million'), 1)

    @unittest.skipUnless(importlib.util.find_spec('PIL'), 'Pillow is not installed')
    def test_large_scan_with_long_native_header_still_runs_ocr(self):
        import pymupdf
        header = 'Quarterly financial report with a substantial native text header'
        with pymupdf.open() as pdf:
            page = pdf.new_page(width=600, height=500)
            page.insert_text((20, 40), header, fontsize=11)
            page.insert_image(pymupdf.Rect(20, 90, 580, 490), stream=image_fixture(), keep_proportion=False)
            content = pdf.tobytes()
        lines = [{'text': header, 'confidence': .99, 'bbox': [20, 20, 400, 40]}] + OCR_LINES
        with patch('documents._ocr_image', return_value=lines) as engine:
            result = documents.extract_document('mixed.pdf', content)
        self.assertEqual(engine.call_count, 1)
        self.assertEqual(result['method'], 'text+ocr')
        self.assertEqual(result['text'].count(header), 1)
        self.assertIn(OCR_LINES[0]['text'], result['text'])

    @unittest.skipUnless(importlib.util.find_spec('PIL'), 'Pillow is not installed')
    def test_scanned_pdf_uses_ocr_and_stops_at_page_limit(self):
        import pymupdf
        with pymupdf.open() as pdf:
            for _ in range(documents.MAX_OCR_PAGES + 1):
                page = pdf.new_page(width=600, height=140)
                page.insert_image(page.rect, stream=image_fixture())
            content = pdf.tobytes()
        with patch('documents._ocr_image', return_value=OCR_LINES) as engine:
            result = documents.extract_document('scan.pdf', content)
        self.assertEqual(engine.call_count, documents.MAX_OCR_PAGES)
        self.assertEqual(result['method'], 'ocr')
        self.assertEqual(result['pageCount'], documents.MAX_OCR_PAGES + 1)
        self.assertEqual(len(result['sections']), documents.MAX_OCR_PAGES)
        self.assertTrue(any('20 pages' in warning for warning in result['warnings']))


class SearchTests(unittest.TestCase):
    def setUp(self):
        self.document = {'sections': [
            {'id': 'first', 'title': 'Revenue results', 'page': 1, 'text': 'Revenue increased to 120 million dollars.'},
            {'id': 'second', 'title': 'Operating costs', 'page': 2, 'text': 'Costs decreased while revenue remained steady.'},
            {'id': 'third', 'title': 'Notes', 'page': 3, 'text': 'No forecast is provided.'},
        ]}

    def test_phrase_heading_and_page_references_return_real_sources(self):
        result = documents.search_document(self.document, 'What were the revenue results?')
        self.assertEqual(result[0]['sectionId'], 'first')
        self.assertIn('120 million', result[0]['snippet'])
        self.assertEqual(result[0]['text'], self.document['sections'][0]['text'])
        self.assertEqual(documents.search_document(self.document, 'revenue page 2')[0]['sectionId'], 'second')
        self.assertEqual(documents.search_document(self.document, 'page 3')[0]['sectionId'], 'third')

    def test_unknown_queries_and_regex_characters_do_not_invent_results(self):
        self.assertEqual(documents.search_document(self.document, 'dividend'), [])
        self.assertEqual(documents.search_document(self.document, '.*[a-z]+'), [])
        self.assertEqual(documents.search_document(self.document, ''), [])


if __name__ == '__main__':
    unittest.main()
