import React, {useEffect, useRef, useState} from 'react';
import Dialog from './Dialog';
import {usePreferences} from './Preferences';
import './admin-documents.scss';

const fallbackFormats = ['pdf', 'docx', 'png', 'jpg', 'jpeg', 'webp'];
const fallbackMaxSize = 10 * 1024 * 1024;
const uploadTimeout = 45000;
const pollInterval = 1500;
const statusOf = document => document?.status || 'ready';
const documentTime = created => new Date(typeof created === 'number' && created < 1e12 ? created * 1000 : created).getTime() || 0;
const typeOf = document => {
  const extension = String(document.type || document.name?.split('.').pop() || '').toLowerCase();
  return extension === 'pdf' ? 'pdf' : ['docx', 'word'].includes(extension) ? 'word' : ['image', 'png', 'jpg', 'jpeg', 'webp'].includes(extension) ? 'images' : 'other';
};
function dateKey(created) {
  const time = documentTime(created);
  if (!time) return '';
  const parts = new Intl.DateTimeFormat('en', {timeZone: 'Asia/Baku', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(time);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-');
}

function DocumentIcon({name = 'document'}) {
  const paths = {
    document: 'M14 3H5v18h14V8l-5-5ZM14 3v6h5M8 13h8M8 17h6',
    upload: 'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6',
    search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',
    close: 'm6 6 12 12M6 18 18 6',
    check: 'm5 12 4 4L19 6',
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.document}/></svg>;
}

function HighlightedText({text, phrase}) {
  const value = String(text || ''), search = String(phrase || '').trim();
  if (!search) return value;
  const lower = value.toLocaleLowerCase(), needle = search.toLocaleLowerCase();
  const parts = [];
  let position = 0, match;
  while ((match = lower.indexOf(needle, position)) !== -1) {
    parts.push(value.slice(position, match), <mark key={match}>{value.slice(match, match + search.length)}</mark>);
    position = match + search.length;
  }
  parts.push(value.slice(position));
  return parts;
}

function ExtractedTable({table}) {
  const headers = Array.isArray(table?.headers) ? table.headers : [];
  const rows = (Array.isArray(table) ? table : Array.isArray(table?.rows) ? table.rows : []).filter(Array.isArray);
  if (!rows.length && !headers.length) return null;
  const cellText = cell => cell == null ? '' : typeof cell === 'object' ? JSON.stringify(cell) : String(cell);
  return <div className="document-table-wrap"><table>
    {!!headers.length && <thead><tr>{headers.map((cell, index) => <th key={index}>{cellText(cell)}</th>)}</tr></thead>}
    <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, column) => <td key={column}>{cellText(cell)}</td>)}</tr>)}</tbody>
  </table></div>;
}

export default function AdminDocuments({onExpired}) {
  const {t, language} = usePreferences();
  const [documents, setDocuments] = useState([]), [capabilities, setCapabilities] = useState(null);
  const [libraryLoading, setLibraryLoading] = useState(true), [selectedId, setSelectedId] = useState(null), [selected, setSelected] = useState(null), [documentLoading, setDocumentLoading] = useState(false);
  const [notice, setNotice] = useState(null), [dragging, setDragging] = useState(false), [upload, setUpload] = useState(null);
  const [search, setSearch] = useState(''), [searchedPhrase, setSearchedPhrase] = useState(''), [matches, setMatches] = useState(null), [searching, setSearching] = useState(false);
  const [question, setQuestion] = useState(''), [answer, setAnswer] = useState(null), [thinking, setThinking] = useState(false);
  const [deleting, setDeleting] = useState(false), [deleteFor, setDeleteFor] = useState(null), [focusedSection, setFocusedSection] = useState(null);
  const [groupBy, setGroupBy] = useState('type'), [typeFilter, setTypeFilter] = useState('all'), [nameFilter, setNameFilter] = useState(''), [dateFrom, setDateFrom] = useState(''), [dateTo, setDateTo] = useState(''), [sortOrder, setSortOrder] = useState('newest');
  const [retrying, setRetrying] = useState(false);
  const fileInput = useRef(null), active = useRef(true), selectedIdRef = useRef(null), requests = useRef(new Set()), selectionRequest = useRef(null), uploadRequest = useRef(null), sectionElements = useRef(new Map());
  const selectedRef = useRef(null);
  const documentsRef = useRef(documents);
  const libraryRevision = useRef(0);
  const searchSequence = useRef(0), answerSequence = useRef(0);
  const formats = Array.isArray(capabilities?.formats) && capabilities.formats.length ? capabilities.formats : fallbackFormats;
  const maxFileSize = Number.isFinite(capabilities?.maxFileSize) && capabilities.maxFileSize > 0 ? capabilities.maxFileSize : fallbackMaxSize;
  const maxMegabytes = Math.round(maxFileSize / 1024 / 1024 * 10) / 10;
  const sections = Array.isArray(selected?.sections) ? selected.sections.filter(section => section && typeof section === 'object') : [];
  const selectedStatus = statusOf(selected);
  const hasText = selectedStatus === 'ready' && typeof selected?.text === 'string' && !!selected.text.trim();
  const canAsk = capabilities?.aiAvailable === true && hasText;
  const processingIds = Array.from(new Set([...documents.filter(document => statusOf(document) === 'processing').map(document => String(document.id)), ...(selected && selectedStatus === 'processing' ? [String(selected.id)] : [])])).sort().join(',');

  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { documentsRef.current = documents; }, [documents]);

  function sourceLabel(value) {
    const text = String(value || '');
    let match;
    if ((match = /^Table (\d+)$/.exec(text))) return t('Table {number}', {number: match[1]});
    if ((match = /^(.+) · Table (\d+)$/.exec(text))) return match[1] + ' · ' + t('Table {number}', {number: match[2]});
    if ((match = /^Page (\d+) · OCR$/.exec(text))) return t('Page {page} · OCR', {page: match[1]});
    if ((match = /^Page (\d+)$/.exec(text))) return t('Page {page}', {page: match[1]});
    if ((match = /^No readable text was found on page (\d+)\.$/.exec(text))) return t('No readable text was found on page {page}.', {page: match[1]});
    if ((match = /^Page (\d+) of the PDF could not be processed\.$/.exec(text))) return t('Page {page} of the PDF could not be processed.', {page: match[1]});
    return text === 'Document body' ? t('Document body') : text;
  }

  function extractionMethod(value) {
    return t(({text: 'Text extraction', ocr: 'Local OCR', 'text+ocr': 'Text and OCR'})[value] || String(value || 'Text extraction'));
  }

  function checkResponse(response, data) {
    if (response.status === 401 || response.status === 403) {
      const message = data?.message || 'Administrator access required.';
      onExpired?.(message);
      throw new Error(message);
    }
    if (!response.ok) throw new Error(data?.message || 'Unable to process this document request.');
    return data;
  }

  async function request(path = '', options = {}, controller = new AbortController()) {
    requests.current.add(controller);
    let timedOut = false;
    const timer = window.setTimeout(() => {timedOut = true; controller.abort();}, path.endsWith('/ask') ? 90000 : 20000);
    try {
      let response;
      try { response = await fetch('/api/admin/documents' + path, {...options, signal: controller.signal}); }
      catch (error) { if (timedOut) throw new Error('Document request timed out. Please try again.'); if (error.name === 'AbortError') throw error; throw new Error('Unable to reach the document service. Please try again.'); }
      let data, unreadable = false;
      try { data = await response.json(); } catch (error) { if (timedOut) throw new Error('Document request timed out. Please try again.'); if (controller.signal.aborted) throw error; unreadable = true; data = {message: 'The server returned an unreadable response.'}; }
      if (response.status === 404 && !path) throw new Error('Document service unavailable. Restart the backend, then refresh documents.');
      checkResponse(response, data);
      if (unreadable) throw new Error('The server returned an unreadable response.');
      return data;
    } finally { window.clearTimeout(timer); requests.current.delete(controller); }
  }

  function showError(error) {
    if (active.current && error.name !== 'AbortError') setNotice({type: 'error', message: error.message});
  }

  function resetExploration() {
    searchSequence.current += 1;
    answerSequence.current += 1;
    setSearch(''); setSearchedPhrase(''); setMatches(null); setSearching(false);
    setQuestion(''); setAnswer(null); setThinking(false); setFocusedSection(null);
    sectionElements.current.clear();
  }

  async function openDocument(document) {
    selectionRequest.current?.abort();
    const controller = new AbortController();
    selectionRequest.current = controller;
    selectedIdRef.current = document.id;
    setSelectedId(document.id); setSelected(null); setDocumentLoading(true); setNotice(null); resetExploration();
    try {
      const data = await request('/' + encodeURIComponent(document.id), {}, controller);
      if (active.current && selectedIdRef.current === document.id) setSelected(data.document);
    } catch (error) { showError(error); }
    finally { if (active.current && selectedIdRef.current === document.id) setDocumentLoading(false); }
  }

  async function loadLibrary(refreshSelected = true) {
    const revision = libraryRevision.current;
    setLibraryLoading(true);
    try {
      const data = await request();
      if (!active.current || revision !== libraryRevision.current) return;
      setNotice(null);
      const library = Array.isArray(data.documents) ? data.documents.filter(document => document && document.id != null) : [];
      setDocuments(library); setCapabilities(data.capabilities || {});
      if (!library.some(document => document.id === selectedIdRef.current)) {
        if (library.length) openDocument(library[0]);
        else { selectedIdRef.current = null; setSelectedId(null); setSelected(null); setDocumentLoading(false); resetExploration(); }
      } else if (refreshSelected) openDocument(library.find(document => document.id === selectedIdRef.current));
    } catch (error) { showError(error); }
    finally { if (active.current) setLibraryLoading(false); }
  }

  useEffect(() => {
    active.current = true;
    loadLibrary();
    return () => {
      active.current = false;
      requests.current.forEach(controller => controller.abort());
      uploadRequest.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!processingIds) return;
    let stopped = false, timer;
    let controller;
    async function poll() {
      controller = new AbortController();
      const revision = libraryRevision.current;
      try {
        const data = await request('', {}, controller);
        if (stopped || !active.current || revision !== libraryRevision.current) return;
        const library = Array.isArray(data.documents) ? data.documents.filter(document => document && document.id != null) : [];
        const summary = library.find(document => document.id === selectedIdRef.current);
        if (summary && statusOf(selectedRef.current) === 'processing') {
          if (statusOf(summary) === 'ready') {
            const currentId = summary.id;
            const detail = await request('/' + encodeURIComponent(currentId), {}, controller);
            if (!stopped && active.current && revision === libraryRevision.current && selectedIdRef.current === currentId) setSelected(detail.document);
          } else setSelected(current => current?.id === summary.id ? {...current, ...summary} : current);
        } else if (!summary && selectedIdRef.current != null) {
          selectionRequest.current?.abort(); selectedIdRef.current = null;
          setSelectedId(null); setSelected(null); setDocumentLoading(false); resetExploration();
          if (library.length) openDocument(library[0]);
        }
        if (!stopped && active.current && revision === libraryRevision.current) {setDocuments(library); if (data.capabilities) setCapabilities(data.capabilities);}
      } catch (error) { if (!stopped) showError(error); }
      finally { if (!stopped) timer = window.setTimeout(poll, pollInterval); }
    }
    timer = window.setTimeout(poll, pollInterval);
    return () => {stopped = true; window.clearTimeout(timer); controller?.abort();};
  }, [processingIds]);

  async function uploadFiles(files) {
    if (!files?.length || upload || uploadRequest.current || libraryLoading || deleting) return;
    setDragging(false); setNotice(null);
    if (files.length !== 1) { setNotice({type: 'error', message: 'Upload one document at a time.'}); return; }
    const file = files[0], extension = file.name.split('.').pop().toLowerCase();
    if (!formats.includes(extension)) { setNotice({type: 'error', message: 'Choose a PDF, Word (.docx), PNG, JPG, JPEG, or WebP file.'}); return; }
    if (file.size > maxFileSize) { setNotice({type: 'error', message: 'Files must be {size} MB or smaller.', values: {size: maxMegabytes}}); return; }
    if (!file.size) { setNotice({type: 'error', message: 'This file is empty. Choose a document with content.'}); return; }
    setUpload({name: file.name, percent: 0, stage: 'upload'});
    try {
      const data = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        uploadRequest.current = xhr;
        xhr.open('POST', '/api/admin/documents');
        xhr.timeout = uploadTimeout;
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        xhr.setRequestHeader('X-Document-Name', encodeURIComponent(file.name));
        xhr.upload.onprogress = event => {
          if (!active.current) return;
          if (event.lengthComputable) setUpload({name: file.name, percent: Math.round(event.loaded / event.total * 100), stage: event.loaded === event.total ? 'save' : 'upload'});
        };
        xhr.upload.onload = () => { if (active.current) setUpload({name: file.name, percent: 100, stage: 'save'}); };
        xhr.onload = () => {
          let result, unreadable = false;
          try { result = JSON.parse(xhr.responseText); } catch { unreadable = true; result = {message: 'The server returned an unreadable response.'}; }
          try {
            checkResponse({status: xhr.status, ok: xhr.status >= 200 && xhr.status < 300}, result);
            if (unreadable) throw new Error('The server returned an unreadable response.');
            resolve(result);
          } catch (error) { reject(error); }
        };
        xhr.onerror = () => reject(new Error('Unable to reach the document service. Please try again.'));
        xhr.ontimeout = () => reject(new Error('Upload timed out. Refresh documents to check whether it was saved, then try again.'));
        xhr.onabort = () => reject(new DOMException('Upload canceled', 'AbortError'));
        xhr.send(file);
      });
      if (!active.current) return;
      const document = data.document;
      if (!document || document.id == null) throw new Error('The server returned an unreadable response.');
      libraryRevision.current += 1;
      selectionRequest.current?.abort();
      selectedIdRef.current = document.id; setSelectedId(document.id); setSelected(document); setDocumentLoading(false);
      setDocuments(list => [document, ...list.filter(item => item.id !== document.id)]);
      resetExploration(); setNotice({type: 'success', message: statusOf(document) === 'processing' ? 'Document saved. Text extraction continues in the background.' : 'Document uploaded and text extracted.'});
    } catch (error) { showError(error); }
    finally { if (active.current) { setUpload(null); if (fileInput.current) fileInput.current.value = ''; } uploadRequest.current = null; }
  }

  function cancelUpload() {
    uploadRequest.current?.abort();
    setNotice({type: 'success', message: 'Upload canceled. Refresh documents to check whether it was already saved.'});
  }

  async function retryDocument() {
    if (!selected || retrying) return;
    const documentId = selected.id;
    setRetrying(true); setNotice(null);
    try {
      const data = await request('/' + encodeURIComponent(documentId) + '/retry', {method: 'POST'});
      if (!active.current) return;
      if (!data.document || data.document.id !== documentId) throw new Error('The server returned an unreadable response.');
      libraryRevision.current += 1;
      setDocuments(list => list.map(document => document.id === documentId ? data.document : document));
      if (selectedIdRef.current === documentId) {selectionRequest.current?.abort(); setSelected(data.document); setDocumentLoading(false); resetExploration();}
      setNotice({type: 'success', message: 'Text extraction restarted. Your original file is saved.'});
    } catch (error) {showError(error);}
    finally {if (active.current) setRetrying(false);}
  }

  async function findText(event) {
    event.preventDefault();
    const phrase = search.trim();
    if (!phrase) { setMatches(null); setSearchedPhrase(''); return; }
    if (!selected || !hasText) return;
    const documentId = selected.id, sequence = ++searchSequence.current;
    setSearching(true); setNotice(null);
    try {
      const data = await request('/' + encodeURIComponent(documentId) + '/search?q=' + encodeURIComponent(phrase));
      if (active.current && selectedIdRef.current === documentId && searchSequence.current === sequence) {
        setMatches(Array.isArray(data.matches) ? data.matches : []); setSearchedPhrase(phrase);
      }
    } catch (error) { if (searchSequence.current === sequence) showError(error); }
    finally { if (active.current && searchSequence.current === sequence) setSearching(false); }
  }

  async function ask(mode) {
    if (!selected || !canAsk || thinking || (mode === 'answer' && !question.trim())) return;
    const documentId = selected.id, sequence = ++answerSequence.current;
    setThinking(true); setAnswer(null); setNotice(null);
    try {
      const data = await request('/' + encodeURIComponent(documentId) + '/ask', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({question: mode === 'summary' ? '' : question.trim(), mode, language}),
      });
      if (active.current && selectedIdRef.current === documentId && answerSequence.current === sequence) setAnswer(data);
    } catch (error) { if (answerSequence.current === sequence) showError(error); }
    finally { if (active.current && answerSequence.current === sequence) setThinking(false); }
  }

  async function deleteDocument() {
    if (!deleteFor || deleting) return;
    const documentId = deleteFor.id;
    setDeleting(true); setNotice(null);
    try {
      await request('/' + encodeURIComponent(documentId), {method: 'DELETE'});
      if (!active.current) return;
      libraryRevision.current += 1;
      const remaining = documentsRef.current.filter(document => document.id !== documentId);
      setDocuments(list => list.filter(document => document.id !== documentId)); setDeleteFor(null);
      if (selectedIdRef.current === documentId) {
        selectionRequest.current?.abort(); selectedIdRef.current = null;
        setSelectedId(null); setSelected(null); setDocumentLoading(false); resetExploration();
        if (remaining.length) openDocument(remaining[0]);
      }
      setNotice({type: 'success', message: 'Document deleted.'});
    } catch (error) { showError(error); }
    finally { if (active.current) setDeleting(false); }
  }

  function goToSection(sectionId) {
    const element = sectionElements.current.get(String(sectionId));
    if (!element) return;
    setFocusedSection(String(sectionId));
    element.scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center'});
    element.focus({preventScroll: true});
  }

  function dateText(created) {
    const value = typeof created === 'number' && created < 1e12 ? created * 1000 : created;
    const date = new Date(value);
    return value && !Number.isNaN(date.getTime()) ? date.toLocaleDateString(language, {timeZone: 'Asia/Baku', month: 'short', day: 'numeric', year: 'numeric'}) : t('Date unavailable');
  }
  const count = value => new Intl.NumberFormat(language).format(Number.isFinite(value) ? value : 0);
  const pageLabel = page => page ? t('Page {page}', {page}) : '';
  const pageCountLabel = document => Number.isFinite(document.pageCount) && document.pageCount > 0 ? t('{count} pages', {count: count(document.pageCount)}) : t('Page count unavailable');
  const warnings = Array.isArray(selected?.warnings) ? selected.warnings.filter(warning => typeof warning === 'string') : [];
  const typeLabels = {pdf: 'PDF documents', word: 'Word documents', images: 'Images', other: 'Other files'};
  const visibleDocuments = documents.filter(document => {
    const day = dateKey(document.created);
    return (typeFilter === 'all' || typeOf(document) === typeFilter) && String(document.name || '').toLocaleLowerCase().includes(nameFilter.trim().toLocaleLowerCase()) && (!dateFrom || day >= dateFrom) && (!dateTo || (!!day && day <= dateTo));
  }).sort((left, right) => (documentTime(left.created) - documentTime(right.created)) * (sortOrder === 'oldest' ? 1 : -1));
  const groups = new Map();
  visibleDocuments.forEach(document => {
    const day = dateKey(document.created);
    const key = groupBy === 'type' ? typeOf(document) : groupBy === 'day' ? day : groupBy === 'month' ? day.slice(0, 7) : 'all';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(document);
  });
  const groupLabel = (key, items) => groupBy === 'type' ? t(typeLabels[key]) : groupBy === 'none' ? t('All documents') : !key ? t('Date unavailable') : new Date(documentTime(items[0].created)).toLocaleDateString(language, {timeZone: 'Asia/Baku', year: 'numeric', month: 'long', ...(groupBy === 'day' ? {day: 'numeric'} : {})});
  const statusLabel = document => t(statusOf(document) === 'processing' ? 'Saved · extracting text' : statusOf(document) === 'failed' ? 'Saved · extraction failed' : 'Document ready');

  return <div className="admin-documents">
    <header className="documents-intro"><div><span className="eyebrow">{t('PRIVATE ADMIN WORKSPACE')}</span><h2>{t('Turn documents into answers.')}</h2><p>{t('Upload, extract, search, and ask questions with source references.')}</p></div><button type="button" className="document-button secondary" onClick={loadLibrary} disabled={libraryLoading || !!upload || deleting}>{t('Refresh documents')}</button></header>
    <ol className="document-pipeline" aria-label={t('Document workspace')}>
      {[['Upload', 'upload'], ['Extract text', 'document'], ['Search & ask', 'spark']].map(([label, icon], index) => <li key={label} className={(upload && index === 0) || (selected && selectedStatus === 'processing' && index === 1) ? 'is-active' : selected && (index === 0 || (index === 1 && selectedStatus === 'ready')) ? 'is-complete' : ''}><span>{selected && (index === 0 || (index === 1 && selectedStatus === 'ready')) ? <DocumentIcon name="check"/> : index + 1}</span><DocumentIcon name={icon}/><strong>{t(label)}</strong>{index < 2 && <i aria-hidden="true">→</i>}</li>)}
    </ol>
    <section className={'document-upload-zone' + (dragging ? ' is-dragging' : '') + (upload ? ' is-uploading' : '')} onDragOver={event => {event.preventDefault(); if (!upload) setDragging(true);}} onDragLeave={event => {if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);}} onDrop={event => {event.preventDefault(); setDragging(false); uploadFiles(event.dataTransfer.files);}}>
      <span className="document-upload-icon"><DocumentIcon name="upload"/></span>
      <div className="document-upload-copy"><strong>{upload ? t('Uploading {name}…', {name: upload.name}) : t('Drop a PDF, Word document, or image here')}</strong><p>{t('PDF · DOCX · PNG · JPG · WEBP')} <span>·</span> {t('Up to {size} MB per file', {size: maxMegabytes})}</p>
        {upload && <div className="document-upload-progress" role="status"><span>{t(upload.stage === 'save' ? 'Saving document…' : 'Uploading… {percent}%', {percent: upload.percent})}</span><progress aria-label={t(upload.stage === 'save' ? 'Saving document…' : 'Uploading document')} value={upload.stage === 'save' ? undefined : upload.percent} max="100"/></div>}
      </div>
      <input className="document-file-input" type="file" ref={fileInput} aria-label={t('Upload document')} accept={formats.map(format => '.' + format).join(',')} onChange={event => {const files = Array.from(event.target.files || []); event.target.value = ''; uploadFiles(files);}} disabled={libraryLoading || !!upload || deleting}/>
      <button type="button" className="document-button" onClick={() => fileInput.current?.click()} disabled={libraryLoading || !!upload || deleting}>{t('Choose a document')}</button>
      {upload && <button type="button" className="document-button secondary" onClick={cancelUpload}>{t('Cancel upload')}</button>}
    </section>
    <div className="documents-capabilities"><span>{t('Files and extracted data are saved on the server. Only administrators can access them.')}</span>{capabilities && <span className={capabilities.ocrAvailable ? 'is-connected' : ''}><i/>{t(capabilities.ocrAvailable ? 'OCR available' : 'OCR unavailable')}</span>}{capabilities && !capabilities.ocrAvailable && <small>{t('Images and scanned PDFs need OCR to extract text.')}</small>}</div>
    {notice && <p className={'document-notice ' + notice.type} role={notice.type === 'error' ? 'alert' : 'status'}>{t(notice.message, notice.values)}</p>}
    <section className="document-library-controls" aria-label={t('Organize documents')}>
      <label>{t('Find a file')}<input type="search" value={nameFilter} onChange={event => setNameFilter(event.target.value)} placeholder={t('Search file names')}/></label>
      <label>{t('Group by')}<select aria-label={t('Group by')} value={groupBy} onChange={event => setGroupBy(event.target.value)}><option value="type">{t('File type')}</option><option value="day">{t('Upload day')}</option><option value="month">{t('Upload month')}</option><option value="none">{t('No grouping')}</option></select></label>
      <label>{t('File type')}<select aria-label={t('File type')} value={typeFilter} onChange={event => setTypeFilter(event.target.value)}><option value="all">{t('All file types')}</option>{Object.entries(typeLabels).map(([type, label]) => <option key={type} value={type}>{t(label)}</option>)}</select></label>
      <label>{t('From date')}<input type="date" value={dateFrom} max={dateTo || undefined} onChange={event => setDateFrom(event.target.value)}/></label>
      <label>{t('To date')}<input type="date" value={dateTo} min={dateFrom || undefined} onChange={event => setDateTo(event.target.value)}/></label>
      <label>{t('Sort by')}<select aria-label={t('Sort by')} value={sortOrder} onChange={event => setSortOrder(event.target.value)}><option value="newest">{t('Newest first')}</option><option value="oldest">{t('Oldest first')}</option></select></label>
      <div className="document-library-filter-note"><span>{t('{count} of {total} documents', {count: visibleDocuments.length, total: documents.length})} · {t('Dates use Baku time (UTC+4).')}</span>{(nameFilter || dateFrom || dateTo || typeFilter !== 'all') && <button type="button" onClick={() => {setNameFilter(''); setDateFrom(''); setDateTo(''); setTypeFilter('all');}}>{t('Clear filters')}</button>}</div>
    </section>
    <div className="documents-layout">
      <aside className="document-library" aria-label={t('Your documents')}><header><h3>{t('Your documents')}</h3><span>{t('{count} documents', {count: documents.length})}</span></header>
        {libraryLoading ? <p className="document-library-empty" role="status">{t('Loading documents…')}</p> : !documents.length ? <div className="document-library-empty"><DocumentIcon/><strong>{t('No documents yet')}</strong><p>{t('Upload a file to start your document library.')}</p></div> : !visibleDocuments.length ? <p className="document-library-empty" role="status">{t('No documents match these filters.')}</p> : <div className="document-library-groups">{Array.from(groups, ([key, items]) => <section className="document-library-group" key={key}><h4>{groupLabel(key, items)}<span>{items.length}</span></h4><ul>{items.map(document => <li key={document.id}><button type="button" className={'document-library-item' + (selectedId === document.id ? ' is-selected' : '')} aria-label={t('Open {name}', {name: document.name})} aria-current={selectedId === document.id ? 'true' : undefined} onClick={() => openDocument(document)} disabled={deleting}><span className="document-type">{String(document.type || document.name?.split('.').pop() || 'FILE').toUpperCase()}</span><span><strong>{document.name}</strong><small className={'document-status ' + statusOf(document)}>{statusLabel(document)}</small>{statusOf(document) === 'ready' && <small>{pageCountLabel(document)} · {t('{count} words', {count: count(document.wordCount)})}</small>}<time>{dateText(document.created)}</time></span></button></li>)}</ul></section>)}</div>}
      </aside>
      <div className="document-explorer">
        {documentLoading ? <section className="document-empty-explorer" role="status"><DocumentIcon/><p>{t('Loading document…')}</p></section> : !selected ? <section className="document-empty-explorer"><DocumentIcon name="search"/><h3>{t('Select a document to explore')}</h3><p>{t('Extracted text, search results, and source references appear here.')}</p></section> : <>
          <section className="document-detail-header"><div><span className={'eyebrow document-status ' + selectedStatus}>{statusLabel(selected)}</span><h3>{selected.name}</h3><p>{selectedStatus === 'ready' && <><span>{pageCountLabel(selected)}</span><span>{t('{count} words', {count: count(selected.wordCount)})}</span><span>{extractionMethod(selected.method)}</span></>}<span>{dateText(selected.created)}</span>{Number.isFinite(selected.size) && <span>{t('{size} MB', {size: Math.round(selected.size / 1024 / 1024 * 100) / 100})}</span>}</p></div><div className="document-detail-actions">{selected.hasOriginal && <a className="document-button secondary" href={'/api/admin/documents/' + encodeURIComponent(selected.id) + '/download'} download>{t('Download original')}</a>}<button type="button" className="document-delete" onClick={() => setDeleteFor(selected)} disabled={deleting}>{t('Delete document')}</button></div></section>
          {selectedStatus !== 'ready' && <section className={'document-processing-panel ' + selectedStatus} role={selectedStatus === 'failed' ? 'alert' : 'status'}><DocumentIcon name={selectedStatus === 'failed' ? 'document' : 'check'}/><div><h3>{t(selectedStatus === 'failed' ? 'Your file is saved. Text extraction failed.' : 'Your file is saved. Extracting text…')}</h3><p>{t(selectedStatus === 'failed' ? 'Download the original or retry extraction.' : 'You can upload another file. This document updates automatically when extraction finishes.')}</p>{selectedStatus === 'processing' && <p className="document-processing-stage">{t(selected.processingStage === 'queued' ? 'Waiting to extract text…' : 'Extracting text…')}</p>}{selectedStatus === 'failed' && selected.error && <p className="document-processing-error">{t(String(selected.error))}</p>}</div>{selectedStatus === 'failed' && selected.hasOriginal && <button type="button" className="document-button" onClick={retryDocument} disabled={retrying}>{t(retrying ? 'Restarting extraction…' : 'Retry extraction')}</button>}</section>}
          {!!warnings.length && <div className="document-warnings"><strong>{t('Extraction notes')}</strong><ul>{warnings.map((warning, index) => <li key={index}>{t(sourceLabel(warning))}</li>)}</ul></div>}
          {selectedStatus === 'ready' && <>
          <section className="document-search-panel"><form onSubmit={findText}><label htmlFor="document-search">{t('Search this document')}</label><div><DocumentIcon name="search"/><input id="document-search" type="search" value={search} onChange={event => setSearch(event.target.value)} maxLength="250" placeholder={t('Search document text')} disabled={!hasText}/><button className="document-button" disabled={!hasText || searching || !search.trim()}>{t(searching ? 'Searching…' : 'Find text')}</button></div></form>
            {matches !== null && <div className="document-search-results" aria-label={t('Search results')}><header><strong>{t('{count} matches', {count: matches.length})}</strong><button type="button" onClick={() => {searchSequence.current += 1; setSearching(false); setMatches(null); setSearchedPhrase(''); setSearch('');}}>{t('Clear search')}</button></header>{!matches.length ? <p role="status">{t('No matching text found. Try another phrase.')}</p> : <ul>{matches.map((match, index) => <li key={String(match.sectionId) + '-' + index}><button type="button" aria-label={t('Open section {title}', {title: sourceLabel(match.title)})} onClick={() => goToSection(match.sectionId)}><strong>{sourceLabel(match.title)}</strong><small>{pageLabel(match.page)}</small><DocumentIcon name="search"/></button><p><HighlightedText text={match.snippet || match.text} phrase={searchedPhrase}/></p></li>)}</ul>}</div>}
          </section>
          <section className="document-assistant"><header><div><DocumentIcon name="spark"/><h3>{t('Document assistant')}</h3></div><span className={capabilities?.aiAvailable ? 'is-connected' : ''}><i/>{t(capabilities?.aiAvailable ? 'AI connected' : 'AI is not connected')}</span></header>
            {!capabilities?.aiAvailable && <p className="document-ai-unavailable">{t('Configure an AI provider to enable summaries and questions. Extraction and search remain available.')}</p>}
            <form onSubmit={event => {event.preventDefault(); ask('answer');}}><label htmlFor="document-question">{t('Question about this document')}</label><textarea id="document-question" value={question} onChange={event => setQuestion(event.target.value)} rows="2" maxLength="2000" disabled={!canAsk || thinking}/><div className="document-assistant-actions"><button type="button" className="document-button secondary" onClick={() => ask('summary')} disabled={!canAsk || thinking}>{t('Summarize document')}</button><button className="document-button" disabled={!canAsk || thinking || !question.trim()}>{t(thinking ? 'Thinking…' : 'Ask a question')}</button></div></form>
            {thinking && <p className="document-thinking" role="status"><DocumentIcon name="spark"/>{t('Thinking…')}</p>}
            {answer && <div className="document-answer" role="status"><h4>{t('Answer')}</h4><p>{String(answer.answer || '')}</p>{Array.isArray(answer.warnings) && !!answer.warnings.length && <ul className="document-answer-warnings">{answer.warnings.filter(warning => typeof warning === 'string').map((warning, index) => <li key={index}>{t(sourceLabel(warning))}</li>)}</ul>}{Array.isArray(answer.citations) && !!answer.citations.length && <div className="document-citations"><strong>{t('Sources')}</strong>{answer.citations.map((citation, index) => <button type="button" key={String(citation.sectionId) + '-' + index} onClick={() => goToSection(citation.sectionId)} disabled={!sections.some(section => String(section.id) === String(citation.sectionId))}><b>{index + 1}</b>{sourceLabel(citation.title)}<span>{pageLabel(citation.page)}</span></button>)}</div>}{answer.provider && <small>{t('Answered by {provider}', {provider: answer.provider})}</small>}</div>}
          </section>
          <section className="document-content"><header><h3>{t('Extracted content')}</h3><span>{pageCountLabel(selected)}</span></header>
            {!hasText && !sections.length ? <p className="document-no-text">{t('No readable text was extracted.')}</p> : sections.length ? sections.map((section, index) => <article key={String(section.id) + '-' + index} className={'document-section' + (focusedSection === String(section.id) ? ' is-referenced' : '')} tabIndex="-1" ref={element => {if (element) sectionElements.current.set(String(section.id), element); else sectionElements.current.delete(String(section.id));}}><header><h4>{sourceLabel(section.title) || t('Extracted text')}</h4><span>{pageLabel(section.page)}</span></header>{section.table ? <ExtractedTable table={section.table}/> : null}{!section.table && section.text && <p>{String(section.text)}</p>}</article>) : <article className="document-section"><p>{selected.text}</p></article>}
          </section>
          </>}
        </>}
      </div>
    </div>
    {deleteFor && <Dialog title={t('Delete {name}?', {name: deleteFor.name})} onClose={() => {if (!deleting) setDeleteFor(null);}}><p>{t('This removes the document and its extracted text from the library.')}</p>{notice?.type === 'error' && <p className="notice error" role="alert">{t(notice.message)}</p>}<div className="document-delete-actions"><button type="button" className="primary delete-confirm" onClick={deleteDocument} disabled={deleting}>{t(deleting ? 'Deleting…' : 'Delete')}</button><button type="button" className="secondary" onClick={() => setDeleteFor(null)} disabled={deleting}>{t('Cancel')}</button></div></Dialog>}
  </div>;
}
