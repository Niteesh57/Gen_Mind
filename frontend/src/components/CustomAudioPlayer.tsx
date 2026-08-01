import React, { useRef, useState, useEffect } from 'react';
import styles from './CustomAudioPlayer.module.css';

export interface Turn {
  index: number;
  speaker_index?: number;
  speaker_name: string;
  voice?: string;
  narration: string;
}

interface CustomAudioPlayerProps {
  src: string;
  turns?: Turn[];
  topic?: string;
}

const SPEAKER_COLORS = [
  '#0284c7', // Sky Blue
  '#7c3aed', // Purple
  '#059669', // Emerald
  '#d97706', // Amber
];

export const CustomAudioPlayer: React.FC<CustomAudioPlayerProps> = ({ src, turns = [], topic: _topic }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [activeTurnIndex, setActiveTurnIndex] = useState<number>(0);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const curr = audioRef.current.currentTime;
    const dur = audioRef.current.duration || 0;
    setCurrentTime(curr);
    setDuration(dur);

    if (turns.length > 0 && dur > 0) {
      // Estimate active turn proportional to audio progress
      const turnProgress = Math.floor((curr / dur) * turns.length);
      const safeIndex = Math.min(turns.length - 1, Math.max(0, turnProgress));
      setActiveTurnIndex(safeIndex);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const cycleSpeed = () => {
    const speeds = [1.0, 1.25, 1.5, 2.0];
    const nextSpeed = speeds[(speeds.indexOf(playbackRate) + 1) % speeds.length];
    setPlaybackRate(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const seekToTurn = (index: number) => {
    if (!audioRef.current || duration <= 0 || turns.length <= 0) return;
    const targetTime = (index / turns.length) * duration;
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
    setActiveTurnIndex(index);
    if (!isPlaying) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className={styles.container}>
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Control Bar */}
      <div className={styles.playerBar}>
        <button className={styles.playBtn} onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? (
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24" style={{ marginLeft: 2 }}>
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <div className={styles.progressWrap}>
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            className={styles.timelineBar}
          />
          <div className={styles.timeRow}>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className={styles.controlsRight}>
          <button className={styles.speedChip} onClick={cycleSpeed}>
            {playbackRate}x
          </button>
        </div>
      </div>

      {/* Synchronized Transcript Block */}
      {turns.length > 0 && (
        <div>
          <div className={styles.transcriptHeader}>
            <span className={styles.transcriptTitle}>Synchronized Transcript</span>
            <span className={styles.turnsBadge}>{turns.length} Turns</span>
          </div>

          <div className={styles.transcriptList} style={{ marginTop: 12 }}>
            {turns.map((t, i) => {
              const spkIdx = (t.speaker_index !== undefined ? t.speaker_index : i) % SPEAKER_COLORS.length;
              const color = SPEAKER_COLORS[spkIdx];
              const isActive = activeTurnIndex === i;

              return (
                <div
                  key={t.index || i}
                  className={`${styles.turnCard} ${isActive ? styles.turnActive : ''}`}
                  onClick={() => seekToTurn(i)}
                >
                  <div className={styles.speakerAvatar} style={{ background: color }}>
                    {t.speaker_name ? t.speaker_name[0].toUpperCase() : 'S'}
                  </div>
                  <div className={styles.turnContent}>
                    <div className={styles.speakerName} style={{ color }}>
                      {t.speaker_name || `Speaker ${spkIdx + 1}`}
                    </div>
                    <div className={styles.narrationText}>{t.narration}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
