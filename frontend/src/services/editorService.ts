import { listMediaBackend } from './apiClient';

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
  type: 'video' | 'image' | 'audio' | 'text';
  duration: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
  url?: string;
  isUsed?: boolean;
  sha256?: string;
  verified?: boolean;
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
  transition?: { type: string; duration: string };
  effect?: string;
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'text' | 'image' | 'layer';
  lockedType?: 'video' | 'audio' | 'image' | null;
  isMuted?: boolean;
  isLocked?: boolean;
  clips: TimelineClip[];
}

export interface IEditorService {
  createProject(name: string, resolution: string): Promise<ProjectMetadata>;
  getMediaAssets(filter?: 'all' | 'video' | 'image' | 'audio'): Promise<MediaAsset[]>;
  getTimelineTracks(): Promise<TimelineTrack[]>;
}

export class RealBackendEditorService implements IEditorService {
  private projectId: string = 'default_project';

  async createProject(name: string, resolution: string): Promise<ProjectMetadata> {
    const cleanName = name.trim() || 'Untitled Campaign';
    this.projectId = `proj_${Date.now()}_${cleanName.replace(/\s+/g, '_').toLowerCase()}`;
    return {
      id: this.projectId,
      name: cleanName,
      resolution: resolution || '1080p (1920x1080)',
      aspectRatio: resolution.includes('Vertical') ? '9:16' : '16:9',
      fps: 24,
      createdAt: new Date().toISOString(),
    };
  }

  async getMediaAssets(filter: 'all' | 'video' | 'image' | 'audio' = 'all'): Promise<MediaAsset[]> {
    try {
      const assets = await listMediaBackend(this.projectId);
      if (filter && filter !== 'all') {
        return assets.filter((a) => a.type === filter);
      }
      return assets;
    } catch {
      return [];
    }
  }

  async getTimelineTracks(): Promise<TimelineTrack[]> {
    return [
      {
        id: 'layer_1',
        name: 'Layer 1',
        type: 'layer',
        lockedType: null,
        clips: [],
      },
      {
        id: 'layer_2',
        name: 'Layer 2',
        type: 'layer',
        lockedType: null,
        clips: [],
      },
    ];
  }
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
        id: 'asset_vid_1',
        name: 'Cyberpunk Drone Tracking City',
        type: 'video',
        duration: '00:12',
        durationSeconds: 12,
        thumbnailUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
        isUsed: true,
        sha256: 'a9b2c3d4e5f67890123456789abcdef0',
        verified: true,
      },
      {
        id: 'asset_vid_2',
        name: 'Futuristic Portrait Neon Glow',
        type: 'video',
        duration: '00:05',
        durationSeconds: 5,
        thumbnailUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
      },
      {
        id: 'asset_vid_3',
        name: 'Mountain Sunrise Atmospheric',
        type: 'video',
        duration: '00:24',
        durationSeconds: 24,
        thumbnailUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&auto=format&fit=crop&q=80',
      },
      {
        id: 'asset_aud_1',
        name: 'Synthesizer Cyber Bassline Track',
        type: 'audio',
        duration: '01:30',
        durationSeconds: 90,
      },
      {
        id: 'asset_aud_2',
        name: 'Cinematic Percussion & Riser Boom',
        type: 'audio',
        duration: '00:18',
        durationSeconds: 18,
      },
      {
        id: 'asset_img_1',
        name: 'Product Render 3D Floating Studio',
        type: 'image',
        duration: '00:05',
        durationSeconds: 5,
        thumbnailUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
      },
    ];

    if (filter && filter !== 'all') {
      return assets.filter((a) => a.type === filter);
    }
    return assets;
  }

  async getTimelineTracks(): Promise<TimelineTrack[]> {
    return [
      {
        id: 'default_video_2',
        name: 'Video 2',
        type: 'video',
        clips: [
          {
            id: 'clip_init_title',
            title: 'GLITCH CYBER TITLE',
            type: 'text',
            startOffsetPx: 100,
            widthPx: 180,
            subTitle: 'Neon Cyber Presentation',
          },
        ],
      },
      {
        id: 'default_video',
        name: 'Video 1',
        type: 'video',
        clips: [
          {
            id: 'clip_init_1',
            title: 'Cyberpunk Drone Tracking City',
            type: 'video',
            startOffsetPx: 60,
            widthPx: 240,
            thumbnailUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
          },
          {
            id: 'clip_init_2',
            title: 'Mountain Sunrise Atmospheric',
            type: 'video',
            startOffsetPx: 320,
            widthPx: 300,
            thumbnailUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&auto=format&fit=crop&q=80',
          },
        ],
      },
      {
        id: 'default_audio',
        name: 'Audio 1',
        type: 'audio',
        clips: [
          {
            id: 'clip_init_aud_1',
            title: 'Synthesizer Cyber Bassline Track',
            type: 'audio',
            startOffsetPx: 40,
            widthPx: 480,
          },
        ],
      },
      {
        id: 'default_audio_2',
        name: 'Audio 2',
        type: 'audio',
        clips: [],
      },
    ];
  }
}
