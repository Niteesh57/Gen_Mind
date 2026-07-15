export interface ProjectMetadata {
  id: string;
  name: string;
  resolution: string;
  aspectRatio: string;
  fps: number;
  createdAt: string;
}

export interface MediaAsset {
  id: string;
  name: string;
  type: 'video' | 'image' | 'audio';
  duration: string;
  durationSeconds: number;
  thumbnailUrl: string;
  isUsed: boolean;
}

export interface TimelineClip {
  id: string;
  title: string;
  type: 'video' | 'audio' | 'text';
  startOffsetPx: number;
  widthPx: number;
  subTitle?: string;
  thumbnailUrl?: string;
  isSelected?: boolean;
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'text';
  isMuted?: boolean;
  isLocked?: boolean;
  clips: TimelineClip[];
}

export interface IEditorService {
  createProject(name: string, resolution: string): Promise<ProjectMetadata>;
  getMediaAssets(filter?: 'all' | 'video' | 'image' | 'audio'): Promise<MediaAsset[]>;
  getTimelineTracks(): Promise<TimelineTrack[]>;
}

export class MockEditorService implements IEditorService {
  async createProject(name: string, resolution: string): Promise<ProjectMetadata> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return {
      id: `proj_${Date.now()}`,
      name: name.trim() || 'Untitled Campaign',
      resolution: resolution || '1080p (1920x1080)',
      aspectRatio: resolution.includes('Vertical') ? '9:16' : '16:9',
      fps: 24,
      createdAt: new Date().toISOString(),
    };
  }

  async getMediaAssets(filter: 'all' | 'video' | 'image' | 'audio' = 'all'): Promise<MediaAsset[]> {
    const assets: MediaAsset[] = [
      {
        id: 'media_1',
        name: 'Cityscape_Main.mp4',
        type: 'video',
        duration: '00:12',
        durationSeconds: 12,
        thumbnailUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
        isUsed: true,
      },
      {
        id: 'media_2',
        name: 'Model_close.mp4',
        type: 'video',
        duration: '00:05',
        durationSeconds: 5,
        thumbnailUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
        isUsed: false,
      },
      {
        id: 'media_3',
        name: 'ambient_drone.wav',
        type: 'audio',
        duration: '02:14',
        durationSeconds: 134,
        thumbnailUrl: '',
        isUsed: true,
      },
      {
        id: 'media_4',
        name: 'Mountain_mist.mp4',
        type: 'video',
        duration: '00:24',
        durationSeconds: 24,
        thumbnailUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80',
        isUsed: false,
      },
    ];

    if (filter === 'all') return assets;
    return assets.filter((asset) => asset.type === filter);
  }

  async getTimelineTracks(): Promise<TimelineTrack[]> {
    return [
      {
        id: 'track_v2',
        name: 'Video 2',
        type: 'text',
        clips: [
          {
            id: 'clip_text_1',
            title: 'Main Title',
            type: 'text',
            startOffsetPx: 300,
            widthPx: 150,
            subTitle: 'NEO TOKYO',
          },
        ],
      },
      {
        id: 'track_v1',
        name: 'Video 1',
        type: 'video',
        clips: [
          {
            id: 'clip_v_1',
            title: 'Intro_shot.mp4',
            type: 'video',
            startOffsetPx: 0,
            widthPx: 120,
            thumbnailUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
          },
          {
            id: 'clip_v_2',
            title: 'Cityscape_Main.mp4',
            type: 'video',
            startOffsetPx: 120,
            widthPx: 280,
            thumbnailUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
            isSelected: true,
          },
          {
            id: 'clip_v_3',
            title: 'Model_close.mp4',
            type: 'video',
            startOffsetPx: 400,
            widthPx: 180,
            thumbnailUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
          },
        ],
      },
      {
        id: 'track_a1',
        name: 'Audio 1 (Voice)',
        type: 'audio',
        clips: [
          {
            id: 'clip_a_1',
            title: 'Cityscape_Main.wav',
            type: 'audio',
            startOffsetPx: 120,
            widthPx: 280,
          },
        ],
      },
      {
        id: 'track_a2',
        name: 'Audio 2 (Music)',
        type: 'audio',
        clips: [
          {
            id: 'clip_a_2',
            title: 'ambient_drone_full.wav',
            type: 'audio',
            startOffsetPx: 0,
            widthPx: 800,
          },
        ],
      },
    ];
  }
}
