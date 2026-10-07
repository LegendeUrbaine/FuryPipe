import { createHash, randomUUID } from 'node:crypto';

import type { RecoveryHandle, RecoveryStore } from './core/recovery-store.js';
import {
  compareFuryEvalReports,
  type FuryEvalComparison,
  type FuryEvalReport,
} from './fury-eval.js';

export const FURY_EVAL_HISTORY_RECORD_FORMAT =
  'furypipe-eval-history-record/v1' as const;

export interface FuryEvalHistoryRecord {
  readonly format: typeof FURY_EVAL_HISTORY_RECORD_FORMAT;
  readonly runId: string;
  readonly projectId: string;
  readonly recordedAt: number;
  readonly report: FuryEvalReport;
  readonly executionAuthorized: false;
}

export interface FuryEvalHistoryRepositoryOptions {
  readonly store: RecoveryStore;
  readonly projectId: string;
  readonly now?: () => number;
  readonly maxRuns?: number;
}

export interface FuryEvalHistoryRepository {
  append(report: FuryEvalReport): Promise<FuryEvalHistoryRecord>;
  get(runId: string): Promise<FuryEvalHistoryRecord | undefined>;
  list(limit?: number): Promise<readonly FuryEvalHistoryRecord[]>;
  compare(
    baselineRunId: string,
    candidate: FuryEvalReport,
    options?: { readonly tolerance?: number },
  ): Promise<FuryEvalComparison>;
}

const SYSTEM = 'furypipe-eval-history';
const MAX_RUNS = 10_000;
const MAX_RECORD_BYTES = 2 * 1024 * 1024;
const RUN_ID_RE = /^eval_[A-Za-z0-9_-]{16,128}$/u;
const PROJECT_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const SHA256_RE = /^[0-9a-f]{64}$/u;

function nowValue(source: () => number): number {
  const value = source();
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('eval history clock is invalid');
  return value;
}

function boundedLimit(value: number | undefined, fallback: number): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < 1 || resolved > MAX_RUNS) {
    throw new Error(`eval history limit must be between 1 and ${MAX_RUNS}`);
  }
  return resolved;
}

function projectId(value: string): string {
  if (typeof value !== 'string' || !PROJECT_ID_RE.test(value)) {
    throw new Error('eval history projectId is invalid');
  }
  return value;
}

function runId(value: unknown): string {
  if (typeof value !== 'string' || !RUN_ID_RE.test(value)) throw new Error('eval history runId is invalid');
  return value;
}

function sha(value: unknown, label: string): string {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) throw new Error(`${label} is invalid`);
  return value;
}

function recordMetadata(project: string, id?: string): Readonly<Record<string, string>> {
  return Object.freeze({
    system: SYSTEM,
    recordType: 'run',
    projectId: project,
    ...(id === undefined ? {} : { runId: id }),
  });
}

function validateReport(value: unknown): FuryEvalReport {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || (value as { format?: unknown }).format !== 'furypipe-eval-report/v1'
    || (value as { executionAuthorized?: unknown }).executionAuthorized !== false
  ) {
    throw new Error('eval history report is invalid');
  }
  const report = value as FuryEvalReport;
  sha(report.datasetDigestSha256, 'eval history dataset digest');
  sha(report.resultDigestSha256, 'eval history result digest');
  if (
    typeof report.datasetId !== 'string'
    || typeof report.datasetVersion !== 'string'
    || !Array.isArray(report.cases)
    || !report.overall
    || typeof report.overall !== 'object'
    || !report.history
    || typeof report.history !== 'object'
  ) throw new Error('eval history report shape is invalid');
  return report;
}

function parseRecord(value: unknown, expectedProjectId: string): FuryEvalHistoryRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('eval history record is invalid');
  const record = value as Partial<FuryEvalHistoryRecord>;
  if (
    record.format !== FURY_EVAL_HISTORY_RECORD_FORMAT
    || record.executionAuthorized !== false
    || record.projectId !== expectedProjectId
    || !Number.isSafeInteger(record.recordedAt)
  ) throw new Error('eval history record metadata is invalid');
  const id = runId(record.runId);
  const report = validateReport(record.report);
  return Object.freeze({
    format: FURY_EVAL_HISTORY_RECORD_FORMAT,
    runId: id,
    projectId: expectedProjectId,
    recordedAt: record.recordedAt as number,
    report,
    executionAuthorized: false as const,
  });
}

function canonicalBytes(record: FuryEvalHistoryRecord): Uint8Array {
  const encoded = JSON.stringify(record);
  if (Buffer.byteLength(encoded, 'utf8') > MAX_RECORD_BYTES) throw new Error('eval history record is too large');
  return new TextEncoder().encode(encoded);
}

function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function createFuryEvalHistoryRepository(
  options: FuryEvalHistoryRepositoryOptions,
): FuryEvalHistoryRepository {
  if (!options || typeof options !== 'object' || !options.store) throw new Error('eval history store is required');
  if (typeof options.store.list !== 'function' || typeof options.store.putBounded !== 'function') {
    throw new Error('eval history store requires list and atomic putBounded');
  }
  const project = projectId(options.projectId);
  const now = options.now ?? Date.now;
  nowValue(now);
  const maxRuns = boundedLimit(options.maxRuns, MAX_RUNS);

  const list = async (limitInput?: number): Promise<readonly FuryEvalHistoryRecord[]> => {
    const limit = boundedLimit(limitInput, 100);
    const handles = await options.store.list!({ metadata: recordMetadata(project), limit });
    const records: FuryEvalHistoryRecord[] = [];
    for (const handle of handles) {
      if (handle.metadata?.system !== SYSTEM || handle.metadata?.recordType !== 'run' || handle.metadata?.projectId !== project) {
        throw new Error('eval history metadata is corrupt');
      }
      records.push(parseRecord(JSON.parse(new TextDecoder().decode(await options.store.get(handle))) as unknown, project));
    }
    records.sort((left, right) => right.recordedAt - left.recordedAt || right.runId.localeCompare(left.runId));
    return Object.freeze(records.slice(0, limit));
  };

  const api: FuryEvalHistoryRepository = Object.freeze({
    async append(report: FuryEvalReport): Promise<FuryEvalHistoryRecord> {
      const normalized = validateReport(report);
      const recordedAt = nowValue(now);
      const runIdValue = `eval_${digest(`${project}\0${recordedAt}\0${randomUUID()}`).slice(0, 32)}`;
      const record: FuryEvalHistoryRecord = Object.freeze({
        format: FURY_EVAL_HISTORY_RECORD_FORMAT,
        runId: runIdValue,
        projectId: project,
        recordedAt,
        report: normalized,
        executionAuthorized: false,
      });
      await options.store.putBounded!(
        canonicalBytes(record),
        recordMetadata(project, runIdValue),
        {
          metadata: { system: SYSTEM },
          maxMatches: maxRuns,
          additionalBounds: [
            { metadata: recordMetadata(project), maxMatches: maxRuns },
            { metadata: recordMetadata(project, runIdValue), maxMatches: 1 },
          ],
        },
      );
      return record;
    },

    async get(id: string): Promise<FuryEvalHistoryRecord | undefined> {
      const requested = runId(id);
      const handles = await options.store.list!({
        metadata: recordMetadata(project, requested),
        limit: 2,
      });
      if (handles.length === 0) return undefined;
      const handle = handles[0]!;
      if (handle.metadata?.system !== SYSTEM || handle.metadata?.recordType !== 'run' || handle.metadata?.projectId !== project || handle.metadata?.runId !== requested) {
        throw new Error('eval history metadata is corrupt');
      }
      return parseRecord(JSON.parse(new TextDecoder().decode(await options.store.get(handle))) as unknown, project);
    },

    list,

    async compare(
      baselineRunId: string,
      candidate: FuryEvalReport,
      comparisonOptions = {},
    ): Promise<FuryEvalComparison> {
      const baseline = await api.get(baselineRunId);
      if (!baseline) throw new Error('eval history baseline run was not found');
      return compareFuryEvalReports(baseline.report, validateReport(candidate), comparisonOptions);
    },
  });
  return api;
}
