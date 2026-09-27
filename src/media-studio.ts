import { createHash } from 'node:crypto';

import type {
  FuryMediaGenerationAdapter,
  FuryMediaGenerationMode,
} from './media-generation-runtime.js';
import type { FuryMediaGenerationJob, FuryMediaGenerationJobOutputReference } from './media-generation-job-engine.js';

export const FURY_MEDIA_STUDIO_FORMAT = 'furypipe-media-studio/v1' as const;
export const FURY_MEDIA_STUDIO_PREVIEW_FORMAT = 'furypipe-media-studio-preview/v1' as const;
export const FURY_MEDIA_STUDIO_GALLERY_FORMAT = 'furypipe-media-studio-gallery/v1' as const;

export type FuryMediaStudioSurfaceId = 'image' | 'video' | 'audio';

export interface FuryMediaStudioControl {
  readonly id: string;
  readonly label: string;
  readonly type: 'text' | 'number' | 'select' | 'toggle';
  readonly required: boolean;
  readonly bounded: true;
}

export interface FuryMediaStudioSurface {
  readonly id: FuryMediaStudioSurfaceId;
  readonly title: string;
  readonly family: 'image-generation' | 'video-generation' | 'audio-generation';
  readonly operations: readonly FuryMediaGenerationMode[];
  readonly outputMimeTypes: readonly string[];
  readonly controls: readonly FuryMediaStudioControl[];
  readonly state: 'CORE_AVAILABLE_PROVIDER_OPTIONAL';
  readonly executionAuthorized: false;
}

export interface FuryMediaStudioAdapterObservation {
  readonly selectorId: string;
  readonly bundleId: string;
  readonly bundleVersion: string;
  readonly profileId: string;
  readonly family: string;
  readonly supportedModes: readonly FuryMediaGenerationMode[];
  readonly supportedMimeTypes: readonly string[];
  readonly lifecycle: 'REGISTERED_CAPABILITY_ONLY';
  readonly executionAuthorized: false;
}

export interface FuryMediaStudioPreviewOptions {
  readonly provider?: string;
  readonly model?: string;
  readonly reference?: string;
  readonly durationMs?: number;
  readonly fps?: number;
  readonly aspectRatio?: string;
  readonly resolution?: string;
  readonly quality?: string;
  readonly negativePrompt?: string;
  readonly seed?: number;
  readonly guidance?: number;
  readonly steps?: number;
  readonly style?: string;
  readonly inputStrength?: number;
}

export interface FuryMediaStudioSnapshot {
  readonly format: typeof FURY_MEDIA_STUDIO_FORMAT;
  readonly generatedAt: number;
  readonly authority: 'studio-preview-only';
  readonly executionAuthorized: false;
  readonly providerExecution: 'NOT_CONFIGURED' | 'ADAPTER_REGISTERED_NOT_LIVE_VALIDATED';
  readonly surfaces: readonly FuryMediaStudioSurface[];
  readonly adapters: readonly FuryMediaStudioAdapterObservation[];
}

export interface FuryMediaStudioPreview {
  readonly format: typeof FURY_MEDIA_STUDIO_PREVIEW_FORMAT;
  readonly surface: FuryMediaStudioSurfaceId;
  readonly operation: FuryMediaGenerationMode;
  readonly outputMimeType: string;
  readonly provider: string;
  readonly model: string;
  readonly promptDigestSha256: string;
  readonly promptBytes: number;
  readonly controlsDigestSha256: string;
  readonly idempotencySeedDigestSha256: string;
  readonly state: 'PREVIEW_ONLY_REQUIRES_RUNTIME_AUTHORITY';
  readonly requiresApproval: true;
  readonly executionAuthorized: false;
  readonly next: 'REGISTER_PROVIDER_ADAPTER_AND_EXPLICITLY_AUTHORIZE';
}

export interface FuryMediaStudioGalleryItem {
  readonly jobId: string;
  readonly surface: FuryMediaStudioSurfaceId;
  readonly operation: FuryMediaGenerationMode;
  readonly status: FuryMediaGenerationJob['status'];
  readonly promptDigestSha256: string;
  readonly provider: string;
  readonly model: string;
  readonly outputMimeTypes: readonly string[];
  readonly dimensions: 'UNKNOWN';
  readonly seed: 'UNKNOWN';
  readonly cost: 'UNKNOWN';
  readonly latencyMs: number | null;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly provenance: Readonly<{
    readonly requestDigestSha256: string;
    readonly planDigestSha256: string;
    readonly mediaSha256: readonly string[];
    readonly artifactIds: readonly string[];
  }>;
}

export interface FuryMediaStudioGallery {
  readonly format: typeof FURY_MEDIA_STUDIO_GALLERY_FORMAT;
  readonly authority: 'read-only-media-job-history';
  readonly state: 'READY' | 'NOT_CONFIGURED';
  readonly jobs: readonly FuryMediaStudioGalleryItem[];
}

const MIME = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,63}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,127}$/u;
const SELECTOR_ID = /^adapter_[0-9a-f]{32}$/u;
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const ASPECT_RATIOS = new Set(['1:1', '16:9', '9:16', '4:3', '3:4']);
const RESOLUTIONS = new Set(['1024x1024', '1536x1024', '1024x1536']);
const VIDEO_RESOLUTIONS = new Set(['720p', '1080p', '2160p']);
const QUALITIES = new Set(['standard', 'high']);
const STYLES = new Set(['auto', 'photorealistic', 'illustration', 'cinematic', '3d']);
const SURFACES: Readonly<Record<FuryMediaStudioSurfaceId, FuryMediaStudioSurface>> = Object.freeze({
  image: Object.freeze({
    id: 'image', title: 'FuryImage Studio', family: 'image-generation',
    operations: Object.freeze(['text-to-image', 'image-to-image', 'inpaint', 'outpaint', 'variation', 'upscale', 'background-editing'] as FuryMediaGenerationMode[]),
    outputMimeTypes: Object.freeze(['image/png', 'image/jpeg']),
    controls: Object.freeze([
      Object.freeze({ id: 'provider', label: 'Provider / AUTO', type: 'select', required: true, bounded: true as const }),
      Object.freeze({ id: 'model', label: 'Model', type: 'select', required: true, bounded: true as const }),
      Object.freeze({ id: 'prompt', label: 'Prompt', type: 'text', required: true, bounded: true as const }),
      Object.freeze({ id: 'aspectRatio', label: 'Aspect ratio', type: 'select', required: true, bounded: true as const }),
      Object.freeze({ id: 'resolution', label: 'Resolution', type: 'select', required: true, bounded: true as const }),
      Object.freeze({ id: 'quality', label: 'Quality', type: 'select', required: true, bounded: true as const }),
      Object.freeze({ id: 'negativePrompt', label: 'Negative prompt', type: 'text', required: false, bounded: true as const }),
      Object.freeze({ id: 'seed', label: 'Seed', type: 'number', required: false, bounded: true as const }),
      Object.freeze({ id: 'guidance', label: 'Guidance', type: 'number', required: false, bounded: true as const }),
      Object.freeze({ id: 'steps', label: 'Steps', type: 'number', required: false, bounded: true as const }),
      Object.freeze({ id: 'style', label: 'Style', type: 'select', required: false, bounded: true as const }),
      Object.freeze({ id: 'inputStrength', label: 'Input strength', type: 'number', required: false, bounded: true as const }),
    ]),
    state: 'CORE_AVAILABLE_PROVIDER_OPTIONAL', executionAuthorized: false,
  }),
  video: Object.freeze({
    id: 'video', title: 'FuryVideo Studio', family: 'video-generation',
    operations: Object.freeze(['text-to-video', 'image-to-video', 'video-to-video', 'continue-video', 'lip-sync'] as FuryMediaGenerationMode[]),
    outputMimeTypes: Object.freeze(['video/mp4', 'video/webm']),
    controls: Object.freeze([
      Object.freeze({ id: 'provider', label: 'Provider / AUTO', type: 'select', required: true, bounded: true as const }),
      Object.freeze({ id: 'model', label: 'Model', type: 'select', required: true, bounded: true as const }),
      Object.freeze({ id: 'prompt', label: 'Prompt', type: 'text', required: true, bounded: true as const }),
      Object.freeze({ id: 'reference', label: 'Reference', type: 'text', required: false, bounded: true as const }),
      Object.freeze({ id: 'durationMs', label: 'Duration', type: 'number', required: false, bounded: true as const }),
      Object.freeze({ id: 'fps', label: 'FPS', type: 'number', required: false, bounded: true as const }),
      Object.freeze({ id: 'aspectRatio', label: 'Aspect ratio', type: 'select', required: false, bounded: true as const }),
      Object.freeze({ id: 'resolution', label: 'Resolution', type: 'select', required: true, bounded: true as const }),
    ]),
    state: 'CORE_AVAILABLE_PROVIDER_OPTIONAL', executionAuthorized: false,
  }),
  audio: Object.freeze({
    id: 'audio', title: 'FuryAudio Studio', family: 'audio-generation',
    operations: Object.freeze(['text-to-audio', 'audio-to-audio', 'voice-generation', 'sound-effect'] as FuryMediaGenerationMode[]),
    outputMimeTypes: Object.freeze(['audio/wav', 'audio/mpeg']),
    controls: Object.freeze([
      Object.freeze({ id: 'prompt', label: 'Prompt', type: 'text', required: true, bounded: true as const }),
      Object.freeze({ id: 'durationMs', label: 'Duration', type: 'number', required: false, bounded: true as const }),
      Object.freeze({ id: 'voice', label: 'Voice', type: 'select', required: false, bounded: true as const }),
    ]),
    state: 'CORE_AVAILABLE_PROVIDER_OPTIONAL', executionAuthorized: false,
  }),
});

function digest(value: string): string {
  return createHash('sha256').update('furypipe-media-studio/v1\0').update(value).digest('hex');
}

function nowValue(source: () => number): number {
  const value = source();
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError('media studio clock is invalid');
  return value;
}

function surfaceFor(value: FuryMediaStudioSurfaceId): FuryMediaStudioSurface {
  const surface = SURFACES[value];
  if (!surface) throw new TypeError('media studio surface is invalid');
  return surface;
}

function selectorId(adapter: FuryMediaGenerationAdapter): string {
  return `adapter_${digest(JSON.stringify({ bundleId: adapter.bundleId, bundleVersion: adapter.bundleVersion, profileId: adapter.profileId, family: adapter.family })).slice(0, 32)}`;
}

function boundedOption(value: unknown, fallback: string, allowed: ReadonlySet<string>, label: string): string {
  const resolved = value === undefined ? fallback : value;
  if (typeof resolved !== 'string' || !allowed.has(resolved)) throw new TypeError(`media studio ${label} is invalid`);
  return resolved;
}

function boundedControlText(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > 100_000 || value.includes('\0')) throw new TypeError(`media studio ${label} is invalid`);
  return value;
}

function boundedNumber(value: unknown, label: string, min: number, max: number, integer = false): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || (integer && !Number.isSafeInteger(value)) || value < min || value > max) {
    throw new TypeError(`media studio ${label} is invalid`);
  }
  return value;
}

function normalizeProviderModel(
  input: FuryMediaStudioPreviewOptions,
  adapters: readonly FuryMediaGenerationAdapter[],
  family: 'image-generation' | 'video-generation',
): { readonly provider: string; readonly model: string } {
  const provider = input.provider ?? 'AUTO';
  if (typeof provider !== 'string' || (provider !== 'AUTO' && !SELECTOR_ID.test(provider))) throw new TypeError('media studio provider selection is invalid');
  const matchingAdapter = provider === 'AUTO' ? undefined : adapters.find((adapter) => selectorId(adapter) === provider && adapter.family === family);
  if (provider !== 'AUTO' && !matchingAdapter) throw new TypeError('media studio provider is not registered');
  const model = input.model ?? 'AUTO';
  if (typeof model !== 'string' || (model !== 'AUTO' && !MODEL_ID.test(model))) throw new TypeError('media studio model selection is invalid');
  if (matchingAdapter && model !== 'AUTO' && model !== matchingAdapter.profileId) throw new TypeError('media studio model is not supported by the selected provider');
  return { provider, model };
}

function normalizeImageOptions(
  input: FuryMediaStudioPreviewOptions | undefined,
  adapters: readonly FuryMediaGenerationAdapter[],
): { readonly provider: string; readonly model: string; readonly controls: Readonly<Record<string, string | number>> } {
  if (input !== undefined && (typeof input !== 'object' || input === null || Array.isArray(input))) throw new TypeError('media studio image controls are invalid');
  const options = input ?? {};
  const allowedKeys = new Set(['provider', 'model', 'aspectRatio', 'resolution', 'quality', 'negativePrompt', 'seed', 'guidance', 'steps', 'style', 'inputStrength']);
  if (Object.keys(options).some((key) => !allowedKeys.has(key))) throw new TypeError('media studio image controls contain an unsupported field');
  const { provider, model } = normalizeProviderModel(options, adapters, 'image-generation');
  const controls: Record<string, string | number> = {
    aspectRatio: boundedOption(options.aspectRatio, '1:1', ASPECT_RATIOS, 'aspect ratio'),
    resolution: boundedOption(options.resolution, '1024x1024', RESOLUTIONS, 'resolution'),
    quality: boundedOption(options.quality, 'standard', QUALITIES, 'quality'),
  };
  const negativePrompt = boundedControlText(options.negativePrompt, 'negative prompt');
  if (negativePrompt !== undefined) controls.negativePrompt = negativePrompt;
  const seed = boundedNumber(options.seed, 'seed', 0, 2 ** 31 - 1, true);
  if (seed !== undefined) controls.seed = seed;
  const guidance = boundedNumber(options.guidance, 'guidance', 0, 30);
  if (guidance !== undefined) controls.guidance = guidance;
  const steps = boundedNumber(options.steps, 'steps', 1, 150, true);
  if (steps !== undefined) controls.steps = steps;
  const style = options.style === undefined ? undefined : boundedOption(options.style, 'auto', STYLES, 'style');
  if (style !== undefined) controls.style = style;
  const inputStrength = boundedNumber(options.inputStrength, 'input strength', 0, 1);
  if (inputStrength !== undefined) controls.inputStrength = inputStrength;
  return Object.freeze({ provider, model, controls: Object.freeze(controls) });
}

function normalizeVideoOptions(
  input: FuryMediaStudioPreviewOptions | undefined,
  adapters: readonly FuryMediaGenerationAdapter[],
): { readonly provider: string; readonly model: string; readonly controls: Readonly<Record<string, string | number>> } {
  if (input !== undefined && (typeof input !== 'object' || input === null || Array.isArray(input))) throw new TypeError('media studio video controls are invalid');
  const options = input ?? {};
  const allowedKeys = new Set(['provider', 'model', 'reference', 'durationMs', 'fps', 'aspectRatio', 'resolution']);
  if (Object.keys(options).some((key) => !allowedKeys.has(key))) throw new TypeError('media studio video controls contain an unsupported field');
  const { provider, model } = normalizeProviderModel(options, adapters, 'video-generation');
  const controls: Record<string, string | number> = {
    aspectRatio: boundedOption(options.aspectRatio, '16:9', ASPECT_RATIOS, 'aspect ratio'),
    resolution: boundedOption(options.resolution, '1080p', VIDEO_RESOLUTIONS, 'video resolution'),
  };
  const reference = boundedControlText(options.reference, 'video reference');
  if (reference !== undefined) {
    if (reference.length < 1 || reference.length > 512) throw new TypeError('media studio video reference is invalid');
    controls.reference = reference;
  }
  const durationMs = boundedNumber(options.durationMs, 'video duration', 500, 600_000, true);
  if (durationMs !== undefined) controls.durationMs = durationMs;
  const fps = boundedNumber(options.fps, 'video FPS', 1, 120, true);
  if (fps !== undefined) controls.fps = fps;
  return Object.freeze({ provider, model, controls: Object.freeze(controls) });
}

export function createFuryMediaStudioSnapshot(options: {
  readonly adapters?: readonly FuryMediaGenerationAdapter[];
  readonly now?: () => number;
} = {}): FuryMediaStudioSnapshot {
  const now = options.now ?? Date.now;
  if (typeof now !== 'function') throw new TypeError('media studio clock must be a function');
  const adapters = options.adapters ?? [];
  if (!Array.isArray(adapters) || adapters.length > 128) throw new TypeError('media studio adapter observation is invalid');
  const observations = adapters.map((adapter) => Object.freeze({
    selectorId: selectorId(adapter),
    bundleId: adapter.bundleId,
    bundleVersion: adapter.bundleVersion,
    profileId: adapter.profileId,
    family: adapter.family,
    supportedModes: Object.freeze([...adapter.supportedModes]),
    supportedMimeTypes: Object.freeze([...(adapter.capabilities?.supportedMimeTypes ?? [])]),
    lifecycle: 'REGISTERED_CAPABILITY_ONLY' as const,
    executionAuthorized: false as const,
  }));
  return Object.freeze({
    format: FURY_MEDIA_STUDIO_FORMAT,
    generatedAt: nowValue(now),
    authority: 'studio-preview-only',
    executionAuthorized: false,
    providerExecution: observations.length > 0 ? 'ADAPTER_REGISTERED_NOT_LIVE_VALIDATED' : 'NOT_CONFIGURED',
    surfaces: Object.freeze(Object.values(SURFACES)),
    adapters: Object.freeze(observations),
  });
}

export function createFuryMediaStudioPreview(input: {
  readonly surface: FuryMediaStudioSurfaceId;
  readonly operation: FuryMediaGenerationMode;
  readonly prompt: string;
  readonly outputMimeType: string;
  readonly options?: FuryMediaStudioPreviewOptions;
  readonly adapters?: readonly FuryMediaGenerationAdapter[];
}): FuryMediaStudioPreview {
  const surface = surfaceFor(input.surface);
  if (!surface.operations.includes(input.operation)) throw new TypeError('media studio operation is not supported by the selected surface');
  if (typeof input.prompt !== 'string' || input.prompt.length < 1 || input.prompt.length > 1_048_576 || input.prompt.includes('\0')) throw new TypeError('media studio prompt is invalid or exceeds its bound');
  if (typeof input.outputMimeType !== 'string' || !MIME.test(input.outputMimeType) || !surface.outputMimeTypes.includes(input.outputMimeType)) throw new TypeError('media studio output MIME is invalid for the selected surface');
  const adapters = input.adapters ?? [];
  if (!Array.isArray(adapters) || adapters.length > 128) throw new TypeError('media studio adapter selection is invalid');
  const surfaceOptions = input.surface === 'image'
    ? normalizeImageOptions(input.options, adapters)
    : input.surface === 'video'
      ? normalizeVideoOptions(input.options, adapters)
      : { provider: 'AUTO', model: 'AUTO', controls: Object.freeze({}) };
  if (input.surface === 'audio' && input.options !== undefined && Object.keys(input.options).length > 0) throw new TypeError('media studio audio controls are not implemented in the preview boundary');
  const promptDigestSha256 = digest(input.prompt);
  const controlsDigestSha256 = digest(JSON.stringify(surfaceOptions.controls));
  const idempotencySeedDigestSha256 = digest(JSON.stringify({ surface: input.surface, operation: input.operation, promptDigestSha256, outputMimeType: input.outputMimeType, provider: surfaceOptions.provider, model: surfaceOptions.model, controlsDigestSha256 }));
  return Object.freeze({
    format: FURY_MEDIA_STUDIO_PREVIEW_FORMAT,
    surface: input.surface,
    operation: input.operation,
    outputMimeType: input.outputMimeType,
    provider: surfaceOptions.provider,
    model: surfaceOptions.model,
    promptDigestSha256,
    promptBytes: new TextEncoder().encode(input.prompt).byteLength,
    controlsDigestSha256,
    idempotencySeedDigestSha256,
    state: 'PREVIEW_ONLY_REQUIRES_RUNTIME_AUTHORITY',
    requiresApproval: true,
    executionAuthorized: false,
    next: 'REGISTER_PROVIDER_ADAPTER_AND_EXPLICITLY_AUTHORIZE',
  });
}

export function createFuryMediaStudioGallery(jobs: readonly FuryMediaGenerationJob[]): FuryMediaStudioGallery {
  if (!Array.isArray(jobs) || jobs.length > 1_000) throw new TypeError('media studio job history is invalid');
  const items = jobs.map((job) => {
    const surface: FuryMediaStudioSurfaceId = job.kind === 'image' ? 'image' : job.kind === 'video' ? 'video' : 'audio';
    const outputReferences = job.outputReferences as readonly FuryMediaGenerationJobOutputReference[];
    const outputMimeTypes = [...new Set<string>(outputReferences.map((reference) => reference.mimeType))];
    const latencyMs = job.updatedAt >= job.createdAt ? job.updatedAt - job.createdAt : null;
    return Object.freeze({
      jobId: job.jobId,
      surface,
      operation: job.operation,
      status: job.status,
      promptDigestSha256: job.promptDigestSha256,
      provider: job.bundleId,
      model: job.providerProfileId,
      outputMimeTypes: Object.freeze(outputMimeTypes),
      dimensions: 'UNKNOWN' as const,
      seed: 'UNKNOWN' as const,
      cost: 'UNKNOWN' as const,
      latencyMs,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      provenance: Object.freeze({
        requestDigestSha256: job.requestDigestSha256,
        planDigestSha256: job.planDigestSha256,
        mediaSha256: Object.freeze(outputReferences.map((reference) => reference.mediaSha256)),
        artifactIds: Object.freeze(outputReferences.map((reference) => reference.artifactId)),
      }),
    });
  });
  return Object.freeze({
    format: FURY_MEDIA_STUDIO_GALLERY_FORMAT,
    authority: 'read-only-media-job-history',
    state: 'READY',
    jobs: Object.freeze(items),
  });
}
