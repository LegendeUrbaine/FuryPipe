import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createFuryArtifactStore } from '../src/fury-artifacts.js';
import { createRecoveryStore } from '../src/core/recovery-store.js';
import {
  FURY_MEDIA_GENERATION_APPROVAL_FORMAT,
  createFuryMediaGenerationAdapterRegistry,
  createFuryMediaGenerationCoordinator,
  createFuryMediaGenerationExecutionSession,
  type FuryMediaGenerationApproval,
  type FuryMediaGenerationExecutionSession,
} from '../src/media-generation-runtime.js';
import { createFuryDeterministicMediaGenerationAdapter, type FuryDeterministicMediaGenerationAdapterOptions, type FuryDeterministicMediaProviderState } from '../src/media-generation-deterministic-adapter.js';
import { createFuryMediaGenerationJobEngine, type FuryMediaGenerationJobEngine } from '../src/media-generation-job-engine.js';
import { createFuryMediaIngestionCoordinator } from '../src/media-ingestion.js';
import { describe, expect, it } from 'vitest';
import {
  FURY_MEDIA_PLUGIN_BUNDLE_FORMAT,
  FURY_MEDIA_PLUGIN_PROFILE_FORMAT,
  validateFuryMediaPluginBundle,
  type FuryMediaPluginBundle,
} from '../src/media-plugin-contracts.js';

const NOW = 1_700_000_000_000;

function png(): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  bytes.set([0, 0, 0, 13], 8);
  bytes.set(Buffer.from('IHDR'), 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 2);
  view.setUint32(20, 2);
  return bytes;
}

function bundle(): FuryMediaPluginBundle {
  return validateFuryMediaPluginBundle({
    format: FURY_MEDIA_PLUGIN_BUNDLE_FORMAT,
    id: 'media-lab',
    version: '1.0.0',
    permissions: ['media-read', 'media-write'],
    source: { url: 'https://example.invalid/media-plugin', licenseStatus: 'NOT_APPLICABLE' },
    profiles: [{
      format: FURY_MEDIA_PLUGIN_PROFILE_FORMAT,
      id: 'image-text',
      family: 'image-generation',
      permissions: ['media-write'],
      supportedMediaTypes: ['image/png'],
      bounds: { maxInputBytes: 1_000_000, maxOutputBytes: 1_000_000, maxItems: 2, maxDurationMs: 60_000 },
      health: { status: 'healthy', observedAt: NOW, authority: 'health-observation-only', executionAuthority: false },
      secretRefs: [],
      lifecycle: 'registered',
      compatibility: ['deterministic-test-provider'],
    }],
  });
}

interface Harness {
  readonly root: string;
  readonly state: FuryDeterministicMediaProviderState;
  readonly engine: FuryMediaGenerationJobEngine;
  readonly store: ReturnType<typeof createRecoveryStore>;
  readonly registry: ReturnType<typeof createFuryMediaGenerationAdapterRegistry>;
  readonly media: ReturnType<typeof createFuryMediaIngestionCoordinator>;
  readonly artifacts: ReturnType<typeof createFuryArtifactStore>;
  readonly coordinator: ReturnType<typeof createFuryMediaGenerationCoordinator>;
}

type DeterministicOverrides = Partial<Pick<FuryDeterministicMediaGenerationAdapterOptions, 'outputBytes' | 'queuePolls' | 'runningPolls' | 'fail' | 'failureClass' | 'returnResultInPoll' | 'submitOutcomeUnknown' | 'cancelOutcome'>>;

async function harness(options: DeterministicOverrides = {}): Promise<Harness> {
  const root = await mkdtemp(join(tmpdir(), 'furypipe-media-job-'));
  const state: FuryDeterministicMediaProviderState = { jobs: new Map(), submitCount: 0, pollCount: 0, cancelCount: 0 };
  const adapter = createFuryDeterministicMediaGenerationAdapter({
    bundleId: 'media-lab',
    bundleVersion: '1.0.0',
    profileId: 'image-text',
    family: 'image-generation',
    supportedModes: ['text-to-image'],
    outputMimeType: 'image/png',
    outputBytes: png(),
    state,
    ...options,
  });
  const registry = createFuryMediaGenerationAdapterRegistry([adapter]);
  const media = createFuryMediaIngestionCoordinator();
  const artifacts = createFuryArtifactStore();
  const coordinator = createFuryMediaGenerationCoordinator({ adapters: registry, mediaCoordinator: media, artifactStore: artifacts, projectId: 'job-engine-test', now: () => NOW });
  const execution = createExecutionWith(coordinator, media);
  const store = createRecoveryStore(root, { namespace: 'media-jobs' });
  const engine = createFuryMediaGenerationJobEngine({ recoveryStore: store, adapters: registry, mediaCoordinator: media, artifactStore: artifacts, projectId: 'job-engine-test', now: () => NOW });
  return { root, state, engine, store, registry, media, artifacts, coordinator };
}

function createExecutionWith(coordinator: ReturnType<typeof createFuryMediaGenerationCoordinator>, media: ReturnType<typeof createFuryMediaIngestionCoordinator>): FuryMediaGenerationExecutionSession {
  const request = coordinator.prepare({ bundle: bundle(), profileId: 'image-text', mediaCoordinator: media, kind: 'image', mode: 'text-to-image', prompt: 'prompt must stay process-local', outputMimeType: 'image/png' });
  const plan = coordinator.plan(request);
  const permit = coordinator.authorize(request, plan, {
    format: FURY_MEDIA_GENERATION_APPROVAL_FORMAT,
    approvalId: 'approval-job-engine',
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
  });
  return createFuryMediaGenerationExecutionSession({ coordinator, request, plan, permit, now: () => NOW });
}

describe('FuryPipe durable media generation job engine', () => {
  it('runs async queue/poll/finalize through governed ingestion and durable references', async () => {
    const h = await harness({ queuePolls: 1, runningPolls: 1 });
    try {
      const execution = createExecutionWith(h.coordinator, h.media);
      const job = await h.engine.create({ execution, idempotencyKey: 'alpha' });
      expect(job.status).toBe('CREATED');
      expect((await h.engine.submit(job.jobId)).status).toBe('QUEUED');
      const done = await h.engine.pollUntil(job.jobId, { maxAttempts: 8, baseDelayMs: 0, maxDelayMs: 0 });
      expect(done.status).toBe('SUCCEEDED');
      expect(done.outputReferences).toHaveLength(1);
      expect(done.outputReferences[0]?.storageHandle).toMatch(/^furypipe-recovery\/v1\/sha256\/[0-9a-f]{64}$/u);
      const verified = await h.engine.inspectOutputs(done.jobId);
      expect(verified).toMatchObject({
        format: 'furypipe-media-generation-output-inspection/v1',
        status: 'VERIFIED',
        executionAuthorized: false,
      });
      expect(verified.outputReferences[0]).toMatchObject({
        status: 'VERIFIED',
        artifact: { status: 'VERIFIED', projectId: 'job-engine-test' },
        provenance: { requestDigestSha256: done.requestDigestSha256, planDigestSha256: done.planDigestSha256 },
      });
      const output = await h.engine.readOutput(done.jobId, done.outputReferences[0]!.artifactId, done.outputReferences[0]!.version);
      expect(output).toMatchObject({
        mimeType: 'image/png',
        mediaSha256: done.outputReferences[0]!.mediaSha256,
        byteLength: done.outputReferences[0]!.byteLength,
      });
      expect(output.bytes).toEqual(png());
      const restartedEngine = createFuryMediaGenerationJobEngine({ recoveryStore: h.store, adapters: h.registry, mediaCoordinator: h.media, artifactStore: h.artifacts, projectId: 'job-engine-test', now: () => NOW });
      expect((await restartedEngine.inspectOutputs(done.jobId)).status).toBe('VERIFIED');
      const cleanup = await restartedEngine.planOutputCleanup(done.jobId);
      expect(cleanup).toMatchObject({ deletionPerformed: false, cleanupAuthorized: false, executionAuthorized: false, candidates: [] });
      await h.store.delete(done.outputReferences[0]!.storageHandle);
      const missing = await restartedEngine.inspectOutputs(done.jobId);
      expect(missing.status).toBe('MISSING');
      expect(missing.outputReferences[0]?.status).toBe('MISSING');
      expect((await restartedEngine.planOutputCleanup(done.jobId)).candidates[0]).toMatchObject({ status: 'MISSING', action: 'REPAIR_REFERENCE_OR_RECONCILE' });
      await expect(restartedEngine.readOutput(done.jobId, done.outputReferences[0]!.artifactId)).rejects.toMatchObject({ status: 409 });
      expect(h.state.submitCount).toBe(1);
      const manifests = await h.store.list!({ metadata: { type: 'media-generation-job' } });
      const durable = await h.store.get(manifests[0]!);
      const text = new TextDecoder().decode(durable);
      expect(text).not.toContain('prompt must stay process-local');
      expect(text).not.toContain('alpha');
      expect(text).not.toContain('deterministic_');
      durable.fill(0);
    } finally {
      await rm(h.root, { recursive: true, force: true });
    }
  });

  it('reuses the idempotency record and submits only once', async () => {
    const h = await harness();
    try {
      const execution = createExecutionWith(h.coordinator, h.media);
      const first = await h.engine.create({ execution, idempotencyKey: 'same' });
      const second = await h.engine.create({ execution, idempotencyKey: 'same' });
      expect(second.jobId).toBe(first.jobId);
      await h.engine.submit(first.jobId);
      expect(h.state.submitCount).toBe(1);
    } finally {
      await rm(h.root, { recursive: true, force: true });
    }
  });

  it('recovers an unknown submit outcome without blind resubmit', async () => {
    const h = await harness({ submitOutcomeUnknown: true, queuePolls: 0, runningPolls: 0 });
    try {
      const execution = createExecutionWith(h.coordinator, h.media);
      const created = await h.engine.create({ execution, idempotencyKey: 'unknown-submit' });
      const unknown = await h.engine.submit(created.jobId);
      expect(unknown.status).toBe('UNKNOWN');
      expect(h.state.submitCount).toBe(1);

      const restartedEngine = createFuryMediaGenerationJobEngine({ recoveryStore: h.store, adapters: h.registry, mediaCoordinator: h.media, artifactStore: h.artifacts, projectId: 'job-engine-test', now: () => NOW });
      const recovered = await restartedEngine.recover();
      expect(recovered[0]?.status).toBe('QUEUED');
      const done = await restartedEngine.pollUntil(created.jobId, { maxAttempts: 4, baseDelayMs: 0, maxDelayMs: 0 });
      expect(done.status).toBe('SUCCEEDED');
      expect(h.state.submitCount).toBe(1);
    } finally {
      await rm(h.root, { recursive: true, force: true });
    }
  });

  it('keeps malformed provider media out of success state', async () => {
    const h = await harness({ outputBytes: Uint8Array.from([1, 2, 3]) });
    try {
      const execution = createExecutionWith(h.coordinator, h.media);
      const job = await h.engine.create({ execution, idempotencyKey: 'bad-output' });
      await h.engine.submit(job.jobId);
      const result = await h.engine.pollUntil(job.jobId, { maxAttempts: 4, baseDelayMs: 0, maxDelayMs: 0 });
      expect(result.status).toBe('UNKNOWN');
      expect(result.failure?.classification).toBe('LOCAL_FINALIZATION_FAILED');
    } finally {
      await rm(h.root, { recursive: true, force: true });
    }
  });

  it('records local and provider cancellation states explicitly', async () => {
    const local = await harness();
    try {
      const execution = createExecutionWith(local.coordinator, local.media);
      const created = await local.engine.create({ execution, idempotencyKey: 'local-cancel' });
      const cancelled = await local.engine.cancel(created.jobId);
      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.cancellationOutcome).toBe('LOCAL_CANCELLED');
    } finally {
      await rm(local.root, { recursive: true, force: true });
    }

    const provider = await harness({ cancelOutcome: 'PROVIDER_STATE_UNKNOWN' });
    try {
      const execution = createExecutionWith(provider.coordinator, provider.media);
      const created = await provider.engine.create({ execution, idempotencyKey: 'provider-cancel' });
      await provider.engine.submit(created.jobId);
      const cancelled = await provider.engine.cancel(created.jobId);
      expect(cancelled.status).toBe('UNKNOWN');
      expect(cancelled.cancellationOutcome).toBe('PROVIDER_STATE_UNKNOWN');
    } finally {
      await rm(provider.root, { recursive: true, force: true });
    }
  });
});
