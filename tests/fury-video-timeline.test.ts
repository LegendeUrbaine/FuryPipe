import { describe, expect, it } from 'vitest';

import { createFuryVideoTimelinePreview } from '../src/fury-video-timeline.js';

const project = {
  projectId: 'demo-project',
  title: 'A private title',
  assets: [
    { assetId: 'hero-image', kind: 'image', mimeType: 'image/png', digestSha256: 'a'.repeat(64) },
    { assetId: 'voice-track', kind: 'audio', mimeType: 'audio/wav' },
  ],
  scenes: [{
    sceneId: 'opening',
    title: 'A private scene title',
    shots: [
      {
        shotId: 'establishing', prompt: 'A private shot prompt', durationMs: 4_000,
        assetIds: ['hero-image'],
        audio: [{ assetId: 'voice-track', role: 'voice', offsetMs: 250, durationMs: 3_000 }],
        generation: {
          jobId: 'fpg_job_00000000-0000-4000-8000-000000000000',
          operation: 'image-to-video',
          outputArtifactIds: ['media_artifact'],
        },
      },
      {
        shotId: 'detail', prompt: 'A second private shot prompt', durationMs: 2_000,
        transition: { kind: 'crossfade', durationMs: 500 },
      },
    ],
  }],
} as const;

describe('FuryVideo storyboard/timeline foundation', () => {
  it('returns an immutable digest-only plan with explicit job/artifact reference authority', () => {
    const preview = createFuryVideoTimelinePreview(project);
    expect(preview).toMatchObject({
      format: 'furypipe-furyvideo-timeline/v1',
      authority: 'studio-preview-only',
      executionAuthorized: false,
      state: 'PREVIEW_ONLY_REQUIRES_RUNTIME_AUTHORITY',
      sceneCount: 1,
      shotCount: 2,
      contentDurationMs: 6_000,
      transitionDurationMs: 500,
      next: 'REGISTER_PROVIDER_ADAPTER_AND_EXPLICITLY_AUTHORIZE',
    });
    expect(preview.project.scenes[0]?.shots[0]).toMatchObject({
      shotId: 'establishing', durationMs: 4_000, assetIds: ['hero-image'],
      generation: {
        state: 'REFERENCE_ONLY', jobId: 'fpg_job_00000000-0000-4000-8000-000000000000',
        operation: 'image-to-video', outputArtifactIds: ['media_artifact'],
      },
    });
    expect(preview.project.scenes[0]?.shots[1]?.transition).toEqual({ kind: 'crossfade', durationMs: 500 });
    expect(preview.project.scenes[0]?.shots[0]?.promptDigestSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(JSON.stringify(preview)).not.toContain('private');
    expect(Object.isFrozen(preview)).toBe(true);
    expect(Object.isFrozen(preview.project)).toBe(true);
    expect(Object.isFrozen(preview.project.scenes[0]?.shots[0])).toBe(true);
  });

  it('rejects unresolved references, duplicate timeline identities and invalid transition authority', () => {
    expect(() => createFuryVideoTimelinePreview({
      ...project,
      scenes: [{ ...project.scenes[0]!, shots: [{ ...project.scenes[0]!.shots[0]!, assetIds: ['missing-asset'] }] }],
    })).toThrow(/unknown asset/u);
    expect(() => createFuryVideoTimelinePreview({
      ...project,
      scenes: [{ ...project.scenes[0]!, shots: [project.scenes[0]!.shots[0]!, { ...project.scenes[0]!.shots[1]!, shotId: 'establishing' }] }],
    })).toThrow(/shot IDs must be unique/u);
    expect(() => createFuryVideoTimelinePreview({
      ...project,
      scenes: [{ ...project.scenes[0]!, shots: [{ ...project.scenes[0]!.shots[0]!, transition: { kind: 'crossfade' } }] }],
    })).toThrow(/transition duration/u);
    expect(() => createFuryVideoTimelinePreview({
      ...project,
      scenes: [{ ...project.scenes[0]!, shots: [{ ...project.scenes[0]!.shots[0]!, generation: { jobId: 'fpg_job_00000000-0000-4000-8000-000000000000', operation: 'text-to-image' } }] }],
    })).toThrow(/operation is invalid/u);
  });
});
