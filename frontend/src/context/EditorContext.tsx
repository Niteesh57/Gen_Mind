import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  type IEditorService,
  MockEditorService,
  type ProjectMetadata,
  type MediaAsset,
  type TimelineTrack,
} from '../services/editorService';

interface EditorContextType {
  service: IEditorService;
  project: ProjectMetadata | null;
  setProject: (proj: ProjectMetadata | null) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
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
  reloadAssets: () => Promise<void>;
  resetProject: () => void;
}

const EditorContext = createContext<EditorContextType | null>(null);

interface EditorProviderProps {
  children: ReactNode;
  service?: IEditorService;
}

export const EditorProvider: React.FC<EditorProviderProps> = ({ children, service }) => {
  const [editorService] = useState<IEditorService>(() => service || new MockEditorService());
  const [project, setProject] = useState<ProjectMetadata | null>(null);
  const [activeTab, setActiveTab] = useState<string>('Media');
  const [activeTool, setActiveTool] = useState<'pan' | 'cut' | 'undo' | 'redo'>('pan');
  const [playheadPx, setPlayheadPx] = useState<number>(340);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [mediaFilter, setMediaFilter] = useState<'all' | 'video' | 'image' | 'audio'>('all');
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [timelineTracks, setTimelineTracks] = useState<TimelineTrack[]>([]);

  const reloadAssets = useCallback(async () => {
    try {
      const [assets, tracks] = await Promise.all([
        editorService.getMediaAssets(mediaFilter),
        editorService.getTimelineTracks(),
      ]);
      setMediaAssets(assets);
      setTimelineTracks(tracks);
    } catch (err) {
      console.error('Failed to load editor data', err);
    }
  }, [editorService, mediaFilter]);

  useEffect(() => {
    if (project) {
      reloadAssets();
    }
  }, [project, reloadAssets]);

  // Simulate playback loop scrubbing playhead forward
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setPlayheadPx((prev) => (prev >= 1800 ? 0 : prev + 4));
    }, 50);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const resetProject = useCallback(() => {
    setIsPlaying(false);
    setProject(null);
  }, []);

  return (
    <EditorContext.Provider
      value={{
        service: editorService,
        project,
        setProject,
        activeTab,
        setActiveTab,
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
        reloadAssets,
        resetProject,
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
