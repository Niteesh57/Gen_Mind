import React, { useState, useEffect } from 'react';
import { useEditor } from '../../context/EditorContext';
import { getDeviceProjectsBackend } from '../../services/apiClient';
import { getDeviceIdentity } from '../../services/deviceIdentity';
import { type ProjectMetadata, type MediaAsset } from '../../services/editorService';
import styles from './ProjectCreate.module.css';

export const ProjectCreate: React.FC = () => {
  const { service, setProject, setActiveTab } = useEditor();
  const [deviceProjects, setDeviceProjects] = useState<Array<{ project: ProjectMetadata; assets: MediaAsset[] }>>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    getDeviceProjectsBackend().then((list) => {
      setDeviceProjects(list || []);
    });
  }, []);

  const handleStartCreation = async () => {
    try {
      const nextNum = deviceProjects.length + 1;
      const defaultName = `Untitled ${nextNum}`;
      const newProject = await service.createProject(defaultName, '1080p (1920x1080)');
      setActiveTab('Media');
      setProject(newProject);
    } catch (err) {
      console.error('Failed to create default project', err);
    }
  };

  const handleOpenPrevious = (proj: ProjectMetadata) => {
    setProject(proj);
  };

  const filteredProjects = deviceProjects.filter((entry) =>
    entry.project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={styles.container}>
      <div className={styles.workspaceWrapper}>
        {/* Single Clean Banner Row */}
        <div className={styles.bannerRowSingle}>
          <button className={styles.bannerCardScratch} onClick={handleStartCreation} title="Click to instantly launch studio canvas">
            <div className={styles.bannerText}>
              <span className={styles.bannerTitle}>Create a new video</span>
              <span className={styles.bannerSubtitle}>Instantly open editing studio canvas (Default name: Untitled {deviceProjects.length + 1})</span>
            </div>
            <div className={styles.bannerIcon}>+</div>
          </button>
        </div>

        {/* Your Videos Section */}
        <div className={styles.yourVideosSection}>
          <div className={styles.yourVideosHeader}>
            <div className={styles.yourVideosTitle}>
              <span>Your videos</span>
            </div>

            <div className={styles.yourVideosControls}>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search videos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button className={styles.controlButton}>
                <span>Sort by</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              <button className={styles.controlButton} onClick={handleStartCreation}>
                <span>New Project</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </div>
          </div>

          {filteredProjects.length > 0 ? (
            <div className={styles.projectsGrid}>
              {filteredProjects.map((entry, idx) => (
                <div key={idx} className={styles.videoCard} onClick={() => handleOpenPrevious(entry.project)}>
                  <div
                    className={styles.videoCardThumb}
                    style={entry.assets && entry.assets.length > 0 && entry.assets[0].thumbnailUrl ? { backgroundImage: `url("${entry.assets[0].thumbnailUrl}")` } : {}}
                  >
                    {(!entry.assets || entry.assets.length === 0 || !entry.assets[0].thumbnailUrl) && (
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <polygon points="23 7 16 12 23 17 23 7" />
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                      </svg>
                    )}
                  </div>
                  <div className={styles.videoCardBody}>
                    <span className={styles.videoCardTitle}>{entry.project.name}</span>
                    <span className={styles.videoCardMeta}>
                      {entry.assets?.length || 0} assets • {new Date(entry.project.createdAt || Date.now()).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyBox}>
              No projects created yet. Click <b>Create a new video</b> above to immediately launch your first project!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
