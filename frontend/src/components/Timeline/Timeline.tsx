import React from 'react';
import { useEditor } from '../../context/EditorContext';
import styles from './Timeline.module.css';

export const Timeline: React.FC = () => {
  const { timelineTracks, activeTool, setActiveTool, playheadPx, setPlayheadPx } = useEditor();

  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left + e.currentTarget.scrollLeft;
    setPlayheadPx(Math.max(0, Math.min(1800, clickX)));
  };

  const ticks = ['00:00', '00:10', '00:20', '00:30', '00:40', '00:50', '01:00', '01:10', '01:20', '01:30', '01:40', '01:50', '02:00'];

  return (
    <div className={styles.timelineContainer}>
      <div className={styles.toolbar}>
        <div className={styles.toolsLeft}>
          <button
            className={`${styles.toolButton} ${activeTool === 'pan' ? styles.toolButtonActive : ''}`}
            title="Pan & Select Tool"
            onClick={() => setActiveTool('pan')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
          </button>
          <button
            className={`${styles.toolButton} ${activeTool === 'cut' ? styles.toolButtonActive : ''}`}
            title="Razor Cut Tool"
            onClick={() => setActiveTool('cut')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="6" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <line x1="20" y1="4" x2="8.12" y2="15.88" />
              <line x1="14.47" y1="14.48" x2="20" y2="20" />
              <line x1="8.12" y1="8.12" x2="12" y2="12" />
            </svg>
          </button>
          <div className={styles.toolDivider} />
          <button className={styles.toolButton} title="Undo" onClick={() => setActiveTool('undo')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
          <button className={styles.toolButton} title="Redo" onClick={() => setActiveTool('redo')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11a5 5 0 00-5 5v2m15-7l-6 6m6-6l-6-6" />
            </svg>
          </button>
        </div>

        <div className={styles.zoomBar}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <div className={styles.zoomSliderTrack} onClick={() => alert('Timeline scale: 100% (Default frames view)')}>
            <div className={styles.zoomThumb} />
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
      </div>

      <div className={styles.timelineBody}>
        <div className={styles.trackHeaders}>
          <div className={styles.timeRulerHeader} />
          <div className={styles.headersList}>
            {timelineTracks.map((track) => (
              <div
                key={track.id}
                className={`${styles.trackHeaderRow} ${track.type === 'audio' ? styles.trackHeaderRowAudio : ''}`}
              >
                <span className={styles.trackName}>{track.name}</span>
                <div className={styles.trackControls}>
                  {track.type === 'audio' ? (
                    <button className={styles.trackButton} title="Mute Track">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
                      </svg>
                    </button>
                  ) : (
                    <button className={styles.trackButton} title="Toggle Track Visibility">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  )}
                  <button className={styles.trackButton} title="Lock Track">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 019.9-1" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.contentArea}>
          <div className={styles.timeRuler} onClick={handleRulerClick}>
            {ticks.map((tick, i) => (
              <div key={tick} className={`${styles.tick} ${i === 4 ? styles.tickActive : ''}`}>
                {tick}
              </div>
            ))}
          </div>

          <div className={styles.tracksContainer}>
            <div className={styles.playhead} style={{ left: `${playheadPx}px` }}>
              <div className={styles.playheadHandle} />
            </div>

            {timelineTracks.map((track) => (
              <div key={track.id} className={styles.trackRow}>
                {track.clips.map((clip) => {
                  if (clip.type === 'text') {
                    return (
                      <div
                        key={clip.id}
                        className={styles.clipText}
                        style={{ left: `${clip.startOffsetPx}px`, width: `${clip.widthPx}px` }}
                        onClick={() => alert(`Title clip selected: ${clip.title} (${clip.subTitle})`)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M4 7V4h16v3M9 20h6M12 4v16" />
                        </svg>
                        <span>{clip.title}</span>
                      </div>
                    );
                  }

                  const isVideo = clip.type === 'video';
                  return (
                    <div
                      key={clip.id}
                      className={`${styles.clip} ${clip.isSelected ? styles.clipSelected : ''}`}
                      style={{ left: `${clip.startOffsetPx}px`, width: `${clip.widthPx}px` }}
                      onClick={() => alert(`Clip selected: ${clip.title}`)}
                    >
                      <div className={`${styles.clipHeader} ${clip.isSelected ? styles.clipHeaderSelected : ''}`}>
                        {clip.title}
                      </div>
                      <div
                        className={isVideo ? styles.clipBodyVideo : styles.clipBodyAudio}
                        style={clip.thumbnailUrl ? { backgroundImage: `url("${clip.thumbnailUrl}")` } : {}}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
