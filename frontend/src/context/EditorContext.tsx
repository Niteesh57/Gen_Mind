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

  const addTrack = useCallback((_type?: 'video' | 'audio') => {
    const nextNum = tracksRef.current.length + 1;
    const newTrack: TimelineTrack = {
      id: `layer_${Date.now()}`,
      name: `Layer ${nextNum}`,
      type: 'layer',
      lockedType: null,
      clips: [],
    };
    pushUndo([...tracksRef.current, newTrack], `ADD_LAYER_${nextNum}`);
  }, [pushUndo]);

  const addClipToTrack = useCallback((trackIdOrName: string, asset: MediaAsset) => {
    const target = tracksRef.current.find((t) => t.id === trackIdOrName || t.name === trackIdOrName) || tracksRef.current[0];
    if (!target) return;
    const assetCategory: 'video' | 'audio' | 'image' = asset.type === 'image' ? 'image' : asset.type === 'audio' ? 'audio' : 'video';

    const currentLocked = target.lockedType || (target.clips.length > 0 ? (target.clips[0].type === 'audio' ? 'audio' : target.clips[0].title.match(/\.(png|jpg|jpeg|webp|gif)$/i) ? 'image' : 'video') : null);

    if (currentLocked && currentLocked !== assetCategory) {
      if (currentLocked === 'audio' && (assetCategory === 'video' || assetCategory === 'image')) {
        alert("Cannot drop Video or Image media into an Audio Layer! Please drop onto an empty Layer or a Video/Image Layer.");
        return;
      }
      if ((currentLocked === 'video' || currentLocked === 'image') && assetCategory === 'audio') {
        alert("Cannot drop Audio media into a Video or Image Layer! Please drop onto an empty Layer or an Audio Layer.");
        return;
      }
      if (currentLocked !== assetCategory) {
        alert(`Cannot mix ${assetCategory.toUpperCase()} clips into a layer locked to ${currentLocked.toUpperCase()}!`);
        return;
      }
    }

    const newTracks = tracksRef.current.map((track) => {
      if (track.id === target.id) {
        const newClip: TimelineClip = {
          id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          title: asset.name,
          type: asset.type === 'audio' ? 'audio' : asset.type === 'text' ? 'text' : 'video',
          startOffsetPx: playheadPx,
          widthPx: (asset.durationSeconds || 8) * 20,
          thumbnailUrl: asset.thumbnailUrl,
          isSelected: true,
        };

        const nextLockedType = track.lockedType || assetCategory;
        const prefix = nextLockedType === 'image' ? 'Image ' : nextLockedType === 'audio' ? 'Audio ' : 'Video ';
        const updatedName = track.name.startsWith('Layer ') ? prefix + track.name : track.name;

        return {
          ...track,
          lockedType: nextLockedType,
          name: updatedName,
          clips: [...track.clips.map((c) => ({ ...c, isSelected: false })), newClip],
        };
      }
      return track;
    });
    pushUndo(newTracks, `ADD_CLIP_${asset.name.substring(0, 15)}`);
  }, [playheadPx, pushUndo]);

  const moveClipInTimeline = useCallback((clipId: string, targetTrackId: string, newOffsetPx: number) => {
    let targetClip: TimelineClip | null = null;
    let sourceTrack: TimelineTrack | null = null;
    for (const t of tracksRef.current) {
      const found = t.clips.find((c) => c.id === clipId);
      if (found) {
        targetClip = { ...found, startOffsetPx: Math.max(0, newOffsetPx), isSelected: true };
        sourceTrack = t;
        break;
      }
    }
    if (!targetClip) return;

    const targetTrack = tracksRef.current.find((t) => t.id === targetTrackId || t.name === targetTrackId);
    if (targetTrack && sourceTrack && targetTrack.id !== sourceTrack.id) {
      const clipCategory: 'video' | 'audio' | 'image' = targetClip.type === 'audio' ? 'audio' : targetClip.title.match(/\.(png|jpg|jpeg|webp|gif)$/i) ? 'image' : 'video';
      const currentLocked = targetTrack.lockedType || (targetTrack.clips.length > 0 ? (targetTrack.clips[0].type === 'audio' ? 'audio' : targetTrack.clips[0].title.match(/\.(png|jpg|jpeg|webp|gif)$/i) ? 'image' : 'video') : null);
      if (currentLocked && currentLocked !== clipCategory) {
        alert(`Cannot move ${clipCategory.toUpperCase()} clip into a layer locked to ${currentLocked.toUpperCase()}!`);
        return;
      }
    }

    const newTracks = tracksRef.current.map((t) => {
      const filteredClips = t.clips.filter((c) => c.id !== clipId).map((c) => ({ ...c, isSelected: false }));
      if (t.id === targetTrackId || t.name === targetTrackId) {
        const clipCategory: 'video' | 'audio' | 'image' = targetClip!.type === 'audio' ? 'audio' : targetClip!.title.match(/\.(png|jpg|jpeg|webp|gif)$/i) ? 'image' : 'video';
        const nextLockedType = t.lockedType || clipCategory;
        const prefix = nextLockedType === 'image' ? 'Image ' : nextLockedType === 'audio' ? 'Audio ' : 'Video ';
        const updatedName = t.name.startsWith('Layer ') ? prefix + t.name : t.name;

        return {
          ...t,
          lockedType: nextLockedType,
          name: updatedName,
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
