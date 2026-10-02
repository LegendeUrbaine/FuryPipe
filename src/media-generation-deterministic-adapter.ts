import { createHash } from 'node:crypto';

import type {
  FuryMediaGenerationAdapter,
  FuryMediaGenerationAdapterCapabilities,
  FuryMediaGenerationAdapterCancellation,
  FuryMediaGenerationAdapterContext,
  FuryMediaGenerationAdapterInput,
  FuryMediaGenerationAdapterPoll,
  FuryMediaGenerationAdapterSubmission,
  FuryMediaGenerationFamily,
  FuryMediaGenerationMode,
} from './media-generation-runtime.js';

export interface FuryDeterministicMediaProviderJob {
  readonly providerJobId: string;
  readonly idempotencyKey: string;
  readonly outputMimeType: string;
  readonly outputBytes: Uint8Array;
  readonly fail: boolean;
  readonly failureClass: string;
  readonly queuePolls: number;
  readonly runningPolls: number;
  readonly returnResultInPoll: boolean;
  polls: number;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
}

export interface FuryDeterministicMediaProviderState {
  readonly jobs: Map<string, FuryDeterministicMediaProviderJob>;
  submitCount: number;
  pollCount: number;
  cancelCount: number;
}

export interface FuryDeterministicMediaGenerationAdapterOptions {
  readonly bundleId: string;
  readonly bundleVersion: string;
  readonly profileId: string;
  readonly family: FuryMediaGenerationFamily;
  readonly supportedModes: readonly FuryMediaGenerationMode[];
  readonly outputMimeType: string;
  readonly outputBytes?: Uint8Array;
  readonly state?: FuryDeterministicMediaProviderState;
  readonly queuePolls?: number;
  readonly runningPolls?: number;
  readonly fail?: boolean;
  readonly failureClass?: string;
  readonly returnResultInPoll?: boolean;
  readonly submitOutcomeUnknown?: boolean;
  readonly cancelOutcome?: FuryMediaGenerationAdapterCancellation['outcome'];
}

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

function providerDigest(value: string): string {
  return createHash('sha256').update('furypipe-deterministic-media-provider/v1\0').update(value).digest('hex');
}

function providerJobId(idempotencyKey: string): string {
  return `deterministic_${providerDigest(idempotencyKey).slice(0, 48)}`;
}

function boundedPolls(value: number | undefined): number {
  const resolved = value ?? 1;
  if (!Number.isSafeInteger(resolved) || resolved < 0 || resolved > 32) throw new TypeError('deterministic provider poll count is invalid');
  return resolved;
}

export function createFuryDeterministicMediaGenerationAdapter(
  options: FuryDeterministicMediaGenerationAdapterOptions,
): FuryMediaGenerationAdapter {
  if (!options || typeof options !== 'object' || !ID.test(options.bundleId) || typeof options.bundleVersion !== 'string' || options.bundleVersion.length < 1 || options.bundleVersion.length > 64 || !ID.test(options.profileId) || !Array.isArray(options.supportedModes) || options.supportedModes.length < 1 || typeof options.outputMimeType !== 'string' || !/^[a-z0-9][a-z0-9!#$&^_.+-]{0,63}\/([a-z0-9][a-z0-9!#$&^_.+-]{0,127})$/u.test(options.outputMimeType)) {
    throw new TypeError('deterministic media adapter identity is invalid');
  }
  const state: FuryDeterministicMediaProviderState = options.state ?? { jobs: new Map(), submitCount: 0, pollCount: 0, cancelCount: 0 };
  if (!(state.jobs instanceof Map)) throw new TypeError('deterministic media provider state is invalid');
  const queuePolls = boundedPolls(options.queuePolls);
  const runningPolls = boundedPolls(options.runningPolls);
  const outputBytes = new Uint8Array(options.outputBytes ?? Uint8Array.from([0x46, 0x55, 0x52, 0x59]));
  if (outputBytes.byteLength < 1 || outputBytes.byteLength > 2 ** 20) throw new TypeError('deterministic media output is invalid');
  const failureClass = options.failureClass ?? 'DETERMINISTIC_PROVIDER_FAILURE';
  if (failureClass.length < 1 || failureClass.length > 128 || /[\u0000-\u001f\u007f]/u.test(failureClass)) throw new TypeError('deterministic provider failure class is invalid');
  const supportedModes = Object.freeze([...options.supportedModes]);
  const capabilities: FuryMediaGenerationAdapterCapabilities = Object.freeze({
    synchronous: false,
    asynchronous: true,
    supportsPolling: true,
    supportsCancellation: true,
    supportsIdempotencyKey: true,
    supportedOperations: supportedModes,
    supportedMimeTypes: Object.freeze([options.outputMimeType]),
    limits: Object.freeze({ maxInputBytes: 2 ** 20, maxOutputBytes: 2 ** 20, maxItems: 8, maxDurationMs: 10 * 60_000 }),
  });

  const jobFor = (providerJobId: string): FuryDeterministicMediaProviderJob => {
    for (const job of state.jobs.values()) if (job.providerJobId === providerJobId) return job;
    throw new Error('deterministic provider job was not found');
  };

  const resultFor = (job: FuryDeterministicMediaProviderJob) => ({
    outputs: [{ bytes: new Uint8Array(job.outputBytes), mimeType: job.outputMimeType, providerRequestId: job.providerJobId }],
  });

  return Object.freeze({
    bundleId: options.bundleId,
    bundleVersion: options.bundleVersion,
    profileId: options.profileId,
    family: options.family,
    supportedModes,
    capabilities,
    async submit(_input: FuryMediaGenerationAdapterInput, context: FuryMediaGenerationAdapterContext): Promise<FuryMediaGenerationAdapterSubmission> {
      if (!context.idempotencyKey) throw new Error('deterministic provider requires idempotency key');
      const existing = state.jobs.get(context.idempotencyKey);
      if (existing) return Object.freeze({ providerJobId: existing.providerJobId, status: existing.status === 'QUEUED' ? 'QUEUED' : existing.status === 'RUNNING' ? 'RUNNING' : 'SUBMITTED' });
      const providerJob: FuryDeterministicMediaProviderJob = {
        providerJobId: providerJobId(context.idempotencyKey),
        idempotencyKey: context.idempotencyKey,
        outputMimeType: context.outputMimeType,
        outputBytes: new Uint8Array(outputBytes),
        fail: options.fail === true,
        failureClass,
        queuePolls,
        runningPolls,
        returnResultInPoll: options.returnResultInPoll === true,
        polls: 0,
        status: 'QUEUED',
      };
      state.jobs.set(context.idempotencyKey, providerJob);
      state.submitCount += 1;
      if (options.submitOutcomeUnknown === true) throw new Error('deterministic provider accepted job before response');
      return Object.freeze({ providerJobId: providerJob.providerJobId, status: 'QUEUED' });
    },
    async poll(providerId: string, _context: FuryMediaGenerationAdapterContext): Promise<FuryMediaGenerationAdapterPoll> {
      const job = jobFor(providerId);
      state.pollCount += 1;
      if (job.status === 'CANCELLED') return Object.freeze({ status: 'CANCELLED' });
      if (job.status === 'FAILED') return Object.freeze({ status: 'FAILED', failureClass: job.failureClass });
      if (job.status === 'SUCCEEDED') return Object.freeze({ status: 'SUCCEEDED', ...(job.returnResultInPoll ? { result: resultFor(job) } : {}) });
      job.polls += 1;
      if (job.fail) {
        job.status = 'FAILED';
        return Object.freeze({ status: 'FAILED', failureClass: job.failureClass });
      }
      if (job.polls <= job.queuePolls) return Object.freeze({ status: 'QUEUED', progress: Math.min(50, job.polls * 10) });
      if (job.polls <= job.queuePolls + job.runningPolls) {
        job.status = 'RUNNING';
        return Object.freeze({ status: 'RUNNING', progress: Math.min(90, 50 + (job.polls - job.queuePolls) * 10) });
      }
      job.status = 'SUCCEEDED';
      return Object.freeze({ status: 'SUCCEEDED', ...(job.returnResultInPoll ? { result: resultFor(job) } : {}) });
    },
    async fetchResult(providerId: string, _context: FuryMediaGenerationAdapterContext): Promise<unknown> {
      const job = jobFor(providerId);
      if (job.status !== 'SUCCEEDED') throw new Error('deterministic provider result is not ready');
      return resultFor(job);
    },
    async reconcile(idempotencyKey: string, _context: FuryMediaGenerationAdapterContext): Promise<FuryMediaGenerationAdapterSubmission | undefined> {
      const job = state.jobs.get(idempotencyKey);
      if (!job) return undefined;
      return Object.freeze({ providerJobId: job.providerJobId, status: job.status === 'QUEUED' ? 'QUEUED' : job.status === 'RUNNING' ? 'RUNNING' : 'SUBMITTED' });
    },
    async cancel(providerId: string, _context: FuryMediaGenerationAdapterContext): Promise<FuryMediaGenerationAdapterCancellation> {
      const job = jobFor(providerId);
      state.cancelCount += 1;
      const outcome = options.cancelOutcome ?? 'PROVIDER_CANCEL_CONFIRMED';
      if (outcome === 'PROVIDER_CANCEL_CONFIRMED') job.status = 'CANCELLED';
      return Object.freeze({ outcome });
    },
  });
}
