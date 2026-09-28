import { createHash } from 'node:crypto';

import type {
  MemoryVNextForgetReceipt,
  MemoryVNextHistoryInput,
  MemoryVNextInspection,
  MemoryVNextMemoryClass,
  MemoryVNextRestoreReceipt,
  MemoryVNextScopeKind,
  MemoryVNextScopeQuery,
  MemoryVNextState,
  MemoryVNextStore,
  MemoryVNextTransitionReceipt,
} from './memory-vnext.js';

export const FURY_MEMORY_TIME_MACHINE_FORMAT = 'furypipe-memory-time-machine/v1' as const;
export const FURY_MEMORY_SNAPSHOT_FORMAT = 'furypipe-memory-snapshot/v1' as const;
export const FURY_MEMORY_DIFF_FORMAT = 'furypipe-memory-snapshot-diff/v1' as const;
export const FURY_MEMORY_EXPORT_FORMAT = 'furypipe-memory-time-machine-export/v1' as const;
export const FURY_MEMORY_GRAPH_FORMAT = 'furypipe-memory-cross-project-graph/v1' as const;

const SCOPE_KINDS: readonly MemoryVNextScopeKind[] = ['global', 'workspace', 'project', 'user', 'agent'];
const MEMORY_ID = /^mvn-[0-9a-f]{48}$/u;
const MAX_SCOPES = 16;
const MAX_TIMELINE_ENTRIES = 4096;
const MAX_DIGEST = 64;

export type FuryMemoryTimeMachineAction = 'archive' | 'pin' | 'delete' | 'restore';
export type FuryMemoryActionPlanStatus = 'GOVERNED_EXECUTION_AVAILABLE' | 'PLAN_ONLY';

export interface FuryMemoryTimelineEntry {
  readonly format: 'furypipe-memory-time-machine-entry/v1';
  readonly checkpointId: string;
  readonly memoryId: string;
  readonly version: number;
  readonly state: MemoryVNextState;
  readonly memoryClass: MemoryVNextMemoryClass;
  readonly scope: Readonly<{ kind: MemoryVNextScopeKind; idDigest: string }>;
  readonly source: Readonly<{
    kind: string;
    idDigest: string;
    evidenceClass: string;
    acceptance: string;
    revoked: boolean;
  }>;
  readonly provenance: Readonly<{
    sourceKind: string;
    sourceIdDigest: string;
    evidenceClass: string;
    acceptance: string;
    reasonDigest: string;
  }>;
  readonly confidence: number;
  readonly retention: Readonly<{ kind: string; expiresAt?: number }>;
  readonly visibility: string;
  readonly contentDigest?: string;
  readonly createdAt: number;
  readonly lastConfirmedAt: number;
  readonly updatedAt: number;
  readonly supersedesVersion?: number;
  readonly restorable: boolean;
}

export interface FuryMemoryCrossProjectGraphNode {
  readonly id: string;
  readonly kind: 'scope' | 'memory' | 'source';
  readonly scopeKind?: MemoryVNextScopeKind;
  readonly memoryId?: string;
  readonly version?: number;
  readonly state?: MemoryVNextState;
  readonly sourceKind?: string;
}

export interface FuryMemoryCrossProjectGraphEdge {
  readonly from: string;
  readonly to: string;
  readonly relation: 'contains' | 'provenance';
}

export interface FuryMemoryCrossProjectGraph {
  readonly format: typeof FURY_MEMORY_GRAPH_FORMAT;
  readonly crossProject: boolean;
  readonly nodes: readonly FuryMemoryCrossProjectGraphNode[];
  readonly edges: readonly FuryMemoryCrossProjectGraphEdge[];
  readonly authority: 'memory-vnext-metadata-projection';
  readonly executionAuthority: false;
}

export interface FuryMemorySnapshot {
  readonly format: typeof FURY_MEMORY_SNAPSHOT_FORMAT;
  readonly snapshotId: string;
  readonly capturedAt: number;
  readonly scopeDigests: readonly string[];
  readonly timeline: readonly FuryMemoryTimelineEntry[];
  readonly graph: FuryMemoryCrossProjectGraph;
  readonly snapshotDigestSha256: string;
  readonly authority: 'memory-vnext-read-only';
  readonly executionAuthority: false;
}

export interface FuryMemorySnapshotDiffChange {
  readonly memoryId: string;
  readonly from?: FuryMemoryTimelineEntry;
  readonly to?: FuryMemoryTimelineEntry;
}

export interface FuryMemorySnapshotDiff {
  readonly format: typeof FURY_MEMORY_DIFF_FORMAT;
  readonly fromSnapshotId: string;
  readonly toSnapshotId: string;
  readonly added: readonly FuryMemoryTimelineEntry[];
  readonly removed: readonly FuryMemoryTimelineEntry[];
  readonly changed: readonly FuryMemorySnapshotDiffChange[];
  readonly summary: Readonly<{ added: number; removed: number; changed: number }>;
  readonly authority: 'memory-vnext-deterministic-diff';
  readonly executionAuthority: false;
}

export interface FuryMemoryTimeMachineExport {
  readonly format: typeof FURY_MEMORY_EXPORT_FORMAT;
  readonly exportedAt: number;
  readonly snapshot: FuryMemorySnapshot;
  readonly content: 'excluded-by-default';
  readonly provenance: 'metadata-only-recovery-backed-export';
  readonly authority: 'memory-vnext-read-only';
  readonly executionAuthority: false;
}

export interface FuryMemoryActionPlan {
  readonly format: 'furypipe-memory-time-machine-action-plan/v1';
  readonly action: FuryMemoryTimeMachineAction;
  readonly memoryId: string;
  readonly version?: number;
  readonly scope: Readonly<{ kind: MemoryVNextScopeKind; idDigest: string }>;
  readonly status: FuryMemoryActionPlanStatus;
  readonly requiresExplicitConfirmation: true;
  readonly reason: string;
  readonly authority: 'memory-vnext-governance' | 'memory-time-machine-plan';
  readonly executionAuthority: false;
}

export interface FuryMemoryTimeMachineTimelineInput {
  readonly scopes: readonly MemoryVNextScopeQuery[];
  readonly memoryId?: string;
  readonly now?: number;
}

export interface FuryMemoryTimeMachineActionInput {
  readonly action: FuryMemoryTimeMachineAction;
  readonly memoryId: string;
  readonly scope: MemoryVNextScopeQuery;
  readonly version?: number;
  readonly confirm?: boolean;
  readonly now?: number;
}

export interface FuryMemoryTimeMachine {
  timeline(input: FuryMemoryTimeMachineTimelineInput): Promise<readonly FuryMemoryTimelineEntry[]>;
  snapshot(input: FuryMemoryTimeMachineTimelineInput): Promise<FuryMemorySnapshot>;
  diff(input: Readonly<{ from: FuryMemorySnapshot; to: FuryMemorySnapshot }>): FuryMemorySnapshotDiff;
  exportSnapshot(input: Readonly<{ snapshot: FuryMemorySnapshot; now?: number }>): FuryMemoryTimeMachineExport;
  graph(input: FuryMemoryTimeMachineTimelineInput): Promise<FuryMemoryCrossProjectGraph>;
  planAction(input: FuryMemoryTimeMachineActionInput): FuryMemoryActionPlan;
  executeAction(input: FuryMemoryTimeMachineActionInput): Promise<MemoryVNextTransitionReceipt | MemoryVNextForgetReceipt | MemoryVNextRestoreReceipt>;
}

export interface CreateFuryMemoryTimeMachineOptions {
  readonly memory: MemoryVNextStore;
  readonly now?: () => number;
  readonly maxTimelineEntries?: number;
}

function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item)).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function scopeDigest(scope: MemoryVNextScopeQuery): string {
  if (!SCOPE_KINDS.includes(scope.kind)) throw new Error('memory time machine scope kind is invalid');
  if (typeof scope.id !== 'string' || !scope.id.trim() || scope.id.length > 1024 || scope.id.includes('\0')) {
    throw new Error('memory time machine scope ID is invalid');
  }
  return digest(`furypipe-memory-vnext/scope/v1\0${scope.kind}\0${scope.id.trim()}`);
}

function validateScopes(scopes: readonly MemoryVNextScopeQuery[]): readonly MemoryVNextScopeQuery[] {
  if (!Array.isArray(scopes) || scopes.length < 1 || scopes.length > MAX_SCOPES) {
    throw new Error(`memory time machine requires 1-${MAX_SCOPES} scopes`);
  }
  const seen = new Set<string>();
  const output = scopes.map((scope) => {
    if (!scope || typeof scope !== 'object' || Array.isArray(scope)) throw new Error('memory time machine scope must be an object');
    const item = { kind: scope.kind, id: scope.id };
    const key = `${item.kind}\0${scopeDigest(item)}`;
    if (seen.has(key)) throw new Error('memory time machine scopes contain a duplicate');
    seen.add(key);
    return Object.freeze(item);
  });
  return Object.freeze(output);
}

function validateMemoryId(memoryId: string): string {
  if (typeof memoryId !== 'string' || !MEMORY_ID.test(memoryId)) throw new Error('memory time machine memory ID is invalid');
  return memoryId;
}

function validateNow(value: number | undefined, clock: () => number): number {
  const now = value ?? clock();
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('memory time machine timestamp is invalid');
  return now;
}

function validateActionInput(input: FuryMemoryTimeMachineActionInput): FuryMemoryTimeMachineActionInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('memory time machine action must be an object');
  if (!['archive', 'pin', 'delete', 'restore'].includes(input.action)) throw new Error('memory time machine action is invalid');
  validateMemoryId(input.memoryId);
  validateScopes([input.scope]);
  if (input.version !== undefined && (!Number.isSafeInteger(input.version) || input.version < 1)) throw new Error('memory time machine version is invalid');
  if (input.confirm !== undefined && typeof input.confirm !== 'boolean') throw new Error('memory time machine confirmation is invalid');
  return input;
}

function entryKey(entry: FuryMemoryTimelineEntry): string {
  return `${entry.memoryId}@${entry.version}`;
}

function entryFingerprint(entry: FuryMemoryTimelineEntry): string {
  return digest(canonical(entry));
}

function memoryScopeForRecord(
  record: MemoryVNextInspection['record'],
  scopes: readonly MemoryVNextScopeQuery[],
): MemoryVNextScopeQuery {
  const match = scopes.find((scope) => scope.kind === record.scope.kind && scopeDigest(scope) === record.scope.idDigest);
  if (!match) throw new Error('memory record escaped the requested scope boundary');
  return match;
}

function entryFromInspection(inspection: MemoryVNextInspection, now: number): FuryMemoryTimelineEntry {
  const record = inspection.record;
  const retention = record.retention.kind === 'ttl'
    ? Object.freeze({ kind: record.retention.kind, expiresAt: record.retention.expiresAt })
    : Object.freeze({ kind: record.retention.kind });
  return Object.freeze({
    format: 'furypipe-memory-time-machine-entry/v1',
    checkpointId: `${record.memoryId}@${record.version}`,
    memoryId: record.memoryId,
    version: record.version,
    state: record.state,
    memoryClass: record.memoryClass,
    scope: Object.freeze({ ...record.scope }),
    source: Object.freeze({
      kind: record.sourceKind,
      idDigest: record.sourceIdDigest,
      evidenceClass: record.evidenceClass,
      acceptance: record.acceptance,
      revoked: inspection.sourceRevoked,
    }),
    provenance: Object.freeze({
      sourceKind: record.sourceKind,
      sourceIdDigest: record.sourceIdDigest,
      evidenceClass: record.evidenceClass,
      acceptance: record.acceptance,
      reasonDigest: record.reasonDigest,
    }),
    confidence: record.confidence,
    retention,
    visibility: record.visibility,
    ...(record.contentDigest === undefined ? {} : { contentDigest: record.contentDigest }),
    createdAt: record.createdAt,
    lastConfirmedAt: record.lastConfirmedAt,
    updatedAt: record.updatedAt,
    ...(record.supersedesVersion === undefined ? {} : { supersedesVersion: record.supersedesVersion }),
    restorable: record.state !== 'forgotten'
      && !inspection.sourceRevoked
      && (record.retention.kind !== 'ttl' || record.retention.expiresAt > now),
  });
}

function latestByMemory(entries: readonly FuryMemoryTimelineEntry[]): readonly FuryMemoryTimelineEntry[] {
  const latest = new Map<string, FuryMemoryTimelineEntry>();
  for (const entry of entries) {
    const prior = latest.get(entry.memoryId);
    if (!prior || entry.version > prior.version) latest.set(entry.memoryId, entry);
  }
  return [...latest.values()].sort((a, b) => a.memoryId.localeCompare(b.memoryId));
}

function graphFrom(entries: readonly FuryMemoryTimelineEntry[], scopeDigests: readonly string[]): FuryMemoryCrossProjectGraph {
  const nodes = new Map<string, FuryMemoryCrossProjectGraphNode>();
  const edges = new Map<string, FuryMemoryCrossProjectGraphEdge>();
  const addEdge = (from: string, to: string, relation: FuryMemoryCrossProjectGraphEdge['relation']) => {
    const key = `${from}\0${to}\0${relation}`;
    edges.set(key, Object.freeze({ from, to, relation }));
  };
  for (const scopeDigestValue of scopeDigests) {
    nodes.set(`scope:${scopeDigestValue}`, Object.freeze({ id: `scope:${scopeDigestValue}`, kind: 'scope' }));
  }
  for (const entry of latestByMemory(entries)) {
    const scopeId = `scope:${entry.scope.idDigest}`;
    const memoryId = `memory:${entry.memoryId}`;
    const sourceId = `source:${entry.source.kind}:${entry.source.idDigest}`;
    nodes.set(memoryId, Object.freeze({ id: memoryId, kind: 'memory', memoryId: entry.memoryId, version: entry.version, state: entry.state }));
    nodes.set(sourceId, Object.freeze({ id: sourceId, kind: 'source', sourceKind: entry.source.kind }));
    addEdge(scopeId, memoryId, 'contains');
    addEdge(memoryId, sourceId, 'provenance');
  }
  const projectScopeCount = new Set(entries.filter((entry) => entry.scope.kind === 'project').map((entry) => entry.scope.idDigest)).size;
  return Object.freeze({
    format: FURY_MEMORY_GRAPH_FORMAT,
    crossProject: projectScopeCount > 1,
    nodes: freezeArray([...nodes.values()].sort((a, b) => a.id.localeCompare(b.id))),
    edges: freezeArray([...edges.values()].sort((a, b) => `${a.from}\0${a.to}`.localeCompare(`${b.from}\0${b.to}`))),
    authority: 'memory-vnext-metadata-projection',
    executionAuthority: false,
  });
}

function validateSnapshot(snapshot: FuryMemorySnapshot, label: string): FuryMemorySnapshot {
  if (!snapshot || typeof snapshot !== 'object' || snapshot.format !== FURY_MEMORY_SNAPSHOT_FORMAT) {
    throw new Error(`${label} is not a Fury Memory snapshot`);
  }
  if (typeof snapshot.snapshotId !== 'string' || !snapshot.snapshotId || snapshot.snapshotId.length > MAX_DIGEST) throw new Error(`${label} ID is invalid`);
  if (!Array.isArray(snapshot.timeline) || !Array.isArray(snapshot.scopeDigests)) throw new Error(`${label} is incomplete`);
  if (snapshot.authority !== 'memory-vnext-read-only' || snapshot.executionAuthority !== false) throw new Error(`${label} authority is invalid`);
  if (!snapshot.scopeDigests.every((value) => typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value))) throw new Error(`${label} scope digest is invalid`);
  const expectedDigest = digest(canonical({ format: FURY_MEMORY_SNAPSHOT_FORMAT, scopeDigests: snapshot.scopeDigests, timeline: snapshot.timeline }));
  if (snapshot.snapshotDigestSha256 !== expectedDigest || snapshot.snapshotId !== `mts-${expectedDigest.slice(0, 48)}`) throw new Error(`${label} digest does not match its content`);
  return snapshot;
}

export function createFuryMemoryTimeMachine(options: CreateFuryMemoryTimeMachineOptions): FuryMemoryTimeMachine {
  if (!options || typeof options !== 'object' || !options.memory) throw new Error('memory time machine requires Memory VNext');
  const clock = options.now ?? Date.now;
  const maxTimelineEntries = options.maxTimelineEntries ?? MAX_TIMELINE_ENTRIES;
  if (!Number.isSafeInteger(maxTimelineEntries) || maxTimelineEntries < 1 || maxTimelineEntries > MAX_TIMELINE_ENTRIES) {
    throw new RangeError(`memory time machine max timeline must be 1-${MAX_TIMELINE_ENTRIES}`);
  }
  const memory = options.memory;

  const timeline = async (input: FuryMemoryTimeMachineTimelineInput): Promise<readonly FuryMemoryTimelineEntry[]> => {
    const scopes = validateScopes(input.scopes);
    const at = validateNow(input.now, clock);
    const memoryId = input.memoryId === undefined ? undefined : validateMemoryId(input.memoryId);
    const current = await memory.inspect({ scopes, ...(memoryId === undefined ? {} : { memoryId }), now: at });
    const histories = await Promise.all(current.map(async (inspection) => {
      const scope = memoryScopeForRecord(inspection.record, scopes);
      const historyInput: MemoryVNextHistoryInput = { memoryId: inspection.record.memoryId, scope, now: at };
      return memory.history(historyInput);
    }));
    const seen = new Set<string>();
    const output: FuryMemoryTimelineEntry[] = [];
    for (const history of histories) {
      for (const inspection of history) {
        const entry = entryFromInspection(inspection, at);
        const key = entryKey(entry);
        if (seen.has(key)) continue;
        seen.add(key);
        output.push(entry);
      }
    }
    if (output.length > maxTimelineEntries) throw new Error('memory time machine timeline exceeds its bound; refusing an incomplete view');
    output.sort((a, b) => a.updatedAt - b.updatedAt || a.memoryId.localeCompare(b.memoryId) || a.version - b.version);
    return freezeArray(output);
  };

  const snapshot = async (input: FuryMemoryTimeMachineTimelineInput): Promise<FuryMemorySnapshot> => {
    const scopes = validateScopes(input.scopes);
    const capturedAt = validateNow(input.now, clock);
    const entries = await timeline({ scopes, ...(input.memoryId === undefined ? {} : { memoryId: input.memoryId }), now: capturedAt });
    const scopeDigests = freezeArray(scopes.map(scopeDigest).sort());
    const graph = graphFrom(entries, scopeDigests);
    const digestInput = { format: FURY_MEMORY_SNAPSHOT_FORMAT, scopeDigests, timeline: entries };
    const snapshotDigestSha256 = digest(canonical(digestInput));
    return Object.freeze({
      format: FURY_MEMORY_SNAPSHOT_FORMAT,
      snapshotId: `mts-${snapshotDigestSha256.slice(0, 48)}`,
      capturedAt,
      scopeDigests,
      timeline: entries,
      graph,
      snapshotDigestSha256,
      authority: 'memory-vnext-read-only',
      executionAuthority: false,
    });
  };

  const diff = (input: Readonly<{ from: FuryMemorySnapshot; to: FuryMemorySnapshot }>): FuryMemorySnapshotDiff => {
    const from = validateSnapshot(input.from, 'from snapshot');
    const to = validateSnapshot(input.to, 'to snapshot');
    const fromMap = new Map(from.timeline.map((entry) => [entryKey(entry), entry]));
    const toMap = new Map(to.timeline.map((entry) => [entryKey(entry), entry]));
    const added = [...toMap.entries()].filter(([key]) => !fromMap.has(key)).map(([, entry]) => entry);
    const removed = [...fromMap.entries()].filter(([key]) => !toMap.has(key)).map(([, entry]) => entry);
    const fromLatest = new Map(latestByMemory(from.timeline).map((entry) => [entry.memoryId, entry]));
    const toLatest = new Map(latestByMemory(to.timeline).map((entry) => [entry.memoryId, entry]));
    const changed: FuryMemorySnapshotDiffChange[] = [];
    for (const [memoryId, before] of fromLatest) {
      const after = toLatest.get(memoryId);
      if (after && entryFingerprint(before) !== entryFingerprint(after)) changed.push(Object.freeze({ memoryId, from: before, to: after }));
    }
    added.sort((a, b) => entryKey(a).localeCompare(entryKey(b)));
    removed.sort((a, b) => entryKey(a).localeCompare(entryKey(b)));
    changed.sort((a, b) => a.memoryId.localeCompare(b.memoryId));
    return Object.freeze({
      format: FURY_MEMORY_DIFF_FORMAT,
      fromSnapshotId: from.snapshotId,
      toSnapshotId: to.snapshotId,
      added: freezeArray(added),
      removed: freezeArray(removed),
      changed: freezeArray(changed),
      summary: Object.freeze({ added: added.length, removed: removed.length, changed: changed.length }),
      authority: 'memory-vnext-deterministic-diff',
      executionAuthority: false,
    });
  };

  const exportSnapshot = (input: Readonly<{ snapshot: FuryMemorySnapshot; now?: number }>): FuryMemoryTimeMachineExport => {
    const snapshotValue = validateSnapshot(input.snapshot, 'snapshot');
    return Object.freeze({
      format: FURY_MEMORY_EXPORT_FORMAT,
      exportedAt: validateNow(input.now, clock),
      snapshot: snapshotValue,
      content: 'excluded-by-default',
      provenance: 'metadata-only-recovery-backed-export',
      authority: 'memory-vnext-read-only',
      executionAuthority: false,
    });
  };

  const graph = async (input: FuryMemoryTimeMachineTimelineInput): Promise<FuryMemoryCrossProjectGraph> => (await snapshot(input)).graph;

  const planAction = (rawInput: FuryMemoryTimeMachineActionInput): FuryMemoryActionPlan => {
    const input = validateActionInput(rawInput);
    const scope = Object.freeze({ kind: input.scope.kind, idDigest: scopeDigest(input.scope) });
    const planOnly = input.action === 'pin';
    const reason = input.action === 'archive'
      ? 'archive maps to a governed Memory VNext disable transition and preserves revisions'
      : input.action === 'delete'
        ? 'delete maps to governed Memory VNext forget and may remove local historical payloads'
        : input.action === 'restore'
          ? 'restore appends a new governed revision from an existing checkpoint'
          : 'pin has no canonical persisted Memory VNext authority; plan only';
    return Object.freeze({
      format: 'furypipe-memory-time-machine-action-plan/v1',
      action: input.action,
      memoryId: input.memoryId,
      ...(input.version === undefined ? {} : { version: input.version }),
      scope,
      status: planOnly ? 'PLAN_ONLY' : 'GOVERNED_EXECUTION_AVAILABLE',
      requiresExplicitConfirmation: true,
      reason,
      authority: planOnly ? 'memory-time-machine-plan' : 'memory-vnext-governance',
      executionAuthority: false,
    });
  };

  const executeAction = async (rawInput: FuryMemoryTimeMachineActionInput): Promise<MemoryVNextTransitionReceipt | MemoryVNextForgetReceipt | MemoryVNextRestoreReceipt> => {
    const input = validateActionInput(rawInput);
    const plan = planAction(input);
    if (input.confirm !== true) throw new Error(`memory time machine ${input.action} requires confirm: true`);
    if (plan.status === 'PLAN_ONLY') throw new Error('memory time machine pin has no canonical persisted authority');
    const now = validateNow(input.now, clock);
    if (input.action === 'archive') return memory.disable({ memoryId: input.memoryId, scope: input.scope, now });
    if (input.action === 'delete') return memory.requestForget({ memoryId: input.memoryId, scope: input.scope, hard: true, now });
    if (input.version === undefined) throw new Error('memory time machine restore requires a version');
    return memory.restore({ memoryId: input.memoryId, scope: input.scope, version: input.version, confirm: true, now });
  };

  return Object.freeze({ timeline, snapshot, diff, exportSnapshot, graph, planAction, executeAction });
}
