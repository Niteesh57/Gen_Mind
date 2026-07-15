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
  const { deviceId, deviceName } = getDeviceIdentity();

  useEffect(() => {
    getDeviceProjectsBackend().then((list) => {
      setDeviceProjects(list || []);
    });
  }, []);

  const handleStartFromScratch = async () => {
    try {
      const newProject = await service.createProject('Untitled Video', '1080p (1920x1080)');
      setActiveTab('Media');
      setProject(newProject);
    } catch (err) {
      console.error('Failed to create project', err);
    }
  };

  const handleStartWithAI = async () => {
    try {
      const newProject = await service.createProject('AI Auto Composed Video', '1080p (1920x1080)');
      setActiveTab('Media');
      setProject(newProject);
    } catch (err) {
      console.error('Failed to start AI project', err);
    }
  };

  const handleEasyEdit = async (mode: 'record' | 'tts') => {
    try {
      const newProject = await service.createProject(
        mode === 'record' ? 'Webcam Recording Session' : 'Text to Speech Voiceover',
        '1080p (1920x1080)'
      );
      setActiveTab(mode === 'tts' ? 'Audio' : 'Media');
      setProject(newProject);
    } catch (err) {
      console.error('Failed to start easy edit', err);
    }
  };

  const handleTemplateSelect = async (templateName: string, res: string = '1080p (1920x1080)') => {
    try {
      const newProject = await service.createProject(templateName, res);
      setActiveTab('Media');
      setProject(newProject);
    } catch (err) {
      console.error('Failed to launch template', err);
    }
  };

  const handleOpenPrevious = (proj: ProjectMetadata) => {
    setProject(proj);
  };

  const filteredProjects = deviceProjects.filter((entry) =>
    entry.project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const templates = [
    { name: 'YouTube', thumb: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&auto=format&fit=crop&q=80', res: '1080p (1920x1080)' },
    { name: 'Instagram', thumb: 'https://images.unsplash.com/photo-1611262588024-d12430b98920?w=400&auto=format&fit=crop&q=80', res: 'Vertical Story (1080x1920)' },
    { name: 'Intro & outro tem...', thumb: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&auto=format&fit=crop&q=80', res: '1080p (1920x1080)' },
    { name: 'Gaming', thumb: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=400&auto=format&fit=crop&q=80', res: '1080p (1920x1080)' },
    { name: 'Corporate templa...', thumb: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&auto=format&fit=crop&q=80', res: '1080p (1920x1080)' },
    { name: 'Slideshows', thumb: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&auto=format&fit=crop&q=80', res: '1080p (1920x1080)' },
    { name: 'Celebration', thumb: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=400&auto=format&fit=crop&q=80', res: 'Vertical Story (1080x1920)' },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.workspaceWrapper}>
        {/* Top Dual Banners Row matching Clipchamp screenshot */}
        <div className={styles.bannerRow}>
          <button className={styles.bannerCardScratch} onClick={handleStartFromScratch} title="Click to open clean timeline canvas">
            <div className={styles.bannerText}>
              <span className={styles.bannerTitle}>Create a new video</span>
              <span className={styles.bannerSubtitle}>Start from scratch</span>
            </div>
            <div className={styles.bannerIcon}>+</div>
          </button>

          <button className={styles.bannerCardAI} onClick={handleStartWithAI} title="Auto compose video with Genblaze & B2 cloud">
            <div className={styles.bannerText}>
              <span className={styles.bannerTitle}>Create a video with AI</span>
              <span className={styles.bannerSubtitle}>Quickly auto compose a video using your own media</span>
            </div>
            <div className={styles.bannerIcon}>✨</div>
          </button>
        </div>

        {/* Middle Easy Edits & Templates Box */}
        <div className={styles.inspirationBox}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Get started with these easy edits</h2>
          </div>

          <div className={styles.easyEditsRow}>
            <div className={styles.easyEditCard} onClick={() => handleEasyEdit('record')}>
              <div
                className={styles.easyEditThumb}
                style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80")' }}
              />
              <div className={styles.easyEditBody}>
                <div className={styles.easyEditInfo}>
                  <span className={styles.easyEditTitle}>Record yourself</span>
                  <span className={styles.easyEditDesc}>Use your microphone, screen or webcam</span>
                </div>
                <button className={styles.tryButton}>Try it</button>
              </div>
            </div>

            <div className={styles.easyEditCard} onClick={() => handleEasyEdit('tts')}>
              <div
                className={styles.easyEditThumb}
                style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=600&auto=format&fit=crop&q=80")' }}
              />
              <div className={styles.easyEditBody}>
                <div className={styles.easyEditInfo}>
                  <span className={styles.easyEditTitle}>Text to speech</span>
                  <span className={styles.easyEditDesc}>Explore lifelike voices in over 80 languages</span>
                </div>
                <button className={styles.tryButton}>Try it</button>
              </div>
            </div>
          </div>

          <div className={styles.sectionHeader} style={{ marginTop: '8px' }}>
            <h2 className={styles.sectionTitle}>Get inspired with a template</h2>
            <button className={styles.allLink}>All templates</button>
          </div>

          <div className={styles.templatesGrid}>
            {templates.map((tpl, idx) => (
              <div key={idx} className={styles.templateItem} onClick={() => handleTemplateSelect(tpl.name, tpl.res)}>
                <div className={styles.templateThumb} style={{ backgroundImage: `url("${tpl.thumb}")` }} />
                <span className={styles.templateName}>{tpl.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Your Videos Section (SQLite Device-Backed) */}
        <div className={styles.yourVideosSection}>
          <div className={styles.yourVideosHeader}>
            <div className={styles.yourVideosTitle}>
              <span>Your videos</span>
              <span className={styles.sqliteBadge} title={`Auto-saved directly to SQLite per ${deviceId} (${deviceName}) without login required`}>
                SQLite Key: {deviceId}
              </span>
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
              <button className={styles.controlButton} onClick={handleStartFromScratch}>
                <span>Import</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 19V5M5 12l7-7 7 7" />
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
              No cloud videos saved under device key (`{deviceId}`) yet. Click <b>Create a new video</b> or <b>Create a video with AI</b> above to start your first timeline!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
