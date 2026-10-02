import { createHash } from 'node:crypto';

import type { RecoveryHandle, RecoveryStore } from './core/recovery-store.js';

export const FURY_EXTERNAL_EFFECT_LEDGER_FORMAT =
  'furypipe-external-effect-ledger/v1' as const;

export type FuryExternalEffectKind = 'browser' | 'coding';
export type FuryExternalEffectOutcome = 'succeeded' | 'failed';
export type FuryExternalEffectState = 'outcome-unknown' | 'terminal';

export interface FuryExternalEffectRecord {
  readonly format: typeof FURY_EXTERNAL_EFFECT_LEDGER_FORMAT;
  readonly operationId: string;
  readonly kind: FuryExternalEffectKind;
  /** Digest of the effect identity used to refuse an unreviewed replay. */
  readonly effectKeySha256: string;
  /** Digest of the exact bounded request/intent, without secrets or payloads. */
  readonly intentSha256: string;
  readonly armedAt: number;
  readonly state: FuryExternalEffectState;
  readonly outcome?: FuryExternalEffectOutcome;
  readonly evidenceSha256?: string;
  readonly resolvedAt?: number;
  readonly automaticReplayAllowed: false;
  readonly executionAuthority: false;
}

export interface FuryExternalEffectReconciliationInput {
  readonly outcome: FuryExternalEffectOutcome;
  /** Digest of operator-supplied external evidence, never the evidence itself. */
  readonly evidenceSha256: string;
  readonly confirmation: 'operator-confirmed';
  readonly now?: number;
}

export interface FuryExternalEffectLedger {
  arm(input: {
    readonly operationId: string;
    readonly kind: FuryExternalEffectKind;
    readonly effectKeySha256: string;
    readonly intentSha256: string;
    readonly now?: number;
  }): Promise<FuryExternalEffectRecord>;
  settle(
    operationId: string,
    input: FuryExternalEffectReconciliationInput,
  ): Promise<FuryExternalEffectRecord>;
  inspect(operationId: string): Promise<FuryExternalEffectRecord | undefined>;
  listOutcomeUnknown(input?: {
    readonly effectKeySha256?: string;
    readonly limit?: number;
  }): Promise<readonly FuryExternalEffectRecord[]>;
}

export type FuryExternalEffectLedgerErrorCode =
  | 'invalid-input'
  | 'conflict'
  | 'not-found'
  | 'recovery-required'
  | 'store-failed';

export class FuryExternalEffectLedgerError extends Error {
  readonly code: FuryExternalEffectLedgerErrorCode;

  constructor(code: FuryExternalEffectLedgerErrorCode, message: string) {
    super(message);
    this.name = 'FuryExternalEffectLedgerError';
    this.code = code;
  }
}

type StoredHandle = RecoveryHandle;

const SOURCE = 'external-effect-ledger';
const CONTENT_TYPE = 'application/vnd.furypipe.external-effect+json';
const MAX_RECORDS = 10_000;
const MAX_OPERATION_ID = 160;
const SHA256 = /^[0-9a-f]{64}$/u;
const SAFE_OPERATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u;

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function bytes(record: FuryExternalEffectRecord): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(record));
}

function assertOperationId(value: unknown): string {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > MAX_OPERATION_ID
    || !SAFE_OPERATION_ID.test(value)
  ) {
    throw new FuryExternalEffectLedgerError(
      'invalid-input',
      'external-effect operation ID is invalid',
    );
  }
  return value;
}

function assertSha(value: unknown, label: string): string {
  if (typeof value !== 'string' || !SHA256.test(value)) {
    throw new FuryExternalEffectLedgerError('invalid-input', `${label} must be a SHA-256 digest`);
  }
  return value;
}

function assertNow(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new FuryExternalEffectLedgerError('invalid-input', `${label} must be a non-negative safe integer`);
  }
  return value as number;
}

function metadataFor(record: FuryExternalEffectRecord): Readonly<Record<string, string | number | boolean>> {
  return Object.freeze({
    source: SOURCE,
    contentType: CONTENT_TYPE,
    operationId: record.operationId,
    kind: record.kind,
    effectKeySha256: record.effectKeySha256,
    state: record.state,
    revision: record.state === 'terminal' ? 1 : 0,
  });
}

function exactMetadata(record: FuryExternalEffectRecord): Readonly<Record<string, string | number | boolean>> {
  return Object.freeze({
    source: SOURCE,
    contentType: CONTENT_TYPE,
    operationId: record.operationId,
    state: record.state,
    revision: record.state === 'terminal' ? 1 : 0,
  });
}

function parseStored(value: unknown): FuryExternalEffectRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new FuryExternalEffectLedgerError('store-failed', 'external-effect ledger record is not an object');
  }
  const record = value as Partial<FuryExternalEffectRecord>;
  if (
    record.format !== FURY_EXTERNAL_EFFECT_LEDGER_FORMAT
    || typeof record.operationId !== 'string'
    || !SAFE_OPERATION_ID.test(record.operationId)
    || (record.kind !== 'browser' && record.kind !== 'coding')
    || typeof record.effectKeySha256 !== 'string'
    || !SHA256.test(record.effectKeySha256)
    || typeof record.intentSha256 !== 'string'
    || !SHA256.test(record.intentSha256)
    || !Number.isSafeInteger(record.armedAt)
    || (record.armedAt as number) < 0
    || (record.state !== 'outcome-unknown' && record.state !== 'terminal')
    || record.automaticReplayAllowed !== false
    || record.executionAuthority !== false
  ) {
    throw new FuryExternalEffectLedgerError('store-failed', 'external-effect ledger record is invalid');
  }
  const armedAt = record.armedAt as number;
  if (record.state === 'terminal') {
    if (
      (record.outcome !== 'succeeded' && record.outcome !== 'failed')
      || typeof record.evidenceSha256 !== 'string'
      || !SHA256.test(record.evidenceSha256)
      || !Number.isSafeInteger(record.resolvedAt)
      || (record.resolvedAt as number) < armedAt
    ) {
      throw new FuryExternalEffectLedgerError('store-failed', 'terminal external-effect ledger record is invalid');
    }
  } else if (record.outcome !== undefined || record.evidenceSha256 !== undefined || record.resolvedAt !== undefined) {
    throw new FuryExternalEffectLedgerError('store-failed', 'unknown external-effect ledger record contains terminal fields');
  }
  return Object.freeze({ ...record }) as FuryExternalEffectRecord;
}

function handleOperationId(handle: StoredHandle): string | undefined {
  const value = handle.metadata?.operationId;
  return typeof value === 'string' ? value : undefined;
}

export function createFuryExternalEffectLedger(options: {
  readonly store: RecoveryStore;
  readonly now?: () => number;
  readonly maxRecords?: number;
}): FuryExternalEffectLedger {
  if (!options || !options.store || typeof options.store.list !== 'function' || typeof options.store.putBounded !== 'function') {
    throw new FuryExternalEffectLedgerError(
      'invalid-input',
      'external-effect ledger requires RecoveryStore list and atomic bounded writes',
    );
  }
  const list = options.store.list.bind(options.store);
  const putBounded = options.store.putBounded.bind(options.store);
  const now = options.now ?? Date.now;
  const maxRecords = options.maxRecords ?? MAX_RECORDS;
  if (!Number.isSafeInteger(maxRecords) || maxRecords < 2 || maxRecords > MAX_RECORDS) {
    throw new FuryExternalEffectLedgerError('invalid-input', 'external-effect ledger maxRecords is invalid');
  }

  const listStored = async (): Promise<readonly { readonly handle: StoredHandle; readonly record: FuryExternalEffectRecord }[]> => {
    let handles: readonly StoredHandle[];
    try {
      handles = await list({ metadata: { source: SOURCE, contentType: CONTENT_TYPE }, limit: maxRecords });
    } catch (error) {
      throw new FuryExternalEffectLedgerError('store-failed', `external-effect ledger listing failed: ${error instanceof Error ? error.message : 'unknown'}`);
    }
    const records: { handle: StoredHandle; record: FuryExternalEffectRecord }[] = [];
    for (const handle of handles) {
      if (handleOperationId(handle) === undefined) continue;
      try {
        const record = parseStored(JSON.parse(new TextDecoder().decode(await options.store.get(handle))));
        if (
          handle.metadata?.operationId !== record.operationId
          || handle.metadata?.state !== record.state
          || handle.metadata?.revision !== (record.state === 'terminal' ? 1 : 0)
        ) {
          throw new Error('metadata does not match record');
        }
        records.push({ handle, record });
      } catch (error) {
        if (error instanceof FuryExternalEffectLedgerError) throw error;
        throw new FuryExternalEffectLedgerError('store-failed', `external-effect ledger record cannot be decoded: ${error instanceof Error ? error.message : 'unknown'}`);
      }
    }
    return Object.freeze(records);
  };

  const latestByOperation = (entries: readonly { readonly record: FuryExternalEffectRecord }[]): Map<string, FuryExternalEffectRecord> => {
    const latest = new Map<string, FuryExternalEffectRecord>();
    for (const entry of entries) {
      const old = latest.get(entry.record.operationId);
      if (old === undefined || (old.state === 'outcome-unknown' && entry.record.state === 'terminal')) latest.set(entry.record.operationId, entry.record);
    }
    return latest;
  };

  return Object.freeze({
    async arm(input: {
      readonly operationId: string;
      readonly kind: FuryExternalEffectKind;
      readonly effectKeySha256: string;
      readonly intentSha256: string;
      readonly now?: number;
    }) {
      const operationId = assertOperationId(input.operationId);
      if (input.kind !== 'browser' && input.kind !== 'coding') throw new FuryExternalEffectLedgerError('invalid-input', 'external-effect kind is invalid');
      const effectKeySha256 = assertSha(input.effectKeySha256, 'effectKeySha256');
      const intentSha256 = assertSha(input.intentSha256, 'intentSha256');
      const armedAt = input.now === undefined ? assertNow(now(), 'external-effect clock') : assertNow(input.now, 'external-effect timestamp');
      const entries = await listStored();
      const latest = latestByOperation(entries);
      const existing = latest.get(operationId);
      if (existing !== undefined) throw new FuryExternalEffectLedgerError('conflict', `external-effect operation ${operationId} already exists`);
      const unresolved = [...latest.values()].find((record) => record.state === 'outcome-unknown' && record.effectKeySha256 === effectKeySha256);
      if (unresolved !== undefined) {
        throw new FuryExternalEffectLedgerError('recovery-required', `external effect ${unresolved.operationId} is unresolved; reconcile it before replay`);
      }
      const record = Object.freeze({
        format: FURY_EXTERNAL_EFFECT_LEDGER_FORMAT,
        operationId,
        kind: input.kind,
        effectKeySha256,
        intentSha256,
        armedAt,
        state: 'outcome-unknown' as const,
        automaticReplayAllowed: false as const,
        executionAuthority: false as const,
      });
      try {
        await putBounded(bytes(record), metadataFor(record), {
          metadata: { source: SOURCE, contentType: CONTENT_TYPE },
          maxMatches: maxRecords,
          additionalBounds: [{ metadata: { source: SOURCE, contentType: CONTENT_TYPE, operationId, state: 'outcome-unknown', revision: 0 }, maxMatches: 1 }],
        });
      } catch (error) {
        throw new FuryExternalEffectLedgerError('conflict', `external-effect operation ${operationId} could not be armed: ${error instanceof Error ? error.message : 'unknown'}`);
      }
      return record;
    },

    async settle(operationId: string, input: FuryExternalEffectReconciliationInput) {
      const id = assertOperationId(operationId);
      if (input.outcome !== 'succeeded' && input.outcome !== 'failed') throw new FuryExternalEffectLedgerError('invalid-input', 'external-effect outcome is invalid');
      assertSha(input.evidenceSha256, 'evidenceSha256');
      if (input.confirmation !== 'operator-confirmed') throw new FuryExternalEffectLedgerError('invalid-input', 'external-effect settlement requires operator-confirmed evidence');
      const resolvedAt = input.now === undefined ? assertNow(now(), 'external-effect clock') : assertNow(input.now, 'external-effect timestamp');
      const entries = await listStored();
      const current = latestByOperation(entries).get(id);
      if (current === undefined) throw new FuryExternalEffectLedgerError('not-found', `external-effect operation ${id} was not found`);
      if (current.state !== 'outcome-unknown') throw new FuryExternalEffectLedgerError('conflict', `external-effect operation ${id} is already terminal`);
      if (resolvedAt < current.armedAt) throw new FuryExternalEffectLedgerError('invalid-input', 'external-effect settlement predates arming');
      const record = Object.freeze({
        ...current,
        state: 'terminal' as const,
        outcome: input.outcome,
        evidenceSha256: input.evidenceSha256,
        resolvedAt,
      });
      try {
        await putBounded(bytes(record), metadataFor(record), {
          metadata: { source: SOURCE, contentType: CONTENT_TYPE },
          maxMatches: maxRecords,
          matchConstraints: [
            { metadata: exactMetadata(current), minMatches: 1, maxMatches: 1 },
            { metadata: exactMetadata(record), maxMatches: 0 },
          ],
          additionalBounds: [{ metadata: { source: SOURCE, contentType: CONTENT_TYPE, operationId: id, state: 'terminal', revision: 1 }, maxMatches: 1 }],
        });
      } catch (error) {
        throw new FuryExternalEffectLedgerError('conflict', `external-effect operation ${id} could not be settled: ${error instanceof Error ? error.message : 'unknown'}`);
      }
      return record;
    },

    async inspect(operationId: string) {
      const id = assertOperationId(operationId);
      return latestByOperation(await listStored()).get(id);
    },

    async listOutcomeUnknown(input: {
      readonly effectKeySha256?: string;
      readonly limit?: number;
    } = {}) {
      const entries = latestByOperation(await listStored());
      const requestedEffectKey = input.effectKeySha256 === undefined ? undefined : assertSha(input.effectKeySha256, 'effectKeySha256');
      const limit = input.limit ?? 100;
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_RECORDS) throw new FuryExternalEffectLedgerError('invalid-input', 'external-effect list limit is invalid');
      return Object.freeze([...entries.values()]
        .filter((record) => record.state === 'outcome-unknown' && (requestedEffectKey === undefined || record.effectKeySha256 === requestedEffectKey))
        .sort((left, right) => left.armedAt - right.armedAt)
        .slice(0, limit));
    },
  });
}

/** Digest helper for callers that need a stable, secret-free effect identity. */
export function digestFuryExternalEffect(value: unknown): string {
  let encoded: string;
  try {
    encoded = JSON.stringify(value);
  } catch {
    throw new FuryExternalEffectLedgerError('invalid-input', 'external-effect identity is not serializable');
  }
  return sha256(encoded);
}
