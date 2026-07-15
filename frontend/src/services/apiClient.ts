import { type MediaAsset } from './editorService';

const API_BASE_URL = 'http://localhost:8000/api';

export interface GenerateMediaPayload {
  project_id: string;
  prompt: string;
  modality: 'video' | 'image' | 'audio' | 'text_to_speech' | 'upscale';
  model_name: string;
  chain?: boolean;
  parent_url?: string;
}

export interface ManifestData {
  run_id: string;
  project_id: string;
  provider: string;
  model: string;
  prompt: string;
  modality: string;
  timestamp: string;
  parent_run_id: string;
  asset_url: string;
  b2_stored_url?: string;
  sha256: string;
  steps_executed: Array<{
    step_index: number;
    modality: string;
    provider: string;
    model: string;
    action: string;
    asset_url: string;
    sha256: string;
    status: string;
  }>;
  storage_sink: string;
  verified: boolean;
}

export interface GenerateResponse {
  run_id: string;
  project_id: string;
  asset_record: MediaAsset & { sha256?: string; manifest_url?: string; run_id?: string; verified?: boolean };
  manifest: ManifestData;
  steps_executed: ManifestData['steps_executed'];
}

export const generateMediaBackend = async (payload: GenerateMediaPayload): Promise<GenerateResponse> => {
  const res = await fetch(`${API_BASE_URL}/media/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Generation failed: ${res.statusText}`);
  }
  return res.json();
};

export const uploadMediaBackend = async (file: File, projectId: string): Promise<MediaAsset & { sha256?: string }> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('project_id', projectId);

  const res = await fetch(`${API_BASE_URL}/media/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    throw new Error(`Upload to B2 failed: ${res.statusText}`);
  }
  const data = await res.json();
  return data.asset;
};

export const listMediaBackend = async (projectId: string): Promise<MediaAsset[]> => {
  const res = await fetch(`${API_BASE_URL}/media/${projectId}`);
  if (!res.ok) {
    throw new Error(`Failed to list project media: ${res.statusText}`);
  }
  return res.json();
};

export const verifyManifestBackend = async (manifestHash: string): Promise<{ verified: boolean; manifest?: ManifestData }> => {
  const res = await fetch(`${API_BASE_URL}/media/verify/${manifestHash}`);
  if (!res.ok) {
    throw new Error(`Verification request failed: ${res.statusText}`);
  }
  return res.json();
};
