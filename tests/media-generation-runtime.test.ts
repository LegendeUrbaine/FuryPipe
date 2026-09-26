import { describe, expect, it } from 'vitest';

import { createFuryArtifactStore } from '../src/fury-artifacts.js';
import {
  FURY_MEDIA_GENERATION_APPROVAL_FORMAT,
  FuryMediaGenerationError,
  createFuryMediaGenerationAdapterRegistry,
  createFuryMediaGenerationCoordinator,
  isGeneratedFuryMediaGenerationPermit,
  isGeneratedFuryMediaGenerationPlan,
  isGeneratedFuryMediaGenerationRequest,
  isGeneratedFuryMediaGenerationResult,
  type FuryMediaGenerationAdapter,
  type FuryMediaGenerationApproval,
  type FuryMediaGenerationCoordinator,
  type FuryMediaGenerationKind,
  type FuryMediaGenerationMode,
  type FuryMediaGenerationRequest,
} from '../src/media-generation-runtime.js';
import {
  FURY_MEDIA_INGESTION_INPUT_FORMAT,
  FURY_MEDIA_INGESTION_SOURCE_FORMAT,
  createFuryMediaIngestionCoordinator,
  type FuryMediaIngestionHandle,
} from '../src/media-ingestion.js';
import {
  FURY_MEDIA_PLUGIN_BUNDLE_FORMAT,
  FURY_MEDIA_PLUGIN_PROFILE_FORMAT,
  validateFuryMediaPluginBundle,
  type FuryMediaPluginBundle,
} from '../src/media-plugin-contracts.js';

const NOW = 1_700_000_000_000;
function png(width = 2, height = 2): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  bytes.set([0, 0, 0, 13], 8);
  bytes.set(Buffer.from('IHDR'), 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function wav(dataBytes = 100, byteRate = 100): Uint8Array {
  const size = 44 + dataBytes;
  const bytes = new Uint8Array(size);
  bytes.set(Buffer.from('RIFF'), 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(4, size - 8, true);
  bytes.set(Buffer.from('WAVEfmt '), 8);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, byteRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  bytes.set(Buffer.from('data'), 36);
  view.setUint32(40, dataBytes, true);
  return bytes;
}

function box(type: string, payload: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(8 + payload.byteLength);
  new DataView(bytes.buffer).setUint32(0, bytes.byteLength);
  bytes.set(Buffer.from(type), 4);
  bytes.set(payload, 8);
  return bytes;
}

function mp4(durationMs = 500): Uint8Array {
  const ftyp = box('ftyp', Buffer.from('isom0000'));
  const mvhdBody = new Uint8Array(20);
  const view = new DataView(mvhdBody.buffer);
  view.setUint32(12, 1_000);
  view.setUint32(16, durationMs);
  const moov = box('moov', box('mvhd', mvhdBody));
  const bytes = new Uint8Array(ftyp.byteLength + moov.byteLength);
  bytes.set(ftyp);
  bytes.set(moov, ftyp.byteLength);
  return bytes;
}

function bundle(overrides: Partial<Parameters<typeof validateFuryMediaPluginBundle>[0]> = {}): FuryMediaPluginBundle {
  return validateFuryMediaPluginBundle({
    format: FURY_MEDIA_PLUGIN_BUNDLE_FORMAT,
    id: 'media-lab',
    version: '1.0.0',
    permissions: ['media-read', 'media-write'],
    source: {
      url: 'https://example.invalid/media-plugin',
      licenseStatus: 'NOT_APPLICABLE',
    },
    profiles: [
      {
        format: FURY_MEDIA_PLUGIN_PROFILE_FORMAT,
        id: 'image-text',
        family: 'image-generation',
        permissions: ['media-write'],
        supportedMediaTypes: ['image/png'],
        bounds: { maxInputBytes: 1_000_000, maxOutputBytes: 1_000_000, maxItems: 2, maxDurationMs: 60_000 },
        health: { status: 'healthy', observedAt: NOW, authority: 'health-observation-only', executionAuthority: false },
        secretRefs: [],
        lifecycle: 'registered',
        compatibility: ['test-runtime'],
      },
      {
        format: FURY_MEDIA_PLUGIN_PROFILE_FORMAT,
        id: 'image-edit',
        family: 'image-generation',
        permissions: ['media-read', 'media-write'],
        supportedMediaTypes: ['image/png'],
        bounds: { maxInputBytes: 1_000_000, maxOutputBytes: 1_000_000, maxItems: 2, maxDurationMs: 60_000 },
        health: { status: 'healthy', observedAt: NOW, authority: 'health-observation-only', executionAuthority: false },
        secretRefs: [],
        lifecycle: 'registered',
        compatibility: ['test-runtime'],
      },
      {
        format: FURY_MEDIA_PLUGIN_PROFILE_FORMAT,
        id: 'audio-text',
        family: 'audio-generation',
        permissions: ['media-write'],
        supportedMediaTypes: ['audio/wav'],
        bounds: { maxInputBytes: 1_000_000, maxOutputBytes: 1_000_000, maxItems: 2, maxDurationMs: 60_000 },
        health: { status: 'healthy', observedAt: NOW, authority: 'health-observation-only', executionAuthority: false },
        secretRefs: [],
        lifecycle: 'registered',
        compatibility: ['test-runtime'],
      },
      {
        format: FURY_MEDIA_PLUGIN_PROFILE_FORMAT,
        id: 'video-text',
        family: 'video-generation',
        permissions: ['media-write'],
        supportedMediaTypes: ['video/mp4'],
        bounds: { maxInputBytes: 1_000_000, maxOutputBytes: 1_000_000, maxItems: 2, maxDurationMs: 60_000 },
        health: { status: 'healthy', observedAt: NOW, authority: 'health-observation-only', executionAuthority: false },
        secretRefs: [],
        lifecycle: 'registered',
        compatibility: ['test-runtime'],
      },
      {
        format: FURY_MEDIA_PLUGIN_PROFILE_FORMAT,
        id: 'video-lipsync',
        family: 'video-generation',
        permissions: ['media-read', 'media-write'],
        supportedMediaTypes: ['video/mp4', 'audio/wav'],
        bounds: { maxInputBytes: 1_000_000, maxOutputBytes: 1_000_000, maxItems: 2, maxDurationMs: 60_000 },
        health: { status: 'healthy', observedAt: NOW, authority: 'health-observation-only', executionAuthority: false },
        secretRefs: [],
        lifecycle: 'registered',
        compatibility: ['test-runtime'],
      },
    ],
    ...overrides,
  });
}

interface Harness {
  readonly clock: { value: number };
  readonly media: ReturnType<typeof createFuryMediaIngestionCoordinator>;
  readonly artifacts: ReturnType<typeof createFuryArtifactStore>;
  readonly coordinator: FuryMediaGenerationCoordinator;
  readonly bundle: FuryMediaPluginBundle;
}

function harness(
  adapters: readonly FuryMediaGenerationAdapter[],
  options: { readonly healthAge?: number; readonly profileBundle?: FuryMediaPluginBundle } = {},
): Harness {
  const clock = { value: NOW };
  const media = createFuryMediaIngestionCoordinator();
  const artifacts = createFuryArtifactStore();
  const registry = createFuryMediaGenerationAdapterRegistry(adapters);
  const profileBundle = options.profileBundle ?? bundle();
  return {
    clock,
    media,
    artifacts,
    bundle: profileBundle,
    coordinator: createFuryMediaGenerationCoordinator({
      adapters: registry,
      mediaCoordinator: media,
      artifactStore: artifacts,
      projectId: 'test-project',
      now: () => clock.value,
      ...(options.healthAge === undefined ? {} : { maxHealthAgeMs: options.healthAge }),
    }),
  };
}

function adapter(
  profileId: string,
  family: 'image-generation' | 'audio-generation' | 'video-generation',
  supportedModes: readonly FuryMediaGenerationMode[],
  execute: FuryMediaGenerationAdapter['execute'],
): FuryMediaGenerationAdapter {
  return { bundleId: 'media-lab', bundleVersion: '1.0.0', profileId, family, supportedModes, execute };
}

function prepareAndAuthorize(
  h: Harness,
  input: {
    readonly profileId: string;
    readonly kind: FuryMediaGenerationKind;
    readonly mode: FuryMediaGenerationMode;
    readonly prompt?: string;
    readonly inputs?: readonly FuryMediaIngestionHandle[];
    readonly outputMimeType: string;
  },
) {
  const request = h.coordinator.prepare({
    bundle: h.bundle,
    profileId: input.profileId,
    mediaCoordinator: h.media,
    kind: input.kind,
    mode: input.mode,
    prompt: input.prompt ?? 'safe prompt',
    ...(input.inputs === undefined ? {} : { inputs: input.inputs }),
    outputMimeType: input.outputMimeType,
  });
  const plan = h.coordinator.plan(request);
  const approval: FuryMediaGenerationApproval = {
    format: FURY_MEDIA_GENERATION_APPROVAL_FORMAT,
    approvalId: 'approval-test-1',
    allowGeneration: true,
    requestDigestSha256: request.requestDigestSha256,
    planDigestSha256: plan.planDigestSha256,
    kind: request.kind,
    mode: request.mode,
    bundleId: request.bundleId,
    bundleVersion: request.bundleVersion,
    profileId: request.profileId,
    outputMimeType: request.outputMimeType,
    expiresInMs: 5_000,
    authority: 'media-generation-approval-decision',
    executionAuthority: false,
  };
  const permit = h.coordinator.authorize(request, plan, approval);
  return { request, plan, permit };
}

function expectCode(error: unknown, code: FuryMediaGenerationError['code']): void {
  expect(error).toBeInstanceOf(FuryMediaGenerationError);
  expect(error).toMatchObject({ code, retrySafe: false });
}

describe('FuryPipe governed media generation runtime', () => {
  it('executes image generation through approval, single-use permit, ingestion and Artifact', async () => {
    let providerBytes = png();
    const h = harness([
      adapter('image-text', 'image-generation', ['text-to-image'], async (input, context) => {
        expect(input.prompt).toBe('a bounded image prompt');
        expect(input.parameters).toEqual({ aspectRatio: '1:1', seed: 7 });
        expect(input.inputs).toHaveLength(0);
        expect(context.outputMimeType).toBe('image/png');
        return { outputs: [{ bytes: providerBytes, mimeType: 'image/png', providerRequestId: 'provider-secret-id' }] };
      }),
    ]);
    const prepared = h.coordinator.prepare({
      bundle: h.bundle,
      profileId: 'image-text',
      mediaCoordinator: h.media,
      kind: 'image',
      mode: 'text-to-image',
      prompt: 'a bounded image prompt',
      parameters: { seed: 7, aspectRatio: '1:1' },
      outputMimeType: 'image/png',
    });
    const plan = h.coordinator.plan(prepared);
    const permit = h.coordinator.authorize(prepared, plan, {
      format: FURY_MEDIA_GENERATION_APPROVAL_FORMAT,
      approvalId: 'approval-image',
      allowGeneration: true,
      requestDigestSha256: prepared.requestDigestSha256,
      planDigestSha256: plan.planDigestSha256,
      kind: 'image',
      mode: 'text-to-image',
      bundleId: 'media-lab',
      bundleVersion: '1.0.0',
      profileId: 'image-text',
      outputMimeType: 'image/png',
      expiresInMs: 5_000,
      authority: 'media-generation-approval-decision',
      executionAuthority: false,
    });
    expect(isGeneratedFuryMediaGenerationRequest(prepared)).toBe(true);
    expect(isGeneratedFuryMediaGenerationPlan(plan)).toBe(true);
    expect(isGeneratedFuryMediaGenerationPermit(permit)).toBe(true);
    expect(JSON.stringify(prepared)).not.toContain('a bounded image prompt');
    expect(JSON.stringify(prepared)).not.toContain('provider-secret-id');

    const result = await h.coordinator.execute(prepared, plan, permit);
    expect(isGeneratedFuryMediaGenerationResult(result)).toBe(true);
    expect(result.outputHandles).toHaveLength(1);
    expect(result.outputHandles[0]?.evidence).toMatchObject({
      kind: 'image',
      mimeType: 'image/png',
      sourceOrigin: 'provider-output',
      instructionAuthority: false,
      executionAuthority: false,
    });
    expect(result.artifactReferences[0]).toMatchObject({ kind: 'image', storage: 'base64', sourceMimeType: 'image/png', mediaType: 'application/vnd.furypipe.media-base64', byteLength: 24 });
    expect(result.receipt.providerRequestIdsSha256[0]).toMatch(/^[0-9a-f]{64}$/u);
    expect(JSON.stringify(result)).not.toContain('provider-secret-id');
    expect(result.provenance.profileSourceDigestSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(h.artifacts.list()).toHaveLength(1);
    expect(providerBytes.every((byte) => byte === 0)).toBe(true);
  });

  it('supports audio and video families with real media re-ingestion', async () => {
    const h = harness([
      adapter('audio-text', 'audio-generation', ['text-to-audio'], async () => ({ outputs: [{ bytes: wav(), mimeType: 'audio/wav' }] })),
      adapter('video-text', 'video-generation', ['text-to-video'], async () => ({ outputs: [{ bytes: mp4(), mimeType: 'video/mp4' }] })),
    ]);
    const audio = prepareAndAuthorize(h, { profileId: 'audio-text', kind: 'audio', mode: 'text-to-audio', outputMimeType: 'audio/wav' });
    const video = prepareAndAuthorize(h, { profileId: 'video-text', kind: 'video', mode: 'text-to-video', outputMimeType: 'video/mp4' });
    const audioResult = await h.coordinator.execute(audio.request, audio.plan, audio.permit);
    const videoResult = await h.coordinator.execute(video.request, video.plan, video.permit);
    expect(audioResult.outputHandles[0]?.evidence).toMatchObject({ kind: 'audio', mimeType: 'audio/wav', durationMs: 1_000 });
    expect(videoResult.outputHandles[0]?.evidence).toMatchObject({ kind: 'video', mimeType: 'video/mp4', durationMs: 500 });
    expect(audioResult.receipt.mode).toBe('text-to-audio');
    expect(videoResult.receipt.mode).toBe('text-to-video');
    expect(h.artifacts.list()).toHaveLength(2);
  });

  it('requires input media for input modes and enforces least-privilege profile permissions', () => {
    const h = harness([adapter('image-edit', 'image-generation', ['image-to-image'], async () => ({ outputs: [{ bytes: png(), mimeType: 'image/png' }] }))]);
    expect(() => h.coordinator.prepare({
      bundle: h.bundle,
      profileId: 'image-edit',
      mediaCoordinator: h.media,
      kind: 'image',
      mode: 'image-to-image',
      prompt: 'edit',
      outputMimeType: 'image/png',
    })).toThrowError(expect.objectContaining({ code: 'media-input-invalid' }));

    expect(() => h.coordinator.prepare({
      bundle: h.bundle,
      profileId: 'image-edit',
      mediaCoordinator: h.media,
      kind: 'image',
      mode: 'text-to-image',
      prompt: 'text only',
      outputMimeType: 'image/png',
    })).toThrowError(expect.objectContaining({ code: 'profile-not-eligible' }));
  });

  it('binds image-to-image and lip-sync inputs to current process-local evidence', async () => {
    let seenKinds: readonly string[] = [];
    const h = harness([
      adapter('image-edit', 'image-generation', ['image-to-image'], async (input) => {
        seenKinds = input.inputs.map((item) => item.kind);
        return { outputs: [{ bytes: png(), mimeType: 'image/png' }] };
      }),
      adapter('video-lipsync', 'video-generation', ['lip-sync'], async (input) => {
        seenKinds = input.inputs.map((item) => item.kind);
        return { outputs: [{ bytes: mp4(), mimeType: 'video/mp4' }] };
      }),
    ]);
    const imageHandle = h.media.ingestBatch([{
      format: FURY_MEDIA_INGESTION_INPUT_FORMAT,
      itemId: 'source-image',
      kind: 'image',
      mimeType: 'image/png',
      bytes: png(),
      source: { format: FURY_MEDIA_INGESTION_SOURCE_FORMAT, origin: 'user-upload' },
    }]).handles[0]!;
    const image = prepareAndAuthorize(h, { profileId: 'image-edit', kind: 'image', mode: 'image-to-image', inputs: [imageHandle], outputMimeType: 'image/png' });
    await h.coordinator.execute(image.request, image.plan, image.permit);
    expect(seenKinds).toEqual(['image']);

    const videoHandle = h.media.ingestBatch([{
      format: FURY_MEDIA_INGESTION_INPUT_FORMAT,
      itemId: 'source-video',
      kind: 'video',
      mimeType: 'video/mp4',
      bytes: mp4(),
      source: { format: FURY_MEDIA_INGESTION_SOURCE_FORMAT, origin: 'user-upload' },
    }]).handles[0]!;
    const audioHandle = h.media.ingestBatch([{
      format: FURY_MEDIA_INGESTION_INPUT_FORMAT,
      itemId: 'source-audio',
      kind: 'audio',
      mimeType: 'audio/wav',
      bytes: wav(),
      source: { format: FURY_MEDIA_INGESTION_SOURCE_FORMAT, origin: 'user-upload' },
    }]).handles[0]!;
    const lipsync = prepareAndAuthorize(h, { profileId: 'video-lipsync', kind: 'video', mode: 'lip-sync', inputs: [videoHandle, audioHandle], outputMimeType: 'video/mp4' });
    await h.coordinator.execute(lipsync.request, lipsync.plan, lipsync.permit);
    expect(seenKinds).toEqual(['video', 'audio']);
  });

  it('rejects copied request, plan and permit objects at process-local authority boundaries', async () => {
    const h = harness([adapter('image-text', 'image-generation', ['text-to-image'], async () => ({ outputs: [{ bytes: png(), mimeType: 'image/png' }] }))]);
    const prepared = prepareAndAuthorize(h, { profileId: 'image-text', kind: 'image', mode: 'text-to-image', outputMimeType: 'image/png' });
    const copiedRequest = { ...prepared.request } as FuryMediaGenerationRequest;
    const copiedPlan = { ...prepared.plan };
    const copiedPermit = { ...prepared.permit };
    expect(isGeneratedFuryMediaGenerationRequest(copiedRequest)).toBe(false);
    expect(isGeneratedFuryMediaGenerationPlan(copiedPlan)).toBe(false);
    expect(isGeneratedFuryMediaGenerationPermit(copiedPermit)).toBe(false);
    expect(() => h.coordinator.plan(copiedRequest)).toThrowError(expect.objectContaining({ code: 'execution-not-authorized' }));
    expect(() => h.coordinator.authorize(prepared.request, copiedPlan as typeof prepared.plan, {
      format: FURY_MEDIA_GENERATION_APPROVAL_FORMAT,
      approvalId: 'approval-copy',
      allowGeneration: true,
      requestDigestSha256: prepared.request.requestDigestSha256,
      planDigestSha256: prepared.plan.planDigestSha256,
      kind: 'image',
      mode: 'text-to-image',
      bundleId: 'media-lab',
      bundleVersion: '1.0.0',
      profileId: 'image-text',
      outputMimeType: 'image/png',
      expiresInMs: 5_000,
      authority: 'media-generation-approval-decision',
      executionAuthority: false,
    })).toThrowError(expect.objectContaining({ code: 'plan-request-mismatch' }));
    await expect(h.coordinator.execute(prepared.request, prepared.plan, copiedPermit as typeof prepared.permit)).rejects.toMatchObject({ code: 'execution-not-authorized' });
  });

  it('does not consume a permit before a missing adapter or released input is detected', async () => {
    const missing = harness([]);
    const prepared = prepareAndAuthorize(missing, { profileId: 'image-text', kind: 'image', mode: 'text-to-image', outputMimeType: 'image/png' });
    await expect(missing.coordinator.execute(prepared.request, prepared.plan, prepared.permit)).rejects.toMatchObject({ code: 'adapter-not-registered', outcome: 'not-started' });
    await expect(missing.coordinator.execute(prepared.request, prepared.plan, prepared.permit)).rejects.toMatchObject({ code: 'adapter-not-registered', outcome: 'not-started' });

    const calls = { value: 0 };
    const h = harness([adapter('image-edit', 'image-generation', ['image-to-image'], async () => {
      calls.value += 1;
      return { outputs: [{ bytes: png(), mimeType: 'image/png' }] };
    })]);
    const handle = h.media.ingestBatch([{
      format: FURY_MEDIA_INGESTION_INPUT_FORMAT,
      itemId: 'release-before-dispatch',
      kind: 'image',
      mimeType: 'image/png',
      bytes: png(),
      source: { format: FURY_MEDIA_INGESTION_SOURCE_FORMAT, origin: 'user-upload' },
    }]).handles[0]!;
    const edit = prepareAndAuthorize(h, { profileId: 'image-edit', kind: 'image', mode: 'image-to-image', inputs: [handle], outputMimeType: 'image/png' });
    h.media.release(handle);
    await expect(h.coordinator.execute(edit.request, edit.plan, edit.permit)).rejects.toMatchObject({ code: 'media-input-invalid', outcome: 'not-started' });
    expect(calls.value).toBe(0);
  });

  it('enforces stale health, expiry and single-use replay fail-closed', async () => {
    const h = harness([adapter('image-text', 'image-generation', ['text-to-image'], async () => ({ outputs: [{ bytes: png(), mimeType: 'image/png' }] }))], { healthAge: 1_000 });
    h.clock.value = NOW + 2_000;
    const stale = (() => {
      const request = h.coordinator.prepare({ bundle: h.bundle, profileId: 'image-text', mediaCoordinator: h.media, kind: 'image', mode: 'text-to-image', prompt: 'stale', outputMimeType: 'image/png' });
      const plan = h.coordinator.plan(request);
      return { request, plan };
    })();
    expect(() => h.coordinator.authorize(stale.request, stale.plan, {
      format: FURY_MEDIA_GENERATION_APPROVAL_FORMAT,
      approvalId: 'approval-stale',
      allowGeneration: true,
      requestDigestSha256: stale.request.requestDigestSha256,
      planDigestSha256: stale.plan.planDigestSha256,
      kind: 'image', mode: 'text-to-image', bundleId: 'media-lab', bundleVersion: '1.0.0', profileId: 'image-text', outputMimeType: 'image/png', expiresInMs: 1_000, authority: 'media-generation-approval-decision', executionAuthority: false,
    })).toThrowError(expect.objectContaining({ code: 'profile-health-not-fresh' }));

    h.clock.value = NOW;
    const prepared = prepareAndAuthorize(h, { profileId: 'image-text', kind: 'image', mode: 'text-to-image', outputMimeType: 'image/png' });
    h.clock.value = NOW + 6_000;
    await expect(h.coordinator.execute(prepared.request, prepared.plan, prepared.permit)).rejects.toMatchObject({ code: 'permit-expired', outcome: 'not-started' });

    h.clock.value = NOW;
    const replay = prepareAndAuthorize(h, { profileId: 'image-text', kind: 'image', mode: 'text-to-image', outputMimeType: 'image/png' });
    await h.coordinator.execute(replay.request, replay.plan, replay.permit);
    await expect(h.coordinator.execute(replay.request, replay.plan, replay.permit)).rejects.toMatchObject({ code: 'permit-already-consumed', outcome: 'not-started' });
  });

  it('classifies adapter crash as unknown and clears adapter-owned input bytes', async () => {
    let received: Uint8Array | undefined;
    const h = harness([adapter('image-edit', 'image-generation', ['image-to-image'], async (input) => {
      received = input.inputs[0]?.bytes;
      throw new Error('provider transport failed');
    })]);
    const source = h.media.ingestBatch([{
      format: FURY_MEDIA_INGESTION_INPUT_FORMAT,
      itemId: 'adapter-input',
      kind: 'image', mimeType: 'image/png', bytes: png(),
      source: { format: FURY_MEDIA_INGESTION_SOURCE_FORMAT, origin: 'user-upload' },
    }]).handles[0]!;
    const prepared = prepareAndAuthorize(h, { profileId: 'image-edit', kind: 'image', mode: 'image-to-image', inputs: [source], outputMimeType: 'image/png' });
    await expect(h.coordinator.execute(prepared.request, prepared.plan, prepared.permit)).rejects.toMatchObject({ code: 'adapter-error', adapterInvoked: true, outcome: 'unknown', retrySafe: false });
    expect(received?.every((byte) => byte === 0)).toBe(true);
  });

  it('rejects adapter MIME drift, output overflow and schema drift after dispatch', async () => {
    const badMime = harness([adapter('image-text', 'image-generation', ['text-to-image'], async () => ({ outputs: [{ bytes: png(), mimeType: 'image/png', providerRequestId: 'p' }, { bytes: png(), mimeType: 'image/jpeg' }] }))]);
    const preparedMime = prepareAndAuthorize(badMime, { profileId: 'image-text', kind: 'image', mode: 'text-to-image', outputMimeType: 'image/png' });
    await expect(badMime.coordinator.execute(preparedMime.request, preparedMime.plan, preparedMime.permit)).rejects.toMatchObject({ code: 'media-type-not-supported', adapterInvoked: true, outcome: 'unknown' });

    const overflow = harness([adapter('image-text', 'image-generation', ['text-to-image'], async () => ({ outputs: [{ bytes: new Uint8Array(1_000_001), mimeType: 'image/png' }] }))]);
    const preparedOverflow = prepareAndAuthorize(overflow, { profileId: 'image-text', kind: 'image', mode: 'text-to-image', outputMimeType: 'image/png' });
    await expect(overflow.coordinator.execute(preparedOverflow.request, preparedOverflow.plan, preparedOverflow.permit)).rejects.toMatchObject({ code: 'output-limit', adapterInvoked: true, outcome: 'unknown' });

    const schema = harness([adapter('image-text', 'image-generation', ['text-to-image'], async () => ({ outputs: [{ bytes: png(), mimeType: 'image/png' }], trusted: true } as unknown as { outputs: readonly { bytes: Uint8Array; mimeType: string }[] }))]);
    const preparedSchema = prepareAndAuthorize(schema, { profileId: 'image-text', kind: 'image', mode: 'text-to-image', outputMimeType: 'image/png' });
    await expect(schema.coordinator.execute(preparedSchema.request, preparedSchema.plan, preparedSchema.permit)).rejects.toMatchObject({ code: 'adapter-result-invalid', adapterInvoked: true, outcome: 'unknown' });
  });

  it('rejects approval drift and adapter mode drift before provider dispatch', () => {
    const h = harness([adapter('image-text', 'image-generation', ['text-to-image'], async () => ({ outputs: [{ bytes: png(), mimeType: 'image/png' }] }))]);
    const request = h.coordinator.prepare({ bundle: h.bundle, profileId: 'image-text', mediaCoordinator: h.media, kind: 'image', mode: 'text-to-image', prompt: 'approval', outputMimeType: 'image/png' });
    const plan = h.coordinator.plan(request);
    expect(() => h.coordinator.authorize(request, plan, {
      format: FURY_MEDIA_GENERATION_APPROVAL_FORMAT,
      approvalId: 'approval-wrong', allowGeneration: true,
      requestDigestSha256: 'b'.repeat(64), planDigestSha256: plan.planDigestSha256,
      kind: 'image', mode: 'text-to-image', bundleId: 'media-lab', bundleVersion: '1.0.0', profileId: 'image-text', outputMimeType: 'image/png', expiresInMs: 1_000, authority: 'media-generation-approval-decision', executionAuthority: false,
    })).toThrowError(expect.objectContaining({ code: 'approval-not-authorized' }));
  });
});
