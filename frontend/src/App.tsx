import { useEffect, useMemo, useState } from 'react';
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

const fallbackVoices: StudioVoice[] = [
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

export const App = () => {
  const [sessionTitle, setSessionTitle] = useState<string>('New Media');
  const [step, setStep] = useState<number>(1);
  const [urls, setUrls] = useState<string>('');
  const [deepResearch, setDeepResearch] = useState<boolean>(false);
  const [files, setFiles] = useState<File[]>([]);
  const [sources, setSources] = useState<StudioSource[]>([]);
  const [loadingSources, setLoadingSources] = useState<boolean>(false);
  const [viewingSource, setViewingSource] = useState<StudioSource | null>(null);

  // Media Options
  const [mode, setMode] = useState<'video' | 'conversation'>('video');
  const [topic, setTopic] = useState<string>('');
  
  // Video Options
  const [imageCount, setImageCount] = useState<number>(8); // Range 5 to 15
  const [presetStyle, setPresetStyle] = useState<string>('Clean Editorial');
  const [customStyle, setCustomStyle] = useState<string>('');

  // Podcast Options
  const [podcastTone, setPodcastTone] = useState<'friendly' | 'serious' | 'deep_dive'>('friendly');
  const [participantCount, setParticipantCount] = useState<number>(2); // 1 to 4 speakers
  const [participantVoices, setParticipantVoices] = useState<string[]>([]);

  // Language & Voices
  const [lang, setLang] = useState<string>('en-US');
  const [voices, setVoices] = useState<StudioVoice[]>([]);
  const [voice, setVoice] = useState<string>('en-US-JennyNeural');

  // Generation State & Output
  const [generating, setGenerating] = useState<boolean>(false);
  const [result, setResult] = useState<LearningMediaResult | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    getStudioVoices()
      .then((list) => setVoices(list.length ? list : fallbackVoices))
      .catch(() => setVoices(fallbackVoices));
  }, []);

  const languageVoices = useMemo(
    () => voices.filter((v) => v.language === lang || lang === 'en-US'),
    [voices, lang]
  );

  useEffect(() => {
    if (languageVoices.length) {
      setVoice((v) => (languageVoices.some((x) => x.id === v) ? v : languageVoices[0].id));
      setParticipantVoices(() =>
        Array.from({ length: participantCount }, (_, i) =>
          languageVoices[i % languageVoices.length]?.id || languageVoices[0].id
        )
      );
    }
  }, [lang, languageVoices, participantCount]);

  const handleAnalyzeSources = async () => {
    const list = urls.split(/\n|,/).map((x) => x.trim()).filter(Boolean);
    if (!list.length && !files.length) {
      setError('Please provide at least one URL link or upload a document.');
      return;
    }
    setLoadingSources(true);
    setError('');
    try {
      const [webSources, docSources] = await Promise.all([
        list.length ? inspectStudioSources(list, deepResearch) : [],
        Promise.all(files.map(uploadStudioDocument)),
      ]);
      const combined = [...webSources, ...docSources];
      setSources(combined);

      // Auto-update session title from first source headline
      const readySource = combined.find((s) => s.status === 'ready' && s.headline);
      if (readySource && readySource.headline) {
        setSessionTitle(readySource.headline);
        setTopic(readySource.headline);
      }

      if (combined.some((s) => s.status === 'ready')) {
        setStep(2);
      } else {
        setError('None of the provided sources could be processed.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not analyze sources.');
    } finally {
      setLoadingSources(false);
    }
  };

  const handleCreateMedia = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic title for generation.');
      return;
    }
    setGenerating(true);
    setError('');

    try {
      const activeStyle = customStyle.trim() ? customStyle.trim() : presetStyle;
      const payload = {
        project_id: `media_${Date.now()}`,
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
      };

      const res = await generateLearningMedia(payload);
      setResult(res);
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const resetSession = () => {
    setSessionTitle('New Media');
    setStep(1);
    setUrls('');
    setFiles([]);
    setSources([]);
    setResult(null);
    setError('');
  };

  const totalWords = sources.reduce((acc, s) => acc + (s.word_count || 0), 0);

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.brandRow}>
          <div className={styles.brandBadge}>M</div>
          <div>
            <h1 className={styles.brandTitle}>NotebookLM Gen Media Studio</h1>
            <p className={styles.brandSub}>Session: <strong>{sessionTitle}</strong></p>
          </div>
        </div>
        <button className={styles.newSessionBtn} onClick={resetSession}>+ New Media</button>
      </header>

      {/* Main Grid Layout */}
      <main className={styles.workspace}>
        {/* Left Column: Notebook Sources */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h3>Sources ({sources.length})</h3>
            <span className={styles.wordBadge}>{totalWords} words</span>
          </div>

          <div className={styles.sourceList}>
            {sources.length === 0 ? (
              <div className={styles.emptySidebar}>
                <p>No active sources.</p>
                <small>Add URLs or upload PDF/Docs on the right to ground your media generation.</small>
              </div>
            ) : (
              sources.map((s) => (
                <div key={s.id} className={styles.sourceCard}>
                  <div className={styles.sourceCardHeader}>
                    <span className={styles.typeBadge}>{s.kind === 'url' ? (s.mode === 'deep' ? 'Deep Web (Depth 1)' : 'Web Page') : 'Document'}</span>
                    <button className={styles.linkBtn} onClick={() => setViewingSource(s)}>View Content</button>
                  </div>
                  <strong className={styles.sourceTitle}>{s.headline || s.name}</strong>
                  <p className={styles.sourceExcerpt}>{s.overview || s.excerpt}</p>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Right Column: Workflow Wizard */}
        <section className={styles.mainContent}>
          {/* Progress Step Indicator */}
          <div className={styles.stepBar}>
            <div className={`${styles.stepTab} ${step >= 1 ? styles.activeTab : ''}`}>1. Source Intake</div>
            <div className={`${styles.stepTab} ${step >= 2 ? styles.activeTab : ''}`}>2. Format & Style</div>
            <div className={`${styles.stepTab} ${step >= 3 ? styles.activeTab : ''}`}>3. Generation</div>
            <div className={`${styles.stepTab} ${step >= 4 ? styles.activeTab : ''}`}>4. Studio Output</div>
          </div>

          {/* STEP 1: SOURCE INTAKE */}
          {step === 1 && (
            <div className={styles.card}>
              <h2>Ingest Information Sources</h2>
              <p className={styles.cardSub}>
                Provide website links or upload documents (PDF, text). Normal URL mode scrapes the page directly; Deep mode crawls direct subpages up to depth 1.
              </p>

              <div className={styles.fieldGroup}>
                <div className={styles.labelRow}>
                  <label>Website URLs</label>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={deepResearch}
                      onChange={(e) => setDeepResearch(e.target.checked)}
                    />
                    <span>Enable Deep Research (Scrape 1st-level child links)</span>
                  </label>
                </div>
                <textarea
                  className={styles.textarea}
                  rows={4}
                  value={urls}
                  onChange={(e) => setUrls(e.target.value)}
                  placeholder="https://example.com/article1&#10;https://example.com/article2"
                />
              </div>

              <div className={styles.fieldGroup}>
                <label>PDF or Text Files</label>
                <div className={styles.dropzone}>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.txt,.md"
                    onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  />
                  <p>Click or drop PDF / text files here</p>
                  <small>{files.length > 0 ? `${files.length} file(s) attached` : 'Text will be extracted automatically'}</small>
                </div>
              </div>

              {error && <div className={styles.errorBanner}>{error}</div>}

              <button
                className={styles.primaryBtn}
                onClick={handleAnalyzeSources}
                disabled={loadingSources}
              >
                {loadingSources ? 'Processing & Extracting Content...' : 'Analyze Sources & Continue →'}
              </button>
            </div>
          )}

          {/* STEP 2: FORMAT & STYLE */}
          {step === 2 && (
            <div className={styles.card}>
              <h2>Configure Generation Output</h2>
              <p className={styles.cardSub}>Select Video Explanation or Audio Podcast, then define visual style and voice settings.</p>

              <div className={styles.modeSelectorGrid}>
                <div
                  className={`${styles.modeBox} ${mode === 'video' ? styles.selectedBox : ''}`}
                  onClick={() => setMode('video')}
                >
                  <h3>Video Explanation</h3>
                  <p>5 to 15 visual scene images stitched seamlessly with Microsoft Voice narration into an MP4 video.</p>
                </div>

                <div
                  className={`${styles.modeBox} ${mode === 'conversation' ? styles.selectedBox : ''}`}
                  onClick={() => setMode('conversation')}
                >
                  <h3>Audio Podcast</h3>
                  <p>Multi-speaker discussion (1 to 4 participants) compiled into a single master MP3 audio file.</p>
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label>Topic / Media Title</label>
                <input
                  type="text"
                  className={styles.input}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Deep Dive into Machine Learning Architecture"
                />
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.fieldGroup}>
                  <label>Language</label>
                  <select className={styles.select} value={lang} onChange={(e) => setLang(e.target.value)}>
                    <option value="en-US">English (US)</option>
                    <option value="en-IN">English (India)</option>
                    <option value="hi-IN">Hindi</option>
                    <option value="es-ES">Spanish</option>
                  </select>
                </div>
              </div>

              {/* VIDEO SPECIFIC SETTINGS */}
              {mode === 'video' ? (
                <>
                  <div className={styles.fieldGroup}>
                    <div className={styles.labelRow}>
                      <label>Image Count (Range: 5 to 15 Images)</label>
                      <strong>{imageCount} Images</strong>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={15}
                      value={imageCount}
                      onChange={(e) => setImageCount(Number(e.target.value))}
                      className={styles.slider}
                    />
                  </div>

                  <div className={styles.fieldRow}>
                    <div className={styles.fieldGroup}>
                      <label>Preset Image Style</label>
                      <select
                        className={styles.select}
                        value={presetStyle}
                        onChange={(e) => setPresetStyle(e.target.value)}
                      >
                        <option value="Clean Editorial">Clean Editorial (Light)</option>
                        <option value="Minimalist Light">Minimalist Light Slate</option>
                        <option value="Cinematic Dark">Cinematic Dark Mode</option>
                        <option value="Modern Infographic">Modern Infographic</option>
                      </select>
                    </div>

                    <div className={styles.fieldGroup}>
                      <label>Custom Image Style (Optional)</label>
                      <input
                        type="text"
                        className={styles.input}
                        value={customStyle}
                        onChange={(e) => setCustomStyle(e.target.value)}
                        placeholder="e.g., Blueprint Architectural Diagram"
                      />
                    </div>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label>Microsoft Voice Narrator</label>
                    <select className={styles.select} value={voice} onChange={(e) => setVoice(e.target.value)}>
                      {languageVoices.map((v) => (
                        <option key={v.id} value={v.id}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                /* PODCAST AUDIO SETTINGS */
                <>
                  <div className={styles.fieldRow}>
                    <div className={styles.fieldGroup}>
                      <label>Podcast Tone / Style</label>
                      <select
                        className={styles.select}
                        value={podcastTone}
                        onChange={(e) => setPodcastTone(e.target.value as any)}
                      >
                        <option value="friendly">Friendly & Conversational</option>
                        <option value="serious">Serious & Professional Discussion</option>
                        <option value="deep_dive">Technical Deep Dive</option>
                      </select>
                    </div>

                    <div className={styles.fieldGroup}>
                      <label>Number of Podcast Speakers</label>
                      <select
                        className={styles.select}
                        value={participantCount}
                        onChange={(e) => setParticipantCount(Number(e.target.value))}
                      >
                        <option value={1}>1 Speaker Solo Narration</option>
                        <option value={2}>2 Speakers Dialogue</option>
                        <option value={3}>3 Speakers Discussion</option>
                        <option value={4}>4 Speakers Panel Call</option>
                      </select>
                    </div>
                  </div>

                  <div className={styles.speakerGrid}>
                    {participantVoices.map((vId, idx) => (
                      <div key={idx} className={styles.speakerBox}>
                        <label>Speaker {idx + 1} Voice</label>
                        <select
                          className={styles.select}
                          value={vId}
                          onChange={(e) => {
                            const next = [...participantVoices];
                            next[idx] = e.target.value;
                            setParticipantVoices(next);
                          }}
                        >
                          {languageVoices.map((v) => (
                            <option key={v.id} value={v.id}>{v.label}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {error && <div className={styles.errorBanner}>{error}</div>}

              <div className={styles.actionRow}>
                <button className={styles.secondaryBtn} onClick={() => setStep(1)}>← Back</button>
                <button className={styles.primaryBtn} onClick={() => setStep(3)}>Proceed to Generation →</button>
              </div>
            </div>
          )}

          {/* STEP 3: GENERATION PIPELINE */}
          {step === 3 && (
            <div className={styles.card}>
              <h2>Synthesize Media</h2>
              <p className={styles.cardSub}>
                Generating {mode === 'video' ? `${imageCount} continuous visual image frames` : `${participantCount}-speaker podcast audio`} with Microsoft Neural Voices.
              </p>

              {generating ? (
                <div className={styles.loadingContainer}>
                  <div className={styles.loaderSpinner}></div>
                  <p>Synthesizing audio narration and compiling media chunks...</p>
                </div>
              ) : (
                <div className={styles.confirmBox}>
                  <p>Ready to synthesize based on <strong>{sources.length} active source(s)</strong>.</p>
                  {error && <div className={styles.errorBanner}>{error}</div>}
                  <div className={styles.actionRow}>
                    <button className={styles.secondaryBtn} onClick={() => setStep(2)}>← Back</button>
                    <button className={styles.primaryBtn} onClick={handleCreateMedia}>Generate Media Now</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: STUDIO OUTPUT */}
          {step === 4 && result && (
            <div className={styles.card}>
              <div className={styles.outputHeader}>
                <div>
                  <h2>Generated Media Package</h2>
                  <p className={styles.cardSub}>Saved in public directory for viewing and download.</p>
                </div>
                <button className={styles.secondaryBtn} onClick={() => setStep(1)}>Start Another Media</button>
              </div>

              {/* Player Container */}
              <div className={styles.playerContainer}>
                {result.mode === 'video' && result.output_url && (
                  <video
                    src={result.output_url}
                    controls
                    autoPlay
                    className={styles.videoPlayer}
                  />
                )}

                {result.mode === 'conversation' && result.output_url && (
                  <div className={styles.audioPlayerBox}>
                    <p className={styles.audioTitle}>Podcast Audio Stream ({participantCount} Speakers)</p>
                    <audio src={result.output_url} controls autoPlay className={styles.audioPlayer} />
                  </div>
                )}

                {result.output_url && (
                  <a
                    href={result.output_url}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className={styles.downloadBtn}
                  >
                    Download {result.mode === 'video' ? 'MP4 Video File' : 'MP3 Audio File'}
                  </a>
                )}
              </div>

              {/* Generated Image Frames for Video */}
              {result.mode === 'video' && result.images && result.images.length > 0 && (
                <div className={styles.framesSection}>
                  <h3>Generated Visual Scene Frames ({result.images.length} Images)</h3>
                  <div className={styles.framesGrid}>
                    {result.images.map((img) => (
                      <div key={img.index} className={styles.frameCard}>
                        <img src={img.url} alt={img.title} />
                        <small>{img.title}</small>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Script Text View */}
              <div className={styles.scriptBox}>
                <h3>Generated Narration Script</h3>
                <pre className={styles.scriptContent}>{result.narration}</pre>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Content Inspector Modal */}
      {viewingSource && (
        <div className={styles.modalBackdrop} onClick={() => setViewingSource(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{viewingSource.name}</h3>
              <button className={styles.closeBtn} onClick={() => setViewingSource(null)}>✕</button>
            </div>
            <p className={styles.modalSub}>
              Type: {viewingSource.kind} | Mode: {viewingSource.mode || 'standard'} | Words: {viewingSource.word_count || 0}
            </p>
            <textarea
              readOnly
              className={styles.modalTextarea}
              value={viewingSource.content || viewingSource.excerpt}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
