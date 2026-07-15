import React from 'react';
import { TopNavBar } from '../TopNavBar/TopNavBar';
import { SideNavBar } from '../SideNavBar/SideNavBar';
import { MediaLibrary } from '../MediaLibrary/MediaLibrary';
import { PreviewPlayer } from '../PreviewPlayer/PreviewPlayer';
import { Timeline } from '../Timeline/Timeline';
import styles from './EditorWorkspace.module.css';

export const EditorWorkspace: React.FC = () => {
  return (
    <div className={styles.workspaceWrapper}>
      <TopNavBar />
      <div className={styles.mainRow}>
        <SideNavBar />
        <div className={styles.centerArea}>
          <div className={styles.topPanelsRow}>
            <MediaLibrary />
            <PreviewPlayer />
          </div>
          <Timeline />
        </div>
      </div>
    </div>
  );
};
