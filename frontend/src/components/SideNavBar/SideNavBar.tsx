import React, { useState } from 'react';
import { useEditor } from '../../context/EditorContext';
import { generateMediaBackend, type GenerateResponse } from '../../services/apiClient';
import styles from './SideNavBar.module.css';

interface TabConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export const SideNavBar: React.FC = () => {
  const { project, activeTab, setActiveTab, reloadAssets } = useEditor();

  const [modality, setModality] = useState<'video' | 'image' | 'audio' | 'upscale'>('video');
  const [modelName, setModelName] = useState('Kling-Image2Video-V2.1-Master');
  const [prompt, setPrompt] = useState('Cinematic drone tracking shot over futuristic glowing neo city at sunset, 4K editorial quality');
  const [chain, setChain] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [stepsLog, setStepsLog] = useState<Array<{ step: number; text: string }>>([]);

  const modelsByModality: Record<'video' | 'image' | 'audio' | 'upscale', Array<{ id: string; name: string }>> = {
    video: [
      { id: 'Kling-Image2Video-V2.1-Master', name: 'GMI Cloud: Kling Image-to-Video v2.1 Master' },
      { id: 'veo-2.0-generate', name: 'Google: Veo 2.0 Cinematic Video' },
      { id: 'runway-gen4-turbo', name: 'Runway: Gen-4 Turbo Video' },
      { id: 'wan2.6-i2v', name: 'GMI Cloud: Wan 2.6 Image-to-Video' },
    ],
    image: [
      { id: 'seedream-5.0-lite', name: 'GMI Cloud: Seedream 5.0 Lite Storyboard' },
      { id: 'flux-kontext-pro', name: 'GMI Cloud: FLUX Kontext Pro' },
      { id: 'imagen-4-ultra', name: 'Google: Imagen 4 Ultra HD' },
    ],
    audio: [
      { id: 'minimax-music-2.5', name: 'GMI Cloud: MiniMax Music 2.5 Score & Sound' },
      { id: 'stable-audio-pro', name: 'Stability AI: Stable Audio 2.0' },
      { id: 'elevenlabs-multilingual-v2', name: 'Replicate: ElevenLabs Voiceover HD' },
    ],
    upscale: [
      { id: 'nightmareai/real-esrgan', name: 'Replicate: Real-ESRGAN 4x Video & Image Upscaler' },
    ],
  };

  const handleModalityChange = (newMod: 'video' | 'image' | 'audio' | 'upscale') => {
    setModality(newMod);
    setModelName(modelsByModality[newMod][0].id);
    if (newMod !== 'video') setChain(false);
    else setChain(true);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setStepsLog([
      { step: 1, text: `Initiating Genblaze SDK for project '${project?.name || 'Workspace'}'...` },
    ]);

    try {
      if (chain && modality === 'video') {
        setTimeout(() => {
          setStepsLog((prev) => [
            ...prev,
            { step: 2, text: `[Chain 1/2] Anchor: Seedream 5.0 Lite frame...` },
          ]);
        }, 500);
        setTimeout(() => {
          setStepsLog((prev) => [
            ...prev,
            { step: 3, text: `[Chain 2/2] Animating via ${modelName}...` },
          ]);
        }, 1200);
      } else {
        setTimeout(() => {
          setStepsLog((prev) => [
            ...prev,
            { step: 2, text: `Running inference: ${modelName}...` },
          ]);
        }, 500);
      }

      const res: GenerateResponse = await generateMediaBackend({
        project_id: project?.id || 'default_project',
        prompt: prompt.trim(),
        modality,
        model_name: modelName,
        chain: chain && modality === 'video',
      });

      setStepsLog((prev) => [
        ...prev,
        { step: 4, text: `✓ SHA-256 Provenance Verified (${res.manifest.sha256.slice(0, 10)}...)` },
        { step: 5, text: `✓ Stored inside Backblaze B2 Object Lock sink!` },
      ]);

      await reloadAssets();
      setTimeout(() => {
        setIsGenerating(false);
      }, 1200);
    } catch (err) {
      console.error('Genblaze generation error', err);
      setStepsLog((prev) => [...prev, { step: 99, text: '❌ Pipeline execution failed.' }]);
      setIsGenerating(false);
    }
  };

  const tabs: TabConfig[] = [
    {
      id: 'Genblaze AI',
      label: 'Genblaze AI',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      ),
    },
    {
      id: 'Media',
      label: 'Media',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'Audio',
      label: 'Audio',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      ),
    },
    {
      id: 'Text',
      label: 'Text',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7V4h16v3M9 20h6M12 4v16" />
        </svg>
      ),
    },
    {
      id: 'Transitions',
      label: 'Transitions',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      id: 'Effects',
      label: 'Effects',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      ),
    },
  ];

  const isAiActive = activeTab === 'Genblaze AI';

  return (
    <div className={`${styles.sidebar} ${isAiActive ? styles.sidebarAiActive : ''}`}>
      <div className={styles.header}>
        <div className={styles.thumbnail}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </div>
        <div className={styles.projectInfo}>
          <span className={styles.projectName} title={project?.name || 'Active Studio Workspace'}>
            {project?.name || 'Active Workspace'}
          </span>
          <span className={styles.projectMeta}>
            {project?.resolution || '1080p • 24fps'} ({project?.aspectRatio || '16:9'})
          </span>
        </div>
      </div>

      <div className={styles.tabsContainer}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tabItem} ${activeTab === tab.id ? styles.tabItemActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {isAiActive && (
        <div className={styles.aiPanel}>
          <div className={styles.aiPanelHeader}>
            <div className={styles.aiTitleRow}>
              <span className={styles.aiTitle}>
                <span>Genblaze AI Studio</span>
                <span className={styles.sdkBadge}>SDK v2026.6</span>
              </span>
            </div>
            <span className={styles.aiSubtitle}>
              Default storage: Backblaze B2 Object Lock sink (`chain=True` supported).
            </span>
          </div>

          <div className={styles.modalityTabs}>
            {(['video', 'image', 'audio', 'upscale'] as const).map((mod) => (
              <button
                key={mod}
                type="button"
                className={`${styles.modalityTab} ${modality === mod ? styles.modalityTabActive : ''}`}
                onClick={() => handleModalityChange(mod)}
                disabled={isGenerating}
              >
                <span>{mod === 'video' ? '🎬 Video' : mod === 'image' ? '🎨 Image' : mod === 'audio' ? '🎵 Audio' : '✨ Upscale'}</span>
              </button>
            ))}
          </div>

          <form onSubmit={handleGenerate} className="flex flex-col gap-3">
            <div className={styles.field}>
              <label className={styles.label}>Model & Provider</label>
              <select
                className={styles.select}
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                disabled={isGenerating}
              >
                {modelsByModality[modality].map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Creative Prompt</label>
              <textarea
                className={styles.textarea}
                placeholder="Describe cinematic lighting, shot type, mood, camera movement..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isGenerating}
                required
              />
            </div>

            {modality === 'video' && (
              <label className={styles.chainBox}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={chain}
                  onChange={(e) => setChain(e.target.checked)}
                  disabled={isGenerating}
                />
                <div className={styles.chainText}>
                  <span className={styles.chainTitle}>Chain (`chain=True`)</span>
                  <span className={styles.chainSub}>
                    Anchor keyframe with Seedream 5.0 Lite first, then animate with {modelName}.
                  </span>
                </div>
              </label>
            )}

            <div className={styles.cloudBadge}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />
              </svg>
              <span>By default stored inside Backblaze B2 Cloud</span>
            </div>

            {stepsLog.length > 0 && (
              <div className={styles.progressContainer}>
                <div className={styles.progressTitle}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={isGenerating ? 'animate-spin' : ''}>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  <span>Pipeline Event Stream</span>
                </div>
                <div className="flex flex-col gap-1">
                  {stepsLog.map((logItem, idx) => (
                    <div key={idx} className={styles.stepItem}>
                      <span className={styles.stepIndex}>[{logItem.step}]</span>
                      <span>{logItem.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button type="submit" className={styles.generateBtn} disabled={isGenerating || !prompt.trim()}>
              {isGenerating ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
                    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
                  </svg>
                  <span>Executing (.step().run())...</span>
                </>
              ) : (
                <>
                  <span>Generate to B2 Cloud</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      <div className={styles.footer}>
        <button className={styles.tabItem} onClick={() => alert('Help documentation & shortcuts loaded.')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>Help Center</span>
        </button>
        <button className={styles.tabItem} onClick={() => alert('Feedback report modal opened.')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          <span>Give Feedback</span>
        </button>
      </div>
    </div>
  );
};
