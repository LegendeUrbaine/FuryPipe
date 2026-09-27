import { createHash, randomUUID } from 'node:crypto';

import type { FuryArtifactKind, FuryArtifactStore } from './fury-artifacts.js';
import {
  FURY_MEDIA_INGESTION_INPUT_FORMAT,
  FURY_MEDIA_INGESTION_SOURCE_FORMAT,
  type FuryMediaIngestionCoordinator,
} from './media-ingestion.js';
import type {
  RecoveryHandle,
  RecoveryMetadata,
  RecoveryStore,
} from './core/recovery-store.js';
import {
  isGeneratedFuryMediaGenerationAdapterRegistry,
  isGeneratedFuryMediaGenerationExecutionSession,
  normalizeFuryMediaGenerationAdapterResult,
  FuryMediaGenerationError,
  type FuryMediaGenerationAdapter,
  type FuryMediaGenerationAdapterRegistry,
  type FuryMediaGenerationAdapterCancellationOutcome,
  type FuryMediaGenerationAdapterPoll,
  type FuryMediaGenerationAdapterStatus,
  type FuryMediaGenerationAdapterSubmission,
  type FuryMediaGenerationExecutionSession,
  type FuryMediaGenerationFamily,
  type FuryMediaGenerationKind,
  type FuryMediaGenerationMode,
} from './media-generation-runtime.js';

export const FURY_MEDIA_GENERATION_JOB_FORMAT = 'furypipe-media-generation-job/v1' as const;
export const FURY_MEDIA_GENERATION_JOB_RECEIPT_FORMAT = 'furypipe-media-generation-job-receipt/v1' as const;

export type FuryMediaGenerationJobStatus = 'CREATED' | FuryMediaGenerationAdapterStatus;

export type FuryMediaGenerationJobFailureClassification =
  | 'SUBMIT_OUTCOME_UNKNOWN'
  | 'POLL_OUTCOME_UNKNOWN'
  | 'PROVIDER_REPORTED_FAILURE'
  | 'PROVIDER_REFERENCE_UNAVAILABLE'
  | 'LOCAL_FINALIZATION_FAILED'
  | 'LOCAL_CANCELLED'
  | 'PROVIDER_CANCEL_CONFIRMED'
  | 'PROVIDER_CANCEL_UNSUPPORTED'
  | 'PROVIDER_STATE_UNKNOWN'
  | 'INVALID_RESULT'
  | 'TIMEOUT'
  | 'RECOVERY_REQUIRED';

export interface FuryMediaGenerationJobOutputReference {
  readonly artifactId: string;
  readonly version: number;
  readonly storageHandle: string;
  readonly mediaSha256: string;
  readonly mimeType: string;
  readonly byteLength: number;
}

export interface FuryMediaGenerationJobFailure {
  readonly classification: FuryMediaGenerationJobFailureClassification;
  readonly messageDigestSha256: string;
}

export interface FuryMediaGenerationJob {
  readonly format: typeof FURY_MEDIA_GENERATION_JOB_FORMAT;
  readonly jobId: string;
  readonly family: FuryMediaGenerationFamily;
  readonly operation: FuryMediaGenerationMode;
  readonly kind: FuryMediaGenerationKind;
  readonly providerProfileId: string;
  readonly bundleId: string;
  readonly bundleVersion: string;
  readonly outputMimeType: string;
  readonly promptDigestSha256: string;
  readonly parametersDigestSha256: string;
  readonly inputDigestsSha256: readonly string[];
  readonly inputKinds: readonly string[];
  readonly inputMimeTypes: readonly string[];
  readonly inputBytes: number;
  readonly promptBytes: number;
  readonly requestDigestSha256: string;
  readonly planDigestSha256: string;
  /** Digest of the deterministic provider idempotency seed, never the raw key. */
  readonly idempotencyKeyDigestSha256: string;
  readonly maxOutputBytes: number;
  readonly maxItems: number;
  readonly maxDurationMs?: number;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly attempt: number;
  readonly revision: number;
  readonly status: FuryMediaGenerationJobStatus;
  readonly progress?: number;
  readonly providerJobIdDigestSha256?: string;
  readonly outputReferences: readonly FuryMediaGenerationJobOutputReference[];
  readonly failure?: FuryMediaGenerationJobFailure;
  readonly cancellationOutcome?: FuryMediaGenerationAdapterCancellationOutcome;
  readonly receiptReferences: readonly string[];
}

export interface FuryMediaGenerationJobEngineOptions {
  readonly recoveryStore: RecoveryStore;
  readonly adapters: FuryMediaGenerationAdapterRegistry;
  readonly mediaCoordinator: FuryMediaIngestionCoordinator;
  readonly artifactStore: FuryArtifactStore;
  readonly projectId: string;
  readonly now?: () => number;
  readonly maxJobs?: number;
  readonly maxRecordBytes?: number;
}

export interface FuryMediaGenerationJobEngine {
  create(input: {
    readonly execution: FuryMediaGenerationExecutionSession;
    readonly idempotencyKey?: string;
  }): Promise<FuryMediaGenerationJob>;
  get(jobId: string): Promise<FuryMediaGenerationJob>;
  list(options?: {
    readonly status?: FuryMediaGenerationJobStatus;
    readonly family?: FuryMediaGenerationFamily;
    readonly limit?: number;
  }): Promise<readonly FuryMediaGenerationJob[]>;
  submit(jobId: string, options?: { readonly signal?: AbortSignal }): Promise<FuryMediaGenerationJob>;
  poll(jobId: string, options?: { readonly signal?: AbortSignal }): Promise<FuryMediaGenerationJob>;
  pollUntil(jobId: string, options?: {
    readonly maxAttempts?: number;
    readonly maxDurationMs?: number;
    readonly baseDelayMs?: number;
    readonly maxDelayMs?: number;
    readonly signal?: AbortSignal;
  }): Promise<FuryMediaGenerationJob>;
  reconcile(jobId: string): Promise<FuryMediaGenerationJob>;
  cancel(jobId: string): Promise<FuryMediaGenerationJob>;
  recover(): Promise<readonly FuryMediaGenerationJob[]>;
}

export type FuryMediaGenerationJobEngineResult = FuryMediaGenerationJob;

const JOB_ID = /^fpg_job_[0-9a-f-]{36}$/u;
const DIGEST = /^[0-9a-f]{64}$/u;
const MIME = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,63}\/([a-z0-9][a-z0-9!#$&^_.+-]{0,127})$/u;
const PROVIDER_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const JOB_STATUSES = new Set<FuryMediaGenerationJobStatus>([
  'CREATED', 'SUBMITTED', 'QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'UNKNOWN',
]);
const JOB_FAMILIES = new Set<FuryMediaGenerationFamily>(['image-generation', 'audio-generation', 'video-generation']);
const JOB_KINDS = new Set<FuryMediaGenerationKind>(['image', 'audio', 'video']);
const JOB_MODES = new Set<FuryMediaGenerationMode>([
  'text-to-image', 'image-to-image', 'inpaint', 'outpaint', 'variation', 'upscale', 'background-editing',
  'text-to-audio', 'audio-to-audio', 'voice-generation', 'sound-effect',
  'text-to-video', 'image-to-video', 'video-to-video', 'continue-video', 'lip-sync',
]);
const JOB_FAMILY_BY_KIND: Readonly<Record<FuryMediaGenerationKind, FuryMediaGenerationFamily>> = Object.freeze({
  image: 'image-generation', audio: 'audio-generation', video: 'video-generation',
});
const JOB_FAMILY_BY_MODE: Readonly<Record<FuryMediaGenerationMode, FuryMediaGenerationFamily>> = Object.freeze({
  'text-to-image': 'image-generation', 'image-to-image': 'image-generation', inpaint: 'image-generation', outpaint: 'image-generation', variation: 'image-generation', upscale: 'image-generation', 'background-editing': 'image-generation',
  'text-to-audio': 'audio-generation', 'audio-to-audio': 'audio-generation', 'voice-generation': 'audio-generation', 'sound-effect': 'audio-generation',
  'text-to-video': 'video-generation', 'image-to-video': 'video-generation', 'video-to-video': 'video-generation', 'continue-video': 'video-generation', 'lip-sync': 'video-generation',
});
const FAILURE_CLASSES = new Set<FuryMediaGenerationJobFailureClassification>([
  'SUBMIT_OUTCOME_UNKNOWN', 'POLL_OUTCOME_UNKNOWN', 'PROVIDER_REPORTED_FAILURE',
  'PROVIDER_REFERENCE_UNAVAILABLE', 'LOCAL_FINALIZATION_FAILED', 'LOCAL_CANCELLED',
  'PROVIDER_CANCEL_CONFIRMED', 'PROVIDER_CANCEL_UNSUPPORTED', 'PROVIDER_STATE_UNKNOWN',
  'INVALID_RESULT', 'TIMEOUT', 'RECOVERY_REQUIRED',
]);
const CANCELLATION_OUTCOMES = new Set<FuryMediaGenerationAdapterCancellationOutcome>([
  'LOCAL_CANCELLED', 'PROVIDER_CANCEL_CONFIRMED', 'PROVIDER_CANCEL_UNSUPPORTED', 'PROVIDER_STATE_UNKNOWN',
]);
const transitionSet = (...values: FuryMediaGenerationJobStatus[]): ReadonlySet<FuryMediaGenerationJobStatus> => new Set(values);
const JOB_TRANSITIONS: Readonly<Record<FuryMediaGenerationJobStatus, ReadonlySet<FuryMediaGenerationJobStatus>>> = Object.freeze({
  CREATED: transitionSet('CREATED', 'SUBMITTED', 'QUEUED', 'RUNNING', 'UNKNOWN', 'CANCELLED'),
  SUBMITTED: transitionSet('SUBMITTED', 'QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'UNKNOWN'),
  QUEUED: transitionSet('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'UNKNOWN'),
  RUNNING: transitionSet('RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'UNKNOWN'),
  UNKNOWN: transitionSet('UNKNOWN', 'SUBMITTED', 'QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'),
  SUCCEEDED: transitionSet('SUCCEEDED'),
  FAILED: transitionSet('FAILED'),
  CANCELLED: transitionSet('CANCELLED'),
});

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function textBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function asHandleString(handle: RecoveryHandle): string {
  return `${handle.format}/${handle.algorithm}/${handle.digest}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(record: Record<string, unknown>, allowed: readonly string[]): void {
  const accepted = new Set(allowed);
  if (Object.keys(record).some((key) => !accepted.has(key))) throw new Error('unsupported durable media job field');
}

function safeNow(now: () => number): number {
  const value = now();
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('media job clock is invalid');
  return value;
}

function boundedString(value: unknown, pattern: RegExp, label: string): string {
  if (typeof value !== 'string' || !pattern.test(value)) throw new Error(`${label} is invalid`);
  return value;
}

function boundedText(value: unknown, max: number, label: string): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > max || /[\u0000-\u001f\u007f]/u.test(value)) throw new Error(`${label} is invalid`);
  return value;
}

function boundedInt(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${label} is invalid`);
  return value;
}

function safeStringArray(value: unknown, pattern: RegExp, max: number, label: string): readonly string[] {
  if (!Array.isArray(value) || value.length > max) throw new Error(`${label} is invalid`);
  const values = value.map((candidate) => boundedString(candidate, pattern, label));
  return Object.freeze(values);
}

function safeOutputReferences(value: unknown): readonly FuryMediaGenerationJobOutputReference[] {
  if (!Array.isArray(value) || value.length > 32) throw new Error('job output references are invalid');
  const outputs = value.map((candidate) => {
    if (!isRecord(candidate)) throw new Error('job output reference is invalid');
    exactKeys(candidate, ['artifactId', 'version', 'storageHandle', 'mediaSha256', 'mimeType', 'byteLength']);
    return Object.freeze({
      artifactId: boundedText(candidate.artifactId, 128, 'artifactId'),
      version: boundedInt(candidate.version, 1, 256, 'artifact version'),
      storageHandle: boundedString(candidate.storageHandle, /^furypipe-recovery\/v1\/sha256\/[0-9a-f]{64}$/u, 'storage handle'),
      mediaSha256: boundedString(candidate.mediaSha256, DIGEST, 'media digest'),
      mimeType: boundedString(candidate.mimeType, MIME, 'output MIME'),
      byteLength: boundedInt(candidate.byteLength, 1, 2 ** 31 - 1, 'output byte length'),
    });
  });
  return Object.freeze(outputs);
}

function freezeJob(job: FuryMediaGenerationJob): FuryMediaGenerationJob {
  return Object.freeze({
    ...job,
    inputDigestsSha256: Object.freeze([...job.inputDigestsSha256]),
    inputKinds: Object.freeze([...job.inputKinds]),
    inputMimeTypes: Object.freeze([...job.inputMimeTypes]),
    outputReferences: Object.freeze(job.outputReferences.map((output) => Object.freeze({ ...output }))),
    receiptReferences: Object.freeze([...job.receiptReferences]),
    ...(job.failure === undefined ? {} : { failure: Object.freeze({ ...job.failure }) }),
  });
}

function parseJob(value: unknown): FuryMediaGenerationJob {
  if (!isRecord(value)) throw new Error('durable media job is not an object');
  exactKeys(value, [
    'format', 'jobId', 'family', 'operation', 'kind', 'providerProfileId', 'bundleId', 'bundleVersion',
    'outputMimeType', 'promptDigestSha256', 'parametersDigestSha256', 'inputDigestsSha256', 'inputKinds',
    'inputMimeTypes', 'inputBytes', 'promptBytes', 'requestDigestSha256', 'planDigestSha256',
    'idempotencyKeyDigestSha256', 'maxOutputBytes', 'maxItems', 'maxDurationMs', 'createdAt', 'updatedAt',
    'attempt', 'revision', 'status', 'progress', 'providerJobIdDigestSha256', 'outputReferences', 'failure',
    'cancellationOutcome', 'receiptReferences',
  ]);
  if (value.format !== FURY_MEDIA_GENERATION_JOB_FORMAT) throw new Error('durable media job format is invalid');
  const status = boundedText(value.status, 16, 'job status') as FuryMediaGenerationJobStatus;
  if (!JOB_STATUSES.has(status)) throw new Error('durable media job status is invalid');
  const job: FuryMediaGenerationJob = {
    format: FURY_MEDIA_GENERATION_JOB_FORMAT,
    jobId: boundedString(value.jobId, JOB_ID, 'job ID'),
    family: boundedText(value.family, 64, 'job family') as FuryMediaGenerationFamily,
    operation: boundedText(value.operation, 64, 'job operation') as FuryMediaGenerationMode,
    kind: boundedText(value.kind, 16, 'job kind') as FuryMediaGenerationKind,
    providerProfileId: boundedText(value.providerProfileId, 128, 'provider profile ID'),
    bundleId: boundedText(value.bundleId, 128, 'bundle ID'),
    bundleVersion: boundedText(value.bundleVersion, 64, 'bundle version'),
    outputMimeType: boundedString(value.outputMimeType, MIME, 'output MIME'),
    promptDigestSha256: boundedString(value.promptDigestSha256, DIGEST, 'prompt digest'),
    parametersDigestSha256: boundedString(value.parametersDigestSha256, DIGEST, 'parameters digest'),
    inputDigestsSha256: safeStringArray(value.inputDigestsSha256, DIGEST, 32, 'input digests'),
    inputKinds: safeStringArray(value.inputKinds, /^[a-z-]{1,32}$/u, 32, 'input kinds'),
    inputMimeTypes: safeStringArray(value.inputMimeTypes, MIME, 32, 'input MIME types'),
    inputBytes: boundedInt(value.inputBytes, 0, 2 ** 31 - 1, 'input bytes'),
    promptBytes: boundedInt(value.promptBytes, 1, 2 ** 31 - 1, 'prompt bytes'),
    requestDigestSha256: boundedString(value.requestDigestSha256, DIGEST, 'request digest'),
    planDigestSha256: boundedString(value.planDigestSha256, DIGEST, 'plan digest'),
    idempotencyKeyDigestSha256: boundedString(value.idempotencyKeyDigestSha256, DIGEST, 'idempotency digest'),
    maxOutputBytes: boundedInt(value.maxOutputBytes, 1, 2 ** 31 - 1, 'max output bytes'),
    maxItems: boundedInt(value.maxItems, 1, 32, 'max items'),
    ...(value.maxDurationMs === undefined ? {} : { maxDurationMs: boundedInt(value.maxDurationMs, 1, 2 ** 31 - 1, 'max duration') }),
    createdAt: boundedInt(value.createdAt, 0, Number.MAX_SAFE_INTEGER, 'createdAt'),
    updatedAt: boundedInt(value.updatedAt, 0, Number.MAX_SAFE_INTEGER, 'updatedAt'),
    attempt: boundedInt(value.attempt, 0, 256, 'attempt'),
    revision: boundedInt(value.revision, 1, Number.MAX_SAFE_INTEGER, 'revision'),
    status,
    ...(value.progress === undefined ? {} : { progress: boundedInt(value.progress, 0, 100, 'progress') }),
    ...(value.providerJobIdDigestSha256 === undefined ? {} : { providerJobIdDigestSha256: boundedString(value.providerJobIdDigestSha256, DIGEST, 'provider job digest') }),
    outputReferences: safeOutputReferences(value.outputReferences),
    ...(value.failure === undefined ? {} : (() => {
      if (!isRecord(value.failure)) throw new Error('job failure is invalid');
      exactKeys(value.failure, ['classification', 'messageDigestSha256']);
      const classification = boundedText(value.failure.classification, 64, 'failure classification') as FuryMediaGenerationJobFailureClassification;
      if (!FAILURE_CLASSES.has(classification)) throw new Error('failure classification is invalid');
      return { failure: Object.freeze({ classification, messageDigestSha256: boundedString(value.failure.messageDigestSha256, DIGEST, 'failure message digest') }) };
    })()),
    ...(value.cancellationOutcome === undefined ? {} : (() => {
      const outcome = boundedText(value.cancellationOutcome, 64, 'cancellation outcome') as FuryMediaGenerationAdapterCancellationOutcome;
      if (!CANCELLATION_OUTCOMES.has(outcome)) throw new Error('cancellation outcome is invalid');
      return { cancellationOutcome: outcome };
    })()),
    receiptReferences: safeStringArray(value.receiptReferences, /^furypipe-recovery\/v1\/sha256\/[0-9a-f]{64}$/u, 32, 'receipt references'),
  };
  if (!JOB_FAMILIES.has(job.family) || !JOB_KINDS.has(job.kind) || !JOB_MODES.has(job.operation)) throw new Error('durable media job taxonomy is invalid');
  if (JOB_FAMILY_BY_KIND[job.kind] !== job.family || JOB_FAMILY_BY_MODE[job.operation] !== job.family) throw new Error('durable media job taxonomy is inconsistent');
  return freezeJob(job);
}

function failure(classification: FuryMediaGenerationJobFailureClassification, message: unknown): FuryMediaGenerationJobFailure {
  const text = message instanceof Error ? message.message : String(message);
  return Object.freeze({ classification, messageDigestSha256: sha256(text.slice(0, 1024)) });
}

function statusIsTerminal(status: FuryMediaGenerationJobStatus): boolean {
  return status === 'SUCCEEDED' || status === 'FAILED' || status === 'CANCELLED';
}

function providerKey(job: FuryMediaGenerationJob): string {
  return `fpg_idem_${job.idempotencyKeyDigestSha256}`;
}

function validateIdempotencySeed(value: string | undefined): string {
  if (value === undefined) return '';
  return boundedText(value, 512, 'idempotency key');
}

function normalizeSubmission(value: unknown): FuryMediaGenerationAdapterSubmission {
  if (!isRecord(value)) throw new Error('adapter submission is invalid');
  exactKeys(value, ['providerJobId', 'status']);
  const providerJobId = boundedString(value.providerJobId, PROVIDER_ID, 'provider job ID');
  const status = value.status;
  if (status !== undefined && status !== 'SUBMITTED' && status !== 'QUEUED' && status !== 'RUNNING') throw new Error('adapter submission status is invalid');
  return Object.freeze({ providerJobId, ...(status === undefined ? {} : { status }) });
}

function normalizePoll(value: unknown): FuryMediaGenerationAdapterPoll {
  if (!isRecord(value)) throw new Error('adapter poll is invalid');
  exactKeys(value, ['status', 'progress', 'failureClass', 'providerRequestId', 'result']);
  const status = boundedText(value.status, 16, 'adapter status') as FuryMediaGenerationAdapterStatus;
  if (!new Set<FuryMediaGenerationAdapterStatus>(['SUBMITTED', 'QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'UNKNOWN']).has(status)) throw new Error('adapter poll status is invalid');
  return Object.freeze({
    status,
    ...(value.progress === undefined ? {} : { progress: boundedInt(value.progress, 0, 100, 'adapter progress') }),
    ...(value.failureClass === undefined ? {} : { failureClass: boundedText(value.failureClass, 128, 'adapter failure class') }),
    ...(value.providerRequestId === undefined ? {} : { providerRequestId: boundedString(value.providerRequestId, PROVIDER_ID, 'provider request ID') }),
    ...(Object.prototype.hasOwnProperty.call(value, 'result') ? { result: value.result } : {}),
  });
}

function zeroAdapterBytes(raw: unknown): void {
  if (!isRecord(raw) || !Array.isArray(raw.outputs)) return;
  for (const output of raw.outputs) {
    if (isRecord(output) && output.bytes instanceof Uint8Array) output.bytes.fill(0);
  }
}

function isAbortSignal(value: unknown): value is AbortSignal {
  return Boolean(value) && typeof value === 'object' && typeof (value as { readonly aborted?: unknown }).aborted === 'boolean' && typeof (value as { readonly addEventListener?: unknown }).addEventListener === 'function';
}

function waitBounded(ms: number, signal: AbortSignal | undefined): Promise<void> {
  if (signal?.aborted) return Promise.reject(new Error('poll aborted'));
  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const abort = () => {
      if (timer !== undefined) clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      reject(new Error('poll aborted'));
    };
    timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

function jitteredDelay(jobId: string, attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exponential = Math.min(maxDelayMs, baseDelayMs * (2 ** Math.min(attempt - 1, 16)));
  if (exponential === 0) return 0;
  // Stable per job and attempt. This spreads concurrent jobs without using
  // ambient randomness, which keeps recovery tests reproducible.
  const fraction = Number.parseInt(sha256(`${jobId}\0${attempt}`).slice(0, 8), 16) / 0xffffffff;
  return Math.min(maxDelayMs, Math.max(1, Math.round(exponential * (0.8 + fraction * 0.4))));
}

export function createFuryMediaGenerationJobEngine(options: FuryMediaGenerationJobEngineOptions): FuryMediaGenerationJobEngine {
  if (!options || typeof options !== 'object') throw new TypeError('media generation job engine options are required');
  const store = options.recoveryStore;
  if (!store || typeof store.list !== 'function' || typeof store.putBounded !== 'function' || typeof store.compactBounded !== 'function') {
    throw new TypeError('media generation job engine requires RecoveryStore list, putBounded and compactBounded');
  }
  if (!isGeneratedFuryMediaGenerationAdapterRegistry(options.adapters) || !options.mediaCoordinator || !options.artifactStore || typeof options.projectId !== 'string' || options.projectId.length < 1) {
    throw new TypeError('media generation job engine dependencies are invalid');
  }
  const nowSource = options.now ?? Date.now;
  if (typeof nowSource !== 'function') throw new TypeError('media generation job engine clock is invalid');
  // RecoveryStore bounded writes reserve one slot for the new revision while
  // the old revision still exists. Keep one slot below its hard 10,000 limit.
  const maxJobs = options.maxJobs ?? 9_999;
  const maxRecordBytes = options.maxRecordBytes ?? 256 * 1024;
  if (!Number.isSafeInteger(maxJobs) || maxJobs < 1 || maxJobs > 9_999) throw new TypeError('media generation maxJobs is invalid');
  if (!Number.isSafeInteger(maxRecordBytes) || maxRecordBytes < 1024 || maxRecordBytes > 4 * 1024 * 1024) throw new TypeError('media generation maxRecordBytes is invalid');

  type StoredJob = { readonly job: FuryMediaGenerationJob; readonly handle: RecoveryHandle };
  const sessions = new Map<string, FuryMediaGenerationExecutionSession>();
  const providerJobIds = new Map<string, string>();

  const metadataFor = (job: FuryMediaGenerationJob): RecoveryMetadata => ({
    type: 'media-generation-job',
    jobId: job.jobId,
    revision: job.revision,
    status: job.status,
    family: job.family,
    operation: job.operation,
    idempotencyKeyDigestSha256: job.idempotencyKeyDigestSha256,
  });

  const encodeJob = (job: FuryMediaGenerationJob): Uint8Array => {
    const bytes = textBytes(JSON.stringify(job));
    if (bytes.byteLength > maxRecordBytes) throw new Error('durable media job record exceeds its bound');
    return bytes;
  };

  const listManifests = async (metadata: Readonly<Record<string, string | number | boolean | null>>, limit: number): Promise<readonly (RecoveryHandle & { metadata?: RecoveryMetadata })[]> => {
    return store.list!({ metadata, limit });
  };

  const readStored = async (jobId: string): Promise<StoredJob> => {
    if (!JOB_ID.test(jobId)) throw new Error('media job ID is invalid');
    const manifests = await listManifests({ type: 'media-generation-job', jobId }, 8);
    if (manifests.length < 1) throw new Error(`unknown media generation job: ${jobId}`);
    const candidates: StoredJob[] = [];
    for (const handle of manifests) {
      const parsed = parseJob(JSON.parse(new TextDecoder().decode(await store.get(handle))));
      if (parsed.jobId === jobId) candidates.push({ job: parsed, handle });
    }
    const selected = candidates.sort((left, right) => right.job.revision - left.job.revision)[0];
    if (!selected) throw new Error(`unknown media generation job: ${jobId}`);
    return selected;
  };

  const updateStored = async (jobId: string, mutate: (job: FuryMediaGenerationJob) => FuryMediaGenerationJob): Promise<FuryMediaGenerationJob> => {
    const current = await readStored(jobId);
    const candidate = mutate(current.job);
    if (candidate.jobId !== current.job.jobId || candidate.requestDigestSha256 !== current.job.requestDigestSha256 || candidate.planDigestSha256 !== current.job.planDigestSha256 || candidate.idempotencyKeyDigestSha256 !== current.job.idempotencyKeyDigestSha256) {
      throw new Error('media job immutable identity changed');
    }
    if (!JOB_STATUSES.has(candidate.status) || !JOB_TRANSITIONS[current.job.status].has(candidate.status)) {
      throw new Error(`invalid media job status transition: ${current.job.status} -> ${candidate.status}`);
    }
    const updated = freezeJob({
      ...candidate,
      revision: current.job.revision + 1,
      updatedAt: safeNow(nowSource),
    });
    const bytes = encodeJob(updated);
    const oldIdentity = { type: 'media-generation-job', jobId, revision: current.job.revision } as const;
    const matchConstraints = [{ metadata: oldIdentity, minMatches: 1, maxMatches: 1 }] as const;
    await store.compactBounded!(
      bytes,
      metadataFor(updated),
      {
        metadata: { type: 'media-generation-job' },
        maxMatches: maxJobs + 1,
        matchConstraints,
      },
      [{ handle: current.handle, targetMetadata: oldIdentity, matchConstraints }],
    );
    return updated;
  };

  const safeFailure = async (jobId: string, status: FuryMediaGenerationJobStatus, classification: FuryMediaGenerationJobFailureClassification, message: unknown, extra?: Partial<FuryMediaGenerationJob>): Promise<FuryMediaGenerationJob> => {
    return updateStored(jobId, (job) => freezeJob({
      ...job,
      ...extra,
      status,
      failure: failure(classification, message),
    }));
  };

  const adapterFor = (job: FuryMediaGenerationJob): FuryMediaGenerationAdapter => {
    const adapter = options.adapters.get(job.bundleId, job.bundleVersion, job.providerProfileId, job.family);
    if (!adapter || !adapter.supportedModes.includes(job.operation)) throw new Error('exact media generation adapter is unavailable');
    return adapter;
  };

  const contextFor = (job: FuryMediaGenerationJob, signal?: AbortSignal) => Object.freeze({
    family: job.family,
    kind: job.kind,
    mode: job.operation,
    requestDigestSha256: job.requestDigestSha256,
    outputMimeType: job.outputMimeType,
    maxOutputBytes: job.maxOutputBytes,
    maxItems: job.maxItems,
    idempotencyKey: providerKey(job),
    ...(signal === undefined ? {} : { signal }),
  });

  const findByIdempotency = async (digest: string): Promise<StoredJob | undefined> => {
    const manifests = await listManifests({ type: 'media-generation-job', idempotencyKeyDigestSha256: digest }, 8);
    const candidates: StoredJob[] = [];
    for (const handle of manifests) {
      const parsed = parseJob(JSON.parse(new TextDecoder().decode(await store.get(handle))));
      if (parsed.idempotencyKeyDigestSha256 === digest) candidates.push({ job: parsed, handle });
    }
    return candidates.sort((left, right) => right.job.revision - left.job.revision)[0];
  };

  const requestMatches = (left: FuryMediaGenerationJob, execution: FuryMediaGenerationExecutionSession): boolean => {
    const request = execution.request;
    const plan = execution.plan;
    return left.requestDigestSha256 === request.requestDigestSha256
      && left.planDigestSha256 === plan.planDigestSha256
      && left.bundleId === request.bundleId
      && left.bundleVersion === request.bundleVersion
      && left.providerProfileId === request.profileId
      && left.operation === request.mode
      && left.kind === request.kind
      && left.outputMimeType === request.outputMimeType
      && left.inputDigestsSha256.length === request.inputDigestsSha256.length
      && left.inputDigestsSha256.every((digest, index) => digest === request.inputDigestsSha256[index]);
  };

  const persistOutput = async (job: FuryMediaGenerationJob, index: number, output: { readonly bytes: Uint8Array; readonly mimeType: string }): Promise<{ readonly handle: string; readonly mediaSha256: string; readonly byteLength: number }> => {
    const expectedDigest = sha256(output.bytes);
    const existing = await listManifests({ type: 'media-generation-output', jobId: job.jobId, outputIndex: index }, 4);
    if (existing[0]) {
      const bytes = await store.get(existing[0]);
      try {
        if (sha256(bytes) !== expectedDigest || bytes.byteLength !== output.bytes.byteLength) throw new Error('durable output does not match provider result');
      } finally {
        bytes.fill(0);
      }
      return { handle: asHandleString(existing[0]), mediaSha256: expectedDigest, byteLength: output.bytes.byteLength };
    }
    // Recovery is content-addressed. Reuse an already verified immutable
    // object even when another job published the same media bytes first.
    const contentHandle = `furypipe-recovery/v1/sha256/${expectedDigest}`;
    const contentVerification = await store.verify(contentHandle);
    if (contentVerification.exists) {
      const bytes = await store.get(contentHandle);
      try {
        if (sha256(bytes) !== expectedDigest || bytes.byteLength !== output.bytes.byteLength) throw new Error('content-addressed output integrity mismatch');
      } finally {
        bytes.fill(0);
      }
      return { handle: contentHandle, mediaSha256: expectedDigest, byteLength: output.bytes.byteLength };
    }
    const batch = options.mediaCoordinator.ingestBatch([{
      format: FURY_MEDIA_INGESTION_INPUT_FORMAT,
      itemId: `${job.jobId}-${index}`,
      kind: job.kind,
      mimeType: output.mimeType,
      bytes: new Uint8Array(output.bytes),
      source: Object.freeze({
        format: FURY_MEDIA_INGESTION_SOURCE_FORMAT,
        origin: 'provider-output' as const,
        referenceDigestSha256: job.requestDigestSha256,
      }),
    }]);
    const mediaHandle = batch.handles[0];
    if (!mediaHandle) throw new Error('governed media ingestion returned no output handle');
    try {
      const evidence = options.mediaCoordinator.inspect(mediaHandle);
      const bytes = options.mediaCoordinator.readBytes(mediaHandle);
      try {
        const stored = await store.putBounded!(bytes, {
          type: 'media-generation-output',
          jobId: job.jobId,
          outputIndex: index,
          mediaSha256: evidence.mediaSha256,
          mimeType: evidence.mimeType,
          byteLength: evidence.byteCount,
        }, {
          metadata: { type: 'media-generation-output', jobId: job.jobId, outputIndex: index },
          maxMatches: 1,
        });
        return { handle: asHandleString(stored), mediaSha256: evidence.mediaSha256, byteLength: evidence.byteCount };
      } finally {
        bytes.fill(0);
      }
    } finally {
      options.mediaCoordinator.release(mediaHandle);
    }
  };

  const artifactFor = (job: FuryMediaGenerationJob, index: number, stored: { readonly handle: string; readonly mediaSha256: string; readonly byteLength: number }, output: { readonly mimeType: string }): FuryMediaGenerationJobOutputReference => {
    const artifactId = `media_${job.jobId}_${index}`;
    const content = `recovery://${stored.handle}`;
    const existing = options.artifactStore.get(artifactId);
    const artifact = existing ?? options.artifactStore.create({
      id: artifactId,
      kind: job.kind as FuryArtifactKind,
      title: `Fury ${job.kind} ${index + 1}`,
      projectId: options.projectId,
      content,
      mediaType: 'application/vnd.furypipe.media-reference',
      metadata: Object.freeze({
        storageHandle: stored.handle,
        mediaSha256: stored.mediaSha256,
        mimeType: output.mimeType,
        byteCount: String(stored.byteLength),
        requestDigestSha256: job.requestDigestSha256,
      }),
      now: new Date(safeNow(nowSource)).toISOString(),
    });
    const version = artifact.versions.at(-1);
    if (!version || version.content !== content) throw new Error('media artifact reference is inconsistent');
    return Object.freeze({ artifactId, version: version.version, storageHandle: stored.handle, mediaSha256: stored.mediaSha256, mimeType: output.mimeType, byteLength: stored.byteLength });
  };

  const persistReceipt = async (job: FuryMediaGenerationJob, outputs: readonly FuryMediaGenerationJobOutputReference[]): Promise<string> => {
    const existing = await listManifests({ type: 'media-generation-receipt', jobId: job.jobId }, 4);
    if (existing[0]) return asHandleString(existing[0]);
    const receipt = Object.freeze({
      format: FURY_MEDIA_GENERATION_JOB_RECEIPT_FORMAT,
      jobId: job.jobId,
      requestDigestSha256: job.requestDigestSha256,
      planDigestSha256: job.planDigestSha256,
      family: job.family,
      operation: job.operation,
      kind: job.kind,
      outputReferences: outputs,
      providerJobIdDigestSha256: job.providerJobIdDigestSha256 ?? null,
      outcome: 'SUCCEEDED',
      automaticReplayAllowed: false,
    });
    const handle = await store.putBounded!(textBytes(JSON.stringify(receipt)), {
      type: 'media-generation-receipt',
      jobId: job.jobId,
      requestDigestSha256: job.requestDigestSha256,
    }, {
      metadata: { type: 'media-generation-receipt', jobId: job.jobId },
      maxMatches: 1,
    });
    return asHandleString(handle);
  };

  const finalize = async (job: FuryMediaGenerationJob, raw: unknown): Promise<FuryMediaGenerationJob> => {
    let outputs: readonly { readonly bytes: Uint8Array; readonly mimeType: string; readonly durationMs?: number; readonly providerRequestId?: string }[];
    try {
      outputs = normalizeFuryMediaGenerationAdapterResult(raw, {
        outputMimeType: job.outputMimeType,
        supportedMediaTypes: [job.outputMimeType],
        maxItems: job.maxItems,
        maxOutputBytes: job.maxOutputBytes,
        maxDurationMs: job.maxDurationMs,
      });
    } catch (error) {
      zeroAdapterBytes(raw);
      return safeFailure(job.jobId, 'FAILED', 'INVALID_RESULT', error);
    } finally {
      zeroAdapterBytes(raw);
    }
    try {
      const references: FuryMediaGenerationJobOutputReference[] = [];
      for (let index = 0; index < outputs.length; index += 1) {
        const output = outputs[index]!;
        const stored = await persistOutput(job, index, output);
        references.push(artifactFor(job, index, stored, output));
        output.bytes.fill(0);
      }
      const receipt = await persistReceipt(job, references);
      return updateStored(job.jobId, (current) => freezeJob({
        ...current,
        status: 'SUCCEEDED',
        progress: 100,
        outputReferences: Object.freeze(references),
        receiptReferences: Object.freeze([receipt]),
        failure: undefined,
        cancellationOutcome: undefined,
      }));
    } catch (error) {
      for (const output of outputs) output.bytes.fill(0);
      return safeFailure(job.jobId, 'UNKNOWN', 'LOCAL_FINALIZATION_FAILED', error);
    }
  };

  const create = async (input: { readonly execution: FuryMediaGenerationExecutionSession; readonly idempotencyKey?: string }): Promise<FuryMediaGenerationJob> => {
    if (!input || !isGeneratedFuryMediaGenerationExecutionSession(input.execution)) throw new TypeError('generated media execution session is required');
    const seed = validateIdempotencySeed(input.idempotencyKey);
    const request = input.execution.request;
    const plan = input.execution.plan;
    const material = JSON.stringify({
      requestDigestSha256: request.requestDigestSha256,
      profileId: request.profileId,
      operation: request.mode,
      inputDigestsSha256: request.inputDigestsSha256,
      parametersDigestSha256: request.parametersDigestSha256,
      outputMimeType: request.outputMimeType,
      seedDigestSha256: sha256(seed),
    });
    const idempotencyKeyDigestSha256 = sha256(`furypipe-media-generation-job/idempotency/v1\0${material}`);
    const existing = await findByIdempotency(idempotencyKeyDigestSha256);
    if (existing) {
      if (!requestMatches(existing.job, input.execution)) throw new Error('idempotency-key-conflict');
      if (!statusIsTerminal(existing.job.status)) sessions.set(existing.job.jobId, input.execution);
      return existing.job;
    }
    const now = safeNow(nowSource);
    const job = freezeJob({
      format: FURY_MEDIA_GENERATION_JOB_FORMAT,
      jobId: `fpg_job_${randomUUID()}`,
      family: plan.family,
      operation: request.mode,
      kind: request.kind,
      providerProfileId: request.profileId,
      bundleId: request.bundleId,
      bundleVersion: request.bundleVersion,
      outputMimeType: request.outputMimeType,
      promptDigestSha256: request.promptDigestSha256,
      parametersDigestSha256: request.parametersDigestSha256,
      inputDigestsSha256: Object.freeze([...request.inputDigestsSha256]),
      inputKinds: Object.freeze([...request.inputKinds]),
      inputMimeTypes: Object.freeze([...request.inputMimeTypes]),
      inputBytes: request.inputBytes,
      promptBytes: request.promptBytes,
      requestDigestSha256: request.requestDigestSha256,
      planDigestSha256: plan.planDigestSha256,
      idempotencyKeyDigestSha256,
      maxOutputBytes: plan.maxOutputBytes,
      maxItems: plan.maxItems,
      ...(plan.maxDurationMs === undefined ? {} : { maxDurationMs: plan.maxDurationMs }),
      createdAt: now,
      updatedAt: now,
      attempt: 0,
      revision: 1,
      status: 'CREATED',
      outputReferences: Object.freeze([]),
      receiptReferences: Object.freeze([]),
    });
    const bytes = encodeJob(job);
    try {
      await store.putBounded!(bytes, metadataFor(job), {
        metadata: { type: 'media-generation-job' },
        maxMatches: maxJobs,
        additionalBounds: [{ metadata: { type: 'media-generation-job', idempotencyKeyDigestSha256 }, maxMatches: 1 }],
      });
    } catch (error) {
      const duplicate = await findByIdempotency(idempotencyKeyDigestSha256);
      if (!duplicate) throw error;
      if (!requestMatches(duplicate.job, input.execution)) throw new Error('idempotency-key-conflict');
      sessions.set(duplicate.job.jobId, input.execution);
      return duplicate.job;
    }
    sessions.set(job.jobId, input.execution);
    return job;
  };

  const submit = async (jobId: string, executionOptions?: { readonly signal?: AbortSignal }): Promise<FuryMediaGenerationJob> => {
    let current = (await readStored(jobId)).job;
    if (statusIsTerminal(current.status)) return current;
    if (current.status !== 'CREATED') {
      if (current.status === 'UNKNOWN') throw new Error('unknown-outcome-requires-reconcile');
      return current;
    }
    const execution = sessions.get(jobId);
    if (!execution) throw new Error('execution-session-unavailable');
    const adapter = adapterFor(current);
    const signal = executionOptions?.signal;
    if (signal !== undefined && !isAbortSignal(signal)) throw new Error('invalid abort signal');
    if (typeof adapter.submit === 'function') {
      try {
        const submission = await execution.submit(adapter, providerKey(current), { ...(signal === undefined ? {} : { signal }) });
        const normalized = normalizeSubmission(submission);
        providerJobIds.set(jobId, normalized.providerJobId);
        current = await updateStored(jobId, (job) => freezeJob({
          ...job,
          status: normalized.status ?? 'SUBMITTED',
          attempt: job.attempt + 1,
          providerJobIdDigestSha256: sha256(normalized.providerJobId),
          failure: undefined,
        }));
        return current;
      } catch (error) {
        if (error instanceof FuryMediaGenerationError && !error.adapterInvoked) throw error;
        return safeFailure(jobId, 'UNKNOWN', 'SUBMIT_OUTCOME_UNKNOWN', error);
      } finally {
        sessions.delete(jobId);
      }
    }
    if (typeof adapter.execute !== 'function') throw new Error('adapter does not support submit or execute');
    try {
      await updateStored(jobId, (job) => freezeJob({ ...job, status: 'RUNNING', attempt: job.attempt + 1 }));
      const raw = await execution.execute(adapter, { ...(signal === undefined ? {} : { signal }) });
      return finalize(current, raw);
    } catch (error) {
      if (error instanceof FuryMediaGenerationError && !error.adapterInvoked) throw error;
      return safeFailure(jobId, 'UNKNOWN', 'SUBMIT_OUTCOME_UNKNOWN', error);
    } finally {
      sessions.delete(jobId);
    }
  };

  const reconcile = async (jobId: string): Promise<FuryMediaGenerationJob> => {
    let current = (await readStored(jobId)).job;
    if (statusIsTerminal(current.status)) return current;
    const adapter = adapterFor(current);
    if (typeof adapter.reconcile !== 'function') {
      return safeFailure(jobId, 'UNKNOWN', 'PROVIDER_REFERENCE_UNAVAILABLE', 'adapter reconciliation is unavailable');
    }
    try {
      const response = await adapter.reconcile(providerKey(current), contextFor(current));
      if (response === undefined) return safeFailure(jobId, 'UNKNOWN', 'PROVIDER_REFERENCE_UNAVAILABLE', 'provider job reference was not found');
      const submission = normalizeSubmission(response);
      providerJobIds.set(jobId, submission.providerJobId);
      current = await updateStored(jobId, (job) => freezeJob({
        ...job,
        status: submission.status ?? 'SUBMITTED',
        providerJobIdDigestSha256: sha256(submission.providerJobId),
        failure: undefined,
      }));
      return current;
    } catch (error) {
      return safeFailure(jobId, 'UNKNOWN', 'PROVIDER_REFERENCE_UNAVAILABLE', error);
    }
  };

  const poll = async (jobId: string, pollOptions?: { readonly signal?: AbortSignal }): Promise<FuryMediaGenerationJob> => {
    let current = (await readStored(jobId)).job;
    if (statusIsTerminal(current.status) || current.status === 'UNKNOWN' || current.status === 'CREATED') return current;
    const adapter = adapterFor(current);
    if (typeof adapter.poll !== 'function') return safeFailure(jobId, 'UNKNOWN', 'POLL_OUTCOME_UNKNOWN', 'adapter polling is unavailable');
    const signal = pollOptions?.signal;
    if (signal !== undefined && !isAbortSignal(signal)) throw new Error('invalid abort signal');
    let providerJobId = providerJobIds.get(jobId);
    if (!providerJobId) {
      current = await reconcile(jobId);
      if (current.status === 'UNKNOWN' || statusIsTerminal(current.status)) return current;
      providerJobId = providerJobIds.get(jobId);
    }
    if (!providerJobId) return safeFailure(jobId, 'UNKNOWN', 'PROVIDER_REFERENCE_UNAVAILABLE', 'provider job reference is unavailable');
    try {
      const response = normalizePoll(await adapter.poll(providerJobId, contextFor(current, signal)));
      if (response.status === 'FAILED') return safeFailure(jobId, 'FAILED', 'PROVIDER_REPORTED_FAILURE', response.failureClass ?? 'provider reported failure', { progress: response.progress });
      if (response.status === 'CANCELLED') return updateStored(jobId, (job) => freezeJob({ ...job, status: 'CANCELLED', progress: response.progress, cancellationOutcome: 'PROVIDER_CANCEL_CONFIRMED', failure: failure('PROVIDER_CANCEL_CONFIRMED', 'provider reported cancellation') }));
      if (response.status === 'UNKNOWN') return safeFailure(jobId, 'UNKNOWN', 'POLL_OUTCOME_UNKNOWN', response.failureClass ?? 'provider reported unknown state', { progress: response.progress });
      if (response.status === 'SUBMITTED' || response.status === 'QUEUED' || response.status === 'RUNNING') {
        return updateStored(jobId, (job) => freezeJob({ ...job, status: response.status, ...(response.progress === undefined ? {} : { progress: response.progress }) }));
      }
      let raw = response.result;
      if (raw === undefined) {
        if (typeof adapter.fetchResult !== 'function') return safeFailure(jobId, 'UNKNOWN', 'PROVIDER_REFERENCE_UNAVAILABLE', 'provider result is unavailable');
        raw = await adapter.fetchResult(providerJobId, contextFor(current, signal));
      }
      return finalize(current, raw);
    } catch (error) {
      return safeFailure(jobId, 'UNKNOWN', 'POLL_OUTCOME_UNKNOWN', error);
    }
  };

  const pollUntil = async (jobId: string, pollOptions?: {
    readonly maxAttempts?: number;
    readonly maxDurationMs?: number;
    readonly baseDelayMs?: number;
    readonly maxDelayMs?: number;
    readonly signal?: AbortSignal;
  }): Promise<FuryMediaGenerationJob> => {
    const maxAttempts = pollOptions?.maxAttempts ?? 16;
    const maxDurationMs = pollOptions?.maxDurationMs ?? 120_000;
    const baseDelayMs = pollOptions?.baseDelayMs ?? 25;
    const maxDelayMs = pollOptions?.maxDelayMs ?? 2_000;
    if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 256 || !Number.isSafeInteger(maxDurationMs) || maxDurationMs < 1 || maxDurationMs > 600_000 || !Number.isSafeInteger(baseDelayMs) || baseDelayMs < 0 || baseDelayMs > 60_000 || !Number.isSafeInteger(maxDelayMs) || maxDelayMs < baseDelayMs || maxDelayMs > 60_000) throw new Error('poll bounds are invalid');
    const signal = pollOptions?.signal;
    if (signal !== undefined && !isAbortSignal(signal)) throw new Error('invalid abort signal');
    const started = safeNow(nowSource);
    let current = await poll(jobId, { ...(signal === undefined ? {} : { signal }) });
    for (let attempt = 1; attempt < maxAttempts && !statusIsTerminal(current.status) && current.status !== 'UNKNOWN'; attempt += 1) {
      if (signal?.aborted || safeNow(nowSource) - started >= maxDurationMs) return safeFailure(jobId, 'UNKNOWN', 'TIMEOUT', 'bounded polling ended before provider terminal proof');
      const delay = jitteredDelay(jobId, attempt, baseDelayMs, maxDelayMs);
      let waitTimedOut = false;
      await waitBounded(delay, signal).catch(async (error) => {
        current = await safeFailure(jobId, 'UNKNOWN', 'TIMEOUT', error);
        waitTimedOut = true;
      });
      if (waitTimedOut) return current;
      current = await poll(jobId, { ...(signal === undefined ? {} : { signal }) });
    }
    if (!statusIsTerminal(current.status) && current.status !== 'UNKNOWN') return safeFailure(jobId, 'UNKNOWN', 'TIMEOUT', 'poll attempt bound reached');
    return current;
  };

  const cancel = async (jobId: string): Promise<FuryMediaGenerationJob> => {
    let current = (await readStored(jobId)).job;
    if (statusIsTerminal(current.status)) return current;
    if (current.status === 'CREATED') return updateStored(jobId, (job) => freezeJob({ ...job, status: 'CANCELLED', cancellationOutcome: 'LOCAL_CANCELLED', failure: failure('LOCAL_CANCELLED', 'cancelled before dispatch') }));
    if (current.status === 'UNKNOWN') return current;
    const adapter = adapterFor(current);
    let providerJobId = providerJobIds.get(jobId);
    if (!providerJobId && typeof adapter.reconcile === 'function') {
      current = await reconcile(jobId);
      if (current.status === 'UNKNOWN') return updateStored(jobId, (job) => freezeJob({ ...job, cancellationOutcome: 'PROVIDER_STATE_UNKNOWN' }));
      providerJobId = providerJobIds.get(jobId);
    }
    if (!providerJobId) return safeFailure(jobId, 'UNKNOWN', 'PROVIDER_STATE_UNKNOWN', 'provider job reference is unavailable');
    if (typeof adapter.cancel !== 'function') return updateStored(jobId, (job) => freezeJob({ ...job, status: 'CANCELLED', cancellationOutcome: 'PROVIDER_CANCEL_UNSUPPORTED', failure: failure('PROVIDER_CANCEL_UNSUPPORTED', 'provider cancellation is unsupported') }));
    try {
      const result = adapter.cancel(providerJobId, contextFor(current));
      const outcome = (await result).outcome;
      if (!CANCELLATION_OUTCOMES.has(outcome)) throw new Error('adapter cancellation outcome is invalid');
      if (outcome === 'PROVIDER_STATE_UNKNOWN') return safeFailure(jobId, 'UNKNOWN', 'PROVIDER_STATE_UNKNOWN', 'provider cancellation state is unknown', { cancellationOutcome: outcome });
      const classification: FuryMediaGenerationJobFailureClassification = outcome === 'LOCAL_CANCELLED'
        ? 'LOCAL_CANCELLED'
        : outcome === 'PROVIDER_CANCEL_CONFIRMED' ? 'PROVIDER_CANCEL_CONFIRMED' : 'PROVIDER_CANCEL_UNSUPPORTED';
      return updateStored(jobId, (job) => freezeJob({ ...job, status: 'CANCELLED', cancellationOutcome: outcome, failure: failure(classification, `cancellation outcome: ${outcome}`) }));
    } catch (error) {
      return safeFailure(jobId, 'UNKNOWN', 'PROVIDER_STATE_UNKNOWN', error, { cancellationOutcome: 'PROVIDER_STATE_UNKNOWN' });
    }
  };

  const list = async (listOptions?: { readonly status?: FuryMediaGenerationJobStatus; readonly family?: FuryMediaGenerationFamily; readonly limit?: number }): Promise<readonly FuryMediaGenerationJob[]> => {
    const limit = listOptions?.limit ?? maxJobs;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > maxJobs) throw new Error('media job list limit is invalid');
    const filters: Record<string, string> = { type: 'media-generation-job' };
    if (listOptions?.status !== undefined) filters.status = listOptions.status;
    if (listOptions?.family !== undefined) filters.family = listOptions.family;
    const manifests = await listManifests(filters, Math.min(maxJobs, 10_000));
    const byId = new Map<string, StoredJob>();
    for (const handle of manifests) {
      const parsed = parseJob(JSON.parse(new TextDecoder().decode(await store.get(handle))));
      const previous = byId.get(parsed.jobId);
      if (!previous || parsed.revision > previous.job.revision) byId.set(parsed.jobId, { job: parsed, handle });
    }
    return Object.freeze([...byId.values()].sort((left, right) => left.job.createdAt - right.job.createdAt).slice(0, limit).map((entry) => entry.job));
  };

  const recover = async (): Promise<readonly FuryMediaGenerationJob[]> => {
    const active = await list();
    const recovered: FuryMediaGenerationJob[] = [];
    for (const job of active) {
      if (job.status === 'UNKNOWN') {
        recovered.push(await reconcile(job.jobId));
      } else if (job.status === 'SUBMITTED' || job.status === 'QUEUED' || job.status === 'RUNNING') {
        const reconciled = await reconcile(job.jobId);
        recovered.push(reconciled.status === 'UNKNOWN' ? reconciled : await poll(job.jobId));
      } else {
        recovered.push(job);
      }
    }
    return Object.freeze(recovered);
  };

  return Object.freeze({
    create,
    get: async (jobId: string) => (await readStored(jobId)).job,
    list,
    submit,
    poll,
    pollUntil,
    reconcile,
    cancel,
    recover,
  });
}
