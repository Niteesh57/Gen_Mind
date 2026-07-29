import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  generateLearningMedia,
  getStudioVoices,
  inspectStudioSources,
  uploadStudioDocument,
  type LearningMediaResult,
  type StudioSource,
  type StudioVoice,
} from './services/studioClient';
import styles from './App.module.css';

// ── Device ID ────────────────────────────────────────────────────────────────
function getOrCreateDeviceId(): string {
  const key = 'genmind_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `dev_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    localStorage.setItem(key, id);
  }
  return id;
}

// ── Session API ──────────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:8000/api';

interface Session {
  id: string;
  device_id: string;
  title: string;
  mode: string;
  source_count: number;
  word_count: number;
  created_at: string;
  updated_at: string;
  output_url?: string;
  output_mode?: string;
  narration?: string;
}

async function apiListSessions(deviceId: string): Promise<Session[]> {
  const r = await fetch(`${API_BASE}/sessions?device_id=${encodeURIComponent(deviceId)}`);
  return r.ok ? r.json() : [];
}
async function apiCreateSession(deviceId: string, title: string, mode: string): Promise<Session> {
  const r = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: deviceId, title, mode }),
  });
  return r.json();
}
async function apiUpdateSession(sessionId: string, updates: Partial<Session>): Promise<Session> {
  const r = await fetch(`${API_BASE}/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return r.json();
}
async function apiDeleteSession(sessionId: string): Promise<void> {
  await fetch(`${API_BASE}/sessions/${sessionId}`, { method: 'DELETE' });
}

// ── Constants ────────────────────────────────────────────────────────────────
const FALLBACK_VOICES: StudioVoice[] = [
  { id: 'en-US-JennyNeural', label: 'Jenny — US English (Female)', language: 'en-US' },
  { id: 'en-US-GuyNeural', label: 'Guy — US English (Male)', language: 'en-US' },
  { id: 'en-US-AriaNeural', label: 'Aria — US English (Female)', language: 'en-US' },
  { id: 'en-US-ChristopherNeural', label: 'Christopher — US English (Male)', language: 'en-US' },
  { id: 'en-IN-NeerjaNeural', label: 'Neerja — Indian English (Female)', language: 'en-IN' },
  { id: 'en-IN-PrabhatNeural', label: 'Prabhat — Indian English (Male)', language: 'en-IN' },
  { id: 'hi-IN-SwaraNeural', label: 'Swara — Hindi (Female)', language: 'hi-IN' },
  { id: 'hi-IN-MadhurNeural', label: 'Madhur — Hindi (Male)', language: 'hi-IN' },
  { id: 'es-ES-ElviraNeural', label: 'Elvira — Spanish (Female)', language: 'es-ES' },
  { id: 'es-ES-AlvaroNeural', label: 'Alvaro — Spanish (Male)', language: 'es-ES' },
];
const STYLE_PRESETS = ['Clean Editorial', 'Cinematic Dark', 'Minimalist White', 'Vibrant Infographic', 'Technical Blueprint'];
const ACCEPT_DOCS = '.pdf,.txt,.md,.docx,.pptx';

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return iso; }
}
function fmtWords(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`; }

type AddMode = 'url' | 'file' | 'text';

// ════════════════════════════════════════════════════════════════════════════
export const App = () => {
  const deviceId = useMemo(getOrCreateDeviceId, []);

  // ── View ────────────────────────────────────────────────────────────────
  const [view, setView] = useState<'home' | 'studio'>('home');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // ── Source Intake ───────────────────────────────────────────────────────
  const [addMode, setAddMode] = useState<AddMode>('url');
  const [urlInput, setUrlInput] = useState('');
  const [rawText, setRawText] = useState('');
  const [deepResearch, setDeepResearch] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [sources, setSources] = useState<StudioSource[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [analyzingLabel, setAnalyzingLabel] = useState('');
  const [analyzingPhase, setAnalyzingPhase] = useState<'idle' | 'scraping' | 'preparing' | 'done'>('idle');
  const [viewingSource, setViewingSource] = useState<StudioSource | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sidebarFileRef = useRef<HTMLInputElement>(null);

  // ── Options ─────────────────────────────────────────────────────────────
  const [topic, setTopic] = useState('New Media');
  const [mode, setMode] = useState<'video' | 'conversation'>('video');
  const [imageCount, setImageCount] = useState(8);
  const [presetStyle, setPresetStyle] = useState('Clean Editorial');
  const [customStyle, setCustomStyle] = useState('');
  const [podcastTone, setPodcastTone] = useState<'friendly' | 'serious' | 'deep_dive'>('friendly');
  const [participantCount, setParticipantCount] = useState(2);
  const [participantVoices, setParticipantVoices] = useState<string[]>([]);
  const [lang, setLang] = useState('en-US');
  const [voices, setVoices] = useState<StudioVoice[]>([]);
  const [voice, setVoice] = useState('en-US-JennyNeural');

  // ── Generation ──────────────────────────────────────────────────────────
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<LearningMediaResult | null>(null);
  const [error, setError] = useState('');

  // ── Init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    apiListSessions(deviceId)
      .then(setSessions).catch(() => setSessions([]))
      .finally(() => setSessionsLoading(false));
  }, [deviceId]);

  useEffect(() => {
    getStudioVoices()
      .then((list) => setVoices(list.length ? list : FALLBACK_VOICES))
      .catch(() => setVoices(FALLBACK_VOICES));
  }, []);

  const languageVoices = useMemo(
    () => voices.filter((v) => v.language === lang || lang === 'en-US'),
    [voices, lang]
  );
  useEffect(() => {
    if (languageVoices.length) {
      setVoice((v) => languageVoices.some((x) => x.id === v) ? v : languageVoices[0].id);
      setParticipantVoices(() =>
        Array.from({ length: participantCount }, (_, i) =>
          languageVoices[i % languageVoices.length]?.id || languageVoices[0].id
        )
      );
    }
  }, [lang, languageVoices, participantCount]);

  // ── Navigation ──────────────────────────────────────────────────────────
  const openNewSession = useCallback(async () => {
    const session = await apiCreateSession(deviceId, 'New Media', mode);
    setActiveSession(session);
    setSessions((prev) => [session, ...prev]);
    setStep(1); setUrlInput(''); setRawText(''); setFiles([]);
    setSources([]); setResult(null); setError(''); setTopic('New Media');
    setAddMode('url');
    setView('studio');
  }, [deviceId, mode]);

  const openSession = useCallback((s: Session) => {
    setActiveSession(s); setTopic(s.title);
    setMode((s.mode as 'video' | 'conversation') || 'video');
    setSources([]); setResult(null); setError('');
    setStep(s.output_url ? 4 : 1);
    setView('studio');
  }, []);

  const goHome = useCallback(() => {
    setView('home'); setActiveSession(null);
    apiListSessions(deviceId).then(setSessions).catch(() => {});
  }, [deviceId]);

  const deleteSession = useCallback(async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    await apiDeleteSession(sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  }, []);

  // ── Add Source (URL / File / Text) ──────────────────────────────────────
  const handleAddSource = async (extraFiles?: File[]) => {
    const urlList = urlInput.split(/\n|,/).map((x) => x.trim()).filter(Boolean);
    const uploadList = extraFiles ?? files;
    const hasRawText = rawText.trim().length > 0;

    if (!urlList.length && !uploadList.length && !hasRawText) {
      setError('Please provide a URL, upload a document, or paste raw text.');
      return;
    }
    setLoadingSources(true);
    setError('');
    setAnalyzingPhase('scraping');

    if (urlList.length) {
      const isDeep = deepResearch;
      setAnalyzingLabel(
        isDeep
          ? `Scraping ${urlList.length} URL${urlList.length > 1 ? 's' : ''} + crawling sub-links (depth 1)…`
          : `Scraping ${urlList.length} URL${urlList.length > 1 ? 's' : ''}…`
      );
    } else if (uploadList.length) {
      setAnalyzingLabel(`Reading ${uploadList.length} document${uploadList.length > 1 ? 's' : ''}…`);
    } else {
      setAnalyzingLabel('Processing raw text…');
    }

    try {
      let textSource: StudioSource | null = null;
      if (hasRawText) {
        const words = rawText.trim().split(/\s+/).length;
        textSource = {
          id: `text_${Date.now()}`,
          kind: 'document',
          name: 'Pasted Text',
          headline: 'Pasted Text',
          overview: rawText.trim().slice(0, 200),
          archive_url: '',
          excerpt: rawText.trim().slice(0, 200),
          content: rawText.trim(),
          word_count: words,
          status: 'ready',
          is_subpage: false,
          parent_url: null,
        } as StudioSource;
      }

      // Phase 1: scrape
      const [webSources, docSources] = await Promise.all([
        urlList.length ? inspectStudioSources(urlList, deepResearch, activeSession?.id) : [],
        Promise.all(uploadList.map(uploadStudioDocument)),
      ]);

      // Phase 2: preparing overview (LLM already ran server-side, but show state briefly)
      setAnalyzingPhase('preparing');
      setAnalyzingLabel('Preparing overview…');

      const allNew = [
        ...webSources,
        ...docSources,
        ...(textSource ? [textSource] : []),
      ];
      const combined = [...sources, ...allNew];
      setSources(combined);

      // Update title from first parent (non-subpage) headline
      const readyParent = allNew.find((s) => s.status === 'ready' && s.headline && !s.is_subpage);
      if (readyParent?.headline && (topic === 'New Media' || topic === '')) {
        setTopic(readyParent.headline);
        if (activeSession) {
          const updated = await apiUpdateSession(activeSession.id, { title: readyParent.headline });
          setActiveSession(updated);
        }
      }

      setUrlInput(''); setRawText(''); setFiles([]);
      setAnalyzingPhase('done');

      if (combined.some((s) => s.status === 'ready') && step === 1) setStep(2);
      else if (!combined.some((s) => s.status === 'ready')) {
        setError('None of the provided sources could be processed.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not analyze sources.');
    } finally {
      setLoadingSources(false);
      setAnalyzingLabel('');
      setAnalyzingPhase('idle');
    }
  };

  // Handle sidebar file button upload (immediately triggers add)
  const handleSidebarFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    setFiles(picked);
    await handleAddSource(picked);
    e.target.value = '';
  };

  // ── Generate ────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!topic.trim()) { setError('Please enter a topic title.'); return; }
    setGenerating(true); setError('');
    try {
      const activeStyle = customStyle.trim() || presetStyle;
      const res = await generateLearningMedia({
        project_id: activeSession?.id || `media_${Date.now()}`,
        session_id: activeSession?.id,
        topic,
        image_count: imageCount,
        image_style: activeStyle,
        language: lang,
        output_mode: mode,
        voice,
        podcast_tone: podcastTone,
        participant_count: participantCount,
        participant_voices: mode === 'conversation' ? participantVoices : [],
        source_urls: sources.filter((s) => s.kind === 'url').map((s) => s.source_url || ''),
        source_assets: sources.map((s) => s.archive_url),
        source_context: sources.map((s) => s.content || s.excerpt),
      });
      setResult(res); setStep(4);
      if (activeSession) {
        const updated = await apiUpdateSession(activeSession.id, { title: topic, mode });
        setActiveSession(updated);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed.');
    } finally { setGenerating(false); }
  };

  const removeSource = (id: string) => setSources((prev) => prev.filter((s) => s.id !== id));
  const totalWords = sources.reduce((acc, s) => acc + (s.word_count || 0), 0);

  // ══════════════════════════════════════════════════════════════════════════
  // HOME VIEW
  // ══════════════════════════════════════════════════════════════════════════
  if (view === 'home') {
    return (
      <div className={styles.appShell}>
        <header className={styles.globalHeader}>
          <div className={styles.brandGroup}>
            <div className={styles.brandLogoMark}>G</div>
            <span className={styles.brandName}>GenMind Studio</span>
          </div>
        </header>
        <main className={styles.homeView}>
          <div className={styles.homeGreeting}>
            <h1 className={styles.homeTitle}>Recent Media Sessions</h1>
            <p className={styles.homeSubtitle}>Pick up where you left off, or create something new.</p>
          </div>
          <p className={styles.sectionLabel}>Your Sessions</p>
          <div className={styles.sessionGrid}>
            <div className={styles.createCard} onClick={openNewSession} id="new-session-btn">
              <div className={styles.createCardIcon}>+</div>
              <span className={styles.createCardLabel}>New Media Session</span>
            </div>
            {sessionsLoading ? (
              <div className={styles.loadingState} style={{ gridColumn: 'span 3' }}>
                <div className={styles.loadingSpinner} />
                <span className={styles.loadingText}>Loading sessions...</span>
              </div>
            ) : sessions.map((s) => (
              <div key={s.id} className={styles.sessionCard} onClick={() => openSession(s)} id={`session-card-${s.id}`}>
                <div className={styles.sessionCardActions}>
                  <button className={styles.sessionMenuBtn} onClick={(e) => deleteSession(e, s.id)} title="Delete">×</button>
                </div>
                <div className={`${styles.sessionCardThumb} ${s.mode === 'conversation' ? styles.thumbAudio : styles.thumbVideo}`}>
                  {s.mode === 'conversation' ? '🎙' : '🎬'}
                </div>
                <div className={styles.sessionCardTitle}>{s.title}</div>
                <div className={styles.sessionCardMeta}>
                  <span className={styles.sessionMetaText}>{formatDate(s.updated_at)}</span>
                  {s.source_count > 0 && <><span className={styles.sessionMetaDot} /><span className={styles.sessionMetaText}>{s.source_count} src</span></>}
                  {s.word_count > 0 && <><span className={styles.sessionMetaDot} /><span className={styles.sessionMetaText}>{fmtWords(s.word_count)}w</span></>}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STUDIO VIEW (3-column)
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className={styles.appShell}>
      <header className={styles.globalHeader}>
        <div className={styles.brandGroup} onClick={goHome}>
          <div className={styles.brandLogoMark}>G</div>
          <span className={styles.brandName}>GenMind Studio</span>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnSecondary} onClick={goHome} id="btn-back-home">All Sessions</button>
          <button className={styles.btnPrimary} onClick={openNewSession} id="btn-new-media">+ New Media</button>
        </div>
      </header>

      <div className={styles.studioView}>

        {/* ─── LEFT: Sources Panel ─────────────────────────────────────── */}
        <aside className={styles.sourcesPanel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Sources</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {sources.length > 0 && <span className={styles.wordsBadge}>{fmtWords(totalWords)}w</span>}
              <span className={styles.countBadge}>{sources.length}</span>
            </div>
          </div>

          <div className={styles.panelBody}>
            {/* Loading state */}
            {loadingSources && (
              <div className={styles.analyzingBanner}>
                <div className={styles.analyzingSpinner} />
                <span className={styles.analyzingText}>{analyzingLabel || 'Analyzing…'}</span>
              </div>
            )}

            {/* Source list */}
            {sources.length === 0 && !loadingSources ? (
              <div className={styles.emptyPanel}>
                <div className={styles.emptyPanelIcon}>
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className={styles.emptyPanelTitle}>No sources yet</p>
                <p className={styles.emptyPanelSub}>Add a link, upload a file, or paste text below.</p>
              </div>
            ) : (
              sources.map((s) => {
                const isSubpage = !!s.is_subpage;
                const kindLabel =
                  s.kind === 'url'
                    ? s.mode === 'deep'
                      ? isSubpage ? 'Depth-1' : 'Deep'
                      : 'Web'
                    : s.kind === 'pdf' ? 'PDF'
                    : s.kind === 'word' ? 'Word'
                    : s.kind === 'ppt' ? 'PPT'
                    : s.name === 'Pasted Text' ? 'Text'
                    : 'Doc';
                const kindStyle =
                  s.kind === 'url'
                    ? s.mode === 'deep'
                      ? isSubpage ? styles.kindDeepSub : styles.kindDeep
                      : styles.kindUrl
                    : styles.kindDoc;

                return (
                  <div
                    key={s.id}
                    className={`${styles.sourceChip} ${isSubpage ? styles.sourceChipSubpage : ''}`}
                  >
                    <div className={styles.sourceChipRow}>
                      {/* Favicon */}
                      {s.favicon_url ? (
                        <img
                          src={s.favicon_url}
                          alt=""
                          width={14}
                          height={14}
                          className={styles.sourceFavicon}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : null}
                      <span className={`${styles.sourceTypePill} ${kindStyle}`}>{kindLabel}</span>
                      <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                        <button className={styles.linkBtn} onClick={() => setViewingSource(s)}>View</button>
                        <button className={styles.linkBtnDanger} onClick={() => removeSource(s.id)}>×</button>
                      </div>
                    </div>
                    <div className={styles.sourceChipTitle}>{s.headline || s.name}</div>
                    {s.overview && (
                      <div className={styles.sourceChipExcerpt}>{s.overview.slice(0, 100)}</div>
                    )}
                    {s.source_url && (
                      <div className={styles.sourceChipUrl} title={s.source_url}>
                        {new URL(s.source_url).hostname}
                      </div>
                    )}
                    {s.word_count ? (
                      <span className={styles.sourceChipMeta}>{fmtWords(s.word_count)} words</span>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          {/* ── Add More Sources Footer ── */}
          <div className={styles.sidebarAddBar}>
            {/* Mode switcher */}
            <div className={styles.addModeRow}>
              {([['url', 'Link'], ['file', 'File'], ['text', 'Text']] as [AddMode, string][]).map(([m, lbl]) => (
                <button
                  key={m}
                  className={`${styles.addModeTab} ${addMode === m ? styles.addModeTabActive : ''}`}
                  onClick={() => setAddMode(m)}
                  id={`add-mode-${m}`}
                >
                  {lbl}
                </button>
              ))}
            </div>

            {addMode === 'url' && (
              <div className={styles.addBarUrlRow}>
                <input
                  id="sidebar-url-input"
                  className={styles.addBarInput}
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !loadingSources && handleAddSource()}
                  placeholder="Paste URL…"
                  disabled={loadingSources}
                />
                <label className={styles.deepTogglePill} title="Crawl sub-pages (depth 1)">
                  <input type="checkbox" checked={deepResearch} onChange={(e) => setDeepResearch(e.target.checked)} />
                  Deep
                </label>
                <button className={styles.addBarBtn} onClick={() => handleAddSource()} disabled={loadingSources || !urlInput.trim()} id="btn-add-url">
                  {loadingSources ? <span className={styles.spinnerSm} /> : '→'}
                </button>
              </div>
            )}

            {addMode === 'file' && (
              <div className={styles.addBarFileRow}>
                <button className={styles.uploadIconBtn} title="Upload PDF" onClick={() => { sidebarFileRef.current?.click(); }}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  PDF / Word
                </button>
                <button className={styles.uploadIconBtn} title="Upload PPT" onClick={() => { sidebarFileRef.current?.click(); }}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 0v10m0-10h2a2 2 0 012 2v8a2 2 0 01-2 2h-2" />
                  </svg>
                  PPT
                </button>
                <input
                  ref={sidebarFileRef}
                  type="file"
                  accept={ACCEPT_DOCS}
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleSidebarFileUpload}
                />
                {loadingSources && <span className={styles.spinnerSm} style={{ color: 'var(--color-accent)' }} />}
              </div>
            )}

            {addMode === 'text' && (
              <div className={styles.addBarTextRow}>
                <textarea
                  id="sidebar-raw-text"
                  className={styles.addBarTextarea}
                  rows={4}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Paste raw text here…"
                  disabled={loadingSources}
                />
                <button
                  className={styles.addBarBtn}
                  onClick={() => handleAddSource()}
                  disabled={loadingSources || !rawText.trim()}
                  id="btn-add-text"
                  style={{ width: '100%', marginTop: 6 }}
                >
                  {loadingSources ? <><span className={styles.spinnerSm} /> Processing…</> : 'Add Text'}
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* ─── CENTER: Studio Workspace ─────────────────────────────────── */}
        <main className={styles.studioCenter}>
          <div className={styles.studioCenterHeader}>
            <input
              id="session-title-input"
              className={styles.sessionTitleInput}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Session title…"
              onBlur={() => activeSession && apiUpdateSession(activeSession.id, { title: topic })}
            />
            <div className={styles.stepPills}>
              {([
                [1, '1. Sources'],
                [2, '2. Format'],
                [3, '3. Generate'],
                [4, '4. Output'],
              ] as [number, string][]).map(([n, label]) => (
                <button
                  key={n}
                  className={`${styles.stepPill} ${step === n ? styles.active : step > n ? styles.done : styles.pending}`}
                  onClick={() => step >= n && setStep(n as 1 | 2 | 3 | 4)}
                  id={`step-pill-${n}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.studioCenterBody}>
            {error && (
              <div className={styles.errorBanner}>
                <span className={styles.errorBannerIcon}>!</span>
                <p className={styles.errorBannerText}>{error}</p>
              </div>
            )}

            {/* ─ Step 1: Source Summary ─ */}
            {step === 1 && (
              <div className={styles.intakeSection}>
                {loadingSources ? (
                  <div className={styles.loadingState}>
                    <div className={styles.loadingSpinner} />
                    <p className={styles.loadingText}>
                      {analyzingPhase === 'preparing'
                        ? 'Preparing overview…'
                        : analyzingLabel || 'Analyzing sources…'}
                    </p>
                    <p className={styles.loadingSubText}>
                      {analyzingPhase === 'scraping'
                        ? 'Collecting all links and scraping page content. Please wait.'
                        : 'AI is generating headline and overview for each source.'}
                    </p>
                  </div>
                ) : sources.length > 0 ? (
                  /* ── Source Overview Cards ── */
                  <div className={styles.sourceSummaryList}>
                    <div className={styles.sourceSummaryHeader}>
                      <p className={styles.sectionLabel}>
                        {sources.length} Source{sources.length !== 1 ? 's' : ''}
                        {' '}&middot;{' '}
                        {fmtWords(totalWords)} words total
                      </p>
                      <button className={styles.btnPrimary} onClick={() => setStep(2)} id="btn-go-format">
                        Continue →
                      </button>
                    </div>
                    <div className={styles.sourceSummaryScroll}>
                      {sources.map((s) => {
                        const isSubpage = !!s.is_subpage;
                        const kindLabel =
                          s.kind === 'url'
                            ? s.mode === 'deep'
                              ? isSubpage ? 'Depth-1 Sub-page' : 'Web (Deep)'
                              : 'Web'
                            : s.kind === 'pdf' ? 'PDF'
                            : s.kind === 'word' ? 'Word'
                            : s.kind === 'ppt' ? 'PPT'
                            : s.name === 'Pasted Text' ? 'Text'
                            : 'Document';
                        const kindStyle =
                          s.kind === 'url'
                            ? s.mode === 'deep'
                              ? isSubpage ? styles.kindDeepSub : styles.kindDeep
                              : styles.kindUrl
                            : styles.kindDoc;
                        return (
                          <div
                            key={s.id}
                            className={`${styles.sourceSummaryCard} ${isSubpage ? styles.sourceSummaryCardSub : ''}`}
                          >
                            <div className={styles.sourceSummaryTop}>
                              {s.favicon_url && (
                                <img
                                  src={s.favicon_url}
                                  alt=""
                                  width={16}
                                  height={16}
                                  className={styles.sourceFavicon}
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                              )}
                              <span className={`${styles.sourceTypePill} ${kindStyle}`}>{kindLabel}</span>
                              {s.word_count ? (
                                <span className={styles.sourceChipMeta}>{fmtWords(s.word_count)} words</span>
                              ) : null}
                              <button className={styles.linkBtn} onClick={() => setViewingSource(s)} style={{ marginLeft: 'auto' }}>
                                View content
                              </button>
                            </div>
                            <div className={styles.sourceSummaryTitle}>{s.headline || s.name}</div>
                            {s.source_url && (
                              <div className={styles.sourceSummaryUrl}>{s.source_url}</div>
                            )}
                            {/* Overview — scrollable */}
                            {s.overview && (
                              <div className={styles.sourceSummaryOverview}>{s.overview}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* ── Empty state ── */
                  <div className={styles.intakeEmpty}>
                    <p className={styles.intakeEmptyTitle}>Add your first source</p>
                    <p className={styles.intakeEmptySub}>Paste a link, upload a PDF/Word/PPT, or paste raw text in the Sources panel on the left.</p>
                    <div className={styles.intakeEmptyArrow}>← Use the Sources panel</div>
                  </div>
                )}
              </div>
            )}

            {/* ─ Step 2: Format & Style ─ */}
            {step === 2 && (
              <div className={styles.formatSection}>
                <div className={styles.formatCard}>
                  <p className={styles.formatCardTitle}>Output Format</p>
                  <div className={styles.modeToggle}>
                    {([['video', 'Video Explanation', 'AI scene images + narration'], ['conversation', 'Podcast Audio', 'Multi-speaker dialogue']] as const).map(([m, t, s]) => (
                      <div key={m} className={`${styles.modeCard} ${mode === m ? styles.selected : ''}`} onClick={() => setMode(m)} id={`mode-${m}`}>
                        <div className={styles.modeCardTitle}>{t}</div>
                        <div className={styles.modeCardSub}>{s}</div>
                      </div>
                    ))}
                  </div>

                  {mode === 'video' && (
                    <>
                      <div className={styles.formRow}>
                        <label className={styles.formLabel}>Scene Images: <span className={styles.rangeValue}>{imageCount}</span></label>
                        <input id="image-count-slider" type="range" min={5} max={15} value={imageCount} onChange={(e) => setImageCount(Number(e.target.value))} className={styles.rangeInput} />
                      </div>
                      <div className={styles.formRow}>
                        <label className={styles.formLabel}>Visual Style</label>
                        <div className={styles.styleChips}>
                          {STYLE_PRESETS.map((s) => (
                            <button key={s} className={`${styles.styleChip} ${presetStyle === s && !customStyle ? styles.selected : ''}`} onClick={() => { setPresetStyle(s); setCustomStyle(''); }}>{s}</button>
                          ))}
                        </div>
                        <input id="custom-style-input" className={styles.inputField} placeholder="Or describe your own style…" value={customStyle} onChange={(e) => setCustomStyle(e.target.value)} style={{ marginTop: 8 }} />
                      </div>
                    </>
                  )}
                  {mode === 'conversation' && (
                    <>
                      <div className={styles.formRow}>
                        <label className={styles.formLabel}>Podcast Tone</label>
                        <div className={styles.toneChips}>
                          {([['friendly', 'Friendly'], ['serious', 'Serious'], ['deep_dive', 'Deep Dive']] as const).map(([t, l]) => (
                            <div key={t} className={`${styles.toneChip} ${podcastTone === t ? styles.selected : ''}`} onClick={() => setPodcastTone(t)} id={`tone-${t}`}>{l}</div>
                          ))}
                        </div>
                      </div>
                      <div className={styles.formRow}>
                        <label className={styles.formLabel}>Speakers: <span className={styles.rangeValue}>{participantCount}</span></label>
                        <input type="range" min={1} max={4} value={participantCount} onChange={(e) => setParticipantCount(Number(e.target.value))} className={styles.rangeInput} />
                      </div>
                    </>
                  )}
                  <div className={styles.formRow}>
                    <label className={styles.formLabel}>Narrator Voice</label>
                    <select id="voice-select" className={styles.selectField} value={voice} onChange={(e) => setVoice(e.target.value)}>
                      {languageVoices.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                    </select>
                  </div>
                </div>
                <button id="btn-continue-to-generate" className={styles.btnPrimary} style={{ alignSelf: 'flex-start' }} onClick={() => setStep(3)}>
                  Continue to Generate
                </button>
              </div>
            )}

            {/* ─ Step 3: Generate ─ */}
            {step === 3 && (
              <div className={styles.generateSection}>
                <div className={styles.generateCta}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--color-navy)', marginBottom: 6, letterSpacing: -0.3 }}>
                      Ready to generate
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                      {mode === 'video'
                        ? `${imageCount} AI widescreen scenes · ${customStyle || presetStyle} style`
                        : `${participantCount}-speaker ${podcastTone.replace('_', ' ')} podcast`}
                    </p>
                  </div>
                  <div style={{ width: '100%', padding: '16px 20px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', border: '1px solid rgba(15,23,42,.08)', boxShadow: 'var(--shadow-sm)' }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Topic</p>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-navy)' }}>{topic}</p>
                    <p style={{ fontSize: 11, color: 'var(--color-faint)', marginTop: 4 }}>{sources.length} source{sources.length !== 1 ? 's' : ''} · {fmtWords(totalWords)} words</p>
                  </div>
                  <button id="btn-generate-media" className={styles.generateBtn} onClick={handleGenerate} disabled={generating}>
                    {generating ? <><span className={styles.spinner} />Generating with GenBlaze…</> : 'Generate Media'}
                  </button>
                  {generating && (
                    <div className={styles.loadingState}>
                      <div className={styles.loadingSpinner} />
                      <p className={styles.loadingText}>GenBlaze Pipeline running…</p>
                      <p className={styles.loadingSubText}>AI scene images generating (16:9 PC widescreen)</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─ Step 4: Output ─ */}
            {step === 4 && result && (
              <div className={styles.outputSection}>
                {result.mode === 'video' && result.output_url && (
                  <div className={styles.outputCard}>
                    <div className={styles.outputCardHeader}>
                      <span className={styles.outputCardTitle}>Video Explanation ({result.images?.length || 0} Scenes)</span>
                      <a href={`http://localhost:8000${result.output_url}`} download className={styles.outputDownloadBtn}>Download MP4</a>
                    </div>
                    <div className={styles.outputMediaWrap}>
                      <video id="output-video" className={styles.outputMedia} controls preload="metadata">
                        <source src={`http://localhost:8000${result.output_url}`} type="video/mp4" />
                      </video>
                    </div>
                  </div>
                )}
                {result.mode === 'conversation' && result.output_url && (
                  <div className={styles.outputCard}>
                    <div className={styles.outputCardHeader}>
                      <span className={styles.outputCardTitle}>Podcast Audio ({result.turns?.length || 0} turns)</span>
                      <a href={`http://localhost:8000${result.output_url}`} download className={styles.outputDownloadBtn}>Download MP3</a>
                    </div>
                    <div style={{ padding: '20px 24px' }}>
                      <audio id="output-audio" controls style={{ width: '100%' }}>
                        <source src={`http://localhost:8000${result.output_url}`} type="audio/mpeg" />
                      </audio>
                    </div>
                  </div>
                )}
                {result.mode === 'conversation' && result.turns && result.turns.length > 0 && (
                  <div className={styles.outputCard}>
                    <div className={styles.outputCardHeader}>
                      <span className={styles.outputCardTitle}>Narration Script</span>
                    </div>
                    <div className={styles.scriptBlock}>
                      {result.turns.map((t) => (
                        <div key={t.index} className={styles.scriptLine}>
                          {t.speaker_name && <div className={styles.scriptLineSpeaker}>{t.speaker_name}</div>}
                          {t.narration}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <button className={styles.btnSecondary} onClick={() => setStep(1)} id="btn-edit-sources">
                  Edit Sources
                </button>
              </div>
            )}
          </div>
        </main>

        {/* ─── RIGHT: Studio Output Panel ──────────────────────────────── */}
        <aside className={styles.studioPanel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Studio</span>
          </div>
          <div className={styles.studioPanelBody}>
            {result ? (
              <div className={styles.outputResultCard}>
                <div className={styles.outputResultTitle}>{topic}</div>
                <div className={styles.outputResultSub}>
                  {result.mode === 'video'
                    ? `${result.images?.length || 0} scenes · MP4`
                    : `${result.turns?.length || 0} turns · MP3`}
                </div>
                {result.output_url && (
                  <a href={`http://localhost:8000${result.output_url}`} download className={styles.outputDownloadBtn} style={{ fontSize: 12, padding: '6px 12px' }}>
                    {result.mode === 'video' ? 'Download MP4' : 'Download MP3'}
                  </a>
                )}
              </div>
            ) : (
              <div className={styles.emptyPanel}>
                <div className={styles.emptyPanelIcon}>
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.868V15.13a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className={styles.emptyPanelTitle}>No output yet</p>
                <p className={styles.emptyPanelSub}>After generating, your video or podcast will appear here.</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Source Content Modal */}
      {viewingSource && (
        <div className={styles.modalOverlay} onClick={() => setViewingSource(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{viewingSource.headline || viewingSource.name}</span>
              <button className={styles.modalClose} onClick={() => setViewingSource(null)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.contentText}>{viewingSource.content || viewingSource.excerpt}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
