import React, { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import ai from '../lib/aiAssistant';
import db from '../lib/db';
import sync from '../lib/sync';
import Tesseract from 'tesseract.js';
import { useAuth } from '../contexts/AuthContext';

// Ensure worker is configured for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

type Highlight = { id: string; page: number; text: string; note?: string; created_at: string };

export default function SmartPDFReader() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // object URL not needed since we read the File directly for rendering/OCR
  const [numPages, setNumPages] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  // lastPageRead persisted in localStorage; we don't need a separate read-only state
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selectionText, setSelectionText] = useState<string>('');
  const [floatingPos, setFloatingPos] = useState<{ x: number; y: number } | null>(null);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [badges, setBadges] = useState<string[]>([]);
  const [showReflection, setShowReflection] = useState(false);
  const [reflectionLog, setReflectionLog] = useState<any[]>([]);
  const [noteInputVisibleFor, setNoteInputVisibleFor] = useState<string | null>(null);
  const [currentNote, setCurrentNote] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [flashcards, setFlashcards] = useState<any[]>([]);
  const [pageWidth, setPageWidth] = useState<number>(600);
  const [selectedPdfId, setSelectedPdfId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [theme, setTheme] = useState<'dark'|'light'>('dark');
  const [unsyncedCount, setUnsyncedCount] = useState<number>(0);
  const [showSRS, setShowSRS] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; type: 'success'|'error'|'info'; visible: boolean }>({ text: '', type: 'info', visible: false });
  const { user } = useAuth();

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const saved = Number(localStorage.getItem('smartpdf:lastPageRead') || 1) || 1;
        setPage(saved);
        const dbHighlights = await db.highlights.orderBy('created_at').reverse().limit(200).toArray();
        setHighlights(dbHighlights as any);
        const refl = await db.reflections.orderBy('created_at').reverse().limit(200).toArray();
        setReflectionLog(refl as any);
        const fc = await db.flashcards.orderBy('created_at').reverse().limit(200).toArray();
        setFlashcards(fc as any);
        const b = JSON.parse(localStorage.getItem('smartpdf:badges') || '[]');
        setBadges(Array.isArray(b) ? b : []);
        // load most recent persisted PDF for this user if present
        try {
          const recent = await db.pdfs.orderBy('created_at').reverse().limit(1).toArray();
          if (recent && recent.length > 0) {
            setSelectedPdfId(recent[0].id);
          }
        } catch (e) {
          // ignore
        }
      } catch (e) {}
    })();

    // responsive page width + load persisted theme/zoom
    function updateWidth() {
      const padding = 48; // container padding
      const containerW = containerRef.current?.clientWidth || window.innerWidth;
      // on very small screens, leave a small gutter so the PDF isn't edge-to-edge
      const min = window.innerWidth < 420 ? 220 : 280;
      const max = window.innerWidth < 640 ? Math.min(720, containerW - padding) : 900;
      const w = Math.min(max, Math.max(min, containerW - padding));
      setPageWidth(w);
      // if on a small screen, ensure zoom isn't greater than 1 by default
      if (window.innerWidth < 480 && zoom > 1) setZoom(1);
    }
    const savedTheme = localStorage.getItem('smartpdf:theme') as 'dark'|'light' | null;
    const savedZoom = parseFloat(localStorage.getItem('smartpdf:zoom') || '') || 1;
    if (savedTheme) setTheme(savedTheme);
    if (savedZoom) setZoom(savedZoom);
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) try { URL.revokeObjectURL(previewUrl); } catch (e) {}
    };
  }, [previewUrl]);

  // poll unsynced history count every 5s for toolbar badge
  useEffect(() => {
    let mounted = true;
    async function refresh() {
      try {
        // count entries where synced is not true and belong to current user
        if (!user?.id) { if (mounted) setUnsyncedCount(0); return; }
        const all = await db.history.toArray();
        const cnt = all.filter((h:any) => !h.synced && h.data?.user_id === user.id).length;
        if (mounted) setUnsyncedCount(cnt);
      } catch (e) { }
    }
    refresh();
    const id = setInterval(refresh, 5000);
    return () => { mounted = false; clearInterval(id); };
  }, [user?.id]);

  useEffect(() => {
    // update last page read (persisted)
    // badges: simple trigger every 10 pages read cumulatively
    const pagesRead = Number(localStorage.getItem('smartpdf:pagesRead') || 0) || 0;
    const newTotal = Math.max(pagesRead, page);
    localStorage.setItem('smartpdf:pagesRead', String(newTotal));
    if (newTotal >= 10 && !badges.includes('Momentum Boost')) {
      setBadges([...badges, 'Momentum Boost']);
    }
  }, [page]);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f && (f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf'))) {
      // create an object URL for consistent rendering across browsers
      try {
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
      } catch (e) {}
      const url = URL.createObjectURL(f);
      setPreviewUrl(url);
      setFile(f);
      // persist PDF blob to Dexie for offline access
      (async () => {
        try {
          const arr = await f.arrayBuffer();
          const blob = new Blob([arr], { type: 'application/pdf' });
          const id = crypto.randomUUID();
          await db.pdfs.add({ id, user_id: user?.id, filename: f.name, blob, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
          setSelectedPdfId(id);
        } catch (e) { console.warn('persist pdf failed', e); }
      })();
      setPage(1);
      setAiResponse(null);
      // small-screen fit
      if (window.innerWidth < 480) setZoom(1);
    }
  }

  // if a persisted PDF is selected, load it from Dexie and create an object URL for rendering
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!selectedPdfId) return;
      try {
        const rec = await db.pdfs.get(selectedPdfId);
        if (!rec || !rec.blob) return;
        // revoke previous
        if (previewUrl) try { URL.revokeObjectURL(previewUrl); } catch (e) {}
        const url = URL.createObjectURL(rec.blob);
        if (mounted) setPreviewUrl(url);
      } catch (e) {
        console.warn('load persisted pdf failed', e);
      }
    })();
    return () => { mounted = false; };
  }, [selectedPdfId]);

  function onDocumentLoadSuccess({ numPages: n }: { numPages: number }) {
    setNumPages(n);
  }

  function onTextSelection() {
    const sel = window.getSelection();
    const txt = sel ? sel.toString().trim() : '';
    if (txt) {
      const range = sel!.getRangeAt(0).getBoundingClientRect();
      setSelectionText(txt);
      setFloatingPos({ x: range.left + range.width / 2, y: range.top - 10 });
    } else {
      setSelectionText('');
      setFloatingPos(null);
    }
  }

  useEffect(() => {
    document.addEventListener('mouseup', onTextSelection);
    return () => document.removeEventListener('mouseup', onTextSelection);
  }, []);

  async function runAi(action: 'explain' | 'translate' | 'define') {
    if (!selectionText) return;
    setAiResponse('Thinking...');
    try {
      let prompt = '';
      if (action === 'explain') prompt = `Explain like I'm 12:\n\n${selectionText}`;
      if (action === 'translate') prompt = `Translate to Swahili:\n\n${selectionText}`;
      if (action === 'define') prompt = `Define and give a real-world example:\n\n${selectionText}`;
      const ans = await ai.callGemini(prompt, 0.2, undefined, undefined, 'analyze');
      setAiResponse(String(ans));
    } catch (e: any) {
      setAiResponse(`AI error: ${e.message}`);
    }
  }

  async function addHighlight(note?: string) {
    if (!selectionText) return;
    const h: Highlight = { id: crypto.randomUUID(), page, text: selectionText, note, created_at: new Date().toISOString() };
    try {
      await db.highlights.add({ ...h, pdf_filename: file?.name, user_id: user?.id });
      await db.history.add({ id: crypto.randomUUID(), table_name: 'highlights', record_id: h.id, action: 'create', data: { ...h, user_id: user?.id }, created_at: new Date().toISOString() });
      const all = await db.highlights.orderBy('created_at').reverse().limit(200).toArray();
      setHighlights(all as any);
      setSelectionText('');
      setFloatingPos(null);
      setNoteInputVisibleFor(null);
      setCurrentNote('');
    } catch (e) {
      console.error('save highlight failed', e);
    }
  }

  async function generateFlashcardFromHighlight(h: Highlight) {
    try {
      setAiResponse('Generating flashcard...');
      const prompt = `Create a single question and answer flashcard from this excerpt:\n\n${h.text}\n\nReturn in JSON with keys question and answer.`;
      const res = await ai.callGemini(prompt, 0.2, undefined, undefined, 'generate');
      let parsed: any = null;
      try { parsed = JSON.parse(String(res)); } catch (e) {
        parsed = { question: `What is this about?`, answer: String(res) };
      }
  const card = { id: crypto.randomUUID(), highlight_id: h.id, question: parsed.question || parsed.q || 'Q', answer: parsed.answer || parsed.a || parsed.answer_text || String(res), created_at: new Date().toISOString(), user_id: user?.id };
  await db.flashcards.add(card as any);
  await db.history.add({ id: crypto.randomUUID(), table_name: 'flashcards', record_id: card.id, action: 'create', data: card, created_at: new Date().toISOString() });
      const fc = await db.flashcards.orderBy('created_at').reverse().limit(200).toArray();
      setFlashcards(fc as any);
      setAiResponse('Flashcard created');
    } catch (e: any) {
      setAiResponse(`Flashcard generation failed: ${e.message}`);
    }
  }

  async function saveReflection(answers: { learned: string; aligned: string; community: string }) {
    const r = { id: crypto.randomUUID(), date: new Date().toISOString().slice(0,10), q_energized: answers.learned, q_alignment: answers.aligned, q_custom1: answers.community, created_at: new Date().toISOString() };
    try {
      await db.reflections.add({ ...r, user_id: user?.id });
      await db.history.add({ id: crypto.randomUUID(), table_name: 'reflections', record_id: r.id, action: 'create', data: { ...r, user_id: user?.id }, created_at: new Date().toISOString() });
      const refl = await db.reflections.orderBy('created_at').reverse().limit(200).toArray();
      setReflectionLog(refl as any);
      setShowReflection(false);
      if (!badges.includes('Reflectionist')) {
        const nb = [...badges, 'Reflectionist'];
        setBadges(nb); localStorage.setItem('smartpdf:badges', JSON.stringify(nb));
      }
    } catch (e) {
      console.error('save reflection failed', e);
    }
  }

  async function runOcrOnCurrentPage() {
    if (!file) return;
    setOcrLoading(true);
    try {
      // Load PDF from the uploaded File and render the current page to a canvas using pdfjs
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const pdfPage = await pdf.getPage(page);
      // choose a scale to make OCR reliable on mobile too
      const scale = 2.0;
      const viewport = pdfPage.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context not available');
      const renderContext = { canvasContext: ctx as any, viewport };
      await pdfPage.render(renderContext).promise;
      // Run Tesseract on the rendered canvas
      const worker = await Tesseract.createWorker();
      await worker.load();
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      const { data: { text } } = await worker.recognize(canvas as any);
      await worker.terminate();
      const cleaned = String(text || '').trim();
      setSelectionText(cleaned);
      setAiResponse(cleaned ? 'OCR finished — selection filled' : 'OCR finished — no text detected');
    } catch (e: any) {
      setAiResponse(`OCR failed: ${e?.message || String(e)}`);
    } finally { setOcrLoading(false); }
  }

  // compute effective width based on zoom and available pageWidth
  const containerW = containerRef.current?.clientWidth || window.innerWidth;
  // leave small gutters on mobile to allow panning/scrolling and avoid cropping
  const gutter = window.innerWidth < 480 ? 24 : 32;
  const base = Math.min(pageWidth, containerW - gutter);
  const effectiveWidth = Math.max(180, Math.floor(base * zoom));

  return (
    <div className={`p-3 sm:p-6 max-w-5xl mx-auto ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-black'}`} ref={containerRef}>
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label className="block">
            <span className="sr-only">Upload PDF</span>
            <input type="file" accept="application/pdf" onChange={onFileChange} className="text-sm" />
          </label>
          <div className="text-sm">{file ? file.name : 'No file selected'}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-800/20 rounded px-2 py-1">
            <button onClick={() => { setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2))); localStorage.setItem('smartpdf:zoom', String(Math.max(0.25, +(zoom - 0.25).toFixed(2)))); }} className="px-2 py-1 bg-slate-700 text-white rounded text-sm">−</button>
            <div className="text-xs px-2">{Math.round(zoom * 100)}%</div>
            <button onClick={() => { setZoom(z => Math.min(3, +(z + 0.25).toFixed(2))); localStorage.setItem('smartpdf:zoom', String(Math.min(3, +(zoom + 0.25).toFixed(2)))); }} className="px-2 py-1 bg-slate-700 text-white rounded text-sm">+</button>
            <button onClick={() => { setZoom(1); localStorage.setItem('smartpdf:zoom', '1'); }} className="px-2 py-1 bg-slate-700 text-white rounded text-sm">Fit</button>
          </div>
          <button onClick={async () => {
            try {
              const el = containerRef.current as any;
              if (!document.fullscreenElement) await el.requestFullscreen(); else await document.exitFullscreen();
            } catch (e) { console.warn('fullscreen failed', e); }
          }} className="px-3 py-1 bg-slate-800 text-white rounded">Full</button>
          <button onClick={() => { const next = theme === 'dark' ? 'light' : 'dark'; setTheme(next); localStorage.setItem('smartpdf:theme', next); }} className="px-3 py-1 bg-slate-800 text-white rounded">Theme</button>
          <button onClick={() => setShowReflection(true)} className="px-3 py-1 bg-slate-800 text-white rounded">Reflection</button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 p-2 rounded flex flex-col items-center">
          <div className="w-full flex justify-center">
            <div style={{ maxWidth: '100%', width: effectiveWidth }} className="shadow-sm touch-auto" role="region">
              {file || previewUrl ? (
                <div className="w-full overflow-auto" style={{ touchAction: 'pan-y pinch-zoom' }}>
                  <Document file={previewUrl || file} onLoadSuccess={onDocumentLoadSuccess} options={{ cMapUrl: `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/cmaps/`, cMapPacked: true }}>
                    <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                      <Page pageNumber={page} width={effectiveWidth} renderTextLayer={true} renderAnnotationLayer={false} />
                    </div>
                  </Document>
                </div>
              ) : (
                <div className="p-8 text-slate-400">Drop a PDF or use the file selector above to start reading.</div>
              )}
            </div>
          </div>
          {/* Saved PDFs quick list */}
          <div className="w-full mt-3 text-sm">
            <div className="text-slate-400 mb-1">Saved PDFs</div>
            <SavedPdfList onOpen={async (id) => { setSelectedPdfId(id); }} />
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <div>
              Page {page} / {numPages || '—'}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} className="px-3 py-1 bg-slate-800 text-white rounded">Prev</button>
              <button onClick={() => setPage(Math.min(numPages || 1, page + 1))} className="px-3 py-1 bg-slate-800 text-white rounded">Next</button>
            </div>
          </div>
          <div className="mt-2 h-2 bg-slate-800 rounded">
            <div className="h-2 bg-cyan-500 rounded" style={{ width: `${((page || 1) / (numPages || 1)) * 100}%` }} />
          </div>
        </div>

        <aside className={`md:w-1/3 w-full p-4 rounded ${theme==='dark' ? 'bg-slate-900/30' : 'bg-white/90 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-slate-400">PDF id: {selectedPdfId || '—'}</div>
            <div className="text-xs text-slate-400">{lastSync ? `Last sync: ${new Date(lastSync).toLocaleString()}` : ''}</div>
          </div>
          <h3 className="text-white font-semibold mb-2">Highlights</h3>
          <div className="space-y-2 max-h-[60vh] overflow-auto">
            {highlights.map((h) => (
              <div key={h.id} className="p-2 bg-slate-800/50 rounded">
                <div className="flex justify-between items-start">
                  <div className="text-xs text-slate-300">Pg {h.page} • {new Date(h.created_at).toLocaleString()}</div>
                  <div className="flex gap-1">
                    <button onClick={() => { setNoteInputVisibleFor(h.id); setCurrentNote(h.note || ''); }} className="text-xs text-slate-400">Add/Edit Note</button>
                    <button onClick={() => generateFlashcardFromHighlight(h)} className="text-xs text-emerald-400">Make Card</button>
                  </div>
                </div>
                <div className="text-sm text-white truncate">{h.text}</div>
                {h.note && <div className="text-xs text-slate-400">Note: {h.note}</div>}
                {noteInputVisibleFor === h.id && (
                  <div className="mt-2 flex gap-2">
                    <input value={currentNote} onChange={(e) => setCurrentNote(e.target.value)} className="flex-1 p-1 bg-slate-800 text-white rounded text-sm" />
                    <button onClick={async () => { await db.highlights.update(h.id, { note: currentNote }); const all = await db.highlights.orderBy('created_at').reverse().limit(200).toArray(); setHighlights(all as any); setNoteInputVisibleFor(null); setCurrentNote(''); }} className="px-2 bg-cyan-600 text-white rounded text-sm">Save</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4">
            <h4 className="text-white font-medium">AI</h4>
            <div className="mt-2 text-slate-300 text-sm">
              {aiResponse || 'Select text in the document to enable Explain / Translate / Define.'}
            </div>
            <div className="mt-2 flex gap-2">
              <button onClick={() => runOcrOnCurrentPage()} className="px-2 py-1 bg-slate-700 text-white rounded text-sm">{ocrLoading ? 'OCR...' : 'Run OCR (fallback)'}</button>
              <button onClick={async () => { if (highlights.length) await generateFlashcardFromHighlight(highlights[0]); }} className="px-2 py-1 bg-emerald-600 text-white rounded text-sm">Quick Flashcard</button>
              <div className="text-xs text-slate-400 self-center">Cards: {flashcards.length}</div>
            </div>
          </div>

          <div className="mt-4">
            <h4 className="text-white font-medium">SRS Review</h4>
            <div className="mt-2 text-slate-300 text-sm">
              <SRSReviewer onUpdate={async (cardId: string, res: 'correct'|'incorrect') => {
                try {
                  const card = await db.flashcards.get(cardId);
                  if (!card) return;
                  // simple SM-2 like update: if correct, increase interval and ease; if wrong, reset
                  const now = new Date();
                  let interval = (card.interval_days || 0);
                  let ease = (card.ease || 2.5);
                  if (res === 'correct') {
                    if (interval < 1) interval = 1; else interval = Math.ceil(interval * ease);
                    ease = Math.min(4.0, ease + 0.15);
                    card.correct_count = (card.correct_count || 0) + 1;
                  } else {
                    interval = 1; ease = Math.max(1.3, ease - 0.2); card.incorrect_count = (card.incorrect_count || 0) + 1;
                  }
                  card.interval_days = interval; card.ease = ease; card.due_at = new Date(now.getTime() + interval * 24*3600*1000).toISOString().slice(0,10);
                  card.updated_at = new Date().toISOString();
                  await db.flashcards.put(card as any);
                } catch (e) { console.warn(e); }
              }} />
            </div>
          </div>

          <div className="mt-4">
            <h4 className="text-white font-medium">Reflections</h4>
            <div className="mt-2 text-slate-300 text-sm max-h-40 overflow-auto">
              {reflectionLog.length === 0 && <div className="text-slate-500">No reflections yet</div>}
              {reflectionLog.map((r, idx) => (
                <div key={idx} className="p-2 bg-slate-800/50 rounded mb-2 text-xs">
                  <div className="font-medium text-white">{new Date(r.created_at).toLocaleString()}</div>
                  <div className="text-slate-300">Learned: {r.learned}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

        {/* Mobile floating toolbar (bottom) */}
        <div className="fixed bottom-4 left-0 right-0 flex justify-center pointer-events-none sm:hidden">
          <div className="pointer-events-auto bg-slate-800/90 text-white rounded-full px-3 py-2 flex items-center gap-2 shadow-lg">
            <button onClick={() => { setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2))); localStorage.setItem('smartpdf:zoom', String(Math.max(0.25, +(zoom - 0.25).toFixed(2)))); }} className="px-2 py-1 bg-transparent text-white rounded">−</button>
            <button onClick={() => runOcrOnCurrentPage()} className="px-2 py-1 bg-transparent text-white rounded">OCR</button>
            <button onClick={async () => { setShowSRS(true); }} className="px-2 py-1 bg-transparent text-white rounded">Review</button>
            <button onClick={async () => { const userId = user?.id || null; const ok = await sync.pushLocalHistoryToServer(userId as any); if (ok) { setToast({ text: 'Sync successful', type: 'success', visible: true }); setLastSync(new Date().toISOString()); setTimeout(()=>setToast({ text: '', type: 'info', visible: false }), 3000); } else { setToast({ text: 'Sync failed', type: 'error', visible: true }); setTimeout(()=>setToast({ text: '', type: 'info', visible: false }), 3000); } }} className="relative px-2 py-1 bg-transparent text-white rounded">Sync
              {unsyncedCount > 0 && <span className="absolute -top-2 -right-3 bg-rose-500 text-white text-xs rounded-full px-1">{unsyncedCount}</span>}
            </button>
            <button onClick={() => { setZoom(1); localStorage.setItem('smartpdf:zoom', '1'); }} className="px-2 py-1 bg-transparent text-white rounded">Fit</button>
          </div>
        </div>

      {/* Floating action when text selected */}
      {selectionText && floatingPos && (() => {
        // clamp the floating toolbar inside the viewport
        const vpw = typeof window !== 'undefined' ? window.innerWidth : 1024;
        const left = Math.min(Math.max(12, floatingPos.x), vpw - 80);
        const top = Math.max(12, floatingPos.y);
        return (
          <div style={{ position: 'fixed', left, top, transform: 'translateX(-50%)' }} className="z-50">
            <div className="flex gap-2 bg-slate-900/80 p-2 rounded shadow-lg">
              <button onClick={() => runAi('explain')} className="px-2 py-1 bg-cyan-600 text-white rounded text-sm">Explain</button>
              <button onClick={() => runAi('translate')} className="px-2 py-1 bg-indigo-600 text-white rounded text-sm">Translate</button>
              <button onClick={() => runAi('define')} className="px-2 py-1 bg-amber-600 text-white rounded text-sm">Define</button>
              <button onClick={() => addHighlight()} className="px-2 py-1 bg-slate-700 text-white rounded text-sm">Highlight</button>
            </div>
          </div>
        );
      })()}

      {/* Reflection modal */}
      {showReflection && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60">
          <div className="bg-slate-900 p-6 rounded w-96">
            <h3 className="text-white text-lg mb-2">Reflection</h3>
            <ReflectionForm onSave={saveReflection} onCancel={() => setShowReflection(false)} />
          </div>
        </div>
      )}

      {/* SRS modal */}
      {showSRS && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60">
          <div className="bg-slate-900 p-4 rounded w-11/12 max-w-md">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-white text-lg">Review Due Cards</h3>
              <button onClick={() => setShowSRS(false)} className="text-slate-300">Close</button>
            </div>
            <div className="max-h-[60vh] overflow-auto">
              <SRSReviewer onUpdate={async (cardId, res) => {
                try {
                  const card = await db.flashcards.get(cardId);
                  if (!card) return;
                  const now = new Date();
                  let interval = (card.interval_days || 0);
                  let ease = (card.ease || 2.5);
                  if (res === 'correct') {
                    if (interval < 1) interval = 1; else interval = Math.ceil(interval * ease);
                    ease = Math.min(4.0, ease + 0.15);
                    card.correct_count = (card.correct_count || 0) + 1;
                  } else {
                    interval = 1; ease = Math.max(1.3, ease - 0.2); card.incorrect_count = (card.incorrect_count || 0) + 1;
                  }
                  card.interval_days = interval; card.ease = ease; card.due_at = new Date(now.getTime() + interval * 24*3600*1000).toISOString().slice(0,10);
                  card.updated_at = new Date().toISOString();
                  await db.flashcards.put(card as any);
                } catch (e) { console.warn(e); }
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.visible && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-80">
          <div className={`px-4 py-2 rounded shadow ${toast.type === 'success' ? 'bg-emerald-600 text-white' : toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-600 text-white'}`}>
            {toast.text}
          </div>
        </div>
      )}
    </div>
  );
}

function ReflectionForm({ onSave, onCancel }: { onSave: (a: any) => void; onCancel: () => void }) {
  const [learned, setLearned] = useState('');
  const [aligned, setAligned] = useState('');
  const [community, setCommunity] = useState('');
  return (
    <div>
      <div className="mb-2">
        <label className="text-sm text-slate-300">What did you learn?</label>
        <textarea value={learned} onChange={(e) => setLearned(e.target.value)} className="w-full mt-1 p-2 bg-slate-800 text-white rounded" />
      </div>
      <div className="mb-2">
        <label className="text-sm text-slate-300">Did this align with your goals?</label>
        <input value={aligned} onChange={(e) => setAligned(e.target.value)} className="w-full mt-1 p-2 bg-slate-800 text-white rounded" />
      </div>
      <div className="mb-4">
        <label className="text-sm text-slate-300">How can this help your community?</label>
        <input value={community} onChange={(e) => setCommunity(e.target.value)} className="w-full mt-1 p-2 bg-slate-800 text-white rounded" />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1 bg-slate-700 text-white rounded">Cancel</button>
        <button onClick={() => onSave({ learned, aligned, community })} className="px-3 py-1 bg-cyan-600 text-white rounded">Save</button>
      </div>
    </div>
  );
}

function SRSReviewer({ onUpdate }: { onUpdate: (cardId: string, result: 'correct'|'incorrect') => Promise<void> }) {
  const [due, setDue] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().slice(0,10);
        const arr = await db.flashcards.where('due_at').belowOrEqual(today).limit(50).toArray();
        setDue(arr as any[]);
      } catch (e) { setDue([]); }
    })();
  }, []);

  return (
    <div className="space-y-2">
      {due.length === 0 && <div className="text-slate-500">No cards due for review</div>}
      {due.map((c: any) => (
        <div key={c.id} className="p-2 bg-slate-800/50 rounded">
          <div className="text-sm text-white">Q: {c.question}</div>
          <div className="text-xs text-slate-300">A: {c.answer}</div>
          <div className="mt-2 flex gap-2">
            <button onClick={async () => { await onUpdate(c.id, 'correct'); setDue(d => d.filter((x:any)=>x.id!==c.id)); }} className="px-2 py-1 bg-emerald-600 text-white rounded text-sm">Correct</button>
            <button onClick={async () => { await onUpdate(c.id, 'incorrect'); setDue(d => d.filter((x:any)=>x.id!==c.id)); }} className="px-2 py-1 bg-rose-600 text-white rounded text-sm">Incorrect</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SavedPdfList({ onOpen }: { onOpen: (id: string) => void }) {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const arr = await db.pdfs.orderBy('created_at').reverse().limit(10).toArray();
        if (mounted) setList(arr as any[]);
      } catch (e) { if (mounted) setList([]); }
    })();
    return () => { mounted = false; };
  }, []);
  if (!list || list.length === 0) return <div className="text-slate-500">No saved PDFs</div>;
  return (
    <div className="space-y-1">
      {list.map(p => (
        <div key={p.id} className="flex items-center justify-between p-2 bg-slate-800/40 rounded">
          <div className="truncate text-xs text-white max-w-[70%]">{p.filename}</div>
          <div className="flex items-center gap-2">
            <button onClick={() => onOpen(p.id)} className="px-2 py-1 text-xs bg-cyan-600 rounded text-white">Open</button>
            <button onClick={async () => { await db.pdfs.delete(p.id); const arr = await db.pdfs.orderBy('created_at').reverse().limit(10).toArray(); setList(arr as any[]); }} className="px-2 py-1 text-xs bg-rose-600 rounded text-white">Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
