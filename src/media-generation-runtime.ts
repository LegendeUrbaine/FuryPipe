import { createHash, randomUUID } from 'node:crypto';

import type { FuryArtifactKind, FuryArtifactStore } from './fury-artifacts.js';
import {
  FURY_MEDIA_INGESTION_INPUT_FORMAT,
  FURY_MEDIA_INGESTION_SOURCE_FORMAT,
  isGeneratedFuryMediaIngestionCoordinator,
  isGeneratedFuryMediaIngestionHandle,
  type FuryMediaIngestionCoordinator,
  type FuryMediaIngestionEvidence,
  type FuryMediaIngestionHandle,
  type FuryMediaKind,
} from './media-ingestion.js';
import type {
  FuryMediaCapabilityFamily,
  FuryMediaPluginBundle,
  FuryMediaPluginPermission,
  FuryMediaPluginProfile,
} from './media-plugin-contracts.js';

export const FURY_MEDIA_GENERATION_REQUEST_FORMAT = 'furypipe-media-generation-request/v1' as const;
export const FURY_MEDIA_GENERATION_PLAN_FORMAT = 'furypipe-media-generation-plan/v1' as const;
export const FURY_MEDIA_GENERATION_APPROVAL_FORMAT = 'furypipe-media-generation-approval/v1' as const;
export const FURY_MEDIA_GENERATION_PERMIT_FORMAT = 'furypipe-media-generation-permit/v1' as const;
export const FURY_MEDIA_GENERATION_RECEIPT_FORMAT = 'furypipe-media-generation-receipt/v1' as const;
export const FURY_MEDIA_GENERATION_PROVENANCE_FORMAT = 'furypipe-media-generation-provenance/v1' as const;
export const FURY_MEDIA_GENERATION_RESULT_FORMAT = 'furypipe-media-generation-result/v1' as const;

export type FuryMediaGenerationKind = 'image' | 'audio' | 'video';
export type FuryMediaGenerationFamily = Extract<
  FuryMediaCapabilityFamily,
  'image-generation' | 'audio-generation' | 'video-generation'
>;
export type FuryMediaGenerationMode =
  | 'text-to-image'
  | 'image-to-image'
  | 'inpaint'
  | 'outpaint'
  | 'variation'
  | 'upscale'
  | 'background-editing'
  | 'text-to-audio'
  | 'audio-to-audio'
  | 'voice-generation'
  | 'sound-effect'
  | 'text-to-video'
  | 'image-to-video'
  | 'video-to-video'
  | 'continue-video'
  | 'lip-sync';

export type FuryMediaGenerationParameterValue = string | number | boolean;
export type FuryMediaGenerationParameters = Readonly<Record<string, FuryMediaGenerationParameterValue>>;

export interface FuryMediaGenerationRequest {
  readonly format: typeof FURY_MEDIA_GENERATION_REQUEST_FORMAT;
  readonly requestId: string;
  readonly kind: FuryMediaGenerationKind;
  readonly mode: FuryMediaGenerationMode;
  readonly bundleId: string;
  readonly bundleVersion: string;
  readonly profileId: string;
  readonly outputMimeType: string;
  readonly promptDigestSha256: string;
  readonly promptBytes: number;
  readonly parametersDigestSha256: string;
  readonly inputDigestsSha256: readonly string[];
  readonly inputKinds: readonly FuryMediaKind[];
  readonly inputMimeTypes: readonly string[];
  readonly inputBytes: number;
  readonly requestDigestSha256: string;
  readonly authority: 'media-generation-request-evidence-only';
  readonly executionAuthority: false;
}

export interface FuryMediaGenerationPlan {
  readonly format: typeof FURY_MEDIA_GENERATION_PLAN_FORMAT;
  readonly planId: string;
  readonly planDigestSha256: string;
  readonly requestDigestSha256: string;
  readonly kind: FuryMediaGenerationKind;
  readonly mode: FuryMediaGenerationMode;
  readonly family: FuryMediaGenerationFamily;
  readonly bundleId: string;
  readonly bundleVersion: string;
  readonly profileId: string;
  readonly outputMimeType: string;
  readonly maxOutputBytes: number;
  readonly maxItems: number;
  readonly maxDurationMs?: number;
  readonly inputCount: number;
  readonly requiresApproval: true;
  readonly selectionAuthority: false;
  readonly executionAuthority: false;
}

export interface FuryMediaGenerationApproval {
  readonly format: typeof FURY_MEDIA_GENERATION_APPROVAL_FORMAT;
  readonly approvalId: string;
  readonly allowGeneration: true;
  readonly requestDigestSha256: string;
  readonly planDigestSha256: string;
  readonly kind: FuryMediaGenerationKind;
  readonly mode: FuryMediaGenerationMode;
  readonly bundleId: string;
  readonly bundleVersion: string;
  readonly profileId: string;
  readonly outputMimeType: string;
  readonly expiresInMs: number;
  readonly authority: 'media-generation-approval-decision';
  readonly executionAuthority: false;
}

export interface FuryMediaGenerationPermit {
  readonly format: typeof FURY_MEDIA_GENERATION_PERMIT_FORMAT;
  readonly permitId: string;
  readonly approvalId: string;
  readonly requestDigestSha256: string;
  readonly planDigestSha256: string;
  readonly kind: FuryMediaGenerationKind;
  readonly mode: FuryMediaGenerationMode;
  readonly bundleId: string;
  readonly bundleVersion: string;
  readonly profileId: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly automaticReplayAllowed: false;
  readonly executionAuthority: false;
}

export interface FuryMediaGenerationAdapterMediaInput {
  readonly kind: FuryMediaKind;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
}

export interface FuryMediaGenerationAdapterInput {
  readonly prompt: string;
  readonly parameters: FuryMediaGenerationParameters;
  readonly inputs: readonly FuryMediaGenerationAdapterMediaInput[];
}

export interface FuryMediaGenerationAdapterContext {
  readonly family: FuryMediaGenerationFamily;
  readonly kind: FuryMediaGenerationKind;
  readonly mode: FuryMediaGenerationMode;
  readonly requestDigestSha256: string;
  readonly outputMimeType: string;
  readonly maxOutputBytes: number;
  readonly maxItems: number;
  readonly signal?: AbortSignal;
}

export interface FuryMediaGenerationAdapter {
  readonly bundleId: string;
  readonly bundleVersion: string;
  readonly profileId: string;
  readonly family: FuryMediaGenerationFamily;
  readonly supportedModes: readonly FuryMediaGenerationMode[];
  execute(input: FuryMediaGenerationAdapterInput, context: FuryMediaGenerationAdapterContext): Promise<unknown>;
}

export interface FuryMediaGenerationAdapterOutput {
  readonly bytes: Uint8Array;
  readonly mimeType: string;
  readonly durationMs?: number;
  readonly providerRequestId?: string;
}

export interface FuryMediaGenerationAdapterResult {
  readonly outputs: readonly FuryMediaGenerationAdapterOutput[];
}

export interface FuryMediaGenerationAdapterRegistry {
  get(
    bundleId: string,
    bundleVersion: string,
    profileId: string,
    family: FuryMediaGenerationFamily,
  ): FuryMediaGenerationAdapter | undefined;
}

export interface FuryMediaGenerationArtifactReference {
  readonly artifactId: string;
  readonly version: number;
  readonly kind: FuryArtifactKind;
  readonly sourceMimeType: string;
  readonly mediaType: string;
  readonly mediaSha256: string;
  readonly contentSha256: string;
  readonly byteLength: number;
  readonly storage: 'base64' | 'digest-only';
}

export interface FuryMediaGenerationReceipt {
  readonly format: typeof FURY_MEDIA_GENERATION_RECEIPT_FORMAT;
  readonly requestDigestSha256: string;
  readonly planDigestSha256: string;
  readonly approvalIdSha256: string;
  readonly permitIdSha256: string;
  readonly kind: FuryMediaGenerationKind;
  readonly mode: FuryMediaGenerationMode;
  readonly bundleId: string;
  readonly bundleVersion: string;
  readonly profileId: string;
  readonly startedAt: number;
  readonly finishedAt?: number;
  readonly outcome: 'succeeded';
  readonly outputCount: number;
  readonly outputMediaSha256: readonly string[];
  readonly artifactIds: readonly string[];
  readonly providerRequestIdsSha256: readonly (string | null)[];
  readonly providerResult: 'adapter-reported-unverified';
  readonly executionAuthority: false;
  readonly automaticReplayAllowed: false;
}

export interface FuryMediaGenerationProvenance {
  readonly format: typeof FURY_MEDIA_GENERATION_PROVENANCE_FORMAT;
  readonly requestDigestSha256: string;
  readonly kind: FuryMediaGenerationKind;
  readonly mode: FuryMediaGenerationMode;
  readonly bundleId: string;
  readonly bundleVersion: string;
  readonly profileId: string;
  readonly profileSourceDigestSha256: string;
  readonly inputMediaSha256: readonly string[];
  readonly inputProvenanceDigestSha256: readonly string[];
  readonly outputMediaSha256: readonly string[];
  readonly outputProvenanceDigestSha256: readonly string[];
  readonly artifactIds: readonly string[];
  readonly contentTrust: 'untrusted-media-content';
  readonly instructionAuthority: false;
  readonly providerCompatibility: 'not-evaluated';
  readonly executionAuthority: false;
  readonly automaticReplayAllowed: false;
}

export interface FuryMediaGenerationResult {
  readonly format: typeof FURY_MEDIA_GENERATION_RESULT_FORMAT;
  readonly kind: FuryMediaGenerationKind;
  readonly mode: FuryMediaGenerationMode;
  readonly outputHandles: readonly FuryMediaIngestionHandle[];
  readonly artifactReferences: readonly FuryMediaGenerationArtifactReference[];
  readonly receipt: FuryMediaGenerationReceipt;
  readonly provenance: FuryMediaGenerationProvenance;
  readonly executionAuthority: false;
  readonly automaticReplayAllowed: false;
}

export interface FuryMediaGenerationPrepareInput {
  readonly bundle: FuryMediaPluginBundle;
  readonly profileId: string;
  readonly mediaCoordinator: FuryMediaIngestionCoordinator;
  readonly kind: FuryMediaGenerationKind;
  readonly mode: FuryMediaGenerationMode;
  readonly prompt: string;
  readonly parameters?: Readonly<Record<string, unknown>>;
  readonly inputs?: readonly FuryMediaIngestionHandle[];
  readonly outputMimeType: string;
}

export interface FuryMediaGenerationCoordinatorOptions {
  readonly adapters: FuryMediaGenerationAdapterRegistry;
  readonly mediaCoordinator: FuryMediaIngestionCoordinator;
  readonly artifactStore: FuryArtifactStore;
  readonly projectId: string;
  readonly now?: () => number;
  readonly maxHealthAgeMs?: number;
  readonly maxPermitTtlMs?: number;
}

export interface FuryMediaGenerationCoordinator {
  prepare(input: FuryMediaGenerationPrepareInput): FuryMediaGenerationRequest;
  plan(request: FuryMediaGenerationRequest): FuryMediaGenerationPlan;
  authorize(request: FuryMediaGenerationRequest, plan: FuryMediaGenerationPlan, approval: FuryMediaGenerationApproval): FuryMediaGenerationPermit;
  execute(
    request: FuryMediaGenerationRequest,
    plan: FuryMediaGenerationPlan,
    permit: FuryMediaGenerationPermit,
    options?: { readonly signal?: AbortSignal },
  ): Promise<FuryMediaGenerationResult>;
}

export type FuryMediaGenerationErrorCode =
  | 'invalid-config'
  | 'invalid-input'
  | 'profile-not-found'
  | 'profile-not-eligible'
  | 'profile-health-not-fresh'
  | 'mode-not-supported'
  | 'media-input-invalid'
  | 'media-type-not-supported'
  | 'input-limit'
  | 'execution-not-authorized'
  | 'plan-request-mismatch'
  | 'approval-not-authorized'
  | 'permit-request-mismatch'
  | 'permit-expired'
  | 'permit-already-consumed'
  | 'adapter-not-registered'
  | 'adapter-mode-not-supported'
  | 'adapter-result-invalid'
  | 'output-limit'
  | 'adapter-error'
  | 'ingestion-failed'
  | 'artifact-failed';

export class FuryMediaGenerationError extends Error {
  readonly retrySafe = false;
  constructor(
    readonly code: FuryMediaGenerationErrorCode,
    message: string,
    readonly adapterInvoked: boolean,
    readonly outcome: 'not-started' | 'unknown',
  ) {
    super(message);
    this.name = 'FuryMediaGenerationError';
  }
}

interface RequestState {
  readonly coordinator: FuryMediaGenerationCoordinator;
  readonly request: FuryMediaGenerationRequest;
  readonly bundle: FuryMediaPluginBundle;
  readonly profile: FuryMediaPluginProfile;
  readonly prompt: string;
  readonly parameters: FuryMediaGenerationParameters;
  readonly mediaCoordinator: FuryMediaIngestionCoordinator;
  readonly inputHandles: readonly FuryMediaIngestionHandle[];
  readonly inputEvidence: readonly FuryMediaIngestionEvidence[];
}

interface PlanState {
  readonly coordinator: FuryMediaGenerationCoordinator;
  readonly plan: FuryMediaGenerationPlan;
  readonly request: FuryMediaGenerationRequest;
}

interface PermitState {
  readonly coordinator: FuryMediaGenerationCoordinator;
  readonly permit: FuryMediaGenerationPermit;
  readonly request: FuryMediaGenerationRequest;
  readonly plan: FuryMediaGenerationPlan;
  consumed: boolean;
}

interface NormalizedAdapterOutput {
  readonly bytes: Uint8Array;
  readonly mimeType: string;
  readonly providerRequestId?: string;
}

const REQUEST_STATE = new WeakMap<object, RequestState>();
const PLAN_STATE = new WeakMap<object, PlanState>();
const PERMIT_STATE = new WeakMap<object, PermitState>();
const GENERATED_RESULTS = new WeakSet<object>();
const GENERATED_ADAPTER_REGISTRIES = new WeakSet<object>();
const GENERATED_COORDINATORS = new WeakSet<object>();

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const MIME = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,63}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,127}$/u;
const PARAMETER_KEY = /^[A-Za-z][A-Za-z0-9._:-]{0,63}$/u;
const MAX_PROMPT_BYTES = 1_048_576;
const MAX_PARAMETERS = 32;
const MAX_PARAMETER_BYTES = 16_384;
const MAX_ADAPTERS = 128;
const MAX_SUPPORTED_MODES = 32;
const DEFAULT_HEALTH_AGE_MS = 60_000;
const HARD_HEALTH_AGE_MS = 5 * 60_000;
const DEFAULT_PERMIT_TTL_MS = 30_000;
const HARD_PERMIT_TTL_MS = 60_000;
const MAX_ARTIFACT_CONTENT_CHARS = 4 * 1024 * 1024;

const FAMILY_BY_KIND: Readonly<Record<FuryMediaGenerationKind, FuryMediaGenerationFamily>> = Object.freeze({
  image: 'image-generation',
  audio: 'audio-generation',
  video: 'video-generation',
});

const MODE_FAMILY: Readonly<Record<FuryMediaGenerationMode, FuryMediaGenerationFamily>> = Object.freeze({
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

const MODE_INPUT_KINDS: Readonly<Record<FuryMediaGenerationMode, readonly FuryMediaKind[]>> = Object.freeze({
  'text-to-image': Object.freeze([] as FuryMediaKind[]),
  'image-to-image': Object.freeze(['image'] as FuryMediaKind[]),
  inpaint: Object.freeze(['image'] as FuryMediaKind[]),
  outpaint: Object.freeze(['image'] as FuryMediaKind[]),
  variation: Object.freeze(['image'] as FuryMediaKind[]),
  upscale: Object.freeze(['image'] as FuryMediaKind[]),
  'background-editing': Object.freeze(['image'] as FuryMediaKind[]),
  'text-to-audio': Object.freeze([] as FuryMediaKind[]),
  'audio-to-audio': Object.freeze(['audio'] as FuryMediaKind[]),
  'voice-generation': Object.freeze([] as FuryMediaKind[]),
  'sound-effect': Object.freeze([] as FuryMediaKind[]),
  'text-to-video': Object.freeze([] as FuryMediaKind[]),
  'image-to-video': Object.freeze(['image'] as FuryMediaKind[]),
  'video-to-video': Object.freeze(['video'] as FuryMediaKind[]),
  'continue-video': Object.freeze(['video'] as FuryMediaKind[]),
  'lip-sync': Object.freeze(['video', 'audio'] as FuryMediaKind[]),
});

const KINDS = new Set<FuryMediaGenerationKind>(['image', 'audio', 'video']);
const FAMILIES = new Set<FuryMediaGenerationFamily>(['image-generation', 'audio-generation', 'video-generation']);
const MODES = new Set<FuryMediaGenerationMode>(Object.keys(MODE_FAMILY) as FuryMediaGenerationMode[]);

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function digest(label: string, value: string): string {
  return createHash('sha256').update('furypipe-media-generation/v1\0').update(label).update('\0').update(value).digest('hex');
}

function fail(code: FuryMediaGenerationErrorCode, message: string, adapterInvoked = false): never {
  throw new FuryMediaGenerationError(code, message, adapterInvoked, adapterInvoked ? 'unknown' : 'not-started');
}

function plainRecord(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('invalid-input', `${label} must be a plain data object`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail('invalid-input', `${label} must use a plain-object prototype`);
  if (Object.getOwnPropertySymbols(value).length !== 0) fail('invalid-input', `${label} must not contain symbol keys`);
  for (const key of Object.getOwnPropertyNames(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) fail('invalid-input', `${label} must contain enumerable data properties only`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(record: Readonly<Record<string, unknown>>, allowed: readonly string[], required: readonly string[], label: string): void {
  const accepted = new Set(allowed);
  for (const key of Object.keys(record)) if (!accepted.has(key)) fail('invalid-input', `${label} contains unsupported field: ${key}`);
  for (const key of required) if (!Object.prototype.hasOwnProperty.call(record, key)) fail('invalid-input', `${label} is missing required field: ${key}`);
}

function boundedInteger(value: number | undefined, fallback: number, min: number, max: number, label: string): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < min || resolved > max) fail('invalid-config', `${label} must be between ${min} and ${max}`);
  return resolved;
}

function safeNow(source: () => number): number {
  let now: number;
  try { now = source(); } catch { fail('invalid-input', 'media generation clock failed'); }
  if (!Number.isSafeInteger(now) || now < 0) fail('invalid-input', 'media generation clock is invalid');
  return now;
}

function safeOptionalFinish(source: () => number, startedAt: number): number | undefined {
  try {
    const value = source();
    return Number.isSafeInteger(value) && value >= startedAt ? value : undefined;
  } catch {
    return undefined;
  }
}

function exactId(value: unknown, label: string): string {
  if (typeof value !== 'string' || !ID.test(value)) fail('invalid-input', `${label} is invalid`);
  return value;
}

function normalizePrompt(value: unknown, profile: FuryMediaPluginProfile): { readonly prompt: string; readonly bytes: number } {
  if (typeof value !== 'string' || value.length < 1 || value.includes('\0')) fail('invalid-input', 'generation prompt must be non-empty text without NUL');
  const bytes = new TextEncoder().encode(value).byteLength;
  if (bytes > Math.min(MAX_PROMPT_BYTES, profile.bounds.maxInputBytes)) fail('input-limit', 'generation prompt exceeds profile input bound');
  return Object.freeze({ prompt: value, bytes });
}

function normalizeParameters(value: Readonly<Record<string, unknown>> | undefined): FuryMediaGenerationParameters {
  if (value === undefined) return Object.freeze({});
  const record = plainRecord(value, 'generation parameters');
  const entries = Object.entries(record);
  if (entries.length > MAX_PARAMETERS) fail('invalid-input', `generation parameters exceed ${MAX_PARAMETERS} entries`);
  const normalized: Record<string, FuryMediaGenerationParameterValue> = {};
  for (const [key, candidate] of entries) {
    if (!PARAMETER_KEY.test(key)) fail('invalid-input', 'generation parameter key is invalid');
    if (typeof candidate === 'string') {
      if (candidate.length > 512 || candidate.includes('\0')) fail('invalid-input', 'generation parameter text is invalid');
      normalized[key] = candidate;
    } else if (typeof candidate === 'number') {
      if (!Number.isFinite(candidate) || Math.abs(candidate) > 1_000_000_000) fail('invalid-input', 'generation parameter number is invalid');
      normalized[key] = candidate;
    } else if (typeof candidate === 'boolean') {
      normalized[key] = candidate;
    } else {
      fail('invalid-input', 'generation parameters must contain only scalar values');
    }
  }
  const sorted = Object.fromEntries(Object.entries(normalized).sort(([left], [right]) => left.localeCompare(right)));
  const encoded = JSON.stringify(sorted);
  if (encoded.length > MAX_PARAMETER_BYTES) fail('input-limit', 'generation parameters exceed their byte bound');
  return Object.freeze(sorted) as FuryMediaGenerationParameters;
}

function profileFor(bundle: FuryMediaPluginBundle, profileId: string, family: FuryMediaGenerationFamily, inputRequired: boolean): FuryMediaPluginProfile {
  plainRecord(bundle, 'media plugin bundle');
  if (
    bundle.authority !== 'plugin-contract-only'
    || bundle.executionAuthority !== false
    || bundle.automaticExecutionAllowed !== false
    || !Array.isArray(bundle.profiles)
  ) {
    fail('profile-not-eligible', 'validated media plugin bundle observation is required');
  }
  exactId(profileId, 'profileId');
  const profile = bundle.profiles.find((candidate) => candidate.id === profileId);
  if (!profile) fail('profile-not-found', 'generation profile is not present in the selected bundle');
  if (profile.bundleId !== bundle.id || profile.bundleVersion !== bundle.version) fail('profile-not-eligible', 'profile bundle binding is invalid');
  if (
    profile.lifecycle !== 'registered'
    || profile.authority !== 'profile-observation-only'
    || profile.executionAuthority !== false
    || profile.selectionAuthority !== false
  ) {
    fail('profile-not-eligible', 'generation profile lifecycle is not eligible');
  }
  if (profile.family !== family) fail('profile-not-eligible', 'generation profile family does not match the requested kind');
  const required: readonly FuryMediaPluginPermission[] = inputRequired ? ['media-read', 'media-write'] : ['media-write'];
  const allowed = new Set(required);
  if (!required.every((permission: FuryMediaPluginPermission) => profile.permissions.includes(permission)) || profile.permissions.some((permission: FuryMediaPluginPermission) => !allowed.has(permission))) {
    fail('profile-not-eligible', 'generation profile permissions are not least-privilege for this operation');
  }
  if (profile.bounds.maxItems < 1 || profile.bounds.maxOutputBytes < 1 || profile.bounds.maxInputBytes < 1) {
    fail('profile-not-eligible', 'generation profile bounds are invalid');
  }
  return profile;
}

function requestDigest(payload: Readonly<Record<string, unknown>>): string {
  return digest('request', JSON.stringify(payload));
}

function planDigest(payload: Readonly<Record<string, unknown>>): string {
  return digest('plan', JSON.stringify(payload));
}

function validateAbortSignal(value: unknown): AbortSignal {
  if (
    typeof value !== 'object'
    || value === null
    || typeof (value as { readonly aborted?: unknown }).aborted !== 'boolean'
    || typeof (value as { readonly addEventListener?: unknown }).addEventListener !== 'function'
  ) {
    fail('invalid-input', 'AbortSignal is invalid');
  }
  return value as AbortSignal;
}

function releaseAll(coordinator: FuryMediaIngestionCoordinator, handles: readonly FuryMediaIngestionHandle[]): void {
  for (const handle of handles) {
    try { coordinator.release(handle); } catch { /* already terminal; preserve original failure */ }
  }
}

function zeroAdapterBytes(raw: unknown): void {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
  const outputs = (raw as { readonly outputs?: unknown }).outputs;
  if (!Array.isArray(outputs)) return;
  for (const output of outputs) {
    if (!output || typeof output !== 'object' || Array.isArray(output)) continue;
    const bytes = (output as { readonly bytes?: unknown }).bytes;
    if (bytes instanceof Uint8Array) bytes.fill(0);
  }
}

function normalizeAdapterResult(raw: unknown, state: RequestState, plan: FuryMediaGenerationPlan): NormalizedAdapterOutput[] {
  let record: Readonly<Record<string, unknown>>;
  try {
    record = plainRecord(raw, 'media generation adapter result');
    exactKeys(record, ['outputs'], ['outputs'], 'media generation adapter result');
  } catch {
    fail('adapter-result-invalid', 'media generation adapter result must contain only bounded output data', true);
  }
  if (!Array.isArray(record.outputs) || record.outputs.length < 1 || record.outputs.length > plan.maxItems) {
    fail('output-limit', 'media generation output item count exceeds its bound', true);
  }
  const normalized: NormalizedAdapterOutput[] = [];
  let totalBytes = 0;
  for (const rawOutput of record.outputs) {
    let output: Readonly<Record<string, unknown>>;
    try {
      output = plainRecord(rawOutput, 'media generation adapter output');
      exactKeys(output, ['bytes', 'mimeType', 'durationMs', 'providerRequestId'], ['bytes', 'mimeType'], 'media generation adapter output');
    } catch {
      fail('adapter-result-invalid', 'media generation adapter output schema is invalid', true);
    }
    if (!(output.bytes instanceof Uint8Array) || output.bytes.byteLength < 1 || typeof output.mimeType !== 'string' || !MIME.test(output.mimeType)) {
      fail('adapter-result-invalid', 'media generation adapter output bytes or MIME is invalid', true);
    }
    if (output.mimeType !== plan.outputMimeType || !state.profile.supportedMediaTypes.includes(output.mimeType)) {
      fail('media-type-not-supported', 'media generation adapter returned an undeclared MIME', true);
    }
    if (output.durationMs !== undefined && (typeof output.durationMs !== 'number' || !Number.isSafeInteger(output.durationMs) || output.durationMs < 0)) {
      fail('adapter-result-invalid', 'media generation adapter duration is invalid', true);
    }
    let providerRequestId: string | undefined;
    if (output.providerRequestId !== undefined) {
      if (typeof output.providerRequestId !== 'string' || !ID.test(output.providerRequestId)) fail('adapter-result-invalid', 'provider request identity is invalid', true);
      providerRequestId = output.providerRequestId;
    }
    totalBytes += output.bytes.byteLength;
    if (!Number.isSafeInteger(totalBytes) || totalBytes > plan.maxOutputBytes) fail('output-limit', 'media generation output exceeds its byte bound', true);
    normalized.push(Object.freeze({
      bytes: new Uint8Array(output.bytes),
      mimeType: output.mimeType,
      ...(providerRequestId === undefined ? {} : { providerRequestId }),
    }));
  }
  return normalized;
}

export function isGeneratedFuryMediaGenerationRequest(value: unknown): value is FuryMediaGenerationRequest {
  return typeof value === 'object' && value !== null && REQUEST_STATE.has(value);
}

export function isGeneratedFuryMediaGenerationPlan(value: unknown): value is FuryMediaGenerationPlan {
  return typeof value === 'object' && value !== null && PLAN_STATE.has(value);
}

export function isGeneratedFuryMediaGenerationPermit(value: unknown): value is FuryMediaGenerationPermit {
  return typeof value === 'object' && value !== null && PERMIT_STATE.has(value);
}

export function isGeneratedFuryMediaGenerationResult(value: unknown): value is FuryMediaGenerationResult {
  return typeof value === 'object' && value !== null && GENERATED_RESULTS.has(value);
}

export function isGeneratedFuryMediaGenerationAdapterRegistry(value: unknown): value is FuryMediaGenerationAdapterRegistry {
  return typeof value === 'object' && value !== null && GENERATED_ADAPTER_REGISTRIES.has(value);
}

export function isGeneratedFuryMediaGenerationCoordinator(value: unknown): value is FuryMediaGenerationCoordinator {
  return typeof value === 'object' && value !== null && GENERATED_COORDINATORS.has(value);
}

export function createFuryMediaGenerationAdapterRegistry(adapters: readonly FuryMediaGenerationAdapter[]): FuryMediaGenerationAdapterRegistry {
  if (!Array.isArray(adapters) || adapters.length > MAX_ADAPTERS) throw new TypeError(`media generation adapter registry must contain at most ${MAX_ADAPTERS} entries`);
  const byKey = new Map<string, FuryMediaGenerationAdapter>();
  for (const raw of adapters) {
    const record = plainRecord(raw, 'media generation adapter');
    exactKeys(record, ['bundleId', 'bundleVersion', 'profileId', 'family', 'supportedModes', 'execute'], ['bundleId', 'bundleVersion', 'profileId', 'family', 'supportedModes', 'execute'], 'media generation adapter');
    if (
      typeof raw.bundleId !== 'string' || !ID.test(raw.bundleId)
      || typeof raw.bundleVersion !== 'string' || raw.bundleVersion.length < 1 || raw.bundleVersion.length > 64
      || typeof raw.profileId !== 'string' || !ID.test(raw.profileId)
      || typeof raw.family !== 'string' || !FAMILIES.has(raw.family as FuryMediaGenerationFamily)
      || !Array.isArray(raw.supportedModes) || raw.supportedModes.length < 1 || raw.supportedModes.length > MAX_SUPPORTED_MODES
      || typeof raw.execute !== 'function'
    ) {
      throw new TypeError('media generation adapter registration is invalid');
    }
    const modes: FuryMediaGenerationMode[] = [];
    const seen = new Set<string>();
    for (const mode of raw.supportedModes) {
      if (typeof mode !== 'string' || !MODES.has(mode as FuryMediaGenerationMode) || seen.has(mode) || MODE_FAMILY[mode as FuryMediaGenerationMode] !== raw.family) {
        throw new TypeError('media generation adapter supportedModes are invalid');
      }
      seen.add(mode);
      modes.push(mode as FuryMediaGenerationMode);
    }
    const key = `${raw.bundleId}\0${raw.bundleVersion}\0${raw.profileId}\0${raw.family}`;
    if (byKey.has(key)) throw new TypeError('media generation adapter registration is duplicated');
    byKey.set(key, Object.freeze({
      bundleId: raw.bundleId,
      bundleVersion: raw.bundleVersion,
      profileId: raw.profileId,
      family: raw.family as FuryMediaGenerationFamily,
      supportedModes: Object.freeze([...modes]),
      execute: raw.execute,
    }));
  }
  const registry: FuryMediaGenerationAdapterRegistry = Object.freeze({
    get(bundleId: string, bundleVersion: string, profileId: string, family: FuryMediaGenerationFamily) {
      return byKey.get(`${bundleId}\0${bundleVersion}\0${profileId}\0${family}`);
    },
  });
  GENERATED_ADAPTER_REGISTRIES.add(registry);
  return registry;
}

export function createFuryMediaGenerationCoordinator(options: FuryMediaGenerationCoordinatorOptions): FuryMediaGenerationCoordinator {
  if (
    !options
    || typeof options !== 'object'
    || !isGeneratedFuryMediaGenerationAdapterRegistry(options.adapters)
    || !isGeneratedFuryMediaIngestionCoordinator(options.mediaCoordinator)
    || !options.artifactStore
    || typeof options.artifactStore.create !== 'function'
    || typeof options.projectId !== 'string'
    || options.projectId.length < 1
  ) {
    throw new TypeError('media generation coordinator requires generated adapters, media ingestion and artifact store');
  }
  const nowSource = options.now ?? Date.now;
  if (typeof nowSource !== 'function') throw new TypeError('media generation coordinator clock must be a function');
  const maxHealthAgeMs = boundedInteger(options.maxHealthAgeMs, DEFAULT_HEALTH_AGE_MS, 1, HARD_HEALTH_AGE_MS, 'maxHealthAgeMs');
  const maxPermitTtlMs = boundedInteger(options.maxPermitTtlMs, DEFAULT_PERMIT_TTL_MS, 1, HARD_PERMIT_TTL_MS, 'maxPermitTtlMs');

  let coordinator: FuryMediaGenerationCoordinator;

  coordinator = Object.freeze({
    prepare(input: FuryMediaGenerationPrepareInput): FuryMediaGenerationRequest {
      const record = plainRecord(input, 'media generation prepare input');
      exactKeys(record, ['bundle', 'profileId', 'mediaCoordinator', 'kind', 'mode', 'prompt', 'parameters', 'inputs', 'outputMimeType'], ['bundle', 'profileId', 'mediaCoordinator', 'kind', 'mode', 'prompt', 'outputMimeType'], 'media generation prepare input');
      if (!isGeneratedFuryMediaIngestionCoordinator(input.mediaCoordinator) || input.mediaCoordinator !== options.mediaCoordinator) {
        fail('media-input-invalid', 'generation media coordinator must be the configured process-local coordinator');
      }
      if (typeof input.kind !== 'string' || !KINDS.has(input.kind as FuryMediaGenerationKind)) fail('invalid-input', 'generation kind is invalid');
      if (typeof input.mode !== 'string' || !MODES.has(input.mode as FuryMediaGenerationMode)) fail('mode-not-supported', 'generation mode is not supported by the common runtime');
      const kind = input.kind as FuryMediaGenerationKind;
      const mode = input.mode as FuryMediaGenerationMode;
      const family = MODE_FAMILY[mode];
      if (family !== FAMILY_BY_KIND[kind]) fail('mode-not-supported', 'generation mode family does not match the requested kind');
      const requiredKinds = MODE_INPUT_KINDS[mode];
      const profile = profileFor(input.bundle, input.profileId, family, requiredKinds.length > 0);
      const prompt = normalizePrompt(input.prompt, profile);
      const parameters = normalizeParameters(input.parameters);
      if (typeof input.outputMimeType !== 'string' || !MIME.test(input.outputMimeType)) fail('invalid-input', 'generation output MIME is invalid');
      if (!profile.supportedMediaTypes.includes(input.outputMimeType)) fail('media-type-not-supported', 'generation profile does not declare output MIME');

      const rawHandles = input.inputs ?? [];
      if (!Array.isArray(rawHandles)) fail('media-input-invalid', 'generation inputs must be an array of process-local media handles');
      if (rawHandles.length !== requiredKinds.length) fail('media-input-invalid', 'generation mode input count does not match the common contract');
      if (rawHandles.length > profile.bounds.maxItems) fail('input-limit', 'generation input item count exceeds profile bounds');
      const inputHandles: FuryMediaIngestionHandle[] = [];
      const inputEvidence: FuryMediaIngestionEvidence[] = [];
      const inputDigests: string[] = [];
      const inputKinds: FuryMediaKind[] = [];
      const inputMimeTypes: string[] = [];
      let inputBytes = 0;
      const seenHandles = new Set<object>();
      for (let index = 0; index < rawHandles.length; index += 1) {
        const handle = rawHandles[index];
        if (!isGeneratedFuryMediaIngestionHandle(handle) || seenHandles.has(handle)) fail('media-input-invalid', 'generation inputs must be unique generated media handles');
        seenHandles.add(handle);
        let evidence: FuryMediaIngestionEvidence;
        try { evidence = input.mediaCoordinator.inspect(handle); } catch { fail('media-input-invalid', 'generation input media handle is unavailable'); }
        if (evidence.kind !== requiredKinds[index]) fail('media-input-invalid', 'generation input media kind does not match the mode');
        if (!profile.supportedMediaTypes.includes(evidence.mimeType)) fail('media-type-not-supported', 'generation profile does not declare input MIME');
        inputBytes += evidence.byteCount;
        if (!Number.isSafeInteger(inputBytes) || inputBytes > profile.bounds.maxInputBytes) fail('input-limit', 'generation media input exceeds profile bounds');
        if (profile.bounds.maxDurationMs !== undefined && evidence.durationMs !== undefined && evidence.durationMs > profile.bounds.maxDurationMs) fail('input-limit', 'generation media duration exceeds profile bounds');
        inputHandles.push(handle);
        inputEvidence.push(evidence);
        inputDigests.push(evidence.mediaSha256);
        inputKinds.push(evidence.kind);
        inputMimeTypes.push(evidence.mimeType);
      }
      const requestId = `fpg_request_${randomUUID()}`;
      const payload = Object.freeze({
        requestId,
        kind,
        mode,
        bundleId: input.bundle.id,
        bundleVersion: input.bundle.version,
        profileId: profile.id,
        outputMimeType: input.outputMimeType,
        promptDigestSha256: sha256(input.prompt),
        promptBytes: prompt.bytes,
        parametersDigestSha256: sha256(JSON.stringify(parameters)),
        inputDigestsSha256: Object.freeze([...inputDigests]),
        inputKinds: Object.freeze([...inputKinds]),
        inputMimeTypes: Object.freeze([...inputMimeTypes]),
        inputBytes,
      });
      const request: FuryMediaGenerationRequest = Object.freeze({
        format: FURY_MEDIA_GENERATION_REQUEST_FORMAT,
        ...payload,
        requestDigestSha256: requestDigest(payload),
        authority: 'media-generation-request-evidence-only',
        executionAuthority: false,
      });
      REQUEST_STATE.set(request, {
        coordinator,
        request,
        bundle: input.bundle,
        profile,
        prompt: input.prompt,
        parameters,
        mediaCoordinator: input.mediaCoordinator,
        inputHandles: Object.freeze(inputHandles),
        inputEvidence: Object.freeze(inputEvidence),
      });
      return request;
    },

    plan(request: FuryMediaGenerationRequest): FuryMediaGenerationPlan {
      const requestState = REQUEST_STATE.get(request);
      if (!requestState || requestState.coordinator !== coordinator || requestState.request !== request) fail('execution-not-authorized', 'process-local generation request is required');
      const planId = `fpg_plan_${randomUUID()}`;
      const payload = Object.freeze({
        planId,
        requestDigestSha256: request.requestDigestSha256,
        kind: request.kind,
        mode: request.mode,
        family: MODE_FAMILY[request.mode],
        bundleId: request.bundleId,
        bundleVersion: request.bundleVersion,
        profileId: request.profileId,
        outputMimeType: request.outputMimeType,
        maxOutputBytes: requestState.profile.bounds.maxOutputBytes,
        maxItems: requestState.profile.bounds.maxItems,
        ...(requestState.profile.bounds.maxDurationMs === undefined ? {} : { maxDurationMs: requestState.profile.bounds.maxDurationMs }),
        inputCount: request.inputDigestsSha256.length,
      });
      const plan: FuryMediaGenerationPlan = Object.freeze({
        format: FURY_MEDIA_GENERATION_PLAN_FORMAT,
        ...payload,
        planDigestSha256: planDigest(payload),
        requiresApproval: true,
        selectionAuthority: false,
        executionAuthority: false,
      });
      PLAN_STATE.set(plan, { coordinator, plan, request });
      return plan;
    },

    authorize(request: FuryMediaGenerationRequest, plan: FuryMediaGenerationPlan, approval: FuryMediaGenerationApproval): FuryMediaGenerationPermit {
      const requestState = REQUEST_STATE.get(request);
      const planState = PLAN_STATE.get(plan);
      if (!requestState || requestState.coordinator !== coordinator || requestState.request !== request) fail('execution-not-authorized', 'process-local generation request is required');
      if (!planState || planState.coordinator !== coordinator || planState.plan !== plan || planState.request !== request) fail('plan-request-mismatch', 'generation plan does not match exact request');
      const record = plainRecord(approval, 'media generation approval');
      exactKeys(record, ['format', 'approvalId', 'allowGeneration', 'requestDigestSha256', 'planDigestSha256', 'kind', 'mode', 'bundleId', 'bundleVersion', 'profileId', 'outputMimeType', 'expiresInMs', 'authority', 'executionAuthority'], ['format', 'approvalId', 'allowGeneration', 'requestDigestSha256', 'planDigestSha256', 'kind', 'mode', 'bundleId', 'bundleVersion', 'profileId', 'outputMimeType', 'expiresInMs', 'authority', 'executionAuthority'], 'media generation approval');
      if (
        approval.format !== FURY_MEDIA_GENERATION_APPROVAL_FORMAT
        || approval.allowGeneration !== true
        || !ID.test(approval.approvalId)
        || approval.requestDigestSha256 !== request.requestDigestSha256
        || approval.planDigestSha256 !== plan.planDigestSha256
        || approval.kind !== request.kind
        || approval.mode !== request.mode
        || approval.bundleId !== request.bundleId
        || approval.bundleVersion !== request.bundleVersion
        || approval.profileId !== request.profileId
        || approval.outputMimeType !== request.outputMimeType
        || approval.authority !== 'media-generation-approval-decision'
        || approval.executionAuthority !== false
        || !Number.isSafeInteger(approval.expiresInMs)
        || approval.expiresInMs < 1
        || approval.expiresInMs > maxPermitTtlMs
      ) {
        fail('approval-not-authorized', 'generation approval does not authorize exact request and plan');
      }
      const now = safeNow(nowSource);
      const profile = requestState.profile;
      if (profile.health.status !== 'healthy' || !Number.isSafeInteger(profile.health.observedAt) || profile.health.observedAt < 0 || profile.health.observedAt > now) {
        fail('profile-not-eligible', 'generation profile health does not report healthy eligibility');
      }
      const healthExpiresAt = profile.health.observedAt + maxHealthAgeMs;
      if (!Number.isSafeInteger(healthExpiresAt) || now >= healthExpiresAt) fail('profile-health-not-fresh', 'generation profile health is stale');
      const expiresAt = Math.min(now + approval.expiresInMs, healthExpiresAt);
      if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) fail('approval-not-authorized', 'generation permit lifetime is invalid');
      const permit: FuryMediaGenerationPermit = Object.freeze({
        format: FURY_MEDIA_GENERATION_PERMIT_FORMAT,
        permitId: `fpg_permit_${randomUUID()}`,
        approvalId: approval.approvalId,
        requestDigestSha256: request.requestDigestSha256,
        planDigestSha256: plan.planDigestSha256,
        kind: request.kind,
        mode: request.mode,
        bundleId: request.bundleId,
        bundleVersion: request.bundleVersion,
        profileId: request.profileId,
        issuedAt: now,
        expiresAt,
        automaticReplayAllowed: false,
        executionAuthority: false,
      });
      PERMIT_STATE.set(permit, { coordinator, permit, request, plan, consumed: false });
      return permit;
    },

    async execute(
      request: FuryMediaGenerationRequest,
      plan: FuryMediaGenerationPlan,
      permit: FuryMediaGenerationPermit,
      executionOptions?: { readonly signal?: AbortSignal },
    ): Promise<FuryMediaGenerationResult> {
      const requestState = REQUEST_STATE.get(request);
      const planState = PLAN_STATE.get(plan);
      const permitState = PERMIT_STATE.get(permit);
      if (!requestState || requestState.coordinator !== coordinator || requestState.request !== request) fail('execution-not-authorized', 'process-local generation request is required');
      if (!planState || planState.coordinator !== coordinator || planState.plan !== plan || planState.request !== request) fail('plan-request-mismatch', 'generation plan does not match exact request');
      if (!permitState || permitState.coordinator !== coordinator || permitState.permit !== permit || permitState.request !== request || permitState.plan !== plan) fail('execution-not-authorized', 'process-local generation permit is required');
      if (
        permit.requestDigestSha256 !== request.requestDigestSha256
        || permit.planDigestSha256 !== plan.planDigestSha256
        || permit.kind !== request.kind
        || permit.mode !== request.mode
        || permit.bundleId !== request.bundleId
        || permit.bundleVersion !== request.bundleVersion
        || permit.profileId !== request.profileId
      ) fail('permit-request-mismatch', 'generation permit does not match exact request and plan');

      let signal: AbortSignal | undefined;
      if (executionOptions !== undefined) {
        const record = plainRecord(executionOptions, 'media generation execution options');
        exactKeys(record, ['signal'], [], 'media generation execution options');
        if (executionOptions.signal !== undefined) signal = validateAbortSignal(executionOptions.signal);
      }

      let adapter: FuryMediaGenerationAdapter | undefined;
      try { adapter = options.adapters.get(request.bundleId, request.bundleVersion, request.profileId, MODE_FAMILY[request.mode]); } catch { fail('adapter-not-registered', 'media generation adapter registry lookup failed'); }
      if (
        !adapter
        || adapter.bundleId !== request.bundleId
        || adapter.bundleVersion !== request.bundleVersion
        || adapter.profileId !== request.profileId
        || adapter.family !== MODE_FAMILY[request.mode]
        || typeof adapter.execute !== 'function'
      ) fail('adapter-not-registered', 'exact media generation adapter is not registered');
      if (!adapter.supportedModes.includes(request.mode)) fail('adapter-mode-not-supported', 'registered media adapter does not support the exact mode');

      const adapterInputs: FuryMediaGenerationAdapterMediaInput[] = [];
      try {
        for (let index = 0; index < requestState.inputHandles.length; index += 1) {
          const handle = requestState.inputHandles[index]!;
          const expected = requestState.inputEvidence[index]!;
          const current = requestState.mediaCoordinator.inspect(handle);
          if (
            current.mediaSha256 !== expected.mediaSha256
            || current.mimeType !== expected.mimeType
            || current.kind !== expected.kind
            || current.byteCount !== expected.byteCount
          ) fail('media-input-invalid', 'generation media evidence changed before dispatch');
          adapterInputs.push(Object.freeze({ kind: current.kind, mimeType: current.mimeType, bytes: requestState.mediaCoordinator.readBytes(handle) }));
        }
      } catch (error) {
        for (const input of adapterInputs) input.bytes.fill(0);
        if (error instanceof FuryMediaGenerationError) throw error;
        fail('media-input-invalid', 'generation media became unavailable before dispatch');
      }

      const startedAt = safeNow(nowSource);
      if (startedAt >= permit.expiresAt) {
        for (const input of adapterInputs) input.bytes.fill(0);
        fail('permit-expired', 'generation permit expired');
      }
      if (permitState.consumed) {
        for (const input of adapterInputs) input.bytes.fill(0);
        fail('permit-already-consumed', 'generation permit was already consumed');
      }
      permitState.consumed = true;
      const context: FuryMediaGenerationAdapterContext = Object.freeze({
        family: MODE_FAMILY[request.mode],
        kind: request.kind,
        mode: request.mode,
        requestDigestSha256: request.requestDigestSha256,
        outputMimeType: request.outputMimeType,
        maxOutputBytes: plan.maxOutputBytes,
        maxItems: plan.maxItems,
        ...(signal === undefined ? {} : { signal }),
      });
      let raw: unknown;
      try {
        raw = await adapter.execute(Object.freeze({ prompt: requestState.prompt, parameters: requestState.parameters, inputs: Object.freeze(adapterInputs) }), context);
      } catch (error) {
        if (error instanceof FuryMediaGenerationError && error.adapterInvoked) throw error;
        fail('adapter-error', 'media generation adapter failed after dispatch began', true);
      } finally {
        for (const input of adapterInputs) input.bytes.fill(0);
      }

      let outputs: NormalizedAdapterOutput[];
      try {
        outputs = normalizeAdapterResult(raw, requestState, plan);
      } finally {
        zeroAdapterBytes(raw);
      }

      const outputHandles: FuryMediaIngestionHandle[] = [];
      try {
        for (let index = 0; index < outputs.length; index += 1) {
          const output = outputs[index]!;
          const batch = requestState.mediaCoordinator.ingestBatch([{
            format: FURY_MEDIA_INGESTION_INPUT_FORMAT,
            itemId: `gen-${request.requestId}-${index}`,
            kind: request.kind,
            mimeType: output.mimeType,
            bytes: new Uint8Array(output.bytes),
            source: Object.freeze({
              format: FURY_MEDIA_INGESTION_SOURCE_FORMAT,
              origin: 'provider-output' as const,
              referenceDigestSha256: request.requestDigestSha256,
            }),
          }]);
          const handle = batch.handles[0];
          if (!handle) fail('ingestion-failed', 'provider output did not produce a media handle', true);
          if (plan.maxDurationMs !== undefined && handle.evidence.durationMs !== undefined && handle.evidence.durationMs > plan.maxDurationMs) {
            fail('output-limit', 'provider output duration exceeds profile bounds', true);
          }
          outputHandles.push(handle);
        }
      } catch (error) {
        releaseAll(requestState.mediaCoordinator, outputHandles);
        if (error instanceof FuryMediaGenerationError) throw error;
        fail('ingestion-failed', 'provider output failed governed media ingestion', true);
      } finally {
        for (const output of outputs) output.bytes.fill(0);
      }

      const artifactReferences: FuryMediaGenerationArtifactReference[] = [];
      try {
        for (let index = 0; index < outputHandles.length; index += 1) {
          const handle = outputHandles[index]!;
          const evidence = handle.evidence;
          const bytes = requestState.mediaCoordinator.readBytes(handle);
          try {
            const base64 = Buffer.from(bytes).toString('base64');
            const storage = base64.length <= MAX_ARTIFACT_CONTENT_CHARS ? 'base64' : 'digest-only';
            const artifactId = `media_${permit.permitId}_${index}`;
            const artifact = options.artifactStore.create({
              id: artifactId,
              kind: storage === 'base64' ? request.kind : 'binary-reference',
              title: `Fury ${request.kind} ${index + 1}`,
              projectId: options.projectId,
              content: storage === 'base64' ? base64 : `sha256:${evidence.mediaSha256}`,
              mediaType: storage === 'base64' ? 'application/vnd.furypipe.media-base64' : 'application/vnd.furypipe.media-reference',
              metadata: Object.freeze({
                encoding: storage,
                mediaSha256: evidence.mediaSha256,
                mimeType: evidence.mimeType,
                byteCount: String(evidence.byteCount),
                requestDigestSha256: request.requestDigestSha256,
                provenanceDigestSha256: evidence.provenanceDigestSha256,
              }),
              now: new Date(startedAt).toISOString(),
            });
            const version = artifact.versions.at(-1);
            if (!version) fail('artifact-failed', 'created media artifact has no version', true);
            artifactReferences.push(Object.freeze({
              artifactId: artifact.id,
              version: version.version,
              kind: artifact.kind,
              sourceMimeType: evidence.mimeType,
              mediaType: version.mediaType,
              mediaSha256: evidence.mediaSha256,
              contentSha256: version.contentSha256,
              byteLength: evidence.byteCount,
              storage,
            }));
          } finally {
            bytes.fill(0);
          }
        }
      } catch (error) {
        releaseAll(requestState.mediaCoordinator, outputHandles);
        if (error instanceof FuryMediaGenerationError) throw error;
        fail('artifact-failed', 'provider output could not be recorded as a Fury Artifact', true);
      }

      const finishedAt = safeOptionalFinish(nowSource, startedAt);
      const providerRequestIdsSha256 = Object.freeze(outputs.map((output) => output.providerRequestId === undefined ? null : sha256(output.providerRequestId)));
      const outputMediaSha256 = Object.freeze(outputHandles.map((handle) => handle.evidence.mediaSha256));
      const receipt: FuryMediaGenerationReceipt = Object.freeze({
        format: FURY_MEDIA_GENERATION_RECEIPT_FORMAT,
        requestDigestSha256: request.requestDigestSha256,
        planDigestSha256: plan.planDigestSha256,
        approvalIdSha256: sha256(permit.approvalId),
        permitIdSha256: sha256(permit.permitId),
        kind: request.kind,
        mode: request.mode,
        bundleId: request.bundleId,
        bundleVersion: request.bundleVersion,
        profileId: request.profileId,
        startedAt,
        ...(finishedAt === undefined ? {} : { finishedAt }),
        outcome: 'succeeded',
        outputCount: outputHandles.length,
        outputMediaSha256,
        artifactIds: Object.freeze(artifactReferences.map((reference) => reference.artifactId)),
        providerRequestIdsSha256,
        providerResult: 'adapter-reported-unverified',
        executionAuthority: false,
        automaticReplayAllowed: false,
      });
      const provenance: FuryMediaGenerationProvenance = Object.freeze({
        format: FURY_MEDIA_GENERATION_PROVENANCE_FORMAT,
        requestDigestSha256: request.requestDigestSha256,
        kind: request.kind,
        mode: request.mode,
        bundleId: request.bundleId,
        bundleVersion: request.bundleVersion,
        profileId: request.profileId,
        profileSourceDigestSha256: requestState.profile.sourceDigestSha256,
        inputMediaSha256: Object.freeze(requestState.inputEvidence.map((evidence) => evidence.mediaSha256)),
        inputProvenanceDigestSha256: Object.freeze(requestState.inputEvidence.map((evidence) => evidence.provenanceDigestSha256)),
        outputMediaSha256,
        outputProvenanceDigestSha256: Object.freeze(outputHandles.map((handle) => handle.evidence.provenanceDigestSha256)),
        artifactIds: Object.freeze(artifactReferences.map((reference) => reference.artifactId)),
        contentTrust: 'untrusted-media-content',
        instructionAuthority: false,
        providerCompatibility: 'not-evaluated',
        executionAuthority: false,
        automaticReplayAllowed: false,
      });
      const result: FuryMediaGenerationResult = Object.freeze({
        format: FURY_MEDIA_GENERATION_RESULT_FORMAT,
        kind: request.kind,
        mode: request.mode,
        outputHandles: Object.freeze(outputHandles),
        artifactReferences: Object.freeze(artifactReferences),
        receipt,
        provenance,
        executionAuthority: false,
        automaticReplayAllowed: false,
      });
      GENERATED_RESULTS.add(result);
      return result;
    },
  });
  GENERATED_COORDINATORS.add(coordinator);
  return coordinator;
}
