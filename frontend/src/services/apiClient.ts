import { type MediaAsset, type ProjectMetadata } from './editorService';
import { getDeviceIdentity } from './deviceIdentity';

const API_BASE_URL = 'http://localhost:8000/api';

const getHeaders = (isJson = true): Record<string, string> => {
  const { deviceId, deviceName } = getDeviceIdentity();
  const headers: Record<string, string> = {
    'X-Device-Id': deviceId,
    'X-Device-Name': deviceName,
  };
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
};

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
    headers: getHeaders(true),
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
    headers: getHeaders(false),
    body: formData,
  });
  if (!res.ok) {
    throw new Error(`Upload to B2 failed: ${res.statusText}`);
  }
  const data = await res.json();
  return data.asset;
};

export const listMediaBackend = async (projectId: string): Promise<MediaAsset[]> => {
  const res = await fetch(`${API_BASE_URL}/media/${projectId}`, {
    headers: getHeaders(false),
  });
  if (!res.ok) {
    throw new Error(`Failed to list project media: ${res.statusText}`);
  }
  return res.json();
};

export const verifyManifestBackend = async (manifestHash: string): Promise<{ verified: boolean; manifest?: ManifestData }> => {
  const res = await fetch(`${API_BASE_URL}/media/verify/${manifestHash}`, {
    headers: getHeaders(false),
  });
  if (!res.ok) {
    throw new Error(`Verification request failed: ${res.statusText}`);
  }
  return res.json();
};

export const getDeviceProjectsBackend = async (): Promise<Array<{ project: ProjectMetadata; assets: MediaAsset[] }>> => {
  const { deviceId } = getDeviceIdentity();
  try {
    const res = await fetch(`${API_BASE_URL}/device/projects?device_id=${deviceId}`, {
      headers: getHeaders(false),
    });
    if (!res.ok) {
      return [];
    }
    return await res.json();
  } catch {
    return [];
  }
};

export const saveDeviceProjectBackend = async (project: ProjectMetadata, assets: MediaAsset[]): Promise<void> => {
  try {
    await fetch(`${API_BASE_URL}/device/projects`, {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify({ device_id: getDeviceIdentity().deviceId, device_name: getDeviceIdentity().deviceName, project, assets }),
    });
  } catch (err) {
    console.warn('Could not sync device project to backend:', err);
  }
};

export interface ProjectEvent {
  id: number;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export const getProjectEventsBackend = async (projectId: string): Promise<ProjectEvent[]> => {
  try {
    const res = await fetch(`${API_BASE_URL}/project/${projectId}/events`, {
      headers: getHeaders(false),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
};

export const logProjectEventBackend = async (projectId: string, eventType: string, payload: Record<string, unknown>): Promise<void> => {
  try {
    await fetch(`${API_BASE_URL}/project/${projectId}/events`, {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify({ event_type: eventType, payload }),
    });
  } catch {
    // silent failure for history log
  }
};
