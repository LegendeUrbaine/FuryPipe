import { createHash } from 'node:crypto';

export const FURY_OBSERVABILITY_FORMAT = 'furypipe-observability/v1' as const;
export const FURY_OBSERVABILITY_SNAPSHOT_FORMAT = 'furypipe-observability-snapshot/v1' as const;

export const FURY_OBSERVABILITY_EVENT_KINDS = Object.freeze([
  'request',
  'router',
  'model',
  'provider',
  'agent',
  'skill',
  'browser',
  'code-runtime',
  'tool',
  'mcp',
  'media-job',
  'artifact',
  'workflow',
] as const);
export const FURY_OBSERVABILITY_EVENT_STATUSES = Object.freeze([
  'success',
  'error',
  'pending',
  'unknown',
] as const);
export const FURY_OBSERVABILITY_HEALTH_STATES = Object.freeze([
  'ready',
  'degraded',
  'unavailable',
  'blocked',
  'unknown',
] as const);
export const FURY_OBSERVABILITY_BUDGET_SCOPES = Object.freeze([
  'request',
  'daily',
  'monthly',
  'workspace',
] as const);

export type FuryObservabilityEventKind = (typeof FURY_OBSERVABILITY_EVENT_KINDS)[number];
export type FuryObservabilityEventStatus = (typeof FURY_OBSERVABILITY_EVENT_STATUSES)[number];
export type FuryObservabilityHealth = (typeof FURY_OBSERVABILITY_HEALTH_STATES)[number];
export type FuryObservabilityBudgetScope = (typeof FURY_OBSERVABILITY_BUDGET_SCOPES)[number];

export interface FuryObservabilityKnownCostInput {
  readonly status: 'known';
  readonly totalUsd: number;
  /** Comparable billing/workload basis. Different bases are never summed. */
  readonly costBasis: string;
  /** Human-readable provenance is digested before it leaves the process. */
  readonly source: string;
  readonly observedAt: number;
}

export interface FuryObservabilityUnknownCostInput {
  readonly status: 'unknown';
  readonly reason: string;
}

export interface FuryObservabilityEstimatedCostInput {
  readonly status: 'estimated';
  readonly totalUsd: number;
  readonly costBasis: string;
  readonly source: string;
  readonly observedAt: number;
}

export interface FuryObservabilityNotApplicableCostInput {
  readonly status: 'not-applicable';
  readonly reason: string;
}

export type FuryObservabilityCostInput =
  | FuryObservabilityKnownCostInput
  | FuryObservabilityEstimatedCostInput
  | FuryObservabilityUnknownCostInput
  | FuryObservabilityNotApplicableCostInput;

export interface FuryObservabilityEventInput {
  readonly format: typeof FURY_OBSERVABILITY_FORMAT;
  readonly eventId: string;
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly kind: FuryObservabilityEventKind;
  /** Source label only. Prompt, response, credential and provider payloads are not accepted. */
  readonly source: string;
  readonly status: FuryObservabilityEventStatus;
  readonly health?: FuryObservabilityHealth;
  readonly startedAt: number;
  readonly finishedAt?: number;
  readonly cost?: FuryObservabilityCostInput;
}

export interface FuryObservabilityBudgetInput {
  readonly scope: FuryObservabilityBudgetScope;
  readonly limitUsd: number;
  readonly costBasis: string;
  /** Required for a request budget; request identity is a trace id. */
  readonly traceId?: string;
}

export interface FuryObservabilityKnownCost {
  readonly status: 'known';
  readonly totalUsd: number;
  readonly costBasis: string;
  readonly sourceDigestSha256: string;
  readonly observedAt: number;
}

export interface FuryObservabilityUnknownCost {
  readonly status: 'unknown';
  readonly reasonDigestSha256: string;
}

export interface FuryObservabilityEstimatedCost {
  readonly status: 'estimated';
  readonly totalUsd: number;
  readonly costBasis: string;
  readonly sourceDigestSha256: string;
  readonly observedAt: number;
}

export interface FuryObservabilityNotApplicableCost {
  readonly status: 'not-applicable';
  readonly reasonDigestSha256: string;
}

export interface FuryObservabilityUnrecordedCost {
  readonly status: 'not-recorded';
}

export type FuryObservabilityCost =
  | FuryObservabilityKnownCost
  | FuryObservabilityEstimatedCost
  | FuryObservabilityUnknownCost
  | FuryObservabilityNotApplicableCost
  | FuryObservabilityUnrecordedCost;

export interface FuryObservabilityEvent extends Omit<FuryObservabilityEventInput, 'source' | 'cost' | 'health' | 'finishedAt'> {
  readonly sourceDigestSha256: string;
  readonly health: FuryObservabilityHealth;
  readonly finishedAt?: number;
  readonly durationMs: number | null;
  readonly observedAt: number;
  readonly cost: FuryObservabilityCost;
  readonly fingerprintSha256: string;
  readonly authority: 'observed-evidence-only';
  readonly executionAuthority: false;
}

export interface FuryObservabilityTraceSummary {
  readonly traceId: string;
  readonly eventCount: number;
  readonly rootSpanCount: number;
  readonly orphanParentCount: number;
  readonly maxDepth: number;
  readonly traceDigestSha256: string;
}

export interface FuryObservabilityLatencySummary {
  readonly sampleCount: number;
  readonly minMs: number | null;
  readonly p50Ms: number | null;
  readonly p95Ms: number | null;
  readonly maxMs: number | null;
}

export interface FuryObservabilityCostSummary {
  readonly knownTotalUsdByBasis: readonly {
    readonly costBasis: string;
    readonly totalUsd: number;
    readonly eventCount: number;
  }[];
  readonly estimatedTotalUsdByBasis: readonly {
    readonly costBasis: string;
    readonly totalUsd: number;
    readonly eventCount: number;
  }[];
  readonly knownEventCount: number;
  readonly estimatedEventCount: number;
  readonly unknownEventCount: number;
  readonly notApplicableEventCount: number;
  readonly notRecordedEventCount: number;
}

export type FuryObservabilityBudgetStatus =
  | 'WITHIN_KNOWN_COST'
  | 'EXCEEDED_KNOWN_COST'
  | 'UNKNOWN_INCOMPLETE_EVIDENCE'
  | 'NO_EVIDENCE';

export interface FuryObservabilityBudget extends FuryObservabilityBudgetInput {
  readonly status: FuryObservabilityBudgetStatus;
  readonly knownCostUsd: number;
  readonly knownEventCount: number;
  readonly estimatedCostEventCount: number;
  readonly unknownCostEventCount: number;
  readonly notApplicableCostEventCount: number;
  readonly notRecordedCostEventCount: number;
  readonly mismatchedCostEventCount: number;
  readonly windowStartAt: number | null;
  readonly windowEndAt: number | null;
}

export interface FuryObservabilitySnapshot {
  readonly format: typeof FURY_OBSERVABILITY_SNAPSHOT_FORMAT;
  readonly state: 'READY' | 'NOT_CONFIGURED';
  readonly generatedAt: number;
  readonly events: readonly FuryObservabilityEvent[];
  readonly traces: readonly FuryObservabilityTraceSummary[];
  readonly counts: {
    readonly events: number;
    readonly traces: number;
    readonly byKind: Readonly<Record<FuryObservabilityEventKind, number>>;
    readonly byStatus: Readonly<Record<FuryObservabilityEventStatus, number>>;
    readonly byHealth: Readonly<Record<FuryObservabilityHealth, number>>;
  };
  readonly latency: FuryObservabilityLatencySummary;
  readonly cost: FuryObservabilityCostSummary;
  readonly budgets: readonly FuryObservabilityBudget[];
  readonly digestSha256: string;
  readonly authority: 'observed-evidence-only';
  readonly executionAuthority: false;
}

export interface FuryObservabilityRegistryOptions {
  readonly maxRecords?: number;
  readonly now?: () => number;
  readonly budgets?: readonly FuryObservabilityBudgetInput[];
}

export interface FuryObservabilityRegistry {
  observe(event: FuryObservabilityEventInput): FuryObservabilityEvent;
  remove(eventId: string): boolean;
  snapshot(): FuryObservabilitySnapshot;
  size(): number;
}

const REGISTRY_EVIDENCE = new WeakSet<object>();
const DEFAULT_MAX_RECORDS = 20_000;
const HARD_MAX_RECORDS = 100_000;
const MAX_TEXT_CHARS = 256;
const MAX_COST_TEXT_CHARS = 200;
const MAX_COST_USD = 1_000_000_000;
const MAX_DURATION_MS = 365 * 24 * 60 * 60 * 1000;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:/@+~-]{0,255}$/u;
const CONTROL_RE = /[\u0000-\u001f\u007f]/u;
const CREDENTIAL_PATTERNS = Object.freeze([
  /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/iu,
  /\bsk-[A-Za-z0-9_-]{16,}\b/u,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/iu,
  /https?:\/\/[^/\s:@]+:[^/\s@]+@/iu,
]);
const KIND_SET = new Set<string>(FURY_OBSERVABILITY_EVENT_KINDS);
const STATUS_SET = new Set<string>(FURY_OBSERVABILITY_EVENT_STATUSES);
const HEALTH_SET = new Set<string>(FURY_OBSERVABILITY_HEALTH_STATES);
const SCOPE_SET = new Set<string>(FURY_OBSERVABILITY_BUDGET_SCOPES);

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function exactRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
  label: string,
): Record<string, unknown> {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
    || Object.getOwnPropertySymbols(value).length > 0
  ) throw new TypeError(`${label} must be a plain data object`);
  const record = value as Record<string, unknown>;
  const allowed = new Set(allowedKeys);
  for (const key of Object.getOwnPropertyNames(record)) {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor) || !allowed.has(key)) {
      throw new TypeError(`${label} contains unsupported or unsafe fields`);
    }
  }
  for (const key of requiredKeys) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) throw new TypeError(`${label} is missing required field: ${key}`);
  }
  return record;
}

function safeText(value: unknown, max: number, label: string): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > max || CONTROL_RE.test(value)) {
    throw new TypeError(`${label} must be bounded printable text`);
  }
  const normalized = value.normalize('NFKC').trim();
  if (normalized.length < 1 || normalized.length > max || CREDENTIAL_PATTERNS.some((pattern) => pattern.test(normalized))) {
    throw new Error(`${label} contains unsafe credential-like material`);
  }
  return normalized;
}

function exactId(value: unknown, label: string): string {
  if (typeof value !== 'string' || !ID_RE.test(value)) throw new TypeError(`${label} is invalid`);
  return value;
}

function timestamp(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new RangeError(`${label} must be a safe non-negative timestamp`);
  return value as number;
}

function boundedCost(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_COST_USD) {
    throw new RangeError(`${label} must be finite, non-negative and <= ${MAX_COST_USD}`);
  }
  return value;
}

function validNow(now: () => number): number {
  return timestamp(now(), 'observability clock');
}

function normalizeCost(value: unknown): FuryObservabilityCost {
  if (value === undefined) return Object.freeze({ status: 'not-recorded' as const });
  const record = exactRecord(value, ['status', 'totalUsd', 'costBasis', 'source', 'observedAt', 'reason'], ['status'], 'observability cost');
  if (record.status === 'known' || record.status === 'estimated') {
    const totalUsd = boundedCost(record.totalUsd, 'observability totalUsd');
    const costBasis = safeText(record.costBasis, MAX_COST_TEXT_CHARS, 'observability costBasis');
    const source = safeText(record.source, MAX_COST_TEXT_CHARS, 'observability cost source');
    const observedAt = timestamp(record.observedAt, 'observability cost observedAt');
    return Object.freeze({
      status: record.status as 'known' | 'estimated',
      totalUsd,
      costBasis,
      sourceDigestSha256: sha256(source),
      observedAt,
    });
  }
  if (record.status === 'unknown') {
    const reason = safeText(record.reason, MAX_COST_TEXT_CHARS, 'observability cost reason');
    return Object.freeze({ status: 'unknown' as const, reasonDigestSha256: sha256(reason) });
  }
  if (record.status === 'not-applicable') {
    const reason = safeText(record.reason, MAX_COST_TEXT_CHARS, 'observability cost not-applicable reason');
    return Object.freeze({ status: 'not-applicable' as const, reasonDigestSha256: sha256(reason) });
  }
  throw new TypeError('observability cost status is invalid');
}

function normalizeEvent(input: FuryObservabilityEventInput): FuryObservabilityEvent {
  const record = exactRecord(
    input,
    ['format', 'eventId', 'traceId', 'spanId', 'parentSpanId', 'kind', 'source', 'status', 'health', 'startedAt', 'finishedAt', 'cost'],
    ['format', 'eventId', 'traceId', 'spanId', 'kind', 'source', 'status', 'startedAt'],
    'observability event',
  );
  if (record.format !== FURY_OBSERVABILITY_FORMAT) throw new TypeError('observability event format is unsupported');
  const eventId = exactId(record.eventId, 'observability eventId');
  const traceId = exactId(record.traceId, 'observability traceId');
  const spanId = exactId(record.spanId, 'observability spanId');
  const parentSpanId = record.parentSpanId === undefined ? undefined : exactId(record.parentSpanId, 'observability parentSpanId');
  if (parentSpanId === spanId) throw new Error('observability event cannot parent itself');
  if (typeof record.kind !== 'string' || !KIND_SET.has(record.kind)) throw new TypeError('observability event kind is unsupported');
  const source = safeText(record.source, MAX_TEXT_CHARS, 'observability source');
  if (typeof record.status !== 'string' || !STATUS_SET.has(record.status)) throw new TypeError('observability event status is unsupported');
  const health = record.health === undefined ? 'unknown' : record.health;
  if (typeof health !== 'string' || !HEALTH_SET.has(health)) throw new TypeError('observability event health is unsupported');
  const startedAt = timestamp(record.startedAt, 'observability startedAt');
  const finishedAt = record.finishedAt === undefined ? undefined : timestamp(record.finishedAt, 'observability finishedAt');
  if (finishedAt !== undefined && finishedAt < startedAt) throw new RangeError('observability finishedAt must not precede startedAt');
  if (record.status === 'pending' && finishedAt !== undefined) throw new Error('pending observability event cannot have finishedAt');
  const durationMs = finishedAt === undefined ? null : finishedAt - startedAt;
  if (durationMs !== null && durationMs > MAX_DURATION_MS) throw new RangeError('observability event duration exceeds its bound');
  const cost = normalizeCost(record.cost);
  const normalized = {
    format: FURY_OBSERVABILITY_FORMAT,
    eventId,
    traceId,
    spanId,
    ...(parentSpanId === undefined ? {} : { parentSpanId }),
    kind: record.kind as FuryObservabilityEventKind,
    sourceDigestSha256: sha256(source),
    status: record.status as FuryObservabilityEventStatus,
    health: health as FuryObservabilityHealth,
    startedAt,
    ...(finishedAt === undefined ? {} : { finishedAt }),
    durationMs,
    observedAt: cost.status === 'known' || cost.status === 'estimated' ? cost.observedAt : (finishedAt ?? startedAt),
    cost,
  };
  return Object.freeze({
    ...normalized,
    fingerprintSha256: sha256(JSON.stringify(normalized)),
    authority: 'observed-evidence-only' as const,
    executionAuthority: false as const,
  });
}

function normalizeBudget(value: FuryObservabilityBudgetInput): FuryObservabilityBudgetInput {
  const record = exactRecord(value, ['scope', 'limitUsd', 'costBasis', 'traceId'], ['scope', 'limitUsd', 'costBasis'], 'observability budget');
  if (typeof record.scope !== 'string' || !SCOPE_SET.has(record.scope)) throw new TypeError('observability budget scope is unsupported');
  const scope = record.scope as FuryObservabilityBudgetScope;
  const traceId = record.traceId === undefined ? undefined : exactId(record.traceId, 'observability budget traceId');
  if (scope === 'request' && traceId === undefined) throw new TypeError('request observability budget requires traceId');
  if (scope !== 'request' && traceId !== undefined) throw new TypeError('non-request observability budget cannot contain traceId');
  return Object.freeze({ scope, limitUsd: boundedCost(record.limitUsd, 'observability budget limitUsd'), costBasis: safeText(record.costBasis, MAX_COST_TEXT_CHARS, 'observability budget costBasis'), ...(traceId === undefined ? {} : { traceId }) });
}

function percentile(values: readonly number[], fraction: number): number | null {
  if (values.length === 0) return null;
  const index = Math.max(0, Math.ceil(values.length * fraction) - 1);
  return values[index] ?? null;
}

function utcDayWindow(at: number): readonly [number, number] {
  const date = new Date(at);
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return [start, start + 24 * 60 * 60 * 1000];
}

function utcMonthWindow(at: number): readonly [number, number] {
  const date = new Date(at);
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  return [start, Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)];
}

function budgetWindow(budget: FuryObservabilityBudgetInput, now: number): readonly [number | null, number | null] {
  if (budget.scope === 'request' || budget.scope === 'workspace') return [null, null];
  return budget.scope === 'daily' ? utcDayWindow(now) : utcMonthWindow(now);
}

function buildBudget(
  budget: FuryObservabilityBudgetInput,
  events: readonly FuryObservabilityEvent[],
  now: number,
): FuryObservabilityBudget {
  const [windowStartAt, windowEndAt] = budgetWindow(budget, now);
  const relevant = events.filter((event) => {
    if (budget.scope === 'request' && event.traceId !== budget.traceId) return false;
    if (windowStartAt !== null && event.observedAt < windowStartAt) return false;
    if (windowEndAt !== null && event.observedAt >= windowEndAt) return false;
    return true;
  });
  let knownCostUsd = 0;
  let knownEventCount = 0;
  let estimatedCostEventCount = 0;
  let unknownCostEventCount = 0;
  let notApplicableCostEventCount = 0;
  let notRecordedCostEventCount = 0;
  let mismatchedCostEventCount = 0;
  for (const event of relevant) {
    if (event.cost.status === 'known') {
      if (event.cost.costBasis === budget.costBasis) {
        knownCostUsd += event.cost.totalUsd;
        knownEventCount += 1;
      } else {
        mismatchedCostEventCount += 1;
      }
    } else if (event.cost.status === 'estimated') {
      estimatedCostEventCount += 1;
    } else if (event.cost.status === 'unknown') {
      unknownCostEventCount += 1;
    } else if (event.cost.status === 'not-applicable') {
      notApplicableCostEventCount += 1;
    } else {
      notRecordedCostEventCount += 1;
    }
  }
  const incomplete = estimatedCostEventCount > 0 || unknownCostEventCount > 0 || notRecordedCostEventCount > 0 || mismatchedCostEventCount > 0;
  const status: FuryObservabilityBudgetStatus = relevant.length === 0
    ? 'NO_EVIDENCE'
    : knownCostUsd > budget.limitUsd
      ? 'EXCEEDED_KNOWN_COST'
      : knownEventCount === 0 && notApplicableCostEventCount === relevant.length
        ? 'NO_EVIDENCE'
      : incomplete
        ? 'UNKNOWN_INCOMPLETE_EVIDENCE'
        : 'WITHIN_KNOWN_COST';
  return Object.freeze({
    ...budget,
    status,
    knownCostUsd,
    knownEventCount,
    estimatedCostEventCount,
    unknownCostEventCount,
    notApplicableCostEventCount,
    notRecordedCostEventCount,
    mismatchedCostEventCount,
    windowStartAt,
    windowEndAt,
  });
}

function traceSummaries(events: readonly FuryObservabilityEvent[]): readonly FuryObservabilityTraceSummary[] {
  const byTrace = new Map<string, FuryObservabilityEvent[]>();
  const bySpan = new Map<string, FuryObservabilityEvent>();
  for (const event of events) {
    const trace = byTrace.get(event.traceId) ?? [];
    trace.push(event);
    byTrace.set(event.traceId, trace);
    if (bySpan.has(event.spanId)) throw new Error('observability spanId must be unique');
    bySpan.set(event.spanId, event);
  }
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const depthFor = (event: FuryObservabilityEvent): number => {
    const existing = depth.get(event.spanId);
    if (existing !== undefined) return existing;
    if (visiting.has(event.spanId)) throw new Error('observability span parent cycle detected');
    visiting.add(event.spanId);
    const parent = event.parentSpanId === undefined ? undefined : bySpan.get(event.parentSpanId);
    if (parent !== undefined && parent.traceId !== event.traceId) {
      throw new Error('observability parent span must belong to the same trace');
    }
    const value = parent === undefined ? 0 : depthFor(parent) + 1;
    visiting.delete(event.spanId);
    depth.set(event.spanId, value);
    return value;
  };
  return Object.freeze([...byTrace.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([traceId, traceEvents]) => {
    const orphanParentCount = traceEvents.filter((event) => event.parentSpanId !== undefined && !bySpan.has(event.parentSpanId)).length;
    const rootSpanCount = traceEvents.filter((event) => event.parentSpanId === undefined).length;
    const maxDepth = Math.max(0, ...traceEvents.map(depthFor));
    return Object.freeze({
      traceId,
      eventCount: traceEvents.length,
      rootSpanCount,
      orphanParentCount,
      maxDepth,
      traceDigestSha256: sha256(JSON.stringify(traceEvents.map((event) => [event.spanId, event.parentSpanId ?? null, event.fingerprintSha256]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))))),
    });
  }));
}

function zeroCounts<T extends string>(values: readonly T[]): Record<T, number> {
  return Object.fromEntries(values.map((value) => [value, 0])) as Record<T, number>;
}

function buildFuryObservabilitySnapshot(
  events: readonly FuryObservabilityEvent[],
  budgets: readonly FuryObservabilityBudgetInput[],
  generatedAt: number,
): FuryObservabilitySnapshot {
  const eventIds = new Set<string>();
  for (const event of events) {
    if (eventIds.has(event.eventId)) throw new Error('observability eventId must be unique');
    eventIds.add(event.eventId);
  }
  const orderedEvents = Object.freeze([...events].sort((left, right) => left.observedAt - right.observedAt || left.eventId.localeCompare(right.eventId)));
  const traces = traceSummaries(orderedEvents);
  const byKind = zeroCounts(FURY_OBSERVABILITY_EVENT_KINDS);
  const byStatus = zeroCounts(FURY_OBSERVABILITY_EVENT_STATUSES);
  const byHealth = zeroCounts(FURY_OBSERVABILITY_HEALTH_STATES);
  const durations: number[] = [];
  const costs = new Map<string, { totalUsd: number; eventCount: number }>();
  const estimatedCosts = new Map<string, { totalUsd: number; eventCount: number }>();
  let knownEventCount = 0;
  let estimatedEventCount = 0;
  let unknownEventCount = 0;
  let notApplicableEventCount = 0;
  let notRecordedEventCount = 0;
  for (const event of orderedEvents) {
    byKind[event.kind] += 1;
    byStatus[event.status] += 1;
    byHealth[event.health] += 1;
    if (event.durationMs !== null) durations.push(event.durationMs);
    if (event.cost.status === 'known') {
      knownEventCount += 1;
      const current = costs.get(event.cost.costBasis) ?? { totalUsd: 0, eventCount: 0 };
      current.totalUsd += event.cost.totalUsd;
      current.eventCount += 1;
      costs.set(event.cost.costBasis, current);
    } else if (event.cost.status === 'estimated') {
      estimatedEventCount += 1;
      const current = estimatedCosts.get(event.cost.costBasis) ?? { totalUsd: 0, eventCount: 0 };
      current.totalUsd += event.cost.totalUsd;
      current.eventCount += 1;
      estimatedCosts.set(event.cost.costBasis, current);
    } else if (event.cost.status === 'unknown') {
      unknownEventCount += 1;
    } else if (event.cost.status === 'not-applicable') {
      notApplicableEventCount += 1;
    } else {
      notRecordedEventCount += 1;
    }
  }
  durations.sort((left, right) => left - right);
  const latency: FuryObservabilityLatencySummary = Object.freeze({
    sampleCount: durations.length,
    minMs: durations[0] ?? null,
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    maxMs: durations.at(-1) ?? null,
  });
  const cost: FuryObservabilityCostSummary = Object.freeze({
    knownTotalUsdByBasis: Object.freeze([...costs.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([costBasis, value]) => Object.freeze({ costBasis, totalUsd: value.totalUsd, eventCount: value.eventCount }))),
    estimatedTotalUsdByBasis: Object.freeze([...estimatedCosts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([costBasis, value]) => Object.freeze({ costBasis, totalUsd: value.totalUsd, eventCount: value.eventCount }))),
    knownEventCount,
    estimatedEventCount,
    unknownEventCount,
    notApplicableEventCount,
    notRecordedEventCount,
  });
  const counts = Object.freeze({
    events: orderedEvents.length,
    traces: traces.length,
    byKind: Object.freeze(byKind),
    byStatus: Object.freeze(byStatus),
    byHealth: Object.freeze(byHealth),
  });
  const snapshotCore = {
    format: FURY_OBSERVABILITY_SNAPSHOT_FORMAT,
    events: orderedEvents,
    traces,
    counts,
    latency,
    cost,
    budgets: Object.freeze(budgets.map((budget) => buildBudget(budget, orderedEvents, generatedAt))),
  };
  return Object.freeze({
    ...snapshotCore,
    state: 'READY' as const,
    generatedAt,
    digestSha256: sha256(JSON.stringify(snapshotCore)),
    authority: 'observed-evidence-only' as const,
    executionAuthority: false as const,
  });
}

export function createFuryObservabilitySnapshot(input: {
  readonly events?: readonly FuryObservabilityEventInput[];
  readonly budgets?: readonly FuryObservabilityBudgetInput[];
  readonly now?: () => number;
} = {}): FuryObservabilitySnapshot {
  const record = exactRecord(input, ['events', 'budgets', 'now'], [], 'observability snapshot options');
  const now = (record.now as (() => number) | undefined) ?? Date.now;
  if (typeof now !== 'function') throw new TypeError('observability clock must be a function');
  const generatedAt = validNow(now);
  const rawEvents = (record.events as readonly FuryObservabilityEventInput[] | undefined) ?? [];
  if (!Array.isArray(rawEvents) || rawEvents.length > HARD_MAX_RECORDS) throw new RangeError('observability event count exceeds its bound');
  const events = rawEvents.map(normalizeEvent);
  const rawBudgets = (record.budgets as readonly FuryObservabilityBudgetInput[] | undefined) ?? [];
  if (!Array.isArray(rawBudgets) || rawBudgets.length > 64) throw new RangeError('observability budget count exceeds its bound');
  const budgets = rawBudgets.map(normalizeBudget);
  const budgetKeys = new Set<string>();
  for (const budget of budgets) {
    const key = `${budget.scope}\u0000${budget.traceId ?? ''}`;
    if (budgetKeys.has(key)) throw new Error('observability budget scope and traceId must be unique');
    budgetKeys.add(key);
  }
  return buildFuryObservabilitySnapshot(events, budgets, generatedAt);
}

export function createFuryObservabilityNotConfiguredSnapshot(now: () => number = Date.now): FuryObservabilitySnapshot {
  const snapshot = createFuryObservabilitySnapshot({ now });
  return Object.freeze({ ...snapshot, state: 'NOT_CONFIGURED' as const });
}

export function isGeneratedFuryObservabilityRegistry(value: unknown): value is FuryObservabilityRegistry {
  return typeof value === 'object' && value !== null && REGISTRY_EVIDENCE.has(value);
}

export function createFuryObservabilityRegistry(options: FuryObservabilityRegistryOptions = {}): FuryObservabilityRegistry {
  const record = exactRecord(options, ['maxRecords', 'now', 'budgets'], [], 'observability registry options');
  const maxRecords = record.maxRecords === undefined ? DEFAULT_MAX_RECORDS : record.maxRecords;
  if (!Number.isSafeInteger(maxRecords) || (maxRecords as number) < 1 || (maxRecords as number) > HARD_MAX_RECORDS) throw new RangeError('observability maxRecords is invalid');
  if (record.now !== undefined && typeof record.now !== 'function') throw new TypeError('observability now must be a function');
  const now = (record.now as (() => number) | undefined) ?? Date.now;
  validNow(now);
  const budgetsInput = record.budgets === undefined ? [] : record.budgets;
  if (!Array.isArray(budgetsInput) || budgetsInput.length > 64) throw new RangeError('observability budget count exceeds its bound');
  const budgets = Object.freeze((budgetsInput as readonly FuryObservabilityBudgetInput[]).map(normalizeBudget));
  const budgetKeys = new Set(budgets.map((budget) => `${budget.scope}\u0000${budget.traceId ?? ''}`));
  if (budgetKeys.size !== budgets.length) throw new Error('observability budget scope and traceId must be unique');
  const events = new Map<string, FuryObservabilityEvent>();
  const api: FuryObservabilityRegistry = {
    observe(input: FuryObservabilityEventInput): FuryObservabilityEvent {
      const event = normalizeEvent(input);
      const previous = events.get(event.eventId);
      if (!previous && events.size >= (maxRecords as number)) throw new RangeError('observability registry capacity exceeded');
      if (previous) {
        if (previous.fingerprintSha256 !== event.fingerprintSha256) throw new Error('observability eventId conflicts with existing evidence');
        return previous;
      }
      if ([...events.values()].some((candidate) => candidate.spanId === event.spanId)) throw new Error('observability spanId must be unique');
      events.set(event.eventId, event);
      return event;
    },
    remove(eventId: string): boolean {
      return events.delete(exactId(eventId, 'observability eventId'));
    },
    snapshot(): FuryObservabilitySnapshot {
      return buildFuryObservabilitySnapshot([...events.values()], budgets, validNow(now));
    },
    size(): number {
      return events.size;
    },
  };
  const frozen = Object.freeze(api);
  REGISTRY_EVIDENCE.add(frozen);
  return frozen;
}
