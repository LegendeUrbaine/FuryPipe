import { createHash, randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { FuryArtifactStore } from './fury-artifacts.js';
import { createFuryArtifactRepository, type FuryArtifactRepository } from './fury-artifact-repository-node.js';
import { createFuryArtifactStore, type FuryArtifact } from './fury-artifacts.js';
import { createRecoveryStore } from './core/recovery-store.js';
import {
  createFuryMediaGenerationAdapterRegistry,
  createFuryMediaGenerationCoordinator,
  createFuryMediaGenerationExecutionSession,
  type FuryMediaGenerationAdapter,
  type FuryMediaGenerationKind,
  type FuryMediaGenerationMode,
  type FuryMediaGenerationParameters,
} from './media-generation-runtime.js';
import {
  createFuryMediaGenerationJobEngine,
  type FuryMediaGenerationJob,
  type FuryMediaGenerationJobEngine,
} from './media-generation-job-engine.js';
import { createFuryMediaIngestionCoordinator } from './media-ingestion.js';
import {
  validateFuryMediaPluginBundle,
  type FuryMediaPluginBundle,
  type FuryMediaPluginBundleInput,
} from './media-plugin-contracts.js';
import {
  createFuryMediaStudioPreview,
  createFuryMediaStudioSnapshot,
  type FuryMediaStudioPreviewOptions,
} from './media-studio.js';
import type {
  StudioMediaExecution,
  StudioMediaExecutionInput,
  StudioMediaExecutionResult,
} from './studio/studio-api.js';

export const FURY_MEDIA_HOST_MODULE_FORMAT = 'furypipe-media-host-module/v1' as const;

const MAX_MODULE_SPECIFIER_BYTES = 1_024;
const MAX_PARAMETERS = 32;
const MAX_PARAMETER_TEXT = 100_000;
const MAX_HEALTH_AGE_MS = 5 * 60_000;
const MEDIA_JOB_MAX_OBJECT_BYTES = 4 * 1024 * 1024;
const MEDIA_JOB_MAX_TOTAL_BYTES = 512 * 1024 * 1024;
const DEFAULT_POLL_ATTEMPTS = 16;
const DEFAULT_POLL_DURATION_MS = 120_000;

const MODE_FAMILY: Readonly<Record<FuryMediaGenerationMode, 'image-generation' | 'audio-generation' | 'video-generation'>> = Object.freeze({
  'text-to-image': 'image-generation',
  'image-to-image': 'image-generation',
  inpaint: 'image-generation',
  outpaint: 'image-generation',
  variation: 'image-generation',
  upscale: 'image-generation',
  'background-editing': 'image-generation',
  'text-to-audio': 'audio-generation',
  'audio-to-audio': 'audio-generation',
  'voice-generation': 'audio-generation',
  'sound-effect': 'audio-generation',
  'text-to-video': 'video-generation',
  'image-to-video': 'video-generation',
  'video-to-video': 'video-generation',
  'continue-video': 'video-generation',
  'lip-sync': 'video-generation',
});

const KIND_BY_SURFACE: Readonly<Record<StudioMediaExecutionInput['surface'], FuryMediaGenerationKind>> = Object.freeze({
  image: 'image',
  audio: 'audio',
  video: 'video',
});

type HostModuleFactory = (context: FuryMediaGenerationHostModuleContext) =>
  FuryMediaGenerationHostModule | Promise<FuryMediaGenerationHostModule>;

export interface FuryMediaGenerationHostModuleContext {
  readonly projectRoot: string;
  readonly stateRoot: string;
  readonly now: number;
}

/**
 * Explicit provider module contract for the Node host.
 *
 * The provider owns the adapter implementation and health observation. FuryPipe
 * owns selection, permits, durable jobs, output verification and artifacts.
 * The module is never installed, fetched or activated automatically.
 */
export interface FuryMediaGenerationHostModule {
  readonly format: typeof FURY_MEDIA_HOST_MODULE_FORMAT;
  readonly bundle: FuryMediaPluginBundleInput;
  readonly adapters: readonly FuryMediaGenerationAdapter[];
}

export interface FuryMediaGenerationHostRuntimeOptions {
  readonly projectRoot: string;
  readonly module: FuryMediaGenerationHostModule | HostModuleFactory;
  readonly stateRoot?: string;
  readonly artifactRoot?: string;
  readonly now?: () => number;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly pollAttempts?: number;
  readonly pollDurationMs?: number;
}

export interface LoadedFuryMediaGenerationHostRuntime {
  readonly adapters: readonly FuryMediaGenerationAdapter[];
  readonly bundle: FuryMediaPluginBundle;
  readonly artifactRepository: FuryArtifactRepository;
  readonly mediaJobEngine: FuryMediaGenerationJobEngine;
  readonly mediaExecution: StudioMediaExecution;
  readonly recover: () => Promise<readonly FuryMediaGenerationJob[]>;
  readonly poll: (jobId: string) => Promise<FuryMediaGenerationJob>;
}

interface DurableArtifactStore extends FuryArtifactStore {
  flush(): Promise<void>;
}

function projectKey(projectRoot: string): string {
  return createHash('sha256').update(path.resolve(projectRoot)).digest('hex').slice(0, 16);
}

function boundedModuleSpecifier(value: string): string {
  if (value.length < 1 || Buffer.byteLength(value, 'utf8') > MAX_MODULE_SPECIFIER_BYTES || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new Error('media adapter module specifier is invalid');
  }
  if (/^(?:data|http|https|node):/iu.test(value)) throw new Error('media adapter module must be local or package-resolved');
  return value;
}

function plainRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error(`${label} must be a plain object`);
  return value as Record<string, unknown>;
}

function normalizeParameters(value: unknown): FuryMediaGenerationParameters {
  if (value === undefined) return Object.freeze({});
  const record = plainRecord(value, 'media options');
  const entries = Object.entries(record);
  if (entries.length > MAX_PARAMETERS) throw new Error('media options exceed their bound');
  const parameters: Record<string, string | number | boolean> = {};
  for (const [key, raw] of entries) {
    if (!/^[A-Za-z][A-Za-z0-9._:-]{0,63}$/u.test(key)) throw new Error('media option key is invalid');
    if (typeof raw === 'string') {
      if (raw.length > MAX_PARAMETER_TEXT || raw.includes('\0')) throw new Error(`media option ${key} is invalid`);
      parameters[key] = raw;
    } else if (typeof raw === 'number') {
      if (!Number.isFinite(raw)) throw new Error(`media option ${key} is invalid`);
      parameters[key] = raw;
    } else if (typeof raw === 'boolean') {
      parameters[key] = raw;
    } else {
      throw new Error(`media option ${key} must be a string, number or boolean`);
    }
  }
  return Object.freeze(parameters);
}

function readyAdapters(
  bundle: FuryMediaPluginBundle,
  adapters: readonly FuryMediaGenerationAdapter[],
  now: number,
  environment: Readonly<Record<string, string | undefined>>,
): readonly FuryMediaGenerationAdapter[] {
  if (!Array.isArray(adapters) || adapters.length < 1 || adapters.length > 128) {
    throw new Error('media host module must expose 1-128 adapters');
  }
  const ready: FuryMediaGenerationAdapter[] = [];
  for (const adapter of adapters) {
    const profile = bundle.profiles.find((candidate) =>
      candidate.id === adapter.profileId
      && candidate.family === adapter.family
      && candidate.bundleId === adapter.bundleId
      && candidate.bundleVersion === adapter.bundleVersion,
    );
    if (!profile) throw new Error(`media adapter ${adapter.profileId} has no matching plugin profile`);
    if (profile.lifecycle !== 'registered') continue;
    if (profile.health.status !== 'healthy' || profile.health.observedAt > now || now - profile.health.observedAt > MAX_HEALTH_AGE_MS) continue;
    if (!bundle.permissions.includes('media-write') || !profile.permissions.includes('media-write')) continue;
    if (profile.secretRefs.some((name) => !(environment[name] ?? '').trim())) continue;
    ready.push(adapter);
  }
  if (ready.length < 1) throw new Error('no healthy, registered and authorized media adapter is available');
  const registry = createFuryMediaGenerationAdapterRegistry(ready);
  const registered = ready.map((adapter) => registry.get(adapter.bundleId, adapter.bundleVersion, adapter.profileId, adapter.family));
  if (registered.some((adapter) => adapter === undefined)) throw new Error('media adapter registry did not retain every configured adapter');
  return Object.freeze(ready);
}

function normalizeModule(value: unknown): FuryMediaGenerationHostModule {
  const record = plainRecord(value, 'media host module');
  if (record.format !== FURY_MEDIA_HOST_MODULE_FORMAT) throw new Error('media host module format is invalid');
  if (!Object.prototype.hasOwnProperty.call(record, 'bundle') || !Object.prototype.hasOwnProperty.call(record, 'adapters')) {
    throw new Error('media host module must declare bundle and adapters');
  }
  if (!Array.isArray(record.adapters)) throw new Error('media host module adapters must be an array');
  return Object.freeze({
    format: FURY_MEDIA_HOST_MODULE_FORMAT,
    bundle: record.bundle as FuryMediaPluginBundleInput,
    adapters: Object.freeze([...record.adapters] as FuryMediaGenerationAdapter[]),
  });
}

async function resolveModuleExport(value: unknown, context: FuryMediaGenerationHostModuleContext): Promise<FuryMediaGenerationHostModule> {
  const namespace = plainRecord(value, 'media host module namespace');
  const candidate = namespace.createFuryMediaGenerationHostModule ?? namespace.default ?? namespace.furypipeMediaGenerationHostModule;
  const resolved = typeof candidate === 'function'
    ? await (candidate as HostModuleFactory)(context)
    : candidate;
  return normalizeModule(resolved);
}

async function loadExternalModule(specifier: string, projectRoot: string, context: FuryMediaGenerationHostModuleContext): Promise<FuryMediaGenerationHostModule> {
  const configured = boundedModuleSpecifier(specifier);
  const isPath = path.isAbsolute(configured)
    || configured === '.'
    || configured === '..'
    || configured.startsWith('./')
    || configured.startsWith('../')
    || configured.startsWith('.\\')
    || configured.startsWith('..\\');
  const resolved = isPath
    ? pathToFileURL(path.resolve(projectRoot, configured)).href
    : configured;
  return resolveModuleExport(await import(resolved), context);
}

function createDurableArtifactStore(
  initial: readonly FuryArtifact[],
  repository: FuryArtifactRepository,
): DurableArtifactStore {
  const memory = createFuryArtifactStore(initial);
  let writeChain: Promise<void> = Promise.resolve();
  let writeFailure: unknown;
  const enqueue = (operation: () => Promise<void>): void => {
    writeChain = writeChain.then(operation).catch((error: unknown) => {
      writeFailure ??= error;
    });
  };
  const store: DurableArtifactStore = {
    create(input: Parameters<FuryArtifactStore['create']>[0]) {
      const artifact = memory.create(input);
      const { projectId: _projectId, ...persisted } = input;
      enqueue(async () => { await repository.create(persisted); });
      return artifact;
    },
    appendVersion(input: Parameters<FuryArtifactStore['appendVersion']>[0]) {
      const artifact = memory.appendVersion(input);
      enqueue(async () => { await repository.appendVersion(input); });
      return artifact;
    },
    get: (id: string) => memory.get(id),
    list: () => memory.list(),
    search: (query: string, projectId?: string) => memory.search(query, projectId),
    planRestore: (artifactId: string, sourceVersion: number) => memory.planRestore(artifactId, sourceVersion),
    async flush() {
      await writeChain;
      if (writeFailure !== undefined) throw writeFailure;
    },
  };
  return Object.freeze(store);
}

function mediaArtifactKind(kind: FuryMediaGenerationKind): 'image' | 'audio' | 'video' {
  return kind;
}

async function hydrateMissingMediaArtifacts(
  jobs: readonly FuryMediaGenerationJob[],
  artifacts: DurableArtifactStore,
  projectId: string,
): Promise<void> {
  for (const job of jobs) {
    for (const output of job.outputReferences) {
      if (artifacts.get(output.artifactId)) continue;
      artifacts.create({
        id: output.artifactId,
        kind: mediaArtifactKind(job.kind),
        title: `Fury ${job.kind} output`,
        projectId,
        content: `recovery://${output.storageHandle}`,
        mediaType: 'application/vnd.furypipe.media-reference',
        metadata: Object.freeze({
          storageHandle: output.storageHandle,
          mediaSha256: output.mediaSha256,
          mimeType: output.mimeType,
          byteCount: String(output.byteLength),
          requestDigestSha256: job.requestDigestSha256,
        }),
        now: new Date(job.updatedAt).toISOString(),
      });
    }
  }
  await artifacts.flush();
}

function selectedAdapter(
  input: StudioMediaExecutionInput,
  preview: ReturnType<typeof createFuryMediaStudioPreview>,
  adapters: readonly FuryMediaGenerationAdapter[],
): FuryMediaGenerationAdapter {
  const candidates = adapters
    .filter((adapter) => adapter.family === MODE_FAMILY[input.operation] && adapter.supportedModes.includes(input.operation))
    .sort((left, right) => `${left.bundleId}/${left.profileId}`.localeCompare(`${right.bundleId}/${right.profileId}`));
  if (preview.provider !== 'AUTO') {
    const observations = createFuryMediaStudioSnapshot({ adapters }).adapters;
    const index = observations.findIndex((observation) => observation.selectorId === preview.provider);
    const explicit = index >= 0 ? adapters[index] : undefined;
    if (!explicit || !candidates.includes(explicit)) throw new Error('selected media adapter does not support the requested operation');
    return explicit;
  }
  const automatic = candidates[0];
  if (!automatic) throw new Error('no configured media adapter supports the requested operation');
  return automatic;
}

function resultForJob(job: FuryMediaGenerationJob): StudioMediaExecutionResult {
  return Object.freeze({
    jobId: job.jobId,
    status: job.status,
    family: job.family,
    operation: job.operation,
    ...(job.outputReferences.length === 0 ? {} : {
      outputReferences: Object.freeze(job.outputReferences.map((output) => Object.freeze({
        artifactId: output.artifactId,
        version: output.version,
        mediaSha256: output.mediaSha256,
        mimeType: output.mimeType,
        byteLength: output.byteLength,
      }))),
    }),
    ...(job.failure === undefined ? {} : { failure: Object.freeze({ ...job.failure }) }),
  });
}

export async function createFuryMediaGenerationHostRuntime(
  options: FuryMediaGenerationHostRuntimeOptions,
): Promise<LoadedFuryMediaGenerationHostRuntime> {
  if (!options || typeof options.projectRoot !== 'string' || options.projectRoot.length < 1) throw new Error('media host project root is required');
  const now = options.now ?? Date.now;
  const observedAt = now();
  if (!Number.isSafeInteger(observedAt) || observedAt < 0) throw new Error('media host clock is invalid');
  const key = projectKey(options.projectRoot);
  const stateRoot = options.stateRoot ?? path.join(os.homedir(), '.furypipe', 'studio', 'media', key);
  const artifactRoot = options.artifactRoot ?? path.join(os.homedir(), '.furypipe', 'studio', 'artifacts', key);
  const environment = options.environment ?? process.env;
  const rawModule = typeof options.module === 'function'
    ? await options.module({ projectRoot: path.resolve(options.projectRoot), stateRoot, now: observedAt })
    : options.module;
  const module = normalizeModule(rawModule);
  const bundle = validateFuryMediaPluginBundle(module.bundle);
  const adapters = readyAdapters(bundle, module.adapters, observedAt, environment);
  const registry = createFuryMediaGenerationAdapterRegistry(adapters);
  const mediaCoordinator = createFuryMediaIngestionCoordinator();
  const projectId = key;
  const artifactRepository = createFuryArtifactRepository({ root: artifactRoot, projectId });
  const initialArtifacts = await artifactRepository.list();
  const artifactStore = createDurableArtifactStore(initialArtifacts, artifactRepository);
  const recoveryStore = createRecoveryStore(stateRoot, {
    namespace: 'media-jobs',
    maxObjectBytes: MEDIA_JOB_MAX_OBJECT_BYTES,
    maxTotalBytes: MEDIA_JOB_MAX_TOTAL_BYTES,
  });
  const coordinator = createFuryMediaGenerationCoordinator({
    adapters: registry,
    mediaCoordinator,
    artifactStore,
    projectId,
    now,
    maxHealthAgeMs: MAX_HEALTH_AGE_MS,
  });
  const engine = createFuryMediaGenerationJobEngine({
    recoveryStore,
    adapters: registry,
    mediaCoordinator,
    artifactStore,
    projectId,
    now,
  });
  const existingJobs = await engine.list({ limit: 9_999 });
  await hydrateMissingMediaArtifacts(existingJobs, artifactStore, projectId);

  const pollAttempts = options.pollAttempts ?? DEFAULT_POLL_ATTEMPTS;
  const pollDurationMs = options.pollDurationMs ?? DEFAULT_POLL_DURATION_MS;
  if (!Number.isSafeInteger(pollAttempts) || pollAttempts < 1 || pollAttempts > 256) throw new Error('media host poll attempts are invalid');
  if (!Number.isSafeInteger(pollDurationMs) || pollDurationMs < 1 || pollDurationMs > 600_000) throw new Error('media host poll duration is invalid');
  const activePolls = new Map<string, Promise<FuryMediaGenerationJob>>();
  const poll = (jobId: string): Promise<FuryMediaGenerationJob> => {
    const active = activePolls.get(jobId);
    if (active) return active;
    const pending = engine.pollUntil(jobId, { maxAttempts: pollAttempts, maxDurationMs: pollDurationMs })
      .then(async (job) => {
        await artifactStore.flush();
        return job;
      })
      .finally(() => { activePolls.delete(jobId); });
    activePolls.set(jobId, pending);
    return pending;
  };
  const recover = async (): Promise<readonly FuryMediaGenerationJob[]> => {
    const recovered = await engine.recover();
    await artifactStore.flush();
    for (const job of recovered) {
      if (job.status === 'SUBMITTED' || job.status === 'QUEUED' || job.status === 'RUNNING') void poll(job.jobId).catch(() => undefined);
    }
    return recovered;
  };
  await recover();

  const mediaExecution: StudioMediaExecution = Object.freeze({
    async submit(input: StudioMediaExecutionInput): Promise<StudioMediaExecutionResult> {
      const optionsValue = input.options as FuryMediaStudioPreviewOptions | undefined;
      const preview = createFuryMediaStudioPreview({
        surface: input.surface,
        operation: input.operation,
        prompt: input.prompt,
        outputMimeType: input.outputMimeType,
        ...(optionsValue === undefined ? {} : { options: optionsValue }),
        adapters,
      });
      const adapter = selectedAdapter(input, preview, adapters);
      const kind = KIND_BY_SURFACE[input.surface];
      const parameters = normalizeParameters(input.options);
      const request = coordinator.prepare({
        bundle,
        profileId: adapter.profileId,
        mediaCoordinator,
        kind,
        mode: input.operation,
        prompt: input.prompt,
        parameters,
        outputMimeType: input.outputMimeType,
      });
      const plan = coordinator.plan(request);
      const permit = coordinator.authorize(request, plan, {
        format: 'furypipe-media-generation-approval/v1',
        approvalId: `studio_${randomUUID()}`,
        allowGeneration: true,
        requestDigestSha256: request.requestDigestSha256,
        planDigestSha256: plan.planDigestSha256,
        kind: request.kind,
        mode: request.mode,
        bundleId: request.bundleId,
        bundleVersion: request.bundleVersion,
        profileId: request.profileId,
        outputMimeType: request.outputMimeType,
        expiresInMs: 30_000,
        authority: 'media-generation-approval-decision',
        executionAuthority: false,
      });
      const execution = createFuryMediaGenerationExecutionSession({ coordinator, request, plan, permit, now });
      const job = await engine.create({ execution, idempotencyKey: `studio_${preview.idempotencySeedDigestSha256}` });
      const submitted = await engine.submit(job.jobId);
      await artifactStore.flush();
      if (submitted.status === 'SUBMITTED' || submitted.status === 'QUEUED' || submitted.status === 'RUNNING') {
        void poll(submitted.jobId).catch(() => undefined);
      }
      return resultForJob(submitted);
    },
  });

  return Object.freeze({
    adapters,
    bundle,
    artifactRepository,
    mediaJobEngine: engine,
    mediaExecution,
    recover,
    poll,
  });
}

export async function loadFuryMediaGenerationHostRuntime(options: {
  readonly projectRoot: string;
  readonly now?: () => number;
  readonly stateRoot?: string;
  readonly artifactRoot?: string;
  readonly environment?: Readonly<Record<string, string | undefined>>;
}): Promise<LoadedFuryMediaGenerationHostRuntime | undefined> {
  const environment = options.environment ?? process.env;
  const specifier = environment.FURYPIPE_MEDIA_ADAPTER_MODULE?.trim();
  if (!specifier) return undefined;
  const now = options.now ?? Date.now;
  const observedAt = now();
  const key = projectKey(options.projectRoot);
  const stateRoot = options.stateRoot ?? path.join(os.homedir(), '.furypipe', 'studio', 'media', key);
  const module = await loadExternalModule(boundedModuleSpecifier(specifier), options.projectRoot, {
    projectRoot: path.resolve(options.projectRoot),
    stateRoot,
    now: observedAt,
  });
  return createFuryMediaGenerationHostRuntime({
    ...options,
    module,
    environment,
  });
}
