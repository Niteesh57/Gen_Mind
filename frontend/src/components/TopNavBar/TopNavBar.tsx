import React from 'react';
import { useEditor } from '../../context/EditorContext';
import styles from './TopNavBar.module.css';

export const TopNavBar: React.FC = () => {
  const { project, resetProject } = useEditor();

  return (
    <nav className={styles.navbar}>
      <div className={styles.leftSection}>
        <div className={styles.brand} onClick={resetProject} title="Switch or Create Project">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7"></polygon>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
          </svg>
          <span>GenMedia</span>
        </div>

        <div className={styles.navLinks}>
          <a
            className={styles.navLinkActive}
            onClick={(e) => {
              e.preventDefault();
              resetProject();
            }}
            href="#"
          >
            Projects ({project?.name || 'Workspace'})
          </a>
          <a className={styles.navLink} href="#" onClick={(e) => e.preventDefault()}>
            Assets
          </a>
        </div>
      </div>

      <div className={styles.rightSection}>
        <div className={styles.iconGroup}>
          <button className={styles.iconButton} title="Project History">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <button className={styles.iconButton} title="Workspace Settings">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>

        <div className={styles.divider}></div>

        <button className={styles.shareButton} onClick={() => alert(`Share link generated for: ${project?.name || 'Project'}`)}>
          Share
        </button>
        <button className={styles.exportButton} onClick={() => alert(`Export started for ${project?.name || 'Project'} (${project?.resolution || '1080p'})`)}>
          Export
        </button>

        <div className={styles.profileAvatar} title="User Profile">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
      </div>
    </nav>
  );
};
