import React, { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import {
  type IEditorService,
  RealBackendEditorService,
  MockEditorService,
  type ProjectMetadata,
  type MediaAsset,
  type TimelineTrack,
  type TimelineClip,
} from '../services/editorService';
import { saveDeviceProjectBackend, logProjectEventBackend } from '../services/apiClient';

interface EditorContextType {
  service: IEditorService;
  project: ProjectMetadata | null;
  setProject: (proj: ProjectMetadata | null) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isSidePanelOpen: boolean;
  setIsSidePanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeTool: 'pan' | 'cut' | 'undo' | 'redo';
  setActiveTool: (tool: 'pan' | 'cut' | 'undo' | 'redo') => void;
  playheadPx: number;
  setPlayheadPx: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  mediaFilter: 'all' | 'video' | 'image' | 'audio';
  setMediaFilter: (filter: 'all' | 'video' | 'image' | 'audio') => void;
  mediaAssets: MediaAsset[];
  timelineTracks: TimelineTrack[];
  activeProjectEffect: string | null;
  setActiveProjectEffect: (eff: string | null) => void;
  reloadAssets: () => Promise<void>;
  resetProject: () => void;
  addTrack: (type: 'video' | 'audio') => void;
  addClipToTrack: (trackIdOrName: string, asset: MediaAsset) => void;
  moveClipInTimeline: (clipId: string, targetTrackId: string, newOffsetPx: number) => void;
  applyTransitionToClip: (clipIdOrTrackId: string, transitionName: string, dropPx?: number) => void;
  applyEffectToClip: (clipIdOrTrackId: string, effectName: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const EditorContext = createContext<EditorContextType | null>(null);

interface EditorProviderProps {
  children: ReactNode;
  service?: IEditorService;
}

export const EditorProvider: React.FC<EditorProviderProps> = ({ children, service }) => {
  const [editorService] = useState<IEditorService>(() => service || new RealBackendEditorService());
  const [project, setProject] = useState<ProjectMetadata | null>(null);
  const [activeTab, setActiveTab] = useState<string>('Media');
  const [isSidePanelOpen, setIsSidePanelOpen] = useState<boolean>(true);
  const [activeTool, setActiveTool] = useState<'pan' | 'cut' | 'undo' | 'redo'>('pan');
  const [playheadPx, setPlayheadPx] = useState<number>(340);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [mediaFilter, setMediaFilter] = useState<'all' | 'video' | 'image' | 'audio'>('video');
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [timelineTracks, setTimelineTracks] = useState<TimelineTrack[]>([]);
  const [activeProjectEffect, setActiveProjectEffect] = useState<string | null>(null);

  const [undoStack, setUndoStack] = useState<TimelineTrack[][]>([]);
  const [redoStack, setRedoStack] = useState<TimelineTrack[][]>([]);
  const tracksRef = useRef<TimelineTrack[]>(timelineTracks);
  tracksRef.current = timelineTracks;

  const pushUndo = useCallback((newTracks: TimelineTrack[], actionName: string = 'EDIT_TIMELINE') => {
    setUndoStack((prev) => [...prev.slice(-20), tracksRef.current]);
    setRedoStack([]);
    setTimelineTracks(newTracks);
    logProjectEventBackend(project?.id || 'default_project', actionName, { tracks_count: newTracks.length });
  }, [project]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, tracksRef.current]);
    setTimelineTracks(previous);
    logProjectEventBackend(project?.id || 'default_project', 'UNDO_ACTION', { restored_tracks: previous.length });
  }, [undoStack, project]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, tracksRef.current]);
    setTimelineTracks(next);
    logProjectEventBackend(project?.id || 'default_project', 'REDO_ACTION', { restored_tracks: next.length });
  }, [redoStack, project]);

  const reloadAssets = useCallback(async () => {
    try {
      const [assets, tracks] = await Promise.all([
        editorService.getMediaAssets('all'),
        editorService.getTimelineTracks(),
      ]);
      setMediaAssets(assets);
      setTimelineTracks(tracks);
      setUndoStack([]);
      setRedoStack([]);
    } catch (err) {
      console.error('Failed to load editor data', err);
    }
  }, [editorService]);

  useEffect(() => {
    if (project) {
      reloadAssets();
    }
  }, [project, reloadAssets]);

  useEffect(() => {
    if (project && timelineTracks.length > 0) {
      saveDeviceProjectBackend(project, mediaAssets);
    }
  }, [project, mediaAssets, timelineTracks]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setPlayheadPx((prev) => (prev >= 2400 ? 0 : prev + 4));
    }, 50);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const resetProject = useCallback(() => {
    setIsPlaying(false);
    setProject(null);
  }, []);

  const addTrack = useCallback((type: 'video' | 'audio') => {
    const trackCount = tracksRef.current.filter((t) => t.type === type).length + 1;
    const newTrack: TimelineTrack = {
      id: `track_${Date.now()}`,
      name: `${type === 'video' ? 'Video' : 'Audio'} ${trackCount}`,
      type,
      clips: [],
    };
    pushUndo([...tracksRef.current, newTrack], `ADD_TRACK_${type.toUpperCase()}`);
  }, [pushUndo]);

  const addClipToTrack = useCallback((trackIdOrName: string, asset: MediaAsset) => {
    const newTracks = tracksRef.current.map((track) => {
      if (track.id !== trackIdOrName && track.name !== trackIdOrName) {
        if (asset.type === 'audio' && track.type === 'audio' && trackIdOrName === 'default_audio') {
          // target default audio if track match
        } else if (asset.type !== 'audio' && track.type === 'video' && trackIdOrName === 'default_video') {
          // target default video
        } else {
          return track;
        }
      }

      const newClip: TimelineClip = {
        id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: asset.name,
        type: asset.type === 'audio' ? 'audio' : asset.type === 'text' ? 'text' : 'video',
        startOffsetPx: playheadPx,
        widthPx: (asset.durationSeconds || 8) * 20,
        thumbnailUrl: asset.thumbnailUrl,
        isSelected: true,
      };

      return {
        ...track,
        clips: [...track.clips.map((c) => ({ ...c, isSelected: false })), newClip],
      };
    });
    pushUndo(newTracks, `ADD_CLIP_${asset.name.substring(0, 15)}`);
  }, [playheadPx, pushUndo]);

  const moveClipInTimeline = useCallback((clipId: string, targetTrackId: string, newOffsetPx: number) => {
    let targetClip: TimelineClip | null = null;
    for (const t of tracksRef.current) {
      const found = t.clips.find((c) => c.id === clipId);
      if (found) {
        targetClip = { ...found, startOffsetPx: Math.max(0, newOffsetPx), isSelected: true };
        break;
      }
    }
    if (!targetClip) return;

    const newTracks = tracksRef.current.map((t) => {
      const filteredClips = t.clips.filter((c) => c.id !== clipId).map((c) => ({ ...c, isSelected: false }));
      if (t.id === targetTrackId || t.name === targetTrackId) {
        return {
          ...t,
          clips: [...filteredClips, targetClip!],
        };
      }
      return {
        ...t,
        clips: filteredClips,
      };
    });
    pushUndo(newTracks, `MOVE_CLIP_${clipId}`);
  }, [pushUndo]);

  const applyTransitionToClip = useCallback((clipIdOrTrackId: string, transitionName: string, dropPx?: number) => {
    const newTracks = tracksRef.current.map((track) => {
      const updatedClips = track.clips.map((clip) => {
        if (clip.id === clipIdOrTrackId || clip.isSelected || (dropPx !== undefined && dropPx >= clip.startOffsetPx && dropPx <= clip.startOffsetPx + clip.widthPx + 50)) {
          return {
            ...clip,
            transition: { type: transitionName, duration: '0.5s' },
          };
        }
        return clip;
      });
      return { ...track, clips: updatedClips };
    });
    pushUndo(newTracks, `APPLY_TRANSITION_${transitionName}`);
  }, [pushUndo]);

  const applyEffectToClip = useCallback((clipIdOrTrackId: string, effectName: string) => {
    setActiveProjectEffect(effectName);
    const newTracks = tracksRef.current.map((track) => {
      const updatedClips = track.clips.map((clip) => {
        if (clip.id === clipIdOrTrackId || clip.isSelected) {
          return {
            ...clip,
            effect: effectName,
          };
        }
        return clip;
      });
      return { ...track, clips: updatedClips };
    });
    pushUndo(newTracks, `APPLY_EFFECT_${effectName}`);
  }, [pushUndo]);

  return (
    <EditorContext.Provider
      value={{
        service: editorService,
        project,
        setProject,
        activeTab,
        setActiveTab,
        isSidePanelOpen,
        setIsSidePanelOpen,
        activeTool,
        setActiveTool,
        playheadPx,
        setPlayheadPx,
        isPlaying,
        setIsPlaying,
        mediaFilter,
        setMediaFilter,
        mediaAssets,
        timelineTracks,
        activeProjectEffect,
        setActiveProjectEffect,
        reloadAssets,
        resetProject,
        addTrack,
        addClipToTrack,
        moveClipInTimeline,
        applyTransitionToClip,
        applyEffectToClip,
        undo,
        redo,
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
      }}
    >
      {children}
    </EditorContext.Provider>
  );
};

export const useEditor = (): EditorContextType => {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditor must be used within an EditorProvider');
  }
  return context;
};
