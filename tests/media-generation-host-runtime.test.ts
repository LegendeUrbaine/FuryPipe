import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createFuryDeterministicMediaGenerationAdapter } from '../src/media-generation-deterministic-adapter.js';
import {
  createFuryMediaGenerationHostRuntime,
  loadFuryMediaGenerationHostRuntime,
  type FuryMediaGenerationHostModule,
} from '../src/media-generation-host-runtime-node.js';
import {
  FURY_MEDIA_PLUGIN_BUNDLE_FORMAT,
  FURY_MEDIA_PLUGIN_PROFILE_FORMAT,
  type FuryMediaPluginBundleInput,
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

function bundle(): FuryMediaPluginBundleInput {
  return {
    format: FURY_MEDIA_PLUGIN_BUNDLE_FORMAT,
    id: 'media-host-test',
    version: '1.0.0',
    permissions: ['media-read', 'media-write'],
    source: { url: 'https://example.invalid/media-host-test', licenseStatus: 'NOT_APPLICABLE' },
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
      compatibility: ['furypipe-media-host-v1'],
    }],
  };
}

function moduleFixture(): FuryMediaGenerationHostModule {
  return {
    format: 'furypipe-media-host-module/v1',
    bundle: bundle(),
    adapters: [createFuryDeterministicMediaGenerationAdapter({
      bundleId: 'media-host-test',
      bundleVersion: '1.0.0',
      profileId: 'image-text',
      family: 'image-generation',
      supportedModes: ['text-to-image'],
      outputMimeType: 'image/png',
      outputBytes: png(),
      queuePolls: 0,
      runningPolls: 0,
    })],
  };
}

describe('Node media generation host runtime', () => {
  it('keeps the normal host unconfigured when no provider module is declared', async () => {
    const root = await mkdtemp(join(tmpdir(), 'furypipe-media-host-unconfigured-'));
    try {
      await expect(loadFuryMediaGenerationHostRuntime({ projectRoot: root, environment: {} })).resolves.toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('loads an explicitly configured local ESM provider module', async () => {
    const root = await mkdtemp(join(tmpdir(), 'furypipe-media-host-module-'));
    try {
      await writeFile(join(root, 'provider.mjs'), `export default {
        format: 'furypipe-media-host-module/v1',
        bundle: {
          format: 'furypipe-media-plugin-bundle/v1',
          id: 'module-host-test',
          version: '1.0.0',
          permissions: ['media-write'],
          source: { url: 'https://example.invalid/module-host-test', licenseStatus: 'NOT_APPLICABLE' },
          profiles: [{
            format: 'furypipe-media-plugin-profile/v1',
            id: 'image-text',
            family: 'image-generation',
            permissions: ['media-write'],
            supportedMediaTypes: ['image/png'],
            bounds: { maxInputBytes: 1000000, maxOutputBytes: 1000000, maxItems: 1 },
            health: { status: 'healthy', observedAt: ${NOW}, authority: 'health-observation-only', executionAuthority: false },
            secretRefs: [],
            lifecycle: 'registered',
            compatibility: ['module-host-v1'],
          }],
        },
        adapters: [{
          bundleId: 'module-host-test',
          bundleVersion: '1.0.0',
          profileId: 'image-text',
          family: 'image-generation',
          supportedModes: ['text-to-image'],
          capabilities: {
            synchronous: false,
            asynchronous: true,
            supportsPolling: true,
            supportsCancellation: true,
            supportsIdempotencyKey: true,
            supportedOperations: ['text-to-image'],
            supportedMimeTypes: ['image/png'],
            limits: { maxInputBytes: 1000000, maxOutputBytes: 1000000, maxItems: 1 },
          },
          submit: async () => ({ providerJobId: 'module-job', status: 'QUEUED' }),
          poll: async () => ({ status: 'SUCCEEDED' }),
          cancel: async () => ({ outcome: 'PROVIDER_CANCEL_CONFIRMED' }),
          reconcile: async () => ({ providerJobId: 'module-job', status: 'QUEUED' }),
        }],
      };`, 'utf8');
      const runtime = await loadFuryMediaGenerationHostRuntime({
        projectRoot: root,
        stateRoot: join(root, 'state'),
        artifactRoot: join(root, 'artifacts'),
        now: () => NOW,
        environment: { FURYPIPE_MEDIA_ADAPTER_MODULE: './provider.mjs' },
      });
      expect(runtime?.adapters).toHaveLength(1);
      expect(runtime?.bundle.id).toBe('module-host-test');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('runs the governed adapter job and rehydrates its verified artifact after restart', async () => {
    const root = await mkdtemp(join(tmpdir(), 'furypipe-media-host-runtime-'));
    const stateRoot = join(root, 'state');
    const artifactRoot = join(root, 'artifacts');
    try {
      const options = {
        projectRoot: root,
        stateRoot,
        artifactRoot,
        module: moduleFixture(),
        now: () => NOW,
        environment: {},
        pollAttempts: 4,
        pollDurationMs: 1_000,
      } as const;
      const runtime = await createFuryMediaGenerationHostRuntime(options);
      const queued = await runtime.mediaExecution.submit({
        surface: 'image',
        operation: 'text-to-image',
        prompt: 'bounded host runtime test',
        outputMimeType: 'image/png',
        options: { provider: 'AUTO', model: 'AUTO' },
      });
      expect(queued.status).toBe('QUEUED');

      const done = await runtime.poll(queued.jobId);
      expect(done.status).toBe('SUCCEEDED');
      expect(done.outputReferences).toHaveLength(1);
      const inspection = await runtime.mediaJobEngine.inspectOutputs(done.jobId);
      expect(inspection).toMatchObject({
        status: 'VERIFIED',
        executionAuthorized: false,
        outputReferences: [{ status: 'VERIFIED', artifact: { status: 'VERIFIED' } }],
      });
      expect(await runtime.artifactRepository.list()).toHaveLength(1);

      const restarted = await createFuryMediaGenerationHostRuntime(options);
      const restartedInspection = await restarted.mediaJobEngine.inspectOutputs(done.jobId);
      expect(restartedInspection).toMatchObject({
        status: 'VERIFIED',
        outputReferences: [{ status: 'VERIFIED', artifact: { status: 'VERIFIED' } }],
      });
      expect(await restarted.artifactRepository.list()).toHaveLength(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
