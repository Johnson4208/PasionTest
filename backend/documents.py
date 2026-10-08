"""Bounded, local document extraction and literal source search.

Optional parsing packages are imported only when their format is processed.
This module neither stores uploads nor makes network requests.
"""

import importlib
import io
import math
import re
import statistics
import threading
import unicodedata
import warnings
import zipfile
from pathlib import PurePosixPath
from xml.etree import ElementTree


MAX_FILE_SIZE = 10 * 1024 * 1024
MAX_PAGES = 50
MAX_OCR_PAGES = 20
MAX_TEXT_CHARS = 200_000
MAX_SECTIONS = 2_000
MAX_IMAGE_PIXELS = 20_000_000
MAX_RENDER_PIXELS = 8_000_000
MAX_ARCHIVE_FILES = 2_000
MAX_ARCHIVE_UNCOMPRESSED = 50 * 1024 * 1024
MAX_ARCHIVE_ENTRY = 20 * 1024 * 1024
MAX_TABLE_CELLS = 20_000

_OCR_ENGINE = None
_OCR_LOCK = threading.Lock()
_PDF_LOCK = threading.Lock()
_WORD_NAMESPACE = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
_DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'


class DocumentError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


def _dependency(module, message):
    try:
        return importlib.import_module(module)
    except (ImportError, OSError) as error:
        raise DocumentError(message, 503) from error


def _clean_text(value):
    value = unicodedata.normalize('NFKC', str(value or '')).replace('\x00', '')
    value = re.sub(r'[^\S\n]+', ' ', value.replace('\r\n', '\n').replace('\r', '\n'))
    return re.sub(r'\n{3,}', '\n\n', value).strip()


class _Extraction:
    def __init__(self, name, file_type, page_count):
        self.name = name
        self.file_type = file_type
        self.page_count = page_count
        self.sections = []
        self.warnings = []
        self.char_count = 0

    def add(self, title, text, page=None, kind='text', table=None, bbox=None):
        text = _clean_text(text)
        if not text:
            return
        self.char_count += len(text) + (2 if self.sections else 0)
        if self.char_count > MAX_TEXT_CHARS:
            raise DocumentError('Extracted text exceeds the 200,000 character limit.', 413)
        if len(self.sections) >= MAX_SECTIONS:
            raise DocumentError('The document contains too many text sections.', 413)
        section = {'id': f'section-{len(self.sections) + 1}', 'title': _clean_text(title)[:240],
                   'page': page, 'text': text, 'kind': kind}
        if table is not None:
            section['table'] = table
        if bbox is not None:
            section['bbox'] = [round(float(value), 2) for value in bbox]
        self.sections.append(section)

    def warn(self, message):
        if message not in self.warnings:
            self.warnings.append(message)

    def finish(self, method):
        text = '\n\n'.join(section['text'] for section in self.sections)
        if not text.strip():
            raise DocumentError('No readable text was found. Upload a clearer scan or a document containing text.', 422)
        return {'name': self.name, 'type': self.file_type, 'method': method,
                'wordCount': len(re.findall(r'\w+', text, re.UNICODE)),
                'pageCount': self.page_count, 'sections': self.sections,
                'text': text, 'warnings': self.warnings}


def _validate_upload(filename, content):
    if not isinstance(filename, str) or not filename.strip():
        raise DocumentError('A document filename is required.')
    # Upload names are display metadata only, never filesystem destinations.
    name = filename.replace('\\', '/').rsplit('/', 1)[-1].strip()
    if not name or len(name) > 240 or any(ord(char) < 32 for char in name):
        raise DocumentError('The document filename is invalid.')
    if not isinstance(content, bytes) or not content:
        raise DocumentError('The uploaded document is empty.')
    if len(content) > MAX_FILE_SIZE:
        raise DocumentError('Documents must be 10 MB or smaller.', 413)
    extension = PurePosixPath(name).suffix.lower()
    if extension == '.doc':
        raise DocumentError('Legacy .doc files are not supported. Save the document as .docx or PDF and upload it again.', 415)
    signatures = {
        '.pdf': content.startswith(b'%PDF-'),
        '.docx': content.startswith(b'PK\x03\x04'),
        '.png': content.startswith(b'\x89PNG\r\n\x1a\n'),
        '.jpg': content.startswith(b'\xff\xd8\xff'),
        '.jpeg': content.startswith(b'\xff\xd8\xff'),
        '.webp': len(content) >= 12 and content[:4] == b'RIFF' and content[8:12] == b'WEBP',
    }
    if extension not in signatures:
        raise DocumentError('Unsupported document type. Upload PDF, DOCX, PNG, JPEG, or WebP.', 415)
    if not signatures[extension]:
        raise DocumentError('The file contents do not match its extension.')
    return name, extension


def validate_upload(filename, content):
    """Perform only cheap bounded name/type/signature checks before saving."""
    return _validate_upload(filename, content)


def _validate_docx_archive(content):
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            entries = archive.infolist()
            if len(entries) > MAX_ARCHIVE_FILES:
                raise DocumentError('The DOCX archive contains too many files.', 413)
            expanded = sum(entry.file_size for entry in entries)
            if expanded > MAX_ARCHIVE_UNCOMPRESSED:
                raise DocumentError('The DOCX archive expands beyond the permitted size.', 413)
            names = set()
            for entry in entries:
                path = entry.filename.replace('\\', '/')
                if path.startswith('/') or ':' in path.split('/')[0] or '..' in path.split('/') or path in names:
                    raise DocumentError('The DOCX archive contains invalid file paths.')
                names.add(path)
                if path.lower().endswith('vbaproject.bin'):
                    raise DocumentError('Only standard DOCX documents are supported; macro-enabled files are not accepted.', 415)
                if entry.flag_bits & 1:
                    raise DocumentError('Encrypted DOCX files are not supported.')
                if entry.file_size > MAX_ARCHIVE_ENTRY or entry.file_size / max(entry.compress_size, 1) > 200:
                    raise DocumentError('The DOCX archive has an unsafe compression ratio or entry size.', 413)
                if entry.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
                    raise DocumentError('The DOCX archive uses an unsupported compression format.')
                data = archive.read(entry)
                if path.lower().endswith(('.xml', '.rels')):
                    if re.search(br'<!\s*(?:DOCTYPE|ENTITY)\b', data.replace(b'\x00', b''), re.IGNORECASE):
                        raise DocumentError('DOCX XML declarations with entities are not supported.')
                    try:
                        ElementTree.fromstring(data)
                    except ElementTree.ParseError as error:
                        raise DocumentError('The DOCX file contains invalid XML.') from error
            if not {'[Content_Types].xml', '_rels/.rels', 'word/document.xml'}.issubset(names):
                raise DocumentError('The uploaded archive is not a valid DOCX document.')
            content_types = ElementTree.fromstring(archive.read('[Content_Types].xml'))
            main_types = [item.attrib.get('ContentType') for item in content_types
                          if item.attrib.get('PartName') == '/word/document.xml']
            if main_types != [_DOCX_CONTENT_TYPE]:
                raise DocumentError('Only standard DOCX documents are supported; macro-enabled files are not accepted.', 415)
            if ElementTree.fromstring(archive.read('word/document.xml')).tag != f'{{{_WORD_NAMESPACE}}}document':
                raise DocumentError('The uploaded archive is not a valid DOCX document.')
    except DocumentError:
        raise
    except (zipfile.BadZipFile, RuntimeError, OSError, ValueError, EOFError) as error:
        raise DocumentError('The DOCX archive is damaged or invalid.') from error


def _normalize_table(rows):
    table = []
    cells = 0
    characters = 0
    for row in rows:
        values = [_clean_text(cell) for cell in row]
        cells += len(values)
        characters += sum(len(value) for value in values)
        if cells > MAX_TABLE_CELLS:
            raise DocumentError('Tables must contain 20,000 cells or fewer.', 413)
        if characters > MAX_TEXT_CHARS:
            raise DocumentError('Extracted text exceeds the 200,000 character limit.', 413)
        table.append(values)
    return table


def _extract_docx(name, content):
    _validate_docx_archive(content)
    docx = _dependency('docx', 'DOCX extraction is unavailable. Install the document processing dependencies.')
    try:
        document = docx.Document(io.BytesIO(content))
        result = _Extraction(name, 'docx', None)
        result.warn('DOCX page numbers are unavailable without rendering; sections follow document order.')
        current_title = 'Document body'
        paragraphs = []
        paragraph_chars = 0
        table_number = 0

        def flush():
            nonlocal paragraph_chars
            if paragraphs:
                result.add(current_title, '\n\n'.join(paragraphs))
                paragraphs.clear()
                paragraph_chars = 0

        for item in document.iter_inner_content():
            if hasattr(item, 'rows'):
                flush()
                table_number += 1
                table = _normalize_table((cell.text for cell in row.cells) for row in item.rows)
                if not any(value for row in table for value in row):
                    continue
                text = '\n'.join(' | '.join(row) for row in table)
                title = f'Table {table_number}' if current_title == 'Document body' else f'{current_title} · Table {table_number}'
                result.add(title, text, kind='table', table=table)
            else:
                text = _clean_text(item.text)
                if not text:
                    continue
                style = item.style
                style_name = ' '.join((str(getattr(style, 'name', '')), str(getattr(style, 'style_id', '')))).casefold()
                if 'heading' in style_name or style_name.strip() in ('title title', 'subtitle subtitle'):
                    flush()
                    current_title = text[:240]
                paragraphs.append(text)
                paragraph_chars += len(text)
                if paragraph_chars + result.char_count > MAX_TEXT_CHARS:
                    raise DocumentError('Extracted text exceeds the 200,000 character limit.', 413)
        flush()
        return result.finish('text')
    except DocumentError:
        raise
    except Exception as error:
        raise DocumentError('The DOCX document could not be read. Save a new DOCX copy and try again.') from error


def _ocr_image(content):
    """Return text lines with their actual OCR confidence and pixel coordinates."""
    global _OCR_ENGINE
    with _OCR_LOCK:
        if _OCR_ENGINE is None:
            package = _dependency('rapidocr_onnxruntime', 'Local OCR is unavailable. Install the document processing dependencies.')
            try:
                # Three ONNX models otherwise each create a full CPU thread pool.
                # Small bounded pools keep OCR responsive alongside the API.
                _OCR_ENGINE = package.RapidOCR(intra_op_num_threads=2, inter_op_num_threads=1)
            except Exception as error:
                raise DocumentError('Local OCR could not start. Check the installed OCR models and dependencies.', 503) from error
        try:
            lines, _elapsed = _OCR_ENGINE(content)
        except Exception as error:
            raise DocumentError('Local OCR could not read this image. Upload a clearer image and try again.', 422) from error
    output = []
    for line in lines or []:
        if len(line) < 3:
            continue
        text = _clean_text(line[1])
        confidence = float(line[2])
        if not text or confidence < .35:
            continue
        points = line[0]
        output.append({'text': text, 'confidence': confidence,
                       'bbox': [min(point[0] for point in points), min(point[1] for point in points),
                                max(point[0] for point in points), max(point[1] for point in points)]})
    output.sort(key=lambda line: (line['bbox'][1], line['bbox'][0]))
    return output


def _add_ocr_lines(result, lines, page, coordinate_scale=1, skip_text=None):
    skipped = {_clean_text(value).casefold() for value in skip_text or []}
    low_confidence = False
    for line in lines:
        if line['text'].casefold() in skipped:
            continue
        result.add(f'Page {page} · OCR', line['text'], page=page,
                   bbox=[value / coordinate_scale for value in line['bbox']])
        low_confidence = low_confidence or line['confidence'] < .65
    if low_confidence:
        result.warn('Some OCR text has low confidence. Check it against the original document.')


def _extract_image(name, extension, content):
    image_module = _dependency('PIL.Image', 'Image extraction is unavailable. Install the document processing dependencies.')
    image_ops = _dependency('PIL.ImageOps', 'Image extraction is unavailable. Install the document processing dependencies.')
    expected = {'.png': 'PNG', '.jpg': 'JPEG', '.jpeg': 'JPEG', '.webp': 'WEBP'}[extension]
    result = _Extraction(name, 'image', 1)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', image_module.DecompressionBombWarning)
            with image_module.open(io.BytesIO(content)) as image:
                if image.format != expected:
                    raise DocumentError('The file contents do not match its extension.')
                if image.width * image.height > MAX_IMAGE_PIXELS:
                    raise DocumentError('The image exceeds the 20 megapixel limit.', 413)
                image.verify()
            with image_module.open(io.BytesIO(content)) as original:
                if getattr(original, 'n_frames', 1) > 1:
                    result.warn('Only the first frame of the animated image was processed.')
                image = image_ops.exif_transpose(original).convert('RGBA')
                background = image_module.new('RGB', image.size, 'white')
                background.paste(image, mask=image.getchannel('A'))
                if max(background.size) > 4000:
                    background.thumbnail((4000, 4000))
                    result.warn('The image was resized for local OCR processing.')
                buffer = io.BytesIO()
                background.save(buffer, format='PNG')
                lines = _ocr_image(buffer.getvalue())
    except DocumentError:
        raise
    except (image_module.DecompressionBombError, image_module.DecompressionBombWarning) as error:
        raise DocumentError('The image exceeds the permitted dimensions.', 413) from error
    except Exception as error:
        raise DocumentError('The image is damaged or could not be decoded.') from error
    _add_ocr_lines(result, lines, 1)
    result.warn('OCR can misread characters, numbers, and table alignment. Verify important values against the original.')
    return result.finish('ocr')


def _pdf_tables(page, result):
    try:
        tables = []
        for detected in page.find_tables().tables:
            if detected.row_count * detected.col_count > MAX_TABLE_CELLS:
                raise DocumentError('Tables must contain 20,000 cells or fewer.', 413)
            rows = _normalize_table(detected.extract())
            if any(value for row in rows for value in row):
                tables.append({'bbox': tuple(detected.bbox), 'table': rows,
                               'text': '\n'.join(' | '.join(row) for row in rows)})
        if tables:
            result.warn('Detected table structure is approximate. Verify merged cells and column alignment against the original.')
        return tables
    except DocumentError:
        raise
    except Exception:
        result.warn('Table detection was unavailable on some PDF pages; their text was preserved.')
        return []


def _inside_table(block_bbox, table_bbox):
    return (block_bbox[0] >= table_bbox[0] - 1 and block_bbox[1] >= table_bbox[1] - 1
            and block_bbox[2] <= table_bbox[2] + 1 and block_bbox[3] <= table_bbox[3] + 1)


def _pdf_image_coverage(page, pdf):
    page_area = float(page.rect.width * page.rect.height)
    if page_area <= 0:
        return 0
    covered_area = 0
    seen = set()
    for image in page.get_image_info():
        box = tuple(image.get('bbox', (0, 0, 0, 0)))
        if box in seen:
            continue
        seen.add(box)
        intersection = page.rect & pdf.Rect(box)
        covered_area += max(0, intersection.width) * max(0, intersection.height)
    return min(1, covered_area / page_area)


def _extract_pdf_unlocked(name, content):
    pdf = _dependency('pymupdf', 'PDF extraction is unavailable. Install the document processing dependencies.')
    try:
        document = pdf.open(stream=content, filetype='pdf')
    except Exception as error:
        raise DocumentError('The PDF is damaged or could not be opened.') from error
    with document:
        if not document.is_pdf:
            raise DocumentError('The file contents do not match its extension.')
        if document.needs_pass or document.is_encrypted:
            raise DocumentError('Password-protected PDFs are not supported. Upload an unlocked copy.')
        if document.page_count > MAX_PAGES:
            raise DocumentError('PDF documents must contain 50 pages or fewer.', 413)
        result = _Extraction(name, 'pdf', document.page_count)
        if document.is_repaired:
            result.warn('The PDF required structural repairs while opening. Review the extracted text.')
        direct_used = False
        ocr_used = False
        ocr_pages = 0
        ocr_unavailable = None
        table_number = 0
        for index, page in enumerate(document):
            page_number = index + 1
            try:
                flags = pdf.TEXTFLAGS_DICT & ~pdf.TEXT_PRESERVE_IMAGES
                blocks = [block for block in page.get_text('dict', flags=flags, sort=True).get('blocks', [])
                          if block.get('type') == 0]
                tables = _pdf_tables(page, result)
                native_text = [_clean_text('\n'.join(''.join(span.get('text', '') for span in line.get('spans', []))
                                                       for line in block.get('lines', []))) for block in blocks]
                native_lines = [line for text in native_text for line in text.splitlines()]
                blocks = [block for block in blocks if not any(_inside_table(block['bbox'], table['bbox']) for table in tables)]
                sizes = [float(span.get('size', 0)) for block in blocks for line in block.get('lines', [])
                         for span in line.get('spans', []) if span.get('text', '').strip()]
                body_size = statistics.median(sizes) if sizes else 0
                page_text = []
                current_title = f'Page {page_number}'
                items = [{'kind': 'text', 'content': block, 'bbox': block['bbox']} for block in blocks]
                items += [{'kind': 'table', 'content': table, 'bbox': table['bbox']} for table in tables]
                items.sort(key=lambda item: (item['bbox'][1], item['bbox'][0]))
                for item in items:
                    block = item['content']
                    if item['kind'] == 'table':
                        table_number += 1
                        result.add(f'{current_title} · Table {table_number}', block['text'], page=page_number,
                                   kind='table', table=block['table'], bbox=block['bbox'])
                        page_text.append(block['text'])
                        direct_used = True
                        continue
                    text = _clean_text('\n'.join(''.join(span.get('text', '') for span in line.get('spans', []))
                                                  for line in block.get('lines', [])))
                    if not text:
                        continue
                    max_size = max((float(span.get('size', 0)) for line in block.get('lines', [])
                                    for span in line.get('spans', [])), default=0)
                    if body_size and max_size >= body_size * 1.25 and len(text) <= 180:
                        current_title = text.replace('\n', ' ')
                    result.add(current_title, text, page=page_number, bbox=block.get('bbox'))
                    page_text.append(text)
                    direct_used = True
                # Large image regions may contain scanned text even with a long native header.
                coverage = _pdf_image_coverage(page, pdf)
                if not page_text or coverage >= .5 or (len(re.sub(r'\s', '', ''.join(page_text))) < 40 and coverage > 0):
                    if ocr_unavailable:
                        result.warn('Scanned pages were skipped because local OCR is unavailable. The document contains its available native text.')
                        continue
                    if ocr_pages >= MAX_OCR_PAGES:
                        result.warn('OCR is limited to 20 pages. Additional pages without readable text were skipped.')
                        continue
                    ocr_pages += 1
                    area = float(page.rect.width * page.rect.height)
                    if area <= 0 or not math.isfinite(area):
                        raise DocumentError('The PDF contains a page with invalid dimensions.')
                    scale = min(200 / 72, math.sqrt(MAX_RENDER_PIXELS / area))
                    pixmap = page.get_pixmap(matrix=pdf.Matrix(scale, scale), colorspace=pdf.csRGB, alpha=False)
                    try:
                        lines = _ocr_image(pixmap.tobytes('png'))
                    except DocumentError as error:
                        if error.status != 503:
                            raise
                        # A scanned cover must not discard readable financial pages.
                        ocr_unavailable = error
                        result.warn(str(error))
                        result.warn('Scanned pages were skipped because local OCR is unavailable. The document contains its available native text.')
                        continue
                    if lines:
                        _add_ocr_lines(result, lines, page_number, coordinate_scale=scale, skip_text=native_lines + page_text)
                        ocr_used = True
                    elif not page_text:
                        result.warn(f'No readable text was found on page {page_number}.')
            except DocumentError:
                raise
            except Exception as error:
                raise DocumentError(f'Page {page_number} of the PDF could not be processed.') from error
        if ocr_used:
            result.warn('OCR can misread characters, numbers, and table alignment. Verify important values against the original.')
        method = 'text+ocr' if direct_used and ocr_used else 'ocr' if ocr_used else 'text'
        if not result.sections and ocr_unavailable:
            raise ocr_unavailable
        return result.finish(method)


def _extract_pdf(name, content):
    # PyMuPDF objects are confined to this serialized extraction scope.
    with _PDF_LOCK:
        return _extract_pdf_unlocked(name, content)


def extract_document(filename: str, content: bytes) -> dict:
    name, extension = _validate_upload(filename, content)
    if extension == '.pdf':
        return _extract_pdf(name, content)
    if extension == '.docx':
        return _extract_docx(name, content)
    return _extract_image(name, extension, content)


_STOP_WORDS = {'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'do', 'does', 'for', 'from',
               'how', 'i', 'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'was',
               'what', 'when', 'where', 'which', 'who', 'with', 'you', 'your', 'document', 'please'}


def search_document(document, query):
    """Rank literal phrases/tokens and explicit page references; no generated answers."""
    if not isinstance(query, str) or not query.strip():
        return []
    query = _clean_text(query)[:1000].casefold()
    tokens = list(dict.fromkeys(token for token in re.findall(r'\w+', query, re.UNICODE)
                               if token not in _STOP_WORDS))[:40]
    page_match = re.search(r'\b(?:page|p\.)\s*(\d{1,3})\b', query)
    requested_page = int(page_match.group(1)) if page_match else None
    matches = []
    for position, section in enumerate(document.get('sections', [])):
        text = section.get('text', '')
        title = section.get('title', '')
        normalized_text = unicodedata.normalize('NFKC', text).casefold()
        normalized_title = unicodedata.normalize('NFKC', title).casefold()
        score = 0
        if query in normalized_text:
            score += 12
        if query in normalized_title:
            score += 18
        matched_tokens = [token for token in tokens if re.search(r'(?<!\w)' + re.escape(token) + r'(?!\w)', normalized_text)]
        score += len(matched_tokens) * 3
        score += sum(5 for token in tokens if re.search(r'(?<!\w)' + re.escape(token) + r'(?!\w)', normalized_title))
        if requested_page is not None:
            if section.get('page') != requested_page:
                continue
            score += 10
        if not score:
            continue
        location = normalized_text.find(query)
        if location < 0:
            location = next((normalized_text.find(token) for token in matched_tokens), 0)
        start = max(0, location - 90)
        end = min(len(text), start + 360)
        snippet = ('…' if start else '') + text[start:end] + ('…' if end < len(text) else '')
        matches.append((score, position, {'sectionId': section.get('id'), 'title': title,
                                        'page': section.get('page'), 'text': text,
                                        'snippet': snippet, 'score': score}))
    matches.sort(key=lambda item: (-item[0], item[1]))
    return [item[2] for item in matches[:12]]
