import { createHash } from 'node:crypto';

import type { FuryMediaGenerationMode } from './media-generation-runtime.js';

export const FURY_VIDEO_TIMELINE_FORMAT = 'furypipe-furyvideo-timeline/v1' as const;

export type FuryVideoTimelineAssetKind = 'image' | 'video' | 'audio';
export type FuryVideoTimelineTransitionKind = 'cut' | 'crossfade' | 'fade-to-black' | 'fade-from-black' | 'wipe';
export type FuryVideoTimelineAudioRole = 'voice' | 'music' | 'sound-effect' | 'ambience';

export interface FuryVideoTimelineAssetInput {
  readonly assetId: string;
  readonly kind: FuryVideoTimelineAssetKind;
  readonly mimeType?: string;
  readonly digestSha256?: string;
}

export interface FuryVideoTimelineAudioInput {
  readonly assetId: string;
  readonly role: FuryVideoTimelineAudioRole;
  readonly offsetMs?: number;
  readonly durationMs?: number;
}

export interface FuryVideoTimelineTransitionInput {
  readonly kind: FuryVideoTimelineTransitionKind;
  readonly durationMs?: number;
}

export interface FuryVideoTimelineGenerationInput {
  readonly jobId?: string;
  readonly operation?: FuryMediaGenerationMode;
  readonly outputArtifactIds?: readonly string[];
}

export interface FuryVideoTimelineShotInput {
  readonly shotId: string;
  readonly prompt: string;
  readonly durationMs: number;
  readonly assetIds?: readonly string[];
  readonly transition?: FuryVideoTimelineTransitionInput;
  readonly audio?: readonly FuryVideoTimelineAudioInput[];
  readonly generation?: FuryVideoTimelineGenerationInput;
}

export interface FuryVideoTimelineSceneInput {
  readonly sceneId: string;
  readonly title: string;
  readonly shots: readonly FuryVideoTimelineShotInput[];
}

export interface FuryVideoTimelineProjectInput {
  readonly projectId: string;
  readonly title: string;
  readonly assets?: readonly FuryVideoTimelineAssetInput[];
  readonly scenes: readonly FuryVideoTimelineSceneInput[];
}

export interface FuryVideoTimelineAssetReference {
  readonly assetId: string;
  readonly kind: FuryVideoTimelineAssetKind;
  readonly mimeType?: string;
  readonly digestSha256?: string;
}

export interface FuryVideoTimelineAudioReference {
  readonly assetId: string;
  readonly role: FuryVideoTimelineAudioRole;
  readonly offsetMs: number;
  readonly durationMs?: number;
}

export interface FuryVideoTimelineGenerationReference {
  readonly state: 'REFERENCE_ONLY';
  readonly jobId?: string;
  readonly operation?: FuryMediaGenerationMode;
  readonly outputArtifactIds: readonly string[];
}

export interface FuryVideoTimelineShotPreview {
  readonly shotId: string;
  readonly promptDigestSha256: string;
  readonly durationMs: number;
  readonly assetIds: readonly string[];
  readonly transition: Readonly<{
    readonly kind: FuryVideoTimelineTransitionKind;
    readonly durationMs: number;
  }>;
  readonly audio: readonly FuryVideoTimelineAudioReference[];
  readonly generation: FuryVideoTimelineGenerationReference;
}

export interface FuryVideoTimelineScenePreview {
  readonly sceneId: string;
  readonly titleDigestSha256: string;
  readonly durationMs: number;
  readonly transitionDurationMs: number;
  readonly shots: readonly FuryVideoTimelineShotPreview[];
}

export interface FuryVideoTimelinePreview {
  readonly format: typeof FURY_VIDEO_TIMELINE_FORMAT;
  readonly authority: 'studio-preview-only';
  readonly executionAuthorized: false;
  readonly state: 'PREVIEW_ONLY_REQUIRES_RUNTIME_AUTHORITY';
  readonly requiresApproval: true;
  readonly project: Readonly<{
    readonly projectId: string;
    readonly titleDigestSha256: string;
    readonly assets: readonly FuryVideoTimelineAssetReference[];
    readonly scenes: readonly FuryVideoTimelineScenePreview[];
  }>;
  readonly sceneCount: number;
  readonly shotCount: number;
  readonly contentDurationMs: number;
  readonly transitionDurationMs: number;
  readonly timelineDigestSha256: string;
  readonly next: 'REGISTER_PROVIDER_ADAPTER_AND_EXPLICITLY_AUTHORIZE';
}

const ID = /^[a-z][a-z0-9._-]{0,127}$/u;
const JOB_ID = /^fpg_job_[0-9a-f-]{36}$/u;
const DIGEST = /^[0-9a-f]{64}$/u;
const MIME = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,63}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,127}$/u;
const ASSET_KINDS = new Set<FuryVideoTimelineAssetKind>(['image', 'video', 'audio']);
const AUDIO_ROLES = new Set<FuryVideoTimelineAudioRole>(['voice', 'music', 'sound-effect', 'ambience']);
const TRANSITIONS = new Set<FuryVideoTimelineTransitionKind>(['cut', 'crossfade', 'fade-to-black', 'fade-from-black', 'wipe']);
const VIDEO_OPERATIONS = new Set<FuryMediaGenerationMode>([
  'text-to-video', 'image-to-video', 'video-to-video', 'continue-video', 'lip-sync',
]);
const MAX_ASSETS = 256;
const MAX_SCENES = 64;
const MAX_SHOTS_PER_SCENE = 128;
const MAX_AUDIO_PER_SHOT = 16;
const MAX_OUTPUT_ARTIFACTS_PER_SHOT = 16;
const MAX_PROMPT_LENGTH = 100_000;
const MAX_TITLE_LENGTH = 256;
const MAX_SHOT_DURATION_MS = 600_000;
const MAX_AUDIO_OFFSET_MS = 7_200_000;
const MAX_AUDIO_DURATION_MS = 600_000;
const MAX_TRANSITION_DURATION_MS = 60_000;
const MAX_TIMELINE_DURATION_MS = 7_200_000;

function digest(value: string): string {
  return createHash('sha256').update('furypipe-furyvideo-timeline/v1\0').update(value).digest('hex');
}

function plainRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be a plain data object`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${label} must use a plain-object prototype`);
  if (Object.getOwnPropertySymbols(value).length !== 0) throw new TypeError(`${label} must not contain symbol keys`);
  for (const key of Object.getOwnPropertyNames(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) throw new TypeError(`${label} must contain enumerable data properties only`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(record: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const accepted = new Set(allowed);
  for (const key of Object.keys(record)) if (!accepted.has(key)) throw new TypeError(`${label} contains unsupported field: ${key}`);
}

function boundedId(value: unknown, label: string): string {
  if (typeof value !== 'string' || !ID.test(value)) throw new TypeError(`${label} is invalid`);
  return value;
}

function boundedText(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > max || /[\u0000-\u001f\u007f]/u.test(value)) throw new TypeError(`${label} is invalid`);
  return value;
}

function boundedInteger(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new RangeError(`${label} is invalid`);
  return value;
}

function boundedOptionalInteger(value: unknown, label: string, min: number, max: number): number | undefined {
  return value === undefined ? undefined : boundedInteger(value, label, min, max);
}

function normalizedIds(value: unknown, label: string, max: number): readonly string[] {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > max) throw new RangeError(`${label} exceeds its bound`);
  const seen = new Set<string>();
  const values = value.map((candidate) => {
    const id = boundedId(candidate, label);
    if (seen.has(id)) throw new TypeError(`${label} contains a duplicate value`);
    seen.add(id);
    return id;
  });
  return Object.freeze(values);
}

function normalizeAsset(input: FuryVideoTimelineAssetInput): FuryVideoTimelineAssetReference {
  const record = plainRecord(input, 'timeline asset');
  exactKeys(record, ['assetId', 'kind', 'mimeType', 'digestSha256'], 'timeline asset');
  const assetId = boundedId(input.assetId, 'timeline asset ID');
  if (!ASSET_KINDS.has(input.kind)) throw new TypeError('timeline asset kind is invalid');
  if (input.mimeType !== undefined && (typeof input.mimeType !== 'string' || !MIME.test(input.mimeType))) throw new TypeError('timeline asset MIME type is invalid');
  if (input.digestSha256 !== undefined && (typeof input.digestSha256 !== 'string' || !DIGEST.test(input.digestSha256))) throw new TypeError('timeline asset digest is invalid');
  return Object.freeze({
    assetId,
    kind: input.kind,
    ...(input.mimeType === undefined ? {} : { mimeType: input.mimeType }),
    ...(input.digestSha256 === undefined ? {} : { digestSha256: input.digestSha256 }),
  });
}

function normalizeTransition(input: FuryVideoTimelineTransitionInput | undefined): Readonly<{ kind: FuryVideoTimelineTransitionKind; durationMs: number }> {
  if (input === undefined) return Object.freeze({ kind: 'cut', durationMs: 0 });
  const record = plainRecord(input, 'timeline transition');
  exactKeys(record, ['kind', 'durationMs'], 'timeline transition');
  if (!TRANSITIONS.has(input.kind)) throw new TypeError('timeline transition kind is invalid');
  const durationMs = input.kind === 'cut'
    ? boundedOptionalInteger(input.durationMs, 'timeline cut duration', 0, 0) ?? 0
    : boundedInteger(input.durationMs, 'timeline transition duration', 1, MAX_TRANSITION_DURATION_MS);
  return Object.freeze({ kind: input.kind, durationMs });
}

function normalizeAudio(
  input: readonly FuryVideoTimelineAudioInput[] | undefined,
  assets: ReadonlyMap<string, FuryVideoTimelineAssetReference>,
): readonly FuryVideoTimelineAudioReference[] {
  if (input === undefined) return Object.freeze([]);
  if (!Array.isArray(input) || input.length > MAX_AUDIO_PER_SHOT) throw new RangeError('timeline audio count exceeds its bound');
  const values = input.map((candidate) => {
    const record = plainRecord(candidate, 'timeline audio');
    exactKeys(record, ['assetId', 'role', 'offsetMs', 'durationMs'], 'timeline audio');
    const assetId = boundedId(candidate.assetId, 'timeline audio asset ID');
    const asset = assets.get(assetId);
    if (!asset || asset.kind !== 'audio') throw new TypeError('timeline audio must reference an audio asset');
    if (!AUDIO_ROLES.has(candidate.role)) throw new TypeError('timeline audio role is invalid');
    const offsetMs = boundedOptionalInteger(candidate.offsetMs, 'timeline audio offset', 0, MAX_AUDIO_OFFSET_MS) ?? 0;
    const durationMs = boundedOptionalInteger(candidate.durationMs, 'timeline audio duration', 1, MAX_AUDIO_DURATION_MS);
    return Object.freeze({
      assetId,
      role: candidate.role,
      offsetMs,
      ...(durationMs === undefined ? {} : { durationMs }),
    });
  });
  return Object.freeze(values);
}

function normalizeGeneration(input: FuryVideoTimelineGenerationInput | undefined): FuryVideoTimelineGenerationReference {
  if (input === undefined) return Object.freeze({ state: 'REFERENCE_ONLY', outputArtifactIds: Object.freeze([]) });
  const record = plainRecord(input, 'timeline generation');
  exactKeys(record, ['jobId', 'operation', 'outputArtifactIds'], 'timeline generation');
  if (input.jobId !== undefined && (typeof input.jobId !== 'string' || !JOB_ID.test(input.jobId))) throw new TypeError('timeline generation job ID is invalid');
  if (input.operation !== undefined && !VIDEO_OPERATIONS.has(input.operation)) throw new TypeError('timeline generation operation is invalid');
  if (input.jobId !== undefined && input.operation === undefined) throw new TypeError('timeline generation operation is required with a job ID');
  const outputArtifactIds = normalizedIds(input.outputArtifactIds, 'timeline output artifact IDs', MAX_OUTPUT_ARTIFACTS_PER_SHOT);
  return Object.freeze({
    state: 'REFERENCE_ONLY',
    ...(input.jobId === undefined ? {} : { jobId: input.jobId }),
    ...(input.operation === undefined ? {} : { operation: input.operation }),
    outputArtifactIds,
  });
}

function normalizeShot(
  input: FuryVideoTimelineShotInput,
  assets: ReadonlyMap<string, FuryVideoTimelineAssetReference>,
  shotIds: Set<string>,
): { readonly shot: FuryVideoTimelineShotPreview; readonly transitionDurationMs: number } {
  const record = plainRecord(input, 'timeline shot');
  exactKeys(record, ['shotId', 'prompt', 'durationMs', 'assetIds', 'transition', 'audio', 'generation'], 'timeline shot');
  const shotId = boundedId(input.shotId, 'timeline shot ID');
  if (shotIds.has(shotId)) throw new TypeError('timeline shot IDs must be unique');
  shotIds.add(shotId);
  const prompt = boundedText(input.prompt, 'timeline shot prompt', MAX_PROMPT_LENGTH);
  const durationMs = boundedInteger(input.durationMs, 'timeline shot duration', 1, MAX_SHOT_DURATION_MS);
  const assetIds = normalizedIds(input.assetIds, 'timeline shot asset IDs', MAX_ASSETS);
  for (const assetId of assetIds) if (!assets.has(assetId)) throw new TypeError('timeline shot references an unknown asset');
  const transition = normalizeTransition(input.transition);
  const audio = normalizeAudio(input.audio, assets);
  const generation = normalizeGeneration(input.generation);
  return {
    shot: Object.freeze({
      shotId,
      promptDigestSha256: digest(prompt),
      durationMs,
      assetIds,
      transition,
      audio,
      generation,
    }),
    transitionDurationMs: transition.durationMs,
  };
}

export function createFuryVideoTimelinePreview(input: FuryVideoTimelineProjectInput): FuryVideoTimelinePreview {
  const projectRecord = plainRecord(input, 'timeline project');
  exactKeys(projectRecord, ['projectId', 'title', 'assets', 'scenes'], 'timeline project');
  const projectId = boundedId(input.projectId, 'timeline project ID');
  const title = boundedText(input.title, 'timeline project title', MAX_TITLE_LENGTH);
  const rawAssets = input.assets === undefined ? [] : input.assets;
  if (!Array.isArray(rawAssets) || rawAssets.length > MAX_ASSETS) throw new RangeError('timeline asset count exceeds its bound');
  const assets = rawAssets.map(normalizeAsset);
  const assetMap = new Map<string, FuryVideoTimelineAssetReference>();
  for (const asset of assets) {
    if (assetMap.has(asset.assetId)) throw new TypeError('timeline asset IDs must be unique');
    assetMap.set(asset.assetId, asset);
  }
  if (!Array.isArray(input.scenes) || input.scenes.length < 1 || input.scenes.length > MAX_SCENES) throw new RangeError('timeline scene count is invalid');
  const sceneIds = new Set<string>();
  const shotIds = new Set<string>();
  let contentDurationMs = 0;
  let transitionDurationMs = 0;
  let shotCount = 0;
  const scenes = input.scenes.map((sceneInput) => {
    const sceneRecord = plainRecord(sceneInput, 'timeline scene');
    exactKeys(sceneRecord, ['sceneId', 'title', 'shots'], 'timeline scene');
    const sceneId = boundedId(sceneInput.sceneId, 'timeline scene ID');
    if (sceneIds.has(sceneId)) throw new TypeError('timeline scene IDs must be unique');
    sceneIds.add(sceneId);
    const sceneTitle = boundedText(sceneInput.title, 'timeline scene title', MAX_TITLE_LENGTH);
    if (!Array.isArray(sceneInput.shots) || sceneInput.shots.length < 1 || sceneInput.shots.length > MAX_SHOTS_PER_SCENE) throw new RangeError('timeline shot count is invalid');
    let sceneDurationMs = 0;
    let sceneTransitionDurationMs = 0;
    const shots = sceneInput.shots.map((shotInput: FuryVideoTimelineShotInput) => {
      const normalized = normalizeShot(shotInput, assetMap, shotIds);
      sceneDurationMs += normalized.shot.durationMs;
      sceneTransitionDurationMs += normalized.transitionDurationMs;
      contentDurationMs += normalized.shot.durationMs;
      transitionDurationMs += normalized.transitionDurationMs;
      shotCount += 1;
      if (contentDurationMs > MAX_TIMELINE_DURATION_MS) throw new RangeError('timeline content duration exceeds its bound');
      if (transitionDurationMs > MAX_TIMELINE_DURATION_MS) throw new RangeError('timeline transition duration exceeds its bound');
      return normalized.shot;
    });
    return Object.freeze({
      sceneId,
      titleDigestSha256: digest(sceneTitle),
      durationMs: sceneDurationMs,
      transitionDurationMs: sceneTransitionDurationMs,
      shots: Object.freeze(shots),
    });
  });
  const project = Object.freeze({
    projectId,
    titleDigestSha256: digest(title),
    assets: Object.freeze(assets),
    scenes: Object.freeze(scenes),
  });
  const timelineDigestSha256 = digest(JSON.stringify(project));
  return Object.freeze({
    format: FURY_VIDEO_TIMELINE_FORMAT,
    authority: 'studio-preview-only',
    executionAuthorized: false,
    state: 'PREVIEW_ONLY_REQUIRES_RUNTIME_AUTHORITY',
    requiresApproval: true,
    project,
    sceneCount: scenes.length,
    shotCount,
    contentDurationMs,
    transitionDurationMs,
    timelineDigestSha256,
    next: 'REGISTER_PROVIDER_ADAPTER_AND_EXPLICITLY_AUTHORIZE',
  });
}
