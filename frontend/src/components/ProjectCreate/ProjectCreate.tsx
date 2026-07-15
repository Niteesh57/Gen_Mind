import React, { useState } from 'react';
import { useEditor } from '../../context/EditorContext';
import styles from './ProjectCreate.module.css';

export const ProjectCreate: React.FC = () => {
  const { service, setProject } = useEditor();
  const [projectName, setProjectName] = useState('');
  const [resolution, setResolution] = useState('1080p (1920x1080)');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    setIsSubmitting(true);
    try {
      const newProject = await service.createProject(projectName.trim(), resolution);
      setProject(newProject);
    } catch (err) {
      console.error('Failed to create project', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickSelect = async (presetName: string, presetRes: string) => {
    setIsSubmitting(true);
    try {
      const newProject = await service.createProject(presetName, presetRes);
      setProject(newProject);
    } catch (err) {
      console.error('Failed to quick start project', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.logoIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7"></polygon>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
          </div>
          <h1 className={styles.title}>StudioPro Workspace</h1>
          <p className={styles.subtitle}>
            Welcome to GenMedia Creative Ad Studio. Enter a dynamic project name below to open your timeline canvas.
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label htmlFor="project-name" className={styles.label}>
              Project Title
            </label>
            <input
              id="project-name"
              type="text"
              className={styles.input}
              placeholder="e.g. Summer Promo Campaign 2026"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="resolution-select" className={styles.label}>
              Canvas Resolution & Aspect Ratio
            </label>
            <select
              id="resolution-select"
              className={styles.select}
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
            >
              <option value="1080p (1920x1080)">1080p HD (1920x1080 • 16:9)</option>
              <option value="4K UHD (3840x2160)">4K UHD (3840x2160 • 16:9)</option>
              <option value="Vertical Story (1080x1920)">Vertical Reel/Story (1080x1920 • 9:16)</option>
              <option value="Square Ad (1080x1080)">Social Square (1080x1080 • 1:1)</option>
            </select>
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={!projectName.trim() || isSubmitting}
          >
            <span>{isSubmitting ? 'Initializing Workspace...' : 'Enter Editing Studio'}</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
        </form>

        <div className={styles.templatesSection}>
          <span className={styles.templatesTitle}>Quick Start Presets</span>
          <div className={styles.templateButtons}>
            <button
              type="button"
              className={styles.templateChip}
              onClick={() => handleQuickSelect('Cyberpunk Ad Showcase', '1080p (1920x1080)')}
            >
              ⚡ Cyberpunk Ad Showcase
            </button>
            <button
              type="button"
              className={styles.templateChip}
              onClick={() => handleQuickSelect('Instagram Vertical Teaser', 'Vertical Story (1080x1920)')}
            >
              📱 Instagram Vertical Teaser
            </button>
            <button
              type="button"
              className={styles.templateChip}
              onClick={() => handleQuickSelect('Brand Anthem 4K', '4K UHD (3840x2160)')}
            >
              🎬 Brand Anthem 4K
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
