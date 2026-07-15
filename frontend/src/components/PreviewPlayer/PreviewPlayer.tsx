import React from 'react';
import { useEditor } from '../../context/EditorContext';
import styles from './PreviewPlayer.module.css';

export const PreviewPlayer: React.FC = () => {
  const { project, playheadPx, setPlayheadPx, isPlaying, setIsPlaying } = useEditor();

  // Convert playheadPx into timecode (e.g., 340px -> 00:01:14:08)
  const formatTimecode = (px: number): string => {
    const totalFrames = Math.floor(px * 0.5) + (340 * 0.5); // base offset
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
    setPlayheadPx((prev) => Math.max(0, Math.min(1800, prev + deltaPx)));
  };

  return (
    <div className={styles.playerContainer}>
      <div className={styles.playerHeader}>
        <div className={styles.headerBadge}>Fit (100%)</div>
        <div className={styles.headerBadge}>
          {project?.resolution || '1920x1080 • 24fps'}
        </div>
      </div>

      <div className={styles.canvasArea}>
        <div className={styles.canvasFrame}>
          <div
            className={`${styles.videoLayer} ${isPlaying ? styles.videoLayerPlaying : ''}`}
            style={{
              backgroundImage: 'url("https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200&auto=format&fit=crop&q=80")',
            }}
          />
          <div className={styles.titleOverlay}>
            {project?.name ? `${project.name.toUpperCase()}` : 'NEO TOKYO'}
          </div>
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

          <button className={styles.controlButton} title="Rewind" onClick={() => handleSeekRelative(-40)}>
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

          <button className={styles.controlButton} title="Fast Forward" onClick={() => handleSeekRelative(40)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
            </svg>
          </button>

          <button className={styles.controlButton} title="Skip to End" onClick={() => setPlayheadPx(800)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
        </div>

        <div className={styles.controlsRight}>
          <button className={styles.controlButton} title="Mute/Unmute" onClick={() => alert('Audio output level: 100%')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
            </svg>
          </button>
          <button className={styles.controlButton} title="Fullscreen" onClick={() => alert('Toggled Fullscreen Preview mode.')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
