import React, { useRef } from 'react';
import { useEditor } from '../../context/EditorContext';
import { type TimelineClip } from '../../services/editorService';
import styles from './Timeline.module.css';

export const Timeline: React.FC = () => {
  const {
    timelineTracks,
    playheadPx,
    setPlayheadPx,
    activeTool,
    setActiveTool,
    isPlaying,
    setIsPlaying,
    moveClipInTimeline,
    applyTransitionToClip,
    applyEffectToClip,
    addTrack,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useEditor();

  const timelineRef = useRef<HTMLDivElement>(null);
  const dragClipRef = useRef<{ clip: TimelineClip; trackId: string; startX: number; origOffset: number } | null>(null);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${ms.toString().padStart(2, '0')}`;
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragClipRef.current) return;
    if (timelineRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left + timelineRef.current.scrollLeft - 180;
      if (clickX >= 0) {
        setPlayheadPx(clickX);
      }
    }
  };

  const handleClipDragStart = (e: React.DragEvent, clip: TimelineClip, trackId: string) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ clipId: clip.id, sourceTrackId: trackId }));
  };

  const handleClipMouseDown = (e: React.MouseEvent, clip: TimelineClip, trackId: string) => {
    e.stopPropagation();
    dragClipRef.current = {
      clip,
      trackId,
      startX: e.clientX,
      origOffset: clip.startOffsetPx,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragClipRef.current) return;
      const deltaX = moveEvent.clientX - dragClipRef.current.startX;
      const newPx = Math.max(0, dragClipRef.current.origOffset + deltaX);
      moveClipInTimeline(dragClipRef.current.clip.id, dragClipRef.current.trackId, newPx);
    };

    const handleMouseUp = () => {
      dragClipRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleTrackDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleTrackDrop = (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      const data = JSON.parse(dataStr);

      if (timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const dropPx = Math.max(0, e.clientX - rect.left + timelineRef.current.scrollLeft - 180);

        if (data.action === 'transition') {
          applyTransitionToClip(trackId, data.name, dropPx);
          return;
        }
        if (data.action === 'effect') {
          applyEffectToClip(trackId, data.name);
          return;
        }
        if (data.clipId && data.sourceTrackId) {
          moveClipInTimeline(data.clipId, trackId, dropPx);
        }
      }
    } catch (err) {
      console.error('Track drop failed', err);
    }
  };

  // Calculate dynamic infinite duration based on maximum clip end position
  const maxClipEndPx = Math.max(
    ...timelineTracks.flatMap((track) => track.clips.map((c) => c.startOffsetPx + c.widthPx)),
    1600
  );
  const infiniteRulerPx = maxClipEndPx + 1000;
  const timeMarkersCount = Math.floor(infiniteRulerPx / 100); // Every 100px = 5 seconds

  return (
    <div className={styles.container}>
      {/* Top Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolsLeft}>
          <button
            className={`${styles.toolBtn} ${activeTool === 'pan' ? styles.toolBtnActive : ''}`}
            onClick={() => setActiveTool('pan')}
            title="Selection Tool"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
            </svg>
          </button>

          <button
            className={`${styles.toolBtn} ${activeTool === 'cut' ? styles.toolBtnActive : ''}`}
            onClick={() => setActiveTool('cut')}
            title="Blade / Cut Tool"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="6" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <line x1="20" y1="4" x2="8.12" y2="15.88" />
              <line x1="14.47" y1="14.48" x2="20" y2="20" />
              <line x1="8.12" y1="8.12" x2="12" y2="12" />
            </svg>
          </button>

          <div className={styles.separator} />

          <button
            className={styles.toolBtn}
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            style={{ opacity: canUndo ? 1 : 0.4 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7v6h6" />
              <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" />
            </svg>
          </button>

          <button
            className={styles.toolBtn}
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            style={{ opacity: canRedo ? 1 : 0.4 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 7v6h-6" />
              <path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7" />
            </svg>
          </button>

          {/* Undo / Redo controls only in header */}
        </div>
      </div>

      {/* Main Tracks Area with Dynamic Infinite Ruler */}
      <div className={styles.tracksContainer} ref={timelineRef} onClick={handleTimelineClick}>
        {/* Infinite Time Ruler */}
        <div className={styles.timeRuler} style={{ width: `${infiniteRulerPx + 180}px` }}>
          <div className={styles.rulerSpacer} />
          <div className={styles.rulerTicks} style={{ width: `${infiniteRulerPx}px` }}>
            {Array.from({ length: timeMarkersCount }).map((_, idx) => {
              const seconds = idx * 5;
              const mins = Math.floor(seconds / 60);
              const secs = seconds % 60;
              const label = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
              return (
                <div key={idx} className={styles.tickMajor} style={{ left: `${idx * 100}px` }}>
                  <span>{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Playhead Marker */}
        <div className={styles.playhead} style={{ left: `${180 + playheadPx}px` }}>
          <div className={styles.playheadHandle} />
          <div className={styles.playheadLine} />
        </div>

        {/* Tracks List */}
        <div className={styles.tracksList} style={{ width: `${infiniteRulerPx + 180}px` }}>
          {timelineTracks.map((track) => (
            <div
              key={track.id}
              className={styles.trackRow}
              onDragOver={handleTrackDragOver}
              onDrop={(e) => handleTrackDrop(e, track.id)}
            >
              {/* Track Header - Universal Layer */}
              <div className={styles.trackHeader}>
                <span className={styles.trackName}>{track.name}</span>
                <div className={styles.trackControls}>
                  <button
                    className={styles.trackIconBtn}
                    title={track.lockedType === 'audio' || track.type === 'audio' ? 'Toggle Audio Mute' : 'Toggle Layer Visibility'}
                  >
                    {track.lockedType === 'audio' || track.type === 'audio' ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M15.54 8.46a5 5 0 010 7.07" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Track Lane */}
              <div className={styles.trackLane} style={{ width: `${infiniteRulerPx}px` }}>
                {track.clips.map((clip) => {
                  if (clip.type === 'text') {
                    return (
                      <div
                        key={clip.id}
                        className={`${styles.clipText} ${clip.isSelected ? styles.clipSelected : ''}`}
                        style={{ left: `${clip.startOffsetPx}px`, width: `${clip.widthPx}px`, cursor: 'grab' }}
                        draggable={true}
                        onDragStart={(e) => handleClipDragStart(e, clip, track.id)}
                        onMouseDown={(e) => handleClipMouseDown(e, clip, track.id)}
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
                      style={{ left: `${clip.startOffsetPx}px`, width: `${clip.widthPx}px`, cursor: 'grab' }}
                      draggable={true}
                      onDragStart={(e) => handleClipDragStart(e, clip, track.id)}
                      onMouseDown={(e) => handleClipMouseDown(e, clip, track.id)}
                    >
                      <div className={`${styles.clipHeader} ${clip.isSelected ? styles.clipHeaderSelected : ''}`}>
                        <span>{clip.title}</span>
                        {clip.effect && (
                          <span
                            style={{
                              fontSize: '9px',
                              background: '#7c3aed',
                              color: '#fff',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              marginLeft: '6px',
                              fontWeight: 600,
                            }}
                          >
                            ✨ {clip.effect}
                          </span>
                        )}
                      </div>
                      <div
                        className={isVideo ? styles.clipBodyVideo : styles.clipBodyAudio}
                        style={clip.thumbnailUrl ? { backgroundImage: `url("${clip.thumbnailUrl}")` } : {}}
                      />
                      {clip.transition && (
                        <div
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            bottom: 0,
                            width: '45px',
                            background: 'linear-gradient(90deg, transparent, rgba(124, 58, 237, 0.85))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontSize: '9px',
                            fontWeight: 'bold',
                            borderLeft: '1px solid #c084fc',
                          }}
                        >
                          {clip.transition.type.substring(0, 4)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Clean Track Sidebar Footer Row (+ Add Layer) */}
          <div className={styles.trackRow} style={{ borderBottom: 'none', height: '44px' }}>
            <div className={styles.trackHeader} style={{ height: '44px', gap: '6px', justifyContent: 'flex-start', background: 'transparent', borderRight: '1px solid var(--outline-variant)' }}>
              <button
                onClick={() => addTrack()}
                style={{
                  background: 'rgba(147, 51, 234, 0.18)',
                  border: '1px solid rgba(147, 51, 234, 0.45)',
                  borderRadius: '6px',
                  padding: '5px 12px',
                  color: '#c084fc',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  width: '100%',
                  justifyContent: 'center',
                }}
                title="Create a new flexible media layer"
              >
                + Add Layer
              </button>
            </div>
            <div className={styles.trackLane} style={{ width: `${infiniteRulerPx}px`, height: '44px', background: 'transparent' }} />
          </div>
        </div>
      </div>
    </div>
  );
};
