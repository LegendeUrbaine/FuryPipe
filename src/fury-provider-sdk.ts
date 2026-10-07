import { createHash } from 'node:crypto';

import type {
  ModelFabricCapabilities,
  ModelFabricCapability,
  ModelFabricLimits,
  ModelFabricModalities,
} from './core/model-fabric.js';
import type { ProviderFabricProtocol } from './core/provider-fabric.js';

export const FURY_PROVIDER_SDK_MANIFEST_FORMAT = 'furypipe-provider-sdk-manifest/v1' as const;

export type FuryProviderSdkProtocol = ProviderFabricProtocol | 'openai-compatible' | 'anthropic-compatible' | 'local' | 'custom';
export type FuryProviderSdkCapability = ModelFabricCapability;
export type FuryProviderSdkReasoningEffort = 'low' | 'medium' | 'high' | 'maximum';

export interface FuryProviderSdkControlRange {
  readonly min: number;
  readonly max: number;
  readonly step?: number;
}

/** Explicit model controls only; omitted controls remain unknown to FuryPipe. */
export interface FuryProviderSdkPowerControls {
  readonly reasoningEffort?: readonly FuryProviderSdkReasoningEffort[];
  readonly thinkingBudgetTokens?: FuryProviderSdkControlRange;
  readonly temperature?: FuryProviderSdkControlRange;
  readonly maxTokens?: FuryProviderSdkControlRange;
  readonly latencyProfiles?: readonly string[];
  readonly toolUse?: FuryProviderSdkCapability;
  readonly contextStrategies?: readonly string[];
}

export interface FuryProviderSdkModel {
  readonly id: string;
  readonly displayName: string;
  /** Every field must be declared as yes, no or unknown; SDK never infers it. */
  readonly modalities: ModelFabricModalities;
  readonly capabilities: ModelFabricCapabilities;
  readonly limits: ModelFabricLimits;
  readonly powerControls?: FuryProviderSdkPowerControls;
}

export interface FuryProviderSdkAdapter {
  readonly id: string;
  readonly displayName: string;
  readonly protocol: FuryProviderSdkProtocol;
  readonly models: readonly FuryProviderSdkModel[];
}

export interface FuryProviderSdkManifest {
  readonly format: typeof FURY_PROVIDER_SDK_MANIFEST_FORMAT;
  readonly adapter: FuryProviderSdkAdapter;
  readonly manifestDigestSha256: string;
  readonly authority: 'authoring-and-inspection-only';
  readonly registrationAuthorized: false;
  readonly networkAuthorized: false;
  readonly filesystemAuthorized: false;
  readonly executionAuthorized: false;
}

const PROTOCOLS: readonly FuryProviderSdkProtocol[] = [
  'anthropic', 'openai', 'google', 'openai-compatible', 'anthropic-compatible', 'local', 'custom',
];
const CAPABILITIES: readonly FuryProviderSdkCapability[] = ['yes', 'no', 'unknown'];
const CONTROL_KEYS = ['reasoningEffort', 'thinkingBudgetTokens', 'temperature', 'maxTokens', 'latencyProfiles', 'toolUse', 'contextStrategies'] as const;
const RANGE_KEYS = ['min', 'max', 'step'] as const;
const MODEL_KEYS = ['id', 'displayName', 'modalities', 'capabilities', 'limits', 'powerControls'] as const;
const ADAPTER_KEYS = ['id', 'displayName', 'protocol', 'models'] as const;
const MODALITY_KEYS = ['textInput', 'imageInput', 'audioInput', 'videoInput', 'fileInput', 'textOutput', 'imageOutput', 'audioOutput'] as const;
const CAPABILITY_KEYS = ['reasoning', 'tools', 'structuredOutput', 'streaming'] as const;
const LIMIT_KEYS = ['contextTokens', 'outputTokens', 'maxImages', 'maxImageBytes', 'maxRequestBytes'] as const;
const REASONING_ORDER: readonly FuryProviderSdkReasoningEffort[] = ['low', 'medium', 'high', 'maximum'];
const MAX_MODELS = 256;
const MAX_LIST_ITEMS = 32;

function objectRecord(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Readonly<Record<string, unknown>>;
}

function knownKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[], label: string): void {
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new Error(`${label} contains unsupported key: ${key}`);
}

function boundedText(value: unknown, label: string, max = 256): string {
  if (typeof value !== 'string') throw new Error(`${label} must be text`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\u0000-\u001f\u007f]/u.test(normalized)) throw new Error(`${label} is invalid`);
  return normalized;
}

function identifier(value: unknown, label: string): string {
  const normalized = boundedText(value, label, 64).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]*$/u.test(normalized)) throw new Error(`${label} must use [a-z0-9._-]`);
  return normalized;
}

function stringList(value: unknown, label: string, max = MAX_LIST_ITEMS): readonly string[] {
  if (!Array.isArray(value) || value.length > max) throw new Error(`${label} must contain at most ${max} text entries`);
  const entries = value.map((entry) => boundedText(entry, `${label} entry`));
  const seen = new Set<string>();
  for (const entry of entries) {
    const key = entry.toLowerCase();
    if (seen.has(key)) throw new Error(`${label} contains duplicates`);
    seen.add(key);
  }
  return Object.freeze([...entries].sort((a, b) => a.localeCompare(b)));
}

function capabilityRecord<Keys extends readonly string[]>(value: unknown, keys: Keys, label: string): { [Key in Keys[number]]: FuryProviderSdkCapability } {
  const source = objectRecord(value, label);
  knownKeys(source, keys, label);
  const result: Partial<Record<Keys[number], FuryProviderSdkCapability>> = {};
  for (const key of keys) {
    const capability = source[key];
    if (!CAPABILITIES.includes(capability as FuryProviderSdkCapability)) throw new Error(`${label}.${key} must be yes, no or unknown`);
    result[key as Keys[number]] = capability as FuryProviderSdkCapability;
  }
  return result as { [Key in Keys[number]]: FuryProviderSdkCapability };
}

function limits(value: unknown): ModelFabricLimits {
  const source = objectRecord(value, 'limits');
  knownKeys(source, LIMIT_KEYS, 'limits');
  const result: Record<string, number> = {};
  for (const key of LIMIT_KEYS) {
    const limit = source[key];
    if (limit === undefined) continue;
    if (typeof limit !== 'number' || !Number.isSafeInteger(limit) || limit < 1) throw new Error(`limits.${key} must be a positive safe integer`);
    result[key] = limit;
  }
  return Object.freeze(result);
}

function range(value: unknown, label: string, integer: boolean): FuryProviderSdkControlRange {
  const source = objectRecord(value, label);
  knownKeys(source, RANGE_KEYS, label);
  const min = source.min;
  const max = source.max;
  const step = source.step;
  const validNumber = (entry: unknown): entry is number => typeof entry === 'number' && Number.isFinite(entry);
  if (!validNumber(min) || !validNumber(max) || min > max || (integer && (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)))) throw new Error(`${label} range is invalid`);
  if (step !== undefined && (!validNumber(step) || step <= 0 || (integer && !Number.isSafeInteger(step)))) throw new Error(`${label}.step is invalid`);
  return Object.freeze({ min, max, ...(step === undefined ? {} : { step }) });
}

function powerControls(value: unknown): FuryProviderSdkPowerControls {
  const source = objectRecord(value, 'powerControls');
  knownKeys(source, CONTROL_KEYS, 'powerControls');
  const result: {
    reasoningEffort?: readonly FuryProviderSdkReasoningEffort[];
    thinkingBudgetTokens?: FuryProviderSdkControlRange;
    temperature?: FuryProviderSdkControlRange;
    maxTokens?: FuryProviderSdkControlRange;
    latencyProfiles?: readonly string[];
    toolUse?: FuryProviderSdkCapability;
    contextStrategies?: readonly string[];
  } = {};
  if (source.reasoningEffort !== undefined) {
    if (!Array.isArray(source.reasoningEffort) || source.reasoningEffort.length === 0 || source.reasoningEffort.length > REASONING_ORDER.length) throw new Error('powerControls.reasoningEffort is invalid');
    const values = source.reasoningEffort;
    if (values.some((entry) => !REASONING_ORDER.includes(entry as FuryProviderSdkReasoningEffort))) throw new Error('powerControls.reasoningEffort is invalid');
    const unique = new Set(values as FuryProviderSdkReasoningEffort[]);
    if (unique.size !== values.length) throw new Error('powerControls.reasoningEffort contains duplicates');
    result.reasoningEffort = Object.freeze(REASONING_ORDER.filter((entry) => unique.has(entry)));
  }
  if (source.thinkingBudgetTokens !== undefined) result.thinkingBudgetTokens = range(source.thinkingBudgetTokens, 'powerControls.thinkingBudgetTokens', true);
  if (source.temperature !== undefined) result.temperature = range(source.temperature, 'powerControls.temperature', false);
  if (source.maxTokens !== undefined) result.maxTokens = range(source.maxTokens, 'powerControls.maxTokens', true);
  if (source.latencyProfiles !== undefined) result.latencyProfiles = stringList(source.latencyProfiles, 'powerControls.latencyProfiles');
  if (source.toolUse !== undefined) {
    if (!CAPABILITIES.includes(source.toolUse as FuryProviderSdkCapability)) throw new Error('powerControls.toolUse is invalid');
    result.toolUse = source.toolUse as FuryProviderSdkCapability;
  }
  if (source.contextStrategies !== undefined) result.contextStrategies = stringList(source.contextStrategies, 'powerControls.contextStrategies');
  return Object.freeze(result);
}

function model(value: unknown): FuryProviderSdkModel {
  const source = objectRecord(value, 'model');
  knownKeys(source, MODEL_KEYS, 'model');
  const id = boundedText(source.id, 'model.id', 256);
  const modalities: ModelFabricModalities = capabilityRecord(source.modalities, MODALITY_KEYS, 'model.modalities');
  const capabilities: ModelFabricCapabilities = capabilityRecord(source.capabilities, CAPABILITY_KEYS, 'model.capabilities');
  return Object.freeze({
    id,
    displayName: boundedText(source.displayName, 'model.displayName'),
    modalities: Object.freeze(modalities),
    capabilities: Object.freeze(capabilities),
    limits: limits(source.limits),
    ...(source.powerControls === undefined ? {} : { powerControls: powerControls(source.powerControls) }),
  });
}

function adapter(value: unknown): FuryProviderSdkAdapter {
  const source = objectRecord(value, 'adapter');
  knownKeys(source, ADAPTER_KEYS, 'adapter');
  const id = identifier(source.id, 'adapter.id');
  const protocol = source.protocol;
  if (!PROTOCOLS.includes(protocol as FuryProviderSdkProtocol)) throw new Error('adapter.protocol is unsupported');
  if (!Array.isArray(source.models) || source.models.length > MAX_MODELS) throw new Error(`adapter.models must contain at most ${MAX_MODELS} entries`);
  const models = source.models.map(model);
  const seen = new Set<string>();
  for (const entry of models) {
    const key = entry.id.toLowerCase();
    if (seen.has(key)) throw new Error(`adapter.models contains duplicate id: ${entry.id}`);
    seen.add(key);
  }
  models.sort((a, b) => a.id.localeCompare(b.id));
  return Object.freeze({
    id,
    displayName: boundedText(source.displayName, 'adapter.displayName'),
    protocol: protocol as FuryProviderSdkProtocol,
    models: Object.freeze(models),
  });
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const record = value as Readonly<Record<string, unknown>>;
  return '{' + Object.keys(record).sort().map((key) => JSON.stringify(key) + ':' + canonical(record[key])).join(',') + '}';
}

function digest(value: unknown): string {
  return createHash('sha256').update(canonical(value), 'utf8').digest('hex');
}

/** Author a metadata-only provider adapter without registering or executing it. */
export function defineFuryProviderAdapter(value: FuryProviderSdkAdapter): FuryProviderSdkAdapter {
  return adapter(value);
}

/** Compile an adapter contract for review, signing or Model Hub projection. */
export function compileFuryProviderSdkManifest(value: FuryProviderSdkAdapter): FuryProviderSdkManifest {
  const normalized = defineFuryProviderAdapter(value);
  const payload = Object.freeze({ format: FURY_PROVIDER_SDK_MANIFEST_FORMAT, adapter: normalized });
  return Object.freeze({
    ...payload,
    manifestDigestSha256: digest(payload),
    authority: 'authoring-and-inspection-only',
    registrationAuthorized: false,
    networkAuthorized: false,
    filesystemAuthorized: false,
    executionAuthorized: false,
  });
}
