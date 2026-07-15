import { describe, it, expect } from 'vitest';
import { MockEditorService, type IEditorService } from './editorService';

describe('MockEditorService (LSP & DIP Verification)', () => {
  it('should implement IEditorService and dynamically create a project without hardcoded names', async () => {
    const service: IEditorService = new MockEditorService();
    const customName = 'Custom Summer Campaign 2026';
    const customRes = '4K UHD (3840x2160)';

    const project = await service.createProject(customName, customRes);

    expect(project).toBeDefined();
    expect(project.name).toBe(customName);
    expect(project.resolution).toBe(customRes);
    expect(project.aspectRatio).toBe('16:9');
    expect(project.fps).toBe(24);
  });

  it('should fallback to default name if empty string passed', async () => {
    const service: IEditorService = new MockEditorService();
    const project = await service.createProject('   ', '');

    expect(project.name).toBe('Untitled Campaign');
    expect(project.resolution).toBe('1080p (1920x1080)');
  });

  it('should return media assets filtered by type', async () => {
    const service: IEditorService = new MockEditorService();
    const allAssets = await service.getMediaAssets('all');
    const videoAssets = await service.getMediaAssets('video');
    const audioAssets = await service.getMediaAssets('audio');

    expect(allAssets.length).toBeGreaterThan(0);
    expect(videoAssets.every((a) => a.type === 'video')).toBe(true);
    expect(audioAssets.every((a) => a.type === 'audio')).toBe(true);
  });

  it('should return multi-track timeline tracks with clips', async () => {
    const service: IEditorService = new MockEditorService();
    const tracks = await service.getTimelineTracks();

    expect(tracks.length).toBe(4);
    expect(tracks[0].name).toBe('Video 2');
    expect(tracks[1].clips.length).toBeGreaterThanOrEqual(2);
  });
});
