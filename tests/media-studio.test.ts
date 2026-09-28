import { describe, expect, it } from 'vitest';

import { createFuryDeterministicMediaGenerationAdapter } from '../src/media-generation-deterministic-adapter.js';
import { createFuryMediaStudioGallery, createFuryMediaStudioPreview, createFuryMediaStudioSnapshot } from '../src/media-studio.js';
import type { FuryMediaGenerationJob } from '../src/media-generation-job-engine.js';

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

  it('keeps FuryVideo controls bounded and provider selection capability-driven', () => {
    const adapter = createFuryDeterministicMediaGenerationAdapter({
      bundleId: 'media-lab', bundleVersion: '1.0.0', profileId: 'video-text',
      family: 'video-generation', supportedModes: ['text-to-video'], outputMimeType: 'video/mp4',
    });
    const snapshot = createFuryMediaStudioSnapshot({ adapters: [adapter], now: () => 7 });
    const selectorId = snapshot.adapters[0]!.selectorId;
    const preview = createFuryMediaStudioPreview({
      surface: 'video', operation: 'text-to-video', prompt: 'A bounded video prompt', outputMimeType: 'video/mp4', adapters: [adapter],
      options: {
        provider: selectorId, model: 'video-text', reference: 'artifact_reference', durationMs: 4_000,
        fps: 24, aspectRatio: '16:9', resolution: '1080p',
      },
    });
    expect(preview).toMatchObject({ provider: selectorId, model: 'video-text' });
    expect(preview.controlsDigestSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(preview).not.toHaveProperty('reference');
    expect(preview).not.toHaveProperty('prompt');
    expect(() => createFuryMediaStudioPreview({
      surface: 'video', operation: 'text-to-video', prompt: 'x', outputMimeType: 'video/mp4', adapters: [adapter],
      options: { provider: selectorId, model: 'video-text', durationMs: 400 },
    })).toThrow(/duration/u);
    expect(() => createFuryMediaStudioPreview({
      surface: 'video', operation: 'text-to-video', prompt: 'x', outputMimeType: 'video/mp4', adapters: [adapter],
      options: { provider: selectorId, model: 'image-text' },
    })).toThrow(/model is not supported by the selected provider/u);
  });

  it('keeps FuryAudio and voice controls bounded without authorizing capture or playback', () => {
    const adapter = createFuryDeterministicMediaGenerationAdapter({
      bundleId: 'media-lab', bundleVersion: '1.0.0', profileId: 'audio-voice',
      family: 'audio-generation', supportedModes: ['text-to-audio', 'voice-generation'], outputMimeType: 'audio/wav',
    });
    const snapshot = createFuryMediaStudioSnapshot({ adapters: [adapter], now: () => 7 });
    const selectorId = snapshot.adapters[0]!.selectorId;
    const preview = createFuryMediaStudioPreview({
      surface: 'audio', operation: 'text-to-audio', prompt: 'A bounded audio prompt', outputMimeType: 'audio/wav', adapters: [adapter],
      options: { provider: selectorId, model: 'audio-voice', voice: 'alloy', language: 'fr-FR', durationMs: 4_000 },
    });
    expect(preview).toMatchObject({ provider: selectorId, model: 'audio-voice', executionAuthorized: false, requiresApproval: true });
    expect(preview.controlsDigestSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(preview).not.toHaveProperty('voice');
    expect(preview).not.toHaveProperty('language');
    expect(preview).not.toHaveProperty('prompt');
    expect(() => createFuryMediaStudioPreview({
      surface: 'audio', operation: 'text-to-audio', prompt: 'x', outputMimeType: 'audio/wav', adapters: [adapter],
      options: { durationMs: 400 },
    })).toThrow(/audio duration/u);
    expect(() => createFuryMediaStudioPreview({
      surface: 'audio', operation: 'text-to-audio', prompt: 'x', outputMimeType: 'audio/wav', adapters: [adapter],
      options: { language: 'fr FR' },
    })).toThrow(/audio language/u);
  });

  it('projects durable job history without inventing dimensions, seed or cost', () => {
    const digest = 'a'.repeat(64);
    const job: FuryMediaGenerationJob = {
      format: 'furypipe-media-generation-job/v1', jobId: 'fpg_job_00000000-0000-4000-8000-000000000000',
      family: 'image-generation', operation: 'text-to-image', kind: 'image', providerProfileId: 'image-text',
      bundleId: 'media-lab', bundleVersion: '1.0.0', outputMimeType: 'image/png', promptDigestSha256: digest,
      parametersDigestSha256: digest, inputDigestsSha256: [], inputKinds: [], inputMimeTypes: [], inputBytes: 0,
      promptBytes: 12, requestDigestSha256: digest, planDigestSha256: digest, idempotencyKeyDigestSha256: digest,
      maxOutputBytes: 1_000_000, maxItems: 1, createdAt: 100, updatedAt: 250, attempt: 1, revision: 2,
      status: 'SUCCEEDED', outputReferences: [{ artifactId: 'media_artifact', version: 1, storageHandle: `furypipe-recovery/v1/sha256/${digest}`, mediaSha256: digest, mimeType: 'image/png', byteLength: 24 }],
      receiptReferences: [],
    };
    const gallery = createFuryMediaStudioGallery([job]);
    expect(gallery).toMatchObject({ format: 'furypipe-media-studio-gallery/v1', authority: 'read-only-media-job-history', state: 'READY' });
    expect(gallery.jobs[0]).toMatchObject({ surface: 'image', provider: 'media-lab', model: 'image-text', status: 'SUCCEEDED', dimensions: 'UNKNOWN', seed: 'UNKNOWN', cost: 'UNKNOWN', latencyMs: 150 });
    expect(gallery.jobs[0]?.provenance.artifactIds).toEqual(['media_artifact']);
  });
});
