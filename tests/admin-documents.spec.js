import {test, expect} from '@playwright/test';

const extracted = {
  id: 'document-1', name: 'annual report.pdf', type: 'pdf', method: 'text',
  wordCount: 24, pageCount: 2, created: 1780400000, warnings: [],
  text: 'Revenue rose 12% to $240 million. <script>window.documentInjected=true</script>\nRevenue | 240\nMargin | 18%',
  sections: [
    {id: 'section-1', title: 'Business overview', page: 1, kind: 'text', text: 'Revenue rose 12% to $240 million. <script>window.documentInjected=true</script>'},
    {id: 'section-2', title: 'Table 1', page: 2, kind: 'table', text: 'Revenue | 240\nMargin | 18%', table: [['Metric', 'Value'], ['Revenue', '240'], ['Margin', '18%']]},
  ],
};

async function mockDocuments(page, {aiAvailable = true, ocrAvailable = true, initial = [], failUpload = null, uploadDelay = 0, background = false, detailDelay = 0} = {}) {
  let library = initial.map(document => ({...document}));
  const calls = {uploads: [], asks: [], searches: [], deleted: [], retries: [], details: [], polls: 0};
  calls.complete = (id = 'document-1') => {library = library.map(document => document.id === id ? {...document, status: 'ready', processingStage: 'complete', error: '', text: extracted.text, sections: extracted.sections, wordCount: extracted.wordCount, pageCount: extracted.pageCount} : document);};
  calls.fail = (id = 'document-1') => {library = library.map(document => document.id === id ? {...document, status: 'failed', processingStage: 'failed', error: 'Text extraction timed out. Retry extraction.'} : document);};
  await page.route('**/api/session', route => route.fulfill({json: {authenticated: true, isAdmin: true, user: {name: 'Document Admin', email: 'documents-admin@example.com'}}}));
  await page.route('**/api/admin/accounts', route => route.fulfill({json: {accounts: [{name: 'Document Admin', email: 'documents-admin@example.com', isAdmin: true, isOwner: true, created: 1780400000}]}}));
  await page.route('**/api/admin/documents**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method();
    if (path === '/api/admin/documents' && method === 'GET') {
      calls.polls += 1;
      return route.fulfill({json: {
        documents: library.map(({text, sections, ...summary}) => summary), capabilities: {formats: ['pdf', 'docx', 'png', 'jpg', 'jpeg', 'webp'], maxFileSize: 10485760, aiAvailable, ocrAvailable, aiProvider: aiAvailable ? 'test-provider' : ''},
      }});
    }
    if (path === '/api/admin/documents' && method === 'POST') {
      calls.uploads.push({name: decodeURIComponent(request.headers()['x-document-name']), type: request.headers()['content-type'], bytes: request.postDataBuffer()?.length});
      if (uploadDelay) await new Promise(resolve => setTimeout(resolve, uploadDelay));
      if (failUpload) return route.fulfill({status: failUpload.status, json: {message: failUpload.message}});
      const document = {...extracted, id: 'document-' + calls.uploads.length, name: calls.uploads.at(-1).name, type: calls.uploads.at(-1).name.split('.').pop(), ...(background ? {status: 'processing', processingStage: 'queued', hasOriginal: true, size: calls.uploads.at(-1).bytes, text: '', sections: [], wordCount: 0, pageCount: 0} : {})};
      library = [document, ...library.filter(item => item.id !== document.id)];
      return route.fulfill({status: background ? 202 : 201, json: {document}});
    }
    if (path.endsWith('/retry') && method === 'POST') {
      const id = decodeURIComponent(path.split('/').at(-2)); calls.retries.push(id);
      library = library.map(document => document.id === id ? {...document, status: 'processing', processingStage: 'queued', error: ''} : document);
      return route.fulfill({status: 202, json: {document: library.find(document => document.id === id)}});
    }
    if (path.endsWith('/search')) {
      calls.searches.push(url.searchParams.get('q'));
      const found = url.searchParams.get('q').toLowerCase().includes('revenue');
      return route.fulfill({json: {matches: found ? [{sectionId: 'section-1', title: 'Business overview', page: 1, text: extracted.sections[0].text, snippet: 'Revenue rose 12% to $240 million.', score: 12}] : []}});
    }
    if (path.endsWith('/ask')) {
      const body = request.postDataJSON(); calls.asks.push(body);
      return route.fulfill({json: {answer: body.mode === 'summary' ? 'The report describes 12% revenue growth and an 18% margin.' : 'Revenue rose 12% to $240 million. <b>Source text stays plain.</b>', warnings: body.mode === 'summary' ? ['This summary uses selected excerpts. Review the extracted document for complete details.'] : [], citations: [{sectionId: 'section-1', title: 'Business overview', page: 1}], provider: 'test-provider'}});
    }
    if (method === 'DELETE') {
      const id = decodeURIComponent(path.split('/').pop()); calls.deleted.push(id);
      library = library.filter(document => document.id !== id);
      return route.fulfill({json: {message: 'Document deleted.'}});
    }
    const document = library.find(document => String(document.id) === decodeURIComponent(path.split('/').pop()));
    calls.details.push(document?.id);
    if (detailDelay && calls.details.length === 1) await new Promise(resolve => setTimeout(resolve, detailDelay));
    return route.fulfill({status: document ? 200 : 404, json: document ? {document} : {message: 'Document not found.'}});
  });
  return calls;
}

async function openWorkspace(page) {
  await page.goto('/#admin');
  await page.getByRole('button', {name: 'Document workspace', exact: true}).click();
  await expect(page.locator('.admin-documents')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Choose a document', exact: true})).toBeEnabled();
}

test('administrator uploads, searches, asks with citations, summarizes and deletes a document', async ({page}) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const calls = await mockDocuments(page);
  await openWorkspace(page);
  await expect(page.getByText('No documents yet', {exact: true})).toBeVisible();
  const buffer = Buffer.from('%PDF-1.7\nmock report contents');
  await page.getByLabel('Upload document', {exact: true}).setInputFiles({name: 'annual report.pdf', mimeType: 'application/pdf', buffer});
  await expect(page.getByText('Document uploaded and text extracted.', {exact: true})).toBeVisible();
  await expect(page.locator('.document-detail-header')).toContainText('annual report.pdf');
  await expect(page.locator('.document-content')).toContainText('Revenue rose 12% to $240 million.');
  await expect(page.locator('.document-table-wrap td')).toContainText(['Metric', 'Value', 'Revenue', '240', 'Margin', '18%']);
  expect(calls.uploads).toEqual([{name: 'annual report.pdf', type: 'application/octet-stream', bytes: buffer.length}]);
  expect(await page.evaluate(() => window.documentInjected)).toBeUndefined();
  await page.getByLabel('Search this document', {exact: true}).fill('Revenue');
  await page.getByRole('button', {name: 'Find text', exact: true}).click();
  await expect(page.locator('.document-search-results')).toContainText('1 matches');
  await expect(page.locator('.document-search-results mark')).toHaveText('Revenue');
  await page.getByRole('button', {name: 'Open section Business overview'}).click();
  await expect(page.locator('.document-section.is-referenced')).toContainText('Revenue rose 12%');
  await expect(page.locator('.document-section.is-referenced')).toBeFocused();
  await page.getByLabel('Question about this document', {exact: true}).fill('How much did revenue grow?');
  await page.getByRole('button', {name: 'Ask a question', exact: true}).click();
  await expect(page.locator('.document-answer')).toContainText('Revenue rose 12%');
  await expect(page.locator('.document-answer p b')).toHaveCount(0);
  await page.locator('.document-citations').getByRole('button').click();
  await expect(page.locator('.document-section.is-referenced')).toBeFocused();
  await page.getByRole('button', {name: 'Summarize document', exact: true}).click();
  await expect(page.locator('.document-answer')).toContainText('The report describes 12% revenue growth');
  await expect(page.locator('.document-answer-warnings')).toHaveText('This summary uses selected excerpts. Review the extracted document for complete details.');
  expect(calls.asks).toEqual([{question: 'How much did revenue grow?', mode: 'answer', language: 'en'}, {question: '', mode: 'summary', language: 'en'}]);
  expect(calls.searches).toEqual(['Revenue']);
  await page.screenshot({path: 'artifacts/ui/admin-document-workspace-light.png', fullPage: true});
  await page.getByRole('button', {name: 'Delete document', exact: true}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'Cancel', exact: true}).click();
  expect(calls.deleted).toEqual([]);
  await page.getByRole('button', {name: 'Delete document', exact: true}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'Delete', exact: true}).click();
  await expect(page.getByText('Document deleted.', {exact: true})).toBeVisible();
  await expect(page.getByText('No documents yet', {exact: true})).toBeVisible();
  expect(calls.deleted).toEqual(['document-1']);
  expect(errors).toEqual([]);
});

test('validates document formats, empty files and the maximum file size before uploading', async ({page}) => {
  const calls = await mockDocuments(page);
  await openWorkspace(page);
  const picker = page.getByLabel('Upload document', {exact: true});
  await picker.setInputFiles({name: 'report.txt', mimeType: 'text/plain', buffer: Buffer.from('unsupported')});
  await expect(page.getByRole('alert')).toHaveText('Choose a PDF, Word (.docx), PNG, JPG, JPEG, or WebP file.');
  await picker.setInputFiles({name: 'large.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(10485761)});
  await expect(page.getByRole('alert')).toHaveText('Files must be 10 MB or smaller.');
  await picker.setInputFiles({name: 'empty.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(0)});
  await expect(page.getByRole('alert')).toHaveText('This file is empty. Choose a document with content.');
  expect(calls.uploads).toEqual([]);
});

test('shows upload progress until the server acknowledges the save', async ({page}) => {
  const calls = await mockDocuments(page, {uploadDelay: 1200});
  await openWorkspace(page);
  await page.getByLabel('Upload document', {exact: true}).setInputFiles({name: 'scan.webp', mimeType: 'image/webp', buffer: Buffer.from('mock image contents')});
  await expect(page.locator('.document-upload-progress progress')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Choose a document', exact: true})).toBeDisabled();
  await expect(page.getByLabel('Upload document', {exact: true})).toBeDisabled();
  await expect(page.getByText('Document uploaded and text extracted.', {exact: true})).toBeVisible();
  await expect(page.locator('.document-upload-progress')).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Choose a document', exact: true})).toBeEnabled();
  expect(calls.uploads).toHaveLength(1);
});

test('202 save acknowledgment releases upload immediately and polls complete extracted content', async ({page}) => {
  const calls = await mockDocuments(page, {background: true});
  await openWorkspace(page);
  await page.getByLabel('Upload document', {exact: true}).setInputFiles({name: 'annual report.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7 mock')});
  await expect(page.getByText('Document saved. Text extraction continues in the background.', {exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Choose a document', exact: true})).toBeEnabled();
  await expect(page.locator('.document-upload-progress')).toHaveCount(0);
  await expect(page.locator('.document-processing-panel')).toContainText('You can upload another file.');
  await expect(page.getByRole('link', {name: 'Download original'})).toHaveAttribute('href', '/api/admin/documents/document-1/download');
  await expect(page.locator('.document-assistant')).toHaveCount(0);
  await expect(page.locator('.document-search-panel')).toHaveCount(0);
  await page.screenshot({path: 'artifacts/ui/admin-document-saved-processing.png', fullPage: true});
  calls.complete();
  await expect(page.locator('.document-content')).toContainText('Revenue rose 12%');
  await expect(page.locator('.document-processing-panel')).toHaveCount(0);
  await expect(page.locator('.document-detail-header')).toContainText('Document ready');
  expect(calls.polls).toBeGreaterThan(1);
  expect(calls.details).toContain('document-1');
});

test('another file can be saved while earlier documents keep processing', async ({page}) => {
  const calls = await mockDocuments(page, {background: true});
  await openWorkspace(page);
  const picker = page.getByLabel('Upload document', {exact: true});
  await picker.setInputFiles({name: 'first.pdf', mimeType: 'application/pdf', buffer: Buffer.from('first')});
  await expect(page.locator('.document-detail-header')).toContainText('first.pdf');
  await expect(picker).toBeEnabled();
  await picker.setInputFiles({name: 'second.pdf', mimeType: 'application/pdf', buffer: Buffer.from('second')});
  await expect(page.locator('.document-detail-header')).toContainText('second.pdf');
  await expect(page.locator('.document-library-item')).toHaveCount(2);
  calls.complete('document-1');
  await expect(page.getByRole('button', {name: 'Open first.pdf'})).toContainText('Document ready');
  await expect(page.locator('.document-processing-panel')).toBeVisible();
  await page.getByRole('button', {name: 'Open first.pdf'}).click();
  await expect(page.locator('.document-content')).toContainText('Revenue rose 12%');
  expect(calls.uploads).toHaveLength(2);
});

test('delayed initial processing details keep polling after the library is already ready', async ({page}) => {
  const processing = {...extracted, status: 'processing', processingStage: 'extracting', text: '', sections: [], hasOriginal: true};
  const calls = await mockDocuments(page, {initial: [processing], detailDelay: 2400});
  await openWorkspace(page);
  calls.complete();
  await expect(page.locator('.document-content')).toContainText('Revenue rose 12%', {timeout: 10000});
  await expect(page.locator('.document-processing-panel')).toHaveCount(0);
  expect(calls.details.length).toBeGreaterThan(1);
});

test('a delayed library poll cannot restore a document deleted while another is processing', async ({page}) => {
  const processing = {...extracted, id: 'processing', name: 'processing.pdf', status: 'processing', text: '', sections: [], hasOriginal: true};
  const ready = {...extracted, id: 'ready', name: 'delete me.pdf', status: 'ready'};
  await mockDocuments(page, {initial: [processing, ready]});
  await openWorkspace(page);
  await page.getByRole('button', {name: 'Open delete me.pdf'}).click();
  await expect(page.locator('.document-content')).toBeVisible();
  let releasePoll, markStarted, delayed = false;
  const gate = new Promise(resolve => {releasePoll = resolve;});
  const started = new Promise(resolve => {markStarted = resolve;});
  await page.route('**/api/admin/documents', async route => {
    if (route.request().method() !== 'GET' || delayed) return route.fallback();
    delayed = true; markStarted();
    await gate;
    return route.fulfill({json: {documents: [processing, ready]}});
  });
  await started;
  await page.getByRole('button', {name: 'Delete document', exact: true}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'Delete', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Open delete me.pdf'})).toHaveCount(0);
  const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api/admin/documents' && response.request().method() === 'GET');
  releasePoll(); await response;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.getByRole('button', {name: 'Open delete me.pdf'})).toHaveCount(0);
  await expect(page.locator('.document-library-item')).toHaveCount(1);
});

test('a delayed delete preserves a new upload that already finished extraction', async ({page}) => {
  const old = {...extracted, id: 'old-document', name: 'old.pdf', status: 'ready'};
  const calls = await mockDocuments(page, {initial: [old], background: true, uploadDelay: 1000});
  await openWorkspace(page);
  await expect(page.locator('.document-detail-header')).toContainText('old.pdf');
  let releaseDelete, markDeleteStarted;
  const gate = new Promise(resolve => {releaseDelete = resolve;});
  const started = new Promise(resolve => {markDeleteStarted = resolve;});
  await page.route('**/api/admin/documents/old-document', async route => {
    if (route.request().method() !== 'DELETE') return route.fallback();
    markDeleteStarted(); await gate;
    return route.fallback();
  });
  await page.getByRole('button', {name: 'Delete document', exact: true}).click();
  // An opened confirmation retains the old file even after a new upload selects another file.
  await page.getByLabel('Upload document', {exact: true}).setInputFiles({name: 'new.pdf', mimeType: 'application/pdf', buffer: Buffer.from('new')});
  await expect(page.locator('.document-upload-progress')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', {name: 'Delete', exact: true}).click();
  await started;
  await expect(page.locator('.document-detail-header')).toContainText('new.pdf');
  calls.complete('document-1');
  await expect(page.locator('.document-content')).toContainText('Revenue rose 12%');
  releaseDelete();
  await expect(page.getByText('Document deleted.', {exact: true})).toBeVisible();
  await expect(page.locator('.document-library-item')).toHaveCount(1);
  await expect(page.getByRole('button', {name: 'Open new.pdf'})).toBeVisible();
  await expect(page.locator('.document-detail-header')).toContainText('new.pdf');
});

test('failed extraction keeps the original available and can be retried', async ({page}) => {
  const calls = await mockDocuments(page, {background: true});
  await openWorkspace(page);
  await page.getByLabel('Upload document', {exact: true}).setInputFiles({name: 'slow.pdf', mimeType: 'application/pdf', buffer: Buffer.from('slow')});
  await expect(page.locator('.document-processing-panel')).toBeVisible();
  calls.fail();
  await expect(page.locator('.document-processing-panel')).toContainText('Text extraction timed out. Retry extraction.');
  await expect(page.getByRole('link', {name: 'Download original'})).toBeVisible();
  await page.getByRole('button', {name: 'Retry extraction', exact: true}).click();
  await expect(page.locator('.document-processing-panel')).toContainText('Extracting text…');
  calls.complete();
  await expect(page.locator('.document-content')).toContainText('Revenue rose 12%');
  expect(calls.retries).toEqual(['document-1']);
});

test('retry cancels a late failed-detail snapshot and continues polling to ready', async ({page}) => {
  const failed = {...extracted, status: 'failed', text: '', sections: [], hasOriginal: true, error: 'Text extraction timed out.'};
  const calls = await mockDocuments(page, {initial: [failed]});
  await openWorkspace(page);
  await expect(page.locator('.document-processing-panel')).toContainText('Text extraction failed.');
  let releaseRetry, releaseDetail, markRetryStarted, markDetailStarted;
  const retryGate = new Promise(resolve => {releaseRetry = resolve;});
  const detailGate = new Promise(resolve => {releaseDetail = resolve;});
  const retryStarted = new Promise(resolve => {markRetryStarted = resolve;});
  const detailStarted = new Promise(resolve => {markDetailStarted = resolve;});
  await page.route('**/api/admin/documents/document-1/retry', async route => {markRetryStarted(); await retryGate; return route.fallback();});
  let delayed = false;
  await page.route('**/api/admin/documents/document-1', async route => {
    if (route.request().method() !== 'GET' || delayed) return route.fallback();
    delayed = true; markDetailStarted(); await detailGate;
    return route.fulfill({json: {document: failed}});
  });
  await page.getByRole('button', {name: 'Retry extraction', exact: true}).click();
  await retryStarted;
  await page.getByRole('button', {name: 'Open annual report.pdf'}).click();
  await detailStarted;
  releaseRetry();
  await expect(page.locator('.document-processing-panel')).toContainText('Your file is saved. Extracting text…');
  releaseDetail(); calls.complete();
  await expect(page.locator('.document-content')).toContainText('Revenue rose 12%');
  await expect(page.locator('.document-processing-panel')).toHaveCount(0);
  expect(calls.retries).toEqual(['document-1']);
});

test('canceling an upload clears its progress and allows another attempt', async ({page}) => {
  await mockDocuments(page, {uploadDelay: 1500});
  await openWorkspace(page);
  await page.getByLabel('Upload document', {exact: true}).setInputFiles({name: 'slow.pdf', mimeType: 'application/pdf', buffer: Buffer.from('slow')});
  await page.getByRole('button', {name: 'Cancel upload', exact: true}).click();
  await expect(page.getByText('Upload canceled. Refresh documents to check whether it was already saved.', {exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Choose a document', exact: true})).toBeEnabled();
  await expect(page.locator('.document-upload-progress')).toHaveCount(0);
});

test('a stalled save has a finite upload timeout and returns an actionable error', async ({page}) => {
  await page.addInitScript(() => {
    const descriptor = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'timeout');
    Object.defineProperty(XMLHttpRequest.prototype, 'timeout', {...descriptor, set(value) {window.configuredUploadTimeout = value; descriptor.set.call(this, Math.min(value, 200));}});
  });
  await mockDocuments(page, {uploadDelay: 1500});
  await openWorkspace(page);
  await page.getByLabel('Upload document', {exact: true}).setInputFiles({name: 'slow.pdf', mimeType: 'application/pdf', buffer: Buffer.from('slow')});
  await expect(page.getByRole('alert')).toHaveText('Upload timed out. Refresh documents to check whether it was saved, then try again.');
  await expect(page.getByRole('button', {name: 'Choose a document', exact: true})).toBeEnabled();
  await expect(page.locator('.document-upload-progress')).toHaveCount(0);
  expect(await page.evaluate(() => window.configuredUploadTimeout)).toBe(45000);
});

test('library groups by real file type and Baku upload dates with filters and sorting', async ({page}) => {
  const initial = [
    {...extracted, id: 'old-pdf', name: 'older report.pdf', created: Date.parse('2026-09-01T10:00:00Z') / 1000},
    {...extracted, id: 'word', name: 'company notes.docx', type: 'docx', created: Date.parse('2026-10-02T10:00:00Z') / 1000},
    {...extracted, id: 'image', name: 'receipt.png', type: 'image', created: Date.parse('2026-10-02T21:00:00Z') / 1000},
    {...extracted, id: 'new-pdf', name: 'latest report.pdf', created: Date.parse('2026-10-03T10:00:00Z') / 1000},
  ];
  await mockDocuments(page, {initial});
  await openWorkspace(page);
  await expect(page.locator('.document-library-group h4')).toContainText(['PDF documents', 'Images', 'Word documents']);
  await page.getByLabel('File type', {exact: true}).selectOption('images');
  await expect(page.locator('.document-library-item')).toHaveCount(1);
  await expect(page.locator('.document-library-item')).toContainText('receipt.png');
  await page.getByRole('button', {name: 'Clear filters'}).click();
  await page.getByLabel('Group by', {exact: true}).selectOption('day');
  await expect(page.locator('.document-library-group h4')).toHaveCount(3);
  await expect(page.locator('.document-library-group').first()).toContainText('receipt.png');
  await expect(page.locator('.document-library-group').first()).toContainText('October 3, 2026');
  await page.getByLabel('From date', {exact: true}).fill('2026-10-03');
  await page.getByLabel('To date', {exact: true}).fill('2026-10-03');
  await expect(page.locator('.document-library-item')).toHaveCount(2);
  await page.getByLabel('Find a file', {exact: true}).fill('receipt');
  await expect(page.locator('.document-library-item')).toHaveCount(1);
  await page.getByLabel('Find a file', {exact: true}).fill('missing');
  await expect(page.getByText('No documents match these filters.')).toBeVisible();
  await page.getByRole('button', {name: 'Clear filters'}).click();
  await page.getByLabel('Group by', {exact: true}).selectOption('month');
  await expect(page.locator('.document-library-group h4')).toHaveCount(2);
  await page.getByLabel('Sort by', {exact: true}).selectOption('oldest');
  await expect(page.locator('.document-library-item').first()).toContainText('older report.pdf');
  await expect(page.locator('.document-library-group h4').first()).toContainText('September 2026');
  await page.reload();
  await page.getByRole('button', {name: 'Document workspace', exact: true}).click();
  await expect(page.locator('.document-library-item')).toHaveCount(4);
});

test('missing document service explains how to recover and refreshes successfully', async ({page}) => {
  await mockDocuments(page);
  let unavailable = true;
  await page.route('**/api/admin/documents', route => unavailable ? route.fulfill({status: 404, json: {message: 'Not found.'}}) : route.fallback());
  await openWorkspace(page);
  await expect(page.getByRole('alert')).toHaveText('Document service unavailable. Restart the backend, then refresh documents.');
  unavailable = false;
  await page.getByRole('button', {name: 'Refresh documents'}).click();
  await expect(page.getByText('OCR available', {exact: true})).toBeVisible();
});

test('extraction and search remain available when AI and OCR are not configured', async ({page}) => {
  const document = {...extracted, name: 'company notes.docx', type: 'docx', pageCount: 0, warnings: ['DOCX page numbers are unavailable without rendering; sections follow document order.']};
  const calls = await mockDocuments(page, {aiAvailable: false, ocrAvailable: false, initial: [document]});
  await openWorkspace(page);
  await expect(page.locator('.document-detail-header')).toContainText('company notes.docx');
  await expect(page.locator('.document-detail-header')).toContainText('Page count unavailable');
  await expect(page.locator('.documents-capabilities')).toContainText('OCR unavailable');
  await expect(page.locator('.document-assistant')).toContainText('AI is not connected');
  await expect(page.getByRole('button', {name: 'Summarize document', exact: true})).toBeDisabled();
  await expect(page.getByLabel('Question about this document', {exact: true})).toBeDisabled();
  await page.getByLabel('Search this document', {exact: true}).fill('missing phrase');
  await page.getByRole('button', {name: 'Find text', exact: true}).click();
  await expect(page.getByText('No matching text found. Try another phrase.', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Clear search', exact: true}).click();
  await expect(page.locator('.document-search-results')).toHaveCount(0);
  await expect(page.locator('.document-content')).toContainText('Revenue rose 12%');
  expect(calls.asks).toEqual([]);
});

test('document workspace fits mobile and dark theme with escaped OCR content', async ({page}) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({width: 390, height: 844});
  const document = {...extracted, name: 'scanned statement.png', type: 'png', method: 'ocr', warnings: ['No readable text was found on page 2.'], sections: [{...extracted.sections[0], title: 'Page 1 · OCR'}]};
  await mockDocuments(page, {initial: [document]});
  await openWorkspace(page);
  await expect(page.locator('.document-detail-header')).toContainText('Local OCR');
  await page.getByRole('button', {name: 'Switch to dark mode'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const width = await page.evaluate(() => ({content: document.documentElement.scrollWidth, viewport: innerWidth}));
  expect(width.content).toBeLessThanOrEqual(width.viewport);
  await page.screenshot({path: 'artifacts/ui/admin-document-workspace-mobile-dark.png', fullPage: true});
  expect(errors).toEqual([]);
});

test('members cannot see document or administration controls even at the admin hash', async ({page}) => {
  let documentRequests = 0;
  await page.route('**/api/session', route => route.fulfill({json: {authenticated: true, isAdmin: false, user: {name: 'Member Tester', email: 'member-documents@example.com'}}}));
  await page.route('**/api/admin/documents**', route => {documentRequests += 1; return route.fulfill({status: 403, json: {message: 'Administrator access required.'}});});
  await page.goto('/#admin');
  await expect(page.locator('.home-shell')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Administration', exact: true})).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Document workspace', exact: true})).toHaveCount(0);
  await expect(page.getByLabel('Upload document', {exact: true})).toHaveCount(0);
  expect(documentRequests).toBe(0);
});

test('expired administrator permission during upload returns to sign in', async ({page}) => {
  await mockDocuments(page, {failUpload: {status: 403, message: 'Administrator access required.'}});
  await openWorkspace(page);
  await page.getByLabel('Upload document', {exact: true}).setInputFiles({name: 'report.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nmock')});
  await expect(page.locator('.admin-documents')).toHaveCount(0);
  await expect(page.locator('.account-panel')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Administrator access required.');
});

test('document answers and summaries request the selected interface language', async ({page}) => {
  const calls = await mockDocuments(page, {initial: [extracted]});
  await openWorkspace(page);
  await expect(page.locator('.document-detail-header')).toContainText('annual report.pdf');
  await page.getByLabel('Question about this document', {exact: true}).fill('Quelle est la croissance du chiffre d’affaires ?');
  await page.getByLabel('Language', {exact: true}).selectOption('fr');
  await page.locator('.document-assistant-actions .document-button').last().click();
  await expect(page.locator('.document-answer')).toBeVisible();
  await page.locator('.document-assistant-actions .document-button').first().click();
  await expect(page.locator('.document-answer-warnings')).toBeVisible();
  expect(calls.asks).toEqual([
    {question: 'Quelle est la croissance du chiffre d’affaires ?', mode: 'answer', language: 'fr'},
    {question: '', mode: 'summary', language: 'fr'},
  ]);
  await expect(page.locator('.document-answer-warnings')).not.toHaveText('This summary uses selected excerpts. Review the extracted document for complete details.');
  await expect(page.locator('.document-content')).toContainText('Business overview');
  await expect(page.locator('.document-content')).toContainText('Revenue rose 12% to $240 million.');
});
