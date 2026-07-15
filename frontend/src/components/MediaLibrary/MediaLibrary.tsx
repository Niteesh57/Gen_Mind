import React from 'react';
import { useEditor } from '../../context/EditorContext';
import styles from './MediaLibrary.module.css';

export const MediaLibrary: React.FC = () => {
  const { mediaAssets, mediaFilter, setMediaFilter } = useEditor();

  const filters: Array<'all' | 'video' | 'image' | 'audio'> = ['all', 'video', 'image', 'audio'];

  return (
    <div className={styles.library}>
      <div className={styles.header}>
        <div className={styles.filters}>
          {filters.map((filter) => (
            <button
              key={filter}
              className={`${styles.filterPill} ${mediaFilter === filter ? styles.filterPillActive : ''}`}
              onClick={() => setMediaFilter(filter)}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
        <button className={styles.filterPill} title="Sort & Filter Options" onClick={() => alert('Sort criteria: Date Added (Newest first)')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="21" x2="4" y2="14" />
            <line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" />
            <line x1="20" y1="12" x2="20" y2="3" />
            <line x1="1" y1="14" x2="7" y2="14" />
            <line x1="9" y1="8" x2="15" y2="8" />
            <line x1="17" y1="16" x2="23" y2="16" />
          </svg>
        </button>
      </div>

      <div className={styles.grid}>
        {mediaAssets.map((asset) => (
          <div
            key={asset.id}
            className={`${styles.card} ${asset.isUsed ? styles.cardUsed : ''}`}
            onClick={() => alert(`Selected asset: ${asset.name} (${asset.duration})`)}
            title={asset.name}
          >
            {asset.thumbnailUrl ? (
              <div className={styles.thumbnail} style={{ backgroundImage: `url("${asset.thumbnailUrl}")` }} />
            ) : (
              <div className={styles.audioPreview}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
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

            <div className={styles.timecode}>{asset.duration}</div>
            <div className={styles.overlay} />
          </div>
        ))}
      </div>
    </div>
  );
};
