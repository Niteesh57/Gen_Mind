import React from 'react';
import { useEditor } from '../../context/EditorContext';
import styles from './SideNavBar.module.css';

interface TabConfig {
  id: string;
  label: string;
  filter?: 'all' | 'video' | 'audio' | 'image';
  icon: React.ReactNode;
}

export const SideNavBar: React.FC = () => {
  const { activeTab, setActiveTab, isSidePanelOpen, setIsSidePanelOpen, setMediaFilter } = useEditor();

  const tabs: TabConfig[] = [
    {
      id: 'Media',
      label: 'Video',
      filter: 'video',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'Audio',
      label: 'Audio',
      filter: 'audio',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      ),
    },
    {
      id: 'Image',
      label: 'Image',
      filter: 'image',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
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

  const handleTabClick = (tabId: string, filter?: 'all' | 'video' | 'audio' | 'image') => {
    if (activeTab === tabId && isSidePanelOpen) {
      setIsSidePanelOpen(false);
    } else {
      setActiveTab(tabId);
      if (filter) {
        setMediaFilter(filter);
      }
      setIsSidePanelOpen(true);
    }
  };

  const isAllMediaActive = activeTab === 'AllMedia' && isSidePanelOpen;

  return (
    <div className={styles.sidebar}>
      <div className={styles.topSection}>
        <button
          className={`${styles.thumbnail} ${isAllMediaActive ? styles.tabItemActive : ''}`}
          onClick={() => handleTabClick('AllMedia', 'all')}
          title="My Assets / All Project Media & Uploads (📁)"
          style={{ cursor: 'pointer', border: isAllMediaActive ? '2px solid var(--primary)' : undefined }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
          </svg>
        </button>

        <div className={styles.tabsContainer}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id && isSidePanelOpen;
            return (
              <button
                key={tab.id}
                className={`${styles.tabItem} ${isActive ? styles.tabItemActive : ''}`}
                onClick={() => handleTabClick(tab.id, tab.filter)}
                title={tab.label}
              >
                {isActive && <div className={styles.activeIndicator} />}
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.footer}>
        <button
          className={styles.toggleBtn}
          onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
          title={isSidePanelOpen ? 'Collapse Side Panel' : 'Expand Side Panel'}
        >
          {isSidePanelOpen ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};
