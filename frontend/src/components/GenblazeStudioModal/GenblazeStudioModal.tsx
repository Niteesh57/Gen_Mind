import React, { useState } from 'react';
import { useEditor } from '../../context/EditorContext';
import { generateMediaBackend, type GenerateResponse } from '../../services/apiClient';
import styles from './GenblazeStudioModal.module.css';

interface GenblazeStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GenblazeStudioModal: React.FC<GenblazeStudioModalProps> = ({ isOpen, onClose }) => {
  const { project, reloadAssets } = useEditor();
  const [modality, setModality] = useState<'video' | 'image' | 'audio' | 'upscale'>('video');
  const [modelName, setModelName] = useState('Kling-Image2Video-V2.1-Master');
  const [prompt, setPrompt] = useState('Cinematic drone tracking shot over futuristic glowing neo city at sunset, 4K editorial quality');
  const [chain, setChain] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [stepsLog, setStepsLog] = useState<Array<{ step: number; text: string }>>([]);

  if (!isOpen) return null;

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
      { step: 1, text: `Initializing Genblaze Pipeline for project '${project?.name || 'Workspace'}'...` },
    ]);

    try {
      if (chain && modality === 'video') {
        setTimeout(() => {
          setStepsLog((prev) => [
            ...prev,
            { step: 2, text: `[Chain Step 1/2] Storyboard Anchor: GMICloudImageProvider ('seedream-5.0-lite') rendering frame...` },
          ]);
        }, 600);
        setTimeout(() => {
          setStepsLog((prev) => [
            ...prev,
            { step: 3, text: `[Chain Step 2/2] Animation: GMICloudVideoProvider ('${modelName}') animating image...` },
          ]);
        }, 1300);
      } else {
        setTimeout(() => {
          setStepsLog((prev) => [
            ...prev,
            { step: 2, text: `Running step: ${modelName} (${modality.toUpperCase()})...` },
          ]);
        }, 600);
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
        { step: 4, text: `✓ SHA-256 Verified Provenance Manifest generated (${res.manifest.sha256.slice(0, 12)}...)` },
        { step: 5, text: `✓ Stored inside Backblaze B2 Object Lock bucket. Asset ready!` },
      ]);

      await reloadAssets();
      setTimeout(() => {
        setIsGenerating(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Genblaze generation error', err);
      setStepsLog((prev) => [...prev, { step: 99, text: '❌ Error executing Genblaze SDK step.' }]);
      setIsGenerating(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <div className={styles.title}>
              <span>Genblaze AI Media Pipeline</span>
              <span className={styles.sdkBadge}>SDK v2026.6</span>
            </div>
            <span className={styles.subtitle}>
              Unified inference across video, image, and audio providers backed by Backblaze B2 object lock storage.
            </span>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
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
              <span>{mod === 'video' ? '🎬 Video' : mod === 'image' ? '🎨 Image' : mod === 'audio' ? '🎵 Audio & TTS' : '✨ Upscale'}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleGenerate} className="flex flex-col gap-4">
          <div className={styles.field}>
            <label className={styles.label}>Provider & Model Selection</label>
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
            <label className={styles.label}>Creative Prompt & Brief</label>
            <textarea
              className={styles.textarea}
              placeholder="Describe the shot, lighting, camera movement, or sound design in detail..."
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
                <span className={styles.chainTitle}>Enable Automatic Step Chaining (`chain=True`)</span>
                <span className={styles.chainSub}>
                  Runs Seedream 5.0 Lite first to lock storyboard anchor, then passes image directly to {modelName}.
                </span>
              </div>
            </label>
          )}

          {stepsLog.length > 0 && (
            <div className={styles.progressContainer}>
              <div className={styles.progressTitle}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={isGenerating ? 'animate-spin' : ''}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                <span>Pipeline Event Stream & Provenance Log</span>
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

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isGenerating}>
              Close
            </button>
            <button type="submit" className={styles.generateBtn} disabled={isGenerating || !prompt.trim()}>
              {isGenerating ? (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
                    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
                  </svg>
                  <span>Executing Pipeline (.step().run())...</span>
                </>
              ) : (
                <>
                  <span>Generate Media & Store in B2</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
