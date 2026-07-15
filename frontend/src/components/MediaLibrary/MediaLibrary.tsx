import React, { useState } from 'react';
import { useEditor } from '../../context/EditorContext';
import { type MediaAsset } from '../../services/editorService';
import { ClipchampDropzone } from '../ClipchampDropzone/ClipchampDropzone';
import { generateMediaBackend } from '../../services/apiClient';
import styles from './MediaLibrary.module.css';

export const MediaLibrary: React.FC = () => {
  const {
    project,
    activeTab,
    isSidePanelOpen,
    setIsSidePanelOpen,
    mediaAssets,
    mediaFilter,
    reloadAssets,
    addClipToTrack,
    applyTransitionToClip,
    applyEffectToClip,
  } = useEditor();

  const [modelName, setModelName] = useState('Kling-Image2Video-V2.1-Master');
  const [prompt, setPrompt] = useState('Cinematic drone tracking shot over glowing neon city at sunset, 4K editorial quality');
  const [chain, setChain] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isSidePanelOpen) {
    return <div className={`${styles.panelDrawer} ${styles.panelDrawerClosed}`} />;
  }

  const handleGenerate = async (e: React.FormEvent, targetModality: 'video' | 'audio' | 'image' | 'upscale') => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsGenerating(true);
    try {
      await generateMediaBackend({
        project_id: project?.id || 'default_project',
        prompt: prompt.trim(),
        modality: targetModality,
        model_name: modelName,
        chain: targetModality === 'video' && chain,
      });
      await reloadAssets();
    } catch (err) {
      console.error('Generation error', err);
      alert('Error generating asset.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, asset: MediaAsset) => {
    e.dataTransfer.setData('application/json', JSON.stringify(asset));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const getFilteredAssets = () => {
    if (activeTab === 'Audio' || mediaFilter === 'audio') {
      return mediaAssets.filter((a) => a.type === 'audio');
    }
    if (activeTab === 'Image' || mediaFilter === 'image') {
      return mediaAssets.filter((a) => a.type === 'image');
    }
    if (activeTab === 'Media' || mediaFilter === 'video') {
      return mediaAssets.filter((a) => a.type === 'video');
    }
    return mediaAssets;
  };

  const filteredAssets = getFilteredAssets();

  const renderPresetCards = () => {
    if (activeTab === 'Text') {
      const presets = [
        { title: 'Glitch Cyber Title', sub: 'Dynamic glowing cyber subtitle preset' },
        { title: 'Cinematic Lower Third', sub: 'Minimalist editorial title block' },
        { title: 'Neon Presentation Headline', sub: 'High-contrast presentation header' },
        { title: 'Animated Subtitle Box', sub: 'Clean caption style for social clips' },
      ];
      return (
        <div className={styles.presetsGrid}>
          {presets.map((p, idx) => (
            <div
              key={idx}
              className={styles.presetCard}
              draggable={true}
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  'application/json',
                  JSON.stringify({
                    id: `preset_text_${Date.now()}_${idx}`,
                    name: p.title,
                    type: 'text',
                    duration: '00:06',
                    durationSeconds: 6,
                  })
                );
              }}
              onClick={() => {
                addClipToTrack('default_video', {
                  id: `preset_text_${Date.now()}_${idx}`,
                  name: p.title,
                  type: 'text',
                  duration: '00:06',
                  durationSeconds: 6,
                });
              }}
              title="Click or drag to add title to timeline"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7V4h16v3M9 20h6M12 4v16" />
              </svg>
              <span className={styles.presetTitle}>{p.title}</span>
              <span className={styles.presetSub}>{p.sub}</span>
            </div>
          ))}
        </div>
      );
    }

    if (activeTab === 'Transitions') {
      const presets = [
        { title: 'Cross Dissolve', sub: 'Smooth editorial blend (0.5s)' },
        { title: 'Cyber Glitch Cut', sub: 'Fast high-energy transition (0.3s)' },
        { title: 'Cinematic Zoom Blur', sub: 'Dynamic forward zoom cut (0.4s)' },
        { title: 'Wipe Right Editorial', sub: 'Clean horizontal wipe transition (0.5s)' },
      ];
      return (
        <div className={styles.presetsGrid}>
          {presets.map((p, idx) => (
            <div
              key={idx}
              className={styles.presetCard}
              draggable={true}
              onDragStart={(e) => {
                e.dataTransfer.setData('application/json', JSON.stringify({ fromTransition: true, transitionName: p.title }));
              }}
              onClick={() => applyTransitionToClip('active', p.title)}
              title="Click or drag onto timeline clip boundary"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className={styles.presetTitle}>{p.title}</span>
              <span className={styles.presetSub}>{p.sub}</span>
            </div>
          ))}
        </div>
      );
    }

    if (activeTab === 'Effects') {
      const presets = [
        { title: 'Teal & Orange Grade', sub: 'Blockbuster cinematic film grading' },
        { title: 'Cyberpunk Neon Glow', sub: 'High-saturation purple/blue aesthetic' },
        { title: '35mm Film Grain', sub: 'Vintage retro textured atmosphere' },
        { title: 'VHS Glitch Aberration', sub: 'Retro analog video distortion preset' },
      ];
      return (
        <div className={styles.presetsGrid}>
          {presets.map((p, idx) => (
            <div
              key={idx}
              className={styles.presetCard}
              draggable={true}
              onDragStart={(e) => {
                e.dataTransfer.setData('application/json', JSON.stringify({ fromEffect: true, effectName: p.title }));
              }}
              onClick={() => applyEffectToClip('active', p.title)}
              title="Click or drag to apply live color grading & effects"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <span className={styles.presetTitle}>{p.title}</span>
              <span className={styles.presetSub}>{p.sub}</span>
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <div className={styles.panelDrawer}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>
          {activeTab === 'AllMedia' && '📁 All Project Assets'}
          {activeTab === 'Media' && '🎬 Video Studio'}
          {activeTab === 'Audio' && '🎵 Audio Studio'}
          {activeTab === 'Image' && '🎨 Image Studio'}
          {activeTab === 'Text' && '🔤 Title Presets'}
          {activeTab === 'Transitions' && '⚡ Transitions'}
          {activeTab === 'Effects' && '✨ Video Effects'}
        </span>
        <button
          className={styles.closeDrawerBtn}
          onClick={() => setIsSidePanelOpen(false)}
          title="Close Side Drawer (<)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <div className={styles.drawerContent}>
        {activeTab === 'AllMedia' && (
          <div className={styles.assetsSection}>
            <ClipchampDropzone />
            <div className={styles.sectionHeadingRow}>
              <span className={styles.sectionHeading}>All Created & Uploaded Assets ({mediaAssets.length})</span>
            </div>
            <div className={styles.cardsContainer}>
              {mediaAssets.map((asset: MediaAsset & { sha256?: string; verified?: boolean }) => (
                <div
                  key={asset.id}
                  className={`${styles.card} ${asset.isUsed ? styles.cardUsed : ''}`}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, asset)}
                  onClick={() => {
                    addClipToTrack(asset.type === 'audio' ? 'default_audio' : 'default_video', asset);
                  }}
                  title={`${asset.name} (Drag to timeline or click to insert)`}
                >
                  {asset.thumbnailUrl ? (
                    <div className={styles.thumbnail} style={{ backgroundImage: `url("${asset.thumbnailUrl}")` }} />
                  ) : (
                    <div className={styles.audioPreview}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                      <div className={styles.audioLabel}>{asset.name}</div>
                    </div>
                  )}

                  {asset.isUsed && (
                    <div className={styles.usedBadge}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>Used</span>
                    </div>
                  )}

                  {(asset.sha256 || asset.verified) && (
                    <div className={styles.shaBadge}>
                      <span>✓</span>
                    </div>
                  )}

                  <div className={styles.timecode}>{asset.duration}</div>
                  <div className={styles.overlay} />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'Media' && (
          <>
            <form onSubmit={(e) => handleGenerate(e, 'video')} className={styles.genSection}>
              <span className={styles.genHeader}>Create Video with AI</span>
              <div className={styles.field}>
                <label className={styles.label}>Video Model</label>
                <select className={styles.select} value={modelName} onChange={(e) => setModelName(e.target.value)} disabled={isGenerating}>
                  <option value="Kling-Image2Video-V2.1-Master">Kling Image-to-Video v2.1</option>
                  <option value="veo-2.0-generate">Veo 2.0 Cinematic Video</option>
                  <option value="wan2.6-i2v">Wan 2.6 Image-to-Video</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Prompt</label>
                <textarea
                  className={styles.textarea}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe camera motion, lighting, subject..."
                  disabled={isGenerating}
                  required
                />
              </div>
              <label className={styles.chainLabel}>
                <input type="checkbox" className={styles.checkbox} checked={chain} onChange={(e) => setChain(e.target.checked)} disabled={isGenerating} />
                <span>Chain storyboard keyframe before animation</span>
              </label>
              <button type="submit" className={styles.generateButton} disabled={isGenerating || !prompt.trim()}>
                {isGenerating ? 'Generating Video...' : 'Generate Video'}
              </button>
              <div className={styles.cloudNote}>Note: Automatically saved to cloud.</div>
            </form>

            <div className={styles.assetsSection}>
              <div className={styles.sectionHeadingRow}>
                <span className={styles.sectionHeading}>Created & Available Videos ({filteredAssets.length})</span>
              </div>
              <div className={styles.cardsContainer}>
                {filteredAssets.map((asset: MediaAsset & { sha256?: string; verified?: boolean }) => (
                  <div
                    key={asset.id}
                    className={`${styles.card} ${asset.isUsed ? styles.cardUsed : ''}`}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, asset)}
                    onClick={() => {
                      addClipToTrack('default_video', asset);
                    }}
                    title={`${asset.name} (Drag to timeline or click to insert)`}
                  >
                    {asset.thumbnailUrl && (
                      <div className={styles.thumbnail} style={{ backgroundImage: `url("${asset.thumbnailUrl}")` }} />
                    )}
                    {asset.isUsed && (
                      <div className={styles.usedBadge}>
                        <span>✓ Used</span>
                      </div>
                    )}
                    <div className={styles.timecode}>{asset.duration}</div>
                    <div className={styles.overlay} />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'Audio' && (
          <>
            <form onSubmit={(e) => handleGenerate(e, 'audio')} className={styles.genSection}>
              <span className={styles.genHeader}>Create Audio & Voice with AI</span>
              <div className={styles.field}>
                <label className={styles.label}>Audio & Voice Model</label>
                <select className={styles.select} value={modelName} onChange={(e) => setModelName(e.target.value)} disabled={isGenerating}>
                  <option value="minimax-music-2.5">MiniMax Music 2.5 Score & Sound</option>
                  <option value="stable-audio-pro">Stable Audio 2.0</option>
                  <option value="elevenlabs-multilingual-v2">ElevenLabs Voiceover HD</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Prompt / Script</label>
                <textarea
                  className={styles.textarea}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe orchestra theme, sound effects, or narration script..."
                  disabled={isGenerating}
                  required
                />
              </div>
              <button type="submit" className={styles.generateButton} disabled={isGenerating || !prompt.trim()}>
                {isGenerating ? 'Generating Audio...' : 'Generate Audio'}
              </button>
              <div className={styles.cloudNote}>Note: Automatically saved to cloud.</div>
            </form>

            <div className={styles.assetsSection}>
              <div className={styles.sectionHeadingRow}>
                <span className={styles.sectionHeading}>Created & Available Audio ({filteredAssets.length})</span>
              </div>
              <div className={styles.cardsContainer}>
                {filteredAssets.map((asset: MediaAsset) => (
                  <div
                    key={asset.id}
                    className={`${styles.card} ${asset.isUsed ? styles.cardUsed : ''}`}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, asset)}
                    onClick={() => addClipToTrack('default_audio', asset)}
                  >
                    <div className={styles.audioPreview}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                      <div className={styles.audioLabel}>{asset.name}</div>
                    </div>
                    <div className={styles.timecode}>{asset.duration}</div>
                    <div className={styles.overlay} />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'Image' && (
          <>
            <form onSubmit={(e) => handleGenerate(e, 'image')} className={styles.genSection}>
              <span className={styles.genHeader}>Create Image with AI</span>
              <div className={styles.field}>
                <label className={styles.label}>Image Model</label>
                <select className={styles.select} value={modelName} onChange={(e) => setModelName(e.target.value)} disabled={isGenerating}>
                  <option value="seedream-5.0-lite">Seedream 5.0 Lite Storyboard</option>
                  <option value="flux-kontext-pro">FLUX Kontext Pro</option>
                  <option value="imagen-4-ultra">Imagen 4 Ultra HD</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Prompt</label>
                <textarea
                  className={styles.textarea}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe visual composition, focal length, color grading..."
                  disabled={isGenerating}
                  required
                />
              </div>
              <button type="submit" className={styles.generateButton} disabled={isGenerating || !prompt.trim()}>
                {isGenerating ? 'Generating Image...' : 'Generate Image'}
              </button>
              <div className={styles.cloudNote}>Note: Automatically saved to cloud.</div>
            </form>

            <div className={styles.assetsSection}>
              <div className={styles.sectionHeadingRow}>
                <span className={styles.sectionHeading}>Created & Available Images ({filteredAssets.length})</span>
              </div>
              <div className={styles.cardsContainer}>
                {filteredAssets.map((asset: MediaAsset) => (
                  <div
                    key={asset.id}
                    className={`${styles.card} ${asset.isUsed ? styles.cardUsed : ''}`}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, asset)}
                    onClick={() => addClipToTrack('default_video', asset)}
                  >
                    {asset.thumbnailUrl && (
                      <div className={styles.thumbnail} style={{ backgroundImage: `url("${asset.thumbnailUrl}")` }} />
                    )}
                    <div className={styles.timecode}>{asset.duration}</div>
                    <div className={styles.overlay} />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}



        {(activeTab === 'Text' || activeTab === 'Transitions' || activeTab === 'Effects') && renderPresetCards()}
      </div>
    </div>
  );
};
