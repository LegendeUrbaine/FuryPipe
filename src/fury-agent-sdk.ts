import { createHash } from 'node:crypto';

import {
  FURY_CAPABILITIES,
  type FuryCapability,
  type FuryCapabilityDecision,
} from './fury-ir.js';

/**
 * FuryPipe Agent SDK — declarative authoring only.
 *
 * This module describes agents, their bounded contracts and their explicit
 * message graph. It deliberately does not register callbacks, load modules,
 * invoke models/tools, read credentials or create an execution worker.
 */
export const FURY_AGENT_SDK_MANIFEST_FORMAT = 'furypipe-agent-sdk-manifest/v1' as const;

export const FURY_AGENT_SDK_ROLES = Object.freeze([
  'planner',
  'researcher',
  'coder',
  'tester',
  'reviewer',
  'security-reviewer',
  'designer',
  'writer',
  'documentation-agent',
] as const);
export type FuryAgentSdkRole = (typeof FURY_AGENT_SDK_ROLES)[number];

export const FURY_AGENT_SDK_VALUE_TYPES = Object.freeze([
  'string',
  'number',
  'boolean',
  'object',
  'array',
  'null',
  'unknown',
] as const);
export type FuryAgentSdkValueType = (typeof FURY_AGENT_SDK_VALUE_TYPES)[number];

export const FURY_AGENT_SDK_SCHEMA_FORMATS = Object.freeze([
  'json',
  'text',
  'artifact',
  'event',
] as const);
export type FuryAgentSdkSchemaFormat = (typeof FURY_AGENT_SDK_SCHEMA_FORMATS)[number];

export const FURY_AGENT_SDK_CONTEXT_SOURCES = Object.freeze([
  'task',
  'workspace',
  'memory',
  'graph',
  'artifact',
  'agent',
] as const);
export type FuryAgentSdkContextSource = (typeof FURY_AGENT_SDK_CONTEXT_SOURCES)[number];

export const FURY_AGENT_SDK_TOOL_KINDS = Object.freeze([
  'skill',
  'mcp',
  'builtin',
  'model',
] as const);
export type FuryAgentSdkToolKind = (typeof FURY_AGENT_SDK_TOOL_KINDS)[number];

export interface FuryAgentSdkSchemaField {
  readonly name: string;
  readonly type: FuryAgentSdkValueType;
  readonly required: boolean;
}

/** A bounded schema descriptor. The host may bind a richer schema by digest. */
export interface FuryAgentSdkSchema {
  readonly id: string;
  readonly format: FuryAgentSdkSchemaFormat;
  readonly fields: readonly FuryAgentSdkSchemaField[];
}

export interface FuryAgentSdkInput {
  readonly name: string;
  readonly type: FuryAgentSdkValueType;
  readonly required: boolean;
}

export interface FuryAgentSdkContext {
  readonly name: string;
  readonly source: FuryAgentSdkContextSource;
  readonly required: boolean;
  readonly maxBytes: number;
}

export interface FuryAgentSdkPermissions {
  readonly capabilities: Readonly<Record<FuryCapability, FuryCapabilityDecision>>;
  /** Secret values remain outside the contract and are never requested here. */
  readonly secrets: 'never-requested' | 'host-managed';
}

export interface FuryAgentSdkBudget {
  readonly maxTokens: number;
  readonly maxToolCalls: number;
  readonly maxWallTimeMs: number;
  readonly maxSubagents: number;
}

export interface FuryAgentSdkAgent {
  readonly id: string;
  readonly displayName: string;
  readonly role: FuryAgentSdkRole;
  readonly goal: string;
  readonly inputs: readonly FuryAgentSdkInput[];
  readonly context: readonly FuryAgentSdkContext[];
  readonly skills: readonly string[];
  readonly tools: readonly { readonly id: string; readonly kind: FuryAgentSdkToolKind }[];
  readonly permissions: FuryAgentSdkPermissions;
  readonly budget: FuryAgentSdkBudget;
  readonly outputSchema: FuryAgentSdkSchema;
  readonly dependsOn: readonly string[];
}

export interface FuryAgentSdkChannel {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly messageSchema: FuryAgentSdkSchema;
}

export interface FuryAgentSdkManifestInput {
  readonly id: string;
  readonly displayName: string;
  readonly version: number;
  readonly agents: readonly FuryAgentSdkAgent[];
  readonly channels: readonly FuryAgentSdkChannel[];
}

export interface FuryAgentSdkManifest extends FuryAgentSdkManifestInput {
  readonly format: typeof FURY_AGENT_SDK_MANIFEST_FORMAT;
  readonly manifestDigestSha256: string;
  readonly order: readonly string[];
  readonly parallelGroups: readonly (readonly string[])[];
  readonly messageBus: {
    readonly mode: 'explicit-channel-only';
    readonly implicitDependencies: false;
    readonly executionAuthorized: false;
  };
  readonly authority: 'authoring-and-inspection-only';
  readonly registrationAuthorized: false;
  readonly networkAuthorized: false;
  readonly filesystemAuthorized: false;
  readonly executionAuthorized: false;
}

const AGENT_KEYS = ['id', 'displayName', 'role', 'goal', 'inputs', 'context', 'skills', 'tools', 'permissions', 'budget', 'outputSchema', 'dependsOn'] as const;
const CHANNEL_KEYS = ['id', 'from', 'to', 'messageSchema'] as const;
const SCHEMA_KEYS = ['id', 'format', 'fields'] as const;
const FIELD_KEYS = ['name', 'type', 'required'] as const;
const INPUT_KEYS = ['name', 'type', 'required'] as const;
const CONTEXT_KEYS = ['name', 'source', 'required', 'maxBytes'] as const;
const TOOL_KEYS = ['id', 'kind'] as const;
const PERMISSION_KEYS = ['capabilities', 'secrets'] as const;
const BUDGET_KEYS = ['maxTokens', 'maxToolCalls', 'maxWallTimeMs', 'maxSubagents'] as const;
const MAX_AGENTS = 64;
const MAX_CHANNELS = 256;
const MAX_LIST_ITEMS = 64;
const MAX_GOAL_CHARS = 8_192;
const MAX_CONTEXT_BYTES = 4 * 1024 * 1024;
const MAX_WALL_TIME_MS = 7 * 24 * 60 * 60 * 1000;

function objectRecord(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error(`${label} must be a plain object`);
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

function uniqueSorted(values: readonly string[], label: string, max = MAX_LIST_ITEMS): readonly string[] {
  if (!Array.isArray(values) || values.length > max) throw new Error(`${label} must contain at most ${max} entries`);
  const normalized = values.map((value) => boundedText(value, `${label} entry`));
  const seen = new Set<string>();
  for (const value of normalized) {
    const key = value.toLowerCase();
    if (seen.has(key)) throw new Error(`${label} contains duplicates`);
    seen.add(key);
  }
  return Object.freeze([...normalized].sort((a, b) => a.localeCompare(b)));
}

function identifierList(values: unknown, label: string, max = MAX_LIST_ITEMS): readonly string[] {
  if (!Array.isArray(values) || values.length > max) throw new Error(`${label} must contain at most ${max} entries`);
  const normalized = values.map((value, index) => identifier(value, `${label}[${index}]`));
  if (new Set(normalized).size !== normalized.length) throw new Error(`${label} contains duplicates`);
  return Object.freeze([...normalized].sort((a, b) => a.localeCompare(b)));
}

function valueType(value: unknown, label: string): FuryAgentSdkValueType {
  if (!FURY_AGENT_SDK_VALUE_TYPES.includes(value as FuryAgentSdkValueType)) throw new Error(`${label} is unsupported`);
  return value as FuryAgentSdkValueType;
}

function schema(value: unknown, label: string): FuryAgentSdkSchema {
  const source = objectRecord(value, label);
  knownKeys(source, SCHEMA_KEYS, label);
  if (!Array.isArray(source.fields) || source.fields.length > MAX_LIST_ITEMS) throw new Error(`${label}.fields must contain at most ${MAX_LIST_ITEMS} entries`);
  const fields = source.fields.map((raw, index) => {
    const field = objectRecord(raw, `${label}.fields[${index}]`);
    knownKeys(field, FIELD_KEYS, `${label}.fields[${index}]`);
    if (typeof field.required !== 'boolean') throw new Error(`${label}.fields[${index}].required must be boolean`);
    const normalized = Object.freeze({
      name: identifier(field.name, `${label}.fields[${index}].name`),
      type: valueType(field.type, `${label}.fields[${index}].type`),
      required: field.required,
    });
    return normalized;
  });
  const names = fields.map((field) => field.name);
  if (new Set(names).size !== names.length) throw new Error(`${label}.fields contains duplicates`);
  fields.sort((a, b) => a.name.localeCompare(b.name));
  const format = source.format;
  if (!FURY_AGENT_SDK_SCHEMA_FORMATS.includes(format as FuryAgentSdkSchemaFormat)) throw new Error(`${label}.format is unsupported`);
  return Object.freeze({
    id: identifier(source.id, `${label}.id`),
    format: format as FuryAgentSdkSchemaFormat,
    fields: Object.freeze(fields),
  });
}

function inputs(value: unknown, label: string): readonly FuryAgentSdkInput[] {
  if (!Array.isArray(value) || value.length > MAX_LIST_ITEMS) throw new Error(`${label} must contain at most ${MAX_LIST_ITEMS} entries`);
  const result = value.map((raw, index) => {
    const input = objectRecord(raw, `${label}[${index}]`);
    knownKeys(input, INPUT_KEYS, `${label}[${index}]`);
    if (typeof input.required !== 'boolean') throw new Error(`${label}[${index}].required must be boolean`);
    return Object.freeze({
      name: identifier(input.name, `${label}[${index}].name`),
      type: valueType(input.type, `${label}[${index}].type`),
      required: input.required,
    });
  });
  if (new Set(result.map((entry) => entry.name)).size !== result.length) throw new Error(`${label} contains duplicates`);
  result.sort((a, b) => a.name.localeCompare(b.name));
  return Object.freeze(result);
}

function contexts(value: unknown, label: string): readonly FuryAgentSdkContext[] {
  if (!Array.isArray(value) || value.length > MAX_LIST_ITEMS) throw new Error(`${label} must contain at most ${MAX_LIST_ITEMS} entries`);
  const result = value.map((raw, index) => {
    const context = objectRecord(raw, `${label}[${index}]`);
    knownKeys(context, CONTEXT_KEYS, `${label}[${index}]`);
    if (typeof context.required !== 'boolean') throw new Error(`${label}[${index}].required must be boolean`);
    if (!FURY_AGENT_SDK_CONTEXT_SOURCES.includes(context.source as FuryAgentSdkContextSource)) throw new Error(`${label}[${index}].source is unsupported`);
    if (typeof context.maxBytes !== 'number' || !Number.isSafeInteger(context.maxBytes) || context.maxBytes < 1 || context.maxBytes > MAX_CONTEXT_BYTES) throw new Error(`${label}[${index}].maxBytes is invalid`);
    return Object.freeze({
      name: identifier(context.name, `${label}[${index}].name`),
      source: context.source as FuryAgentSdkContextSource,
      required: context.required,
      maxBytes: context.maxBytes,
    });
  });
  if (new Set(result.map((entry) => entry.name)).size !== result.length) throw new Error(`${label} contains duplicates`);
  result.sort((a, b) => a.name.localeCompare(b.name));
  return Object.freeze(result);
}

function tools(value: unknown, label: string): readonly { readonly id: string; readonly kind: FuryAgentSdkToolKind }[] {
  if (!Array.isArray(value) || value.length > MAX_LIST_ITEMS) throw new Error(`${label} must contain at most ${MAX_LIST_ITEMS} entries`);
  const result = value.map((raw, index) => {
    const tool = objectRecord(raw, `${label}[${index}]`);
    knownKeys(tool, TOOL_KEYS, `${label}[${index}]`);
    if (!FURY_AGENT_SDK_TOOL_KINDS.includes(tool.kind as FuryAgentSdkToolKind)) throw new Error(`${label}[${index}].kind is unsupported`);
    return Object.freeze({ id: identifier(tool.id, `${label}[${index}].id`), kind: tool.kind as FuryAgentSdkToolKind });
  });
  if (new Set(result.map((entry) => entry.id.toLowerCase())).size !== result.length) throw new Error(`${label} contains duplicate ids`);
  result.sort((a, b) => a.id.localeCompare(b.id) || a.kind.localeCompare(b.kind));
  return Object.freeze(result);
}

function permissions(value: unknown, label: string): FuryAgentSdkPermissions {
  const source = objectRecord(value, label);
  knownKeys(source, PERMISSION_KEYS, label);
  const capabilities = objectRecord(source.capabilities, `${label}.capabilities`);
  knownKeys(capabilities, FURY_CAPABILITIES, `${label}.capabilities`);
  const normalized = Object.fromEntries(FURY_CAPABILITIES.map((capability) => {
    const decision = capabilities[capability];
    if (decision !== 'ALLOW' && decision !== 'ASK' && decision !== 'DENY') throw new Error(`${label}.capabilities.${capability} is invalid`);
    return [capability, decision];
  })) as Record<FuryCapability, FuryCapabilityDecision>;
  if (source.secrets !== 'never-requested' && source.secrets !== 'host-managed') throw new Error(`${label}.secrets is invalid`);
  return Object.freeze({ capabilities: Object.freeze(normalized), secrets: source.secrets });
}

function budget(value: unknown, label: string): FuryAgentSdkBudget {
  const source = objectRecord(value, label);
  knownKeys(source, BUDGET_KEYS, label);
  const limits: Readonly<Record<keyof FuryAgentSdkBudget, number>> = {
    maxTokens: 100_000_000,
    maxToolCalls: 100_000,
    maxWallTimeMs: MAX_WALL_TIME_MS,
    maxSubagents: MAX_AGENTS,
  };
  const normalized = {} as Record<keyof FuryAgentSdkBudget, number>;
  for (const key of BUDGET_KEYS) {
    const current = source[key];
    if (!Number.isSafeInteger(current) || (current as number) < 0 || (current as number) > limits[key]) throw new Error(`${label}.${key} is invalid`);
    normalized[key] = current as number;
  }
  if (normalized.maxTokens < 1 || normalized.maxWallTimeMs < 1) throw new Error(`${label} must allow positive tokens and wall time`);
  return Object.freeze(normalized);
}

function agent(value: unknown, label = 'agent'): FuryAgentSdkAgent {
  const source = objectRecord(value, label);
  knownKeys(source, AGENT_KEYS, label);
  if (!FURY_AGENT_SDK_ROLES.includes(source.role as FuryAgentSdkRole)) throw new Error(`${label}.role is unsupported`);
  return Object.freeze({
    id: identifier(source.id, `${label}.id`),
    displayName: boundedText(source.displayName, `${label}.displayName`),
    role: source.role as FuryAgentSdkRole,
    goal: boundedText(source.goal, `${label}.goal`, MAX_GOAL_CHARS),
    inputs: inputs(source.inputs, `${label}.inputs`),
    context: contexts(source.context, `${label}.context`),
    skills: uniqueSorted(source.skills as readonly string[], `${label}.skills`),
    tools: tools(source.tools, `${label}.tools`),
    permissions: permissions(source.permissions, `${label}.permissions`),
    budget: budget(source.budget, `${label}.budget`),
    outputSchema: schema(source.outputSchema, `${label}.outputSchema`),
    dependsOn: identifierList(source.dependsOn, `${label}.dependsOn`),
  });
}

function channels(value: unknown, agents: ReadonlyMap<string, FuryAgentSdkAgent>): readonly FuryAgentSdkChannel[] {
  if (!Array.isArray(value) || value.length > MAX_CHANNELS) throw new Error(`channels must contain at most ${MAX_CHANNELS} entries`);
  const result = value.map((raw, index) => {
    const channel = objectRecord(raw, `channels[${index}]`);
    knownKeys(channel, CHANNEL_KEYS, `channels[${index}]`);
    const from = identifier(channel.from, `channels[${index}].from`);
    const to = identifier(channel.to, `channels[${index}].to`);
    if (!agents.has(from) || !agents.has(to)) throw new Error(`channels[${index}] references an unknown agent`);
    if (from === to) throw new Error(`channels[${index}] cannot target itself`);
    if (!agents.get(to)!.dependsOn.includes(from)) throw new Error(`channels[${index}] creates an implicit dependency; add ${from} to ${to}.dependsOn`);
    return Object.freeze({
      id: identifier(channel.id, `channels[${index}].id`),
      from,
      to,
      messageSchema: schema(channel.messageSchema, `channels[${index}].messageSchema`),
    });
  });
  if (new Set(result.map((channel) => channel.id)).size !== result.length) throw new Error('channels contains duplicate ids');
  if (new Set(result.map((channel) => `${channel.from}\0${channel.to}`)).size !== result.length) throw new Error('channels contains duplicate agent pairs');
  result.sort((a, b) => a.id.localeCompare(b.id));
  return Object.freeze(result);
}

function graphOrder(agents: readonly FuryAgentSdkAgent[]): { readonly order: readonly string[]; readonly parallelGroups: readonly (readonly string[])[] } {
  const byId = new Map(agents.map((entry) => [entry.id, entry]));
  for (const entry of agents) for (const dependency of entry.dependsOn) {
    if (!byId.has(dependency)) throw new Error(`agent ${entry.id} depends on unknown agent ${dependency}`);
    if (dependency === entry.id) throw new Error(`agent ${entry.id} depends on itself`);
  }
  const indegree = new Map(agents.map((entry) => [entry.id, entry.dependsOn.length]));
  const ready = agents.filter((entry) => entry.dependsOn.length === 0).map((entry) => entry.id).sort();
  const order: string[] = [];
  const groups: string[][] = [];
  const level = new Map<string, number>();
  while (ready.length > 0) {
    const id = ready.shift()!;
    order.push(id);
    const currentLevel = level.get(id) ?? 0;
    (groups[currentLevel] ??= []).push(id);
    const children = agents.filter((entry) => entry.dependsOn.includes(id)).map((entry) => entry.id);
    for (const child of children) {
      level.set(child, Math.max(level.get(child) ?? 0, currentLevel + 1));
      const next = indegree.get(child)! - 1;
      indegree.set(child, next);
      if (next === 0) {
        ready.push(child);
        ready.sort();
      }
    }
  }
  if (order.length !== agents.length) throw new Error('agent graph contains a cycle');
  return Object.freeze({
    order: Object.freeze(order),
    parallelGroups: Object.freeze(groups.map((group) => Object.freeze([...group].sort()))),
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

/** Normalize one explicit agent contract without registering or executing it. */
export function defineFuryAgentContract(value: FuryAgentSdkAgent): FuryAgentSdkAgent {
  return agent(value);
}

/** Compile an explicit agent graph for review, signing or Studio projection. */
export function compileFuryAgentSdkManifest(value: FuryAgentSdkManifestInput): FuryAgentSdkManifest {
  const source = objectRecord(value, 'agent SDK manifest');
  knownKeys(source, ['id', 'displayName', 'version', 'agents', 'channels'], 'agent SDK manifest');
  if (!Number.isSafeInteger(source.version) || (source.version as number) < 1 || (source.version as number) > 1_000_000) throw new Error('agent SDK manifest.version is invalid');
  if (!Array.isArray(source.agents) || source.agents.length === 0 || source.agents.length > MAX_AGENTS) throw new Error(`agent SDK manifest.agents must contain 1..${MAX_AGENTS} entries`);
  const normalizedAgents = source.agents.map((entry, index) => agent(entry, `agents[${index}]`)).sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(normalizedAgents.map((entry) => entry.id)).size !== normalizedAgents.length) throw new Error('agents contains duplicate ids');
  const agentMap = new Map(normalizedAgents.map((entry) => [entry.id, entry]));
  const graph = graphOrder(normalizedAgents);
  const normalizedChannels = channels(source.channels, agentMap);
  const payload = Object.freeze({
    format: FURY_AGENT_SDK_MANIFEST_FORMAT,
    id: identifier(source.id, 'agent SDK manifest.id'),
    displayName: boundedText(source.displayName, 'agent SDK manifest.displayName'),
    version: source.version as number,
    agents: Object.freeze(normalizedAgents),
    channels: normalizedChannels,
    order: graph.order,
    parallelGroups: graph.parallelGroups,
    messageBus: Object.freeze({ mode: 'explicit-channel-only' as const, implicitDependencies: false as const, executionAuthorized: false as const }),
  });
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
