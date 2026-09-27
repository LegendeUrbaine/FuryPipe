import { describe, expect, it } from 'vitest';

import { createFuryDeterministicMediaGenerationAdapter } from '../src/media-generation-deterministic-adapter.js';
import { createFuryMediaStudioPreview, createFuryMediaStudioSnapshot } from '../src/media-studio.js';

describe('Media Studio preview boundary', () => {
  it('projects image, video and audio surfaces without execution authority', () => {
    const snapshot = createFuryMediaStudioSnapshot({ now: () => 42 });
    expect(snapshot).toMatchObject({
      format: 'furypipe-media-studio/v1',
      generatedAt: 42,
      authority: 'studio-preview-only',
      executionAuthorized: false,
      providerExecution: 'NOT_CONFIGURED',
    });
    expect(snapshot.surfaces.map((surface) => surface.id)).toEqual(['image', 'video', 'audio']);
    expect(snapshot.surfaces.every((surface) => surface.state === 'CORE_AVAILABLE_PROVIDER_OPTIONAL' && surface.executionAuthorized === false)).toBe(true);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('observes registered adapter capabilities without promoting them to live execution', () => {
    const adapter = createFuryDeterministicMediaGenerationAdapter({
      bundleId: 'media-lab', bundleVersion: '1.0.0', profileId: 'image-text',
      family: 'image-generation', supportedModes: ['text-to-image'], outputMimeType: 'image/png',
    });
    const snapshot = createFuryMediaStudioSnapshot({ adapters: [adapter], now: () => 7 });
    expect(snapshot.providerExecution).toBe('ADAPTER_REGISTERED_NOT_LIVE_VALIDATED');
    expect(snapshot.adapters).toEqual([expect.objectContaining({
      bundleId: 'media-lab', profileId: 'image-text', lifecycle: 'REGISTERED_CAPABILITY_ONLY', executionAuthorized: false,
      supportedModes: ['text-to-image'], supportedMimeTypes: ['image/png'],
    })]);
  });

  it('returns digest-only preview evidence and rejects unsupported operation or MIME', () => {
    const preview = createFuryMediaStudioPreview({
      surface: 'image', operation: 'text-to-image', prompt: 'A bounded preview', outputMimeType: 'image/png',
    });
    expect(preview).toMatchObject({
      format: 'furypipe-media-studio-preview/v1',
      state: 'PREVIEW_ONLY_REQUIRES_RUNTIME_AUTHORITY',
      requiresApproval: true,
      executionAuthorized: false,
      next: 'REGISTER_PROVIDER_ADAPTER_AND_EXPLICITLY_AUTHORIZE',
    });
    expect(preview.promptDigestSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(preview).not.toHaveProperty('prompt');
    expect(() => createFuryMediaStudioPreview({ surface: 'video', operation: 'text-to-image', prompt: 'x', outputMimeType: 'image/png' })).toThrow(/operation/u);
    expect(() => createFuryMediaStudioPreview({ surface: 'image', operation: 'text-to-image', prompt: 'x', outputMimeType: 'video/mp4' })).toThrow(/MIME/u);
  });

  it('keeps FuryImage controls bounded and provider selection capability-driven', () => {
    const adapter = createFuryDeterministicMediaGenerationAdapter({
      bundleId: 'media-lab', bundleVersion: '1.0.0', profileId: 'image-text',
      family: 'image-generation', supportedModes: ['text-to-image'], outputMimeType: 'image/png',
    });
    const snapshot = createFuryMediaStudioSnapshot({ adapters: [adapter], now: () => 7 });
    const selectorId = snapshot.adapters[0]!.selectorId;
    const preview = createFuryMediaStudioPreview({
      surface: 'image', operation: 'text-to-image', prompt: 'A bounded image prompt', outputMimeType: 'image/png', adapters: [adapter],
      options: {
        provider: selectorId, model: 'image-text', aspectRatio: '16:9', resolution: '1536x1024', quality: 'high',
        negativePrompt: 'blur', seed: 42, guidance: 7.5, steps: 24, style: 'cinematic', inputStrength: 0.4,
      },
    });
    expect(preview).toMatchObject({ provider: selectorId, model: 'image-text' });
    expect(preview.controlsDigestSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(preview).not.toHaveProperty('negativePrompt');
    expect(preview).not.toHaveProperty('prompt');
    expect(() => createFuryMediaStudioPreview({
      surface: 'image', operation: 'text-to-image', prompt: 'x', outputMimeType: 'image/png', adapters: [adapter],
      options: { provider: 'adapter_00000000000000000000000000000000', model: 'image-text' },
    })).toThrow(/provider/u);
    expect(() => createFuryMediaStudioPreview({
      surface: 'image', operation: 'text-to-image', prompt: 'x', outputMimeType: 'image/png',
      options: { aspectRatio: '2:1' },
    })).toThrow(/aspect ratio/u);
  });
});
