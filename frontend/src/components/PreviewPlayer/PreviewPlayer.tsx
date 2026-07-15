import React, { useRef, useState, useEffect } from 'react';
import { useEditor } from '../../context/EditorContext';
import styles from './PreviewPlayer.module.css';

export const PreviewPlayer: React.FC = () => {
  const { project, playheadPx, setPlayheadPx, isPlaying, setIsPlaying, timelineTracks, activeProjectEffect } = useEditor();
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(false);

  const formatTimecode = (px: number): string => {
    const totalFrames = Math.floor(px * 0.5);
    const seconds = Math.floor(totalFrames / 24);
    const frames = totalFrames % 24;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `00:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  };

  const togglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleSeekRelative = (deltaPx: number) => {
    setPlayheadPx((prev) => Math.max(0, prev + deltaPx));
  };

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch((err) => {
        console.error('Error attempting to enable fullscreen mode:', err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.error('Error attempting to exit fullscreen mode:', err);
      });
    }
  };

  const getActiveVideoClip = () => {
    for (const track of timelineTracks) {
      if (track.type !== 'video' && track.type !== 'image') continue;
      for (const clip of track.clips) {
        if (playheadPx >= clip.startOffsetPx && playheadPx <= clip.startOffsetPx + clip.widthPx) {
          return clip;
        }
      }
    }
    return null;
  };

  const getActiveTextClip = () => {
    for (const track of timelineTracks) {
      for (const clip of track.clips) {
        if (clip.type === 'text' && playheadPx >= clip.startOffsetPx && playheadPx <= clip.startOffsetPx + clip.widthPx) {
          return clip;
        }
      }
    }
    return null;
  };

  const getActiveEffectFilter = (): string => {
    let effectName = activeProjectEffect;
    const activeVid = getActiveVideoClip();
    if (activeVid?.effect) {
      effectName = activeVid.effect;
    }

    if (!effectName) return 'none';
    if (effectName.includes('Teal & Orange')) {
      return 'contrast(1.25) saturate(1.35) hue-rotate(-12deg) sepia(0.2)';
    }
    if (effectName.includes('Cyberpunk Neon') || effectName.includes('Neon Glow')) {
      return 'contrast(1.3) saturate(1.8) hue-rotate(30deg) drop-shadow(0 0 12px rgba(147, 51, 234, 0.5))';
    }
    if (effectName.includes('Film Grain')) {
      return 'contrast(1.15) sepia(0.3) brightness(0.95)';
    }
    if (effectName.includes('Vintage Sepia') || effectName.includes('Sepia')) {
      return 'sepia(0.75) contrast(1.1) brightness(0.9)';
    }
    if (effectName.includes('Black & White Cinema')) {
      return 'grayscale(1) contrast(1.4)';
    }
    if (effectName.includes('Dreamy Soft Focus') || effectName.includes('Blur')) {
      return 'blur(1px) brightness(1.1) saturate(1.2)';
    }
    if (effectName.includes('High Contrast')) {
      return 'contrast(1.6) saturate(1.3)';
    }
    return 'none';
  };

  const activeVideoClip = getActiveVideoClip();
  const activeTextClip = getActiveTextClip();
  const currentFilter = getActiveEffectFilter();

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, activeVideoClip]);

  const videoSourceUrl = (activeVideoClip as any)?.url || (activeVideoClip as any)?.cloud_url;

  return (
    <div className={styles.playerContainer} ref={playerContainerRef}>
      {/* Red-marked Fit (100%) and 1080p header badges completely removed */}

      <div className={styles.canvasArea}>
        <div className={styles.canvasFrame}>
          {videoSourceUrl ? (
            <video
              ref={videoRef}
              src={videoSourceUrl}
              className={styles.videoLayer}
              autoPlay={isPlaying}
              loop
              muted={isMuted}
              style={{
                filter: currentFilter,
                transition: 'filter 0.3s ease',
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
          ) : activeVideoClip?.thumbnailUrl ? (
            <div
              className={`${styles.videoLayer} ${isPlaying ? styles.videoLayerPlaying : ''}`}
              style={{
                backgroundImage: `url("${activeVideoClip.thumbnailUrl}")`,
                filter: currentFilter,
                transition: 'filter 0.3s ease',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: '#0a0d14',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#475569',
                fontFamily: 'var(--font-sans)',
                userSelect: 'none',
              }}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ marginBottom: '8px', opacity: 0.6 }}>
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Full HD Video Canvas</span>
              <span style={{ fontSize: '11px', marginTop: '4px' }}>Drag and drop media clips to the timeline below</span>
            </div>
          )}

          {/* Functional Text Title Overlay */}
          {activeTextClip ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                pointerEvents: 'none',
                zIndex: 10,
                textShadow: '0 4px 15px rgba(0,0,0,0.85)',
              }}
            >
              <h2
                style={{
                  fontSize: activeTextClip.title.includes('Lower Third') ? '24px' : '36px',
                  fontWeight: 900,
                  color: activeTextClip.title.includes('Cyber') || activeTextClip.title.includes('Glitch') ? '#00ffff' : '#ffffff',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '8px 20px',
                  background: activeTextClip.title.includes('Lower Third') ? 'rgba(20, 27, 43, 0.85)' : 'transparent',
                  borderLeft: activeTextClip.title.includes('Lower Third') ? '4px solid #7c3aed' : 'none',
                }}
              >
                {activeTextClip.title}
              </h2>
              {activeTextClip.subTitle && (
                <span style={{ fontSize: '14px', color: '#c084fc', fontWeight: 600, marginTop: '4px' }}>
                  {activeTextClip.subTitle}
                </span>
              )}
            </div>
          ) : (
            <div className={styles.titleOverlay}>
              {project?.name ? `${project.name.toUpperCase()}` : 'GENMEDIA STUDIO PREVIEW'}
            </div>
          )}

          {/* Functional Grain Overlay if active */}
          {(activeProjectEffect?.includes('Grain') || activeProjectEffect?.includes('VHS')) && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 0)',
                backgroundSize: '3px 3px',
                pointerEvents: 'none',
                opacity: 0.6,
                zIndex: 8,
              }}
            />
          )}
        </div>
      </div>

      <div className={styles.transportBar}>
        <div className={styles.timecodeDisplay}>{formatTimecode(playheadPx)}</div>

        <div className={styles.controlsCenter}>
          <button className={styles.controlButton} title="Skip to Start" onClick={() => setPlayheadPx(0)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          <button className={styles.controlButton} title="Rewind 1 Second" onClick={() => handleSeekRelative(-40)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
            </svg>
          </button>

          <button className={styles.playButton} title={isPlaying ? 'Pause' : 'Play'} onClick={togglePlay}>
            {isPlaying ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: '2px' }}>
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button className={styles.controlButton} title="Forward 1 Second" onClick={() => handleSeekRelative(40)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
            </svg>
          </button>
        </div>

        <div className={styles.controlsRight}>
          <button
            className={styles.controlButton}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            onClick={() => setIsMuted(!isMuted)}
            style={{ color: isMuted ? '#f59e0b' : 'currentColor' }}
          >
            {isMuted ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
              </svg>
            )}
          </button>

          <button className={styles.controlButton} title="Toggle Fullscreen" onClick={toggleFullscreen}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
