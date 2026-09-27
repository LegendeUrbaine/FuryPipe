import { createHash } from 'node:crypto';

import type {
  FuryMediaGenerationAdapter,
  FuryMediaGenerationMode,
} from './media-generation-runtime.js';

export const FURY_MEDIA_STUDIO_FORMAT = 'furypipe-media-studio/v1' as const;
export const FURY_MEDIA_STUDIO_PREVIEW_FORMAT = 'furypipe-media-studio-preview/v1' as const;

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
  readonly bundleId: string;
  readonly bundleVersion: string;
  readonly profileId: string;
  readonly family: string;
  readonly supportedModes: readonly FuryMediaGenerationMode[];
  readonly supportedMimeTypes: readonly string[];
  readonly lifecycle: 'REGISTERED_CAPABILITY_ONLY';
  readonly executionAuthorized: false;
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
  readonly promptDigestSha256: string;
  readonly promptBytes: number;
  readonly idempotencySeedDigestSha256: string;
  readonly state: 'PREVIEW_ONLY_REQUIRES_RUNTIME_AUTHORITY';
  readonly requiresApproval: true;
  readonly executionAuthorized: false;
  readonly next: 'REGISTER_PROVIDER_ADAPTER_AND_EXPLICITLY_AUTHORIZE';
}

const MIME = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,63}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,127}$/u;
const SURFACES: Readonly<Record<FuryMediaStudioSurfaceId, FuryMediaStudioSurface>> = Object.freeze({
  image: Object.freeze({
    id: 'image', title: 'FuryImage Studio', family: 'image-generation',
    operations: Object.freeze(['text-to-image', 'image-to-image', 'inpaint', 'outpaint', 'variation', 'upscale', 'background-editing'] as FuryMediaGenerationMode[]),
    outputMimeTypes: Object.freeze(['image/png', 'image/jpeg']),
    controls: Object.freeze([
      Object.freeze({ id: 'prompt', label: 'Prompt', type: 'text', required: true, bounded: true as const }),
      Object.freeze({ id: 'negativePrompt', label: 'Negative prompt', type: 'text', required: false, bounded: true as const }),
      Object.freeze({ id: 'width', label: 'Width', type: 'number', required: false, bounded: true as const }),
      Object.freeze({ id: 'height', label: 'Height', type: 'number', required: false, bounded: true as const }),
      Object.freeze({ id: 'seed', label: 'Seed', type: 'number', required: false, bounded: true as const }),
    ]),
    state: 'CORE_AVAILABLE_PROVIDER_OPTIONAL', executionAuthorized: false,
  }),
  video: Object.freeze({
    id: 'video', title: 'FuryVideo Studio', family: 'video-generation',
    operations: Object.freeze(['text-to-video', 'image-to-video', 'video-to-video', 'continue-video', 'lip-sync'] as FuryMediaGenerationMode[]),
    outputMimeTypes: Object.freeze(['video/mp4', 'video/webm']),
    controls: Object.freeze([
      Object.freeze({ id: 'prompt', label: 'Prompt', type: 'text', required: true, bounded: true as const }),
      Object.freeze({ id: 'durationMs', label: 'Duration', type: 'number', required: false, bounded: true as const }),
      Object.freeze({ id: 'fps', label: 'FPS', type: 'number', required: false, bounded: true as const }),
      Object.freeze({ id: 'aspectRatio', label: 'Aspect ratio', type: 'select', required: false, bounded: true as const }),
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

export function createFuryMediaStudioSnapshot(options: {
  readonly adapters?: readonly FuryMediaGenerationAdapter[];
  readonly now?: () => number;
} = {}): FuryMediaStudioSnapshot {
  const now = options.now ?? Date.now;
  if (typeof now !== 'function') throw new TypeError('media studio clock must be a function');
  const adapters = options.adapters ?? [];
  if (!Array.isArray(adapters) || adapters.length > 128) throw new TypeError('media studio adapter observation is invalid');
  const observations = adapters.map((adapter) => Object.freeze({
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
}): FuryMediaStudioPreview {
  const surface = surfaceFor(input.surface);
  if (!surface.operations.includes(input.operation)) throw new TypeError('media studio operation is not supported by the selected surface');
  if (typeof input.prompt !== 'string' || input.prompt.length < 1 || input.prompt.length > 1_048_576 || input.prompt.includes('\0')) throw new TypeError('media studio prompt is invalid or exceeds its bound');
  if (typeof input.outputMimeType !== 'string' || !MIME.test(input.outputMimeType) || !surface.outputMimeTypes.includes(input.outputMimeType)) throw new TypeError('media studio output MIME is invalid for the selected surface');
  const promptDigestSha256 = digest(input.prompt);
  const idempotencySeedDigestSha256 = digest(JSON.stringify({ surface: input.surface, operation: input.operation, promptDigestSha256, outputMimeType: input.outputMimeType }));
  return Object.freeze({
    format: FURY_MEDIA_STUDIO_PREVIEW_FORMAT,
    surface: input.surface,
    operation: input.operation,
    outputMimeType: input.outputMimeType,
    promptDigestSha256,
    promptBytes: new TextEncoder().encode(input.prompt).byteLength,
    idempotencySeedDigestSha256,
    state: 'PREVIEW_ONLY_REQUIRES_RUNTIME_AUTHORITY',
    requiresApproval: true,
    executionAuthorized: false,
    next: 'REGISTER_PROVIDER_ADAPTER_AND_EXPLICITLY_AUTHORIZE',
  });
}
