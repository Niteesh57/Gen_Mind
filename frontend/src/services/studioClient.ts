const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const apiError = async (res: Response, action: string): Promise<Error> => {
  if (res.status === 405 || res.status === 404) {
    return new Error(`The GenMind studio backend is not running at ${API_BASE_URL}. Start the backend server and try again.`);
  }
  const body = await res.text();
  return new Error(body || `Could not ${action}.`);
};

export interface StudioVoice { id: string; label: string; language: string }

export interface LearningMediaResult {
  brief: any;
  mode: 'video' | 'conversation';
  scenes?: any[];
  turns?: any[];
  images?: Array<{ index: number; title: string; url: string }>;
  voice_tracks?: Array<{ index: number; speaker: string; voice: string; narration: string; url: string }>;
  output_url: string | null;
  narration: string;
  stages: string[];
}

export interface LearningMediaPayload {
  project_id: string;
  topic: string;
  image_count: number; // 5 to 15
  image_style: string;
  language: string;
  output_mode: 'video' | 'conversation';
  voice: string;
  podcast_tone: 'friendly' | 'serious' | 'deep_dive';
  participant_count: number; // 1 to 4
  participant_voices: string[];
  source_urls: string[];
  source_assets: string[];
  source_context: string[];
}

export interface StudioSource {
  id: string;
  kind: 'url' | 'document';
  mode?: 'normal' | 'deep';
  name: string;
  headline?: string;
  overview?: string;
  source_url?: string;
  archive_url: string;
  excerpt: string;
  content: string;
  word_count?: number;
  deep_pages?: string[];
  status: 'ready' | 'error';
  error?: string;
}

export const getStudioVoices = async (): Promise<StudioVoice[]> => {
  const res = await fetch(`${API_BASE_URL}/studio/voices`);
  if (!res.ok) throw new Error('Could not load Microsoft voices.');
  return res.json();
};

export const generateLearningMedia = async (payload: LearningMediaPayload): Promise<LearningMediaResult> => {
  const res = await fetch(`${API_BASE_URL}/studio/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || 'Generation failed.');
  }
  return res.json();
};

export const inspectStudioSources = async (urls: string[], deepResearch: boolean = false): Promise<StudioSource[]> => {
  const res = await fetch(`${API_BASE_URL}/studio/sources/inspect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls, deep_research: deepResearch }),
  });
  if (!res.ok) throw await apiError(res, 'inspect source URLs');
  return res.json();
};

export const uploadStudioDocument = async (file: File): Promise<StudioSource> => {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE_URL}/studio/sources/upload`, { method: 'POST', body: form });
  if (!res.ok) throw await apiError(res, 'upload document');
  return res.json();
};
