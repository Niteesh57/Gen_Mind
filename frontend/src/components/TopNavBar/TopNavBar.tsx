import React, { useState, useEffect } from 'react';
import { useEditor } from '../../context/EditorContext';
import { getProjectEventsBackend, type ProjectEvent } from '../../services/apiClient';
import styles from './TopNavBar.module.css';

export const TopNavBar: React.FC = () => {
  const { project, setProject, resetProject, timelineTracks, mediaAssets, undo, redo, canUndo, canRedo } = useEditor();
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [events, setEvents] = useState<ProjectEvent[]>([]);
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [editedName, setEditedName] = useState<string>('');

  const fetchHistory = async () => {
    const list = await getProjectEventsBackend(project?.id || 'default_project');
    setEvents(list);
  };

  useEffect(() => {
    if (showHistory) {
      fetchHistory();
    }
  }, [showHistory, project]);

  const handleSaveName = () => {
    setIsEditingName(false);
    if (project && editedName.trim() && editedName.trim() !== project.name) {
      setProject({
        ...project,
        name: editedName.trim(),
      });
    }
  };

  const handleExportProject = () => {
    const exportManifest = {
      project_title: project?.name || 'Untitled Project',
      resolution: project?.resolution || '1080p',
      timestamp: new Date().toISOString(),
      timeline_tracks: timelineTracks,
      cloud_assets_count: mediaAssets.length,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportManifest, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${project?.name?.replace(/\s+/g, '_') || 'project'}_export.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCopyShareLink = () => {
    const shareUrl = `${window.location.origin}/?project_id=${project?.id || 'demo'}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert(`Copied studio link for "${project?.name || 'Workspace'}" to clipboard!`);
    }).catch(() => {
      alert(`Project Studio Share Link: ${shareUrl}`);
    });
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.leftSection}>
        <div className={styles.brand} onClick={resetProject} title="Back to All Projects / Launcher" style={{ cursor: 'pointer' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7"></polygon>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
          </svg>
          <span>GenMedia Studio</span>
        </div>

        <div className={styles.navLinks} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={resetProject}
            style={{
              background: 'rgba(147, 51, 234, 0.15)',
              border: '1px solid rgba(147, 51, 234, 0.35)',
              borderRadius: '6px',
              padding: '4px 10px',
              cursor: 'pointer',
              color: '#c084fc',
              fontSize: '11px',
              fontWeight: 700,
            }}
            title="Return to Projects List"
          >
            🏠 All Projects
          </button>

          {isEditingName ? (
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              style={{
                background: 'var(--surface-container-lowest)',
                border: '1px solid #9333ea',
                borderRadius: '6px',
                padding: '3px 8px',
                color: 'var(--on-surface)',
                fontSize: '13px',
                fontWeight: 700,
                outline: 'none',
                width: '180px',
              }}
              autoFocus
            />
          ) : (
            <div
              onClick={() => {
                setEditedName(project?.name || 'Untitled 1');
                setIsEditingName(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                background: 'var(--surface-container-low)',
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid var(--outline-variant)',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--on-surface)',
              }}
              title="Click to rename project anytime"
            >
              <span>Project: <b>{project?.name || 'Untitled 1'}</b></span>
              <span style={{ fontSize: '11px', color: '#9333ea' }}>✎</span>
            </div>
          )}
        </div>
      </div>

      <div className={styles.rightSection} style={{ position: 'relative' }}>
        {/* History Clock Button */}
        <button
          className={styles.shareButton}
          onClick={() => setShowHistory(!showHistory)}
          title="View Project Event History (Drag & drops, edits, generation log)"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: showHistory ? 'rgba(147, 51, 234, 0.25)' : undefined }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>History ({events.length || 'Log'})</span>
        </button>

        {showHistory && (
          <div
            style={{
              position: 'absolute',
              top: '44px',
              right: '120px',
              width: '320px',
              maxHeight: '380px',
              overflowY: 'auto',
              background: 'var(--surface-container-high)',
              border: '1px solid var(--outline-variant)',
              borderRadius: '12px',
              boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
              padding: '14px',
              zIndex: 999,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--outline-variant)', paddingBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--on-surface)' }}>Project Event Log (Postgre/SQLite)</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={undo}
                  disabled={!canUndo}
                  title="Undo last action"
                  style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--outline-variant)', background: 'transparent', color: canUndo ? '#9333ea' : 'gray', cursor: canUndo ? 'pointer' : 'default' }}
                >
                  Undo
                </button>
                <button
                  onClick={redo}
                  disabled={!canRedo}
                  title="Redo action"
                  style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--outline-variant)', background: 'transparent', color: canRedo ? '#9333ea' : 'gray', cursor: canRedo ? 'pointer' : 'default' }}
                >
                  Redo
                </button>
              </div>
            </div>

            {events.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    style={{
                      background: 'var(--surface-container-low)',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--outline-variant)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                      fontSize: '11px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#c084fc' }}>
                      <span>{ev.event_type}</span>
                      <span style={{ fontSize: '10px', color: 'var(--on-surface-variant)' }}>
                        {ev.created_at ? new Date(ev.created_at).toLocaleTimeString() : 'Just now'}
                      </span>
                    </div>
                    {ev.payload && (
                      <span style={{ color: 'var(--on-surface)', wordBreak: 'break-all' }}>
                        {ev.payload.asset_name || ev.payload.project_name || ev.payload.prompt || JSON.stringify(ev.payload).slice(0, 60)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: '12px', color: 'var(--on-surface-variant)', textAlign: 'center', padding: '20px 0' }}>
                No events recorded yet. Add tracks or drag & drop clips to build your timeline history!
              </span>
            )}
          </div>
        )}

        <button className={styles.shareButton} onClick={handleCopyShareLink} title="Copy Project Share URL">
          Share
        </button>
        <button className={styles.exportButton} onClick={handleExportProject} title="Export Timeline Manifest & Video">
          Export Video
        </button>
      </div>
    </nav>
  );
};
