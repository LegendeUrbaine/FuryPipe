// FuryTrace — a bounded, source-backed projection of one completed run.
//
// The trace is deliberately a projection, not a second execution log. Every
// event comes from FuryReplay and every evidence item comes from the sealed
// FuryProofBundle. A missing result or a broken replay head is exposed as a
// non-ready/invalid trace; the builder never fills the gap with UI claims.
import { createHash } from 'node:crypto';

import { FURY_REPLAY_FORMAT, verifyFuryReplay, type FuryReplayEntry } from './fury-mission-control.js';
import type { FuryRunResult } from './fury-run.js';

export const FURY_TRACE_FORMAT = 'furypipe-trace/v1' as const;

export type FuryTraceStatus = 'READY' | 'NOT_READY' | 'INVALID';
export type FuryTraceNodeKind = 'run' | 'replay' | 'event' | 'worker' | 'receipt' | 'judge' | 'bundle';
export type FuryTraceNodeState = 'OBSERVED' | 'DERIVED' | 'VERIFIED' | 'FAILED';
export type FuryTraceEdgeKind = 'contains' | 'emitted' | 'linked' | 'judged' | 'sealed' | 'reports';

export interface FuryTraceWorkerSource {
  readonly workerId: string;
  readonly taskId: string;
  readonly role: string;
  readonly state: string;
  readonly receiptIds: readonly string[];
}

export interface FuryTraceNode {
  readonly id: string;
  readonly kind: FuryTraceNodeKind;
  readonly label: string;
  readonly state: FuryTraceNodeState;
  readonly source: Readonly<{
    readonly replaySeq?: number;
    readonly replayHash?: string;
    readonly receiptId?: string;
    readonly bundleDigest?: string;
  }>;
  readonly details?: Readonly<{
    readonly eventType?: string;
    readonly workerId?: string;
    readonly taskId?: string;
    readonly role?: string;
    readonly state?: string;
    readonly dataDigestSha256?: string;
    readonly irDigestSha256?: string;
    readonly outputDigestSha256?: string;
    readonly outcome?: string;
    readonly subject?: string;
    readonly verdict?: string;
  }>;
}

export interface FuryTraceEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly kind: FuryTraceEdgeKind;
  readonly source?: Readonly<{ readonly replaySeq?: number; readonly receiptId?: string }>;
}

export interface FuryTraceEvidence {
  readonly receiptId: string;
  readonly kind: string;
  readonly subject: string;
  readonly outcome: string;
  readonly producer: string;
  readonly evidenceDigest: string;
  readonly replaySeqs: readonly number[];
  readonly source: Readonly<{ readonly bundleDigest: string }>;
}

export interface FuryRunTrace {
  readonly format: typeof FURY_TRACE_FORMAT;
  readonly runId: string;
  readonly runStatus: string;
  readonly status: FuryTraceStatus;
  readonly reason?: string;
  /** Trace inspection never grants execution authority. */
  readonly executionAuthority: false;
  readonly replayIntegrity: Readonly<{
    readonly status: 'PASS' | 'FAIL' | 'NOT_READY';
    readonly checkedEntries: number;
    readonly expectedHead?: Readonly<{ readonly seq: number; readonly hash: string }>;
    readonly brokenAt?: number;
    readonly truncated?: boolean;
  }>;
  readonly summary: Readonly<{
    readonly replayEntries: number;
    readonly workers: number;
    readonly receipts: number;
    readonly verdict?: string;
    readonly bundleDigest?: string;
    readonly outputDigest?: string;
  }>;
  readonly nodes: readonly FuryTraceNode[];
  readonly edges: readonly FuryTraceEdge[];
  readonly evidence: readonly FuryTraceEvidence[];
}

export interface FuryRunTraceInput {
  readonly runId: string;
  readonly runStatus: string;
  readonly result?: FuryRunResult;
  readonly workers?: readonly FuryTraceWorkerSource[];
}

const MAX_TRACE_ENTRIES = 4_096;
const MAX_TRACE_RECEIPTS = 4_096;
const SHA256 = /^[0-9a-f]{64}$/u;

function id(prefix: string, value: string | number): string {
  return `trace:${prefix}:${encodeURIComponent(String(value))}`;
}

function traceText(value: string, max = 256): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function dataDigest(entry: FuryReplayEntry): string {
  return createHash('sha256').update(JSON.stringify(entry.data), 'utf8').digest('hex');
}

function emptyTrace(input: FuryRunTraceInput, status: FuryTraceStatus, reason: string, replayIntegrity: FuryRunTrace['replayIntegrity']): FuryRunTrace {
  return Object.freeze({
    format: FURY_TRACE_FORMAT,
    runId: input.runId,
    runStatus: input.runStatus,
    status,
    reason,
    executionAuthority: false,
    replayIntegrity,
    summary: Object.freeze({ replayEntries: 0, workers: 0, receipts: 0 }),
    nodes: Object.freeze([]),
    edges: Object.freeze([]),
    evidence: Object.freeze([]),
  });
}

/** Build a verified trace projection from a real completed run result. */
export function buildFuryRunTrace(input: FuryRunTraceInput): FuryRunTrace {
  if (!input || typeof input.runId !== 'string' || input.runId.length === 0 || input.runId.length > 128) {
    throw new Error('trace runId is invalid');
  }
  if (!input.result) {
    return emptyTrace(input, 'NOT_READY', 'RUN_NOT_COMPLETED', { status: 'NOT_READY', checkedEntries: 0 });
  }

  const result = input.result;
  const replay = result.replay;
  const head = result.replayHead;
  if (replay.format !== FURY_REPLAY_FORMAT || replay.replayId !== input.runId || replay.entries.length > MAX_TRACE_ENTRIES) {
    return emptyTrace(input, 'INVALID', 'REPLAY_FORMAT_OR_BOUND_INVALID', {
      status: 'FAIL', checkedEntries: Math.min(replay.entries.length, MAX_TRACE_ENTRIES), expectedHead: head,
    });
  }
  if (result.bundle.taskId !== input.runId || !SHA256.test(result.bundle.bundleDigest) || result.bundle.receipts.length > MAX_TRACE_RECEIPTS) {
    return emptyTrace(input, 'INVALID', 'PROOF_BUNDLE_BOUND_INVALID', {
      status: 'FAIL', checkedEntries: replay.entries.length, expectedHead: head,
    });
  }

  const integrity = verifyFuryReplay(replay, head);
  if (!integrity.ok) {
    return emptyTrace(input, 'INVALID', 'REPLAY_INTEGRITY_FAILED', {
      status: 'FAIL', checkedEntries: replay.entries.length, expectedHead: head,
      ...(integrity.brokenAt !== undefined ? { brokenAt: integrity.brokenAt } : {}),
      ...(integrity.truncated !== undefined ? { truncated: integrity.truncated } : {}),
    });
  }

  const runNode = id('run', input.runId);
  const replayNode = id('replay', replay.replayId);
  const judgeNode = id('judge', input.runId);
  const bundleNode = id('bundle', result.bundle.bundleDigest);
  const nodes: FuryTraceNode[] = [
    { id: runNode, kind: 'run', label: `Run ${traceText(input.runId)}`, state: 'OBSERVED', source: {}, details: { verdict: result.judgement.verdict } },
    { id: replayNode, kind: 'replay', label: `Replay ${traceText(replay.replayId)}`, state: 'VERIFIED', source: { replayHash: head.hash }, details: { eventType: 'HASH_CHAIN', irDigestSha256: replay.irDigest } },
    { id: judgeNode, kind: 'judge', label: `FuryJudge ${result.judgement.verdict}`, state: 'DERIVED', source: { bundleDigest: result.bundle.bundleDigest }, details: { verdict: result.judgement.verdict } },
    { id: bundleNode, kind: 'bundle', label: `Proof bundle ${traceText(result.bundle.bundleDigest, 16)}`, state: 'VERIFIED', source: { bundleDigest: result.bundle.bundleDigest }, details: { outputDigestSha256: result.bundle.outputDigest } },
  ];
  const edges: FuryTraceEdge[] = [
    { id: `${runNode}->${replayNode}`, from: runNode, to: replayNode, kind: 'contains' },
    { id: `${runNode}->${judgeNode}`, from: runNode, to: judgeNode, kind: 'judged' },
    { id: `${judgeNode}->${bundleNode}`, from: judgeNode, to: bundleNode, kind: 'sealed' },
  ];

  const workers = new Map<string, FuryTraceWorkerSource>();
  for (const worker of input.workers ?? []) {
    if (!workers.has(worker.workerId)) workers.set(worker.workerId, worker);
  }
  for (const entry of replay.entries) {
    if (entry.workerId && !workers.has(entry.workerId)) {
      const routing = replay.entries.find((candidate) => candidate.type === 'ROUTING' && candidate.workerId === entry.workerId);
      const taskId = typeof routing?.data.taskId === 'string' ? routing.data.taskId : entry.workerId;
      workers.set(entry.workerId, { workerId: entry.workerId, taskId, role: 'unknown', state: 'observed', receiptIds: [] });
    }
  }
  const workerNodes = new Map<string, string>();
  for (const worker of workers.values()) {
    const workerNode = id('worker', worker.workerId);
    workerNodes.set(worker.workerId, workerNode);
    nodes.push({ id: workerNode, kind: 'worker', label: `Worker ${traceText(worker.workerId)}`, state: 'DERIVED', source: {}, details: { workerId: worker.workerId, taskId: worker.taskId, role: worker.role, state: worker.state } });
    edges.push({ id: `${replayNode}->${workerNode}`, from: replayNode, to: workerNode, kind: 'contains' });
  }

  const eventReceiptIds = new Map<string, number[]>();
  for (const entry of replay.entries) {
    const eventNode = id('event', entry.seq);
    nodes.push({
      id: eventNode,
      kind: 'event',
      label: `${entry.seq}. ${traceText(entry.type, 96)}`,
      state: 'OBSERVED',
      source: { replaySeq: entry.seq, replayHash: entry.hash },
      details: {
        eventType: entry.type,
        ...(entry.workerId ? { workerId: entry.workerId } : {}),
        dataDigestSha256: dataDigest(entry),
      },
    });
    edges.push({ id: `${replayNode}->${eventNode}`, from: replayNode, to: eventNode, kind: 'contains', source: { replaySeq: entry.seq } });
    if (entry.workerId) {
      const workerNode = workerNodes.get(entry.workerId);
      if (workerNode) edges.push({ id: `${eventNode}->${workerNode}`, from: eventNode, to: workerNode, kind: 'emitted', source: { replaySeq: entry.seq } });
    }
    const receiptId = typeof entry.data.receiptId === 'string' ? entry.data.receiptId : undefined;
    if (receiptId) {
      const seqs = eventReceiptIds.get(receiptId) ?? [];
      seqs.push(entry.seq);
      eventReceiptIds.set(receiptId, seqs);
    }
  }

  const evidence: FuryTraceEvidence[] = [];
  for (const receipt of result.bundle.receipts) {
    const receiptNode = id('receipt', receipt.receiptId);
    const replaySeqs = Object.freeze(eventReceiptIds.get(receipt.receiptId) ?? []);
    evidence.push(Object.freeze({
      receiptId: receipt.receiptId,
      kind: receipt.kind,
      subject: receipt.subject,
      outcome: receipt.outcome,
      producer: receipt.producer,
      evidenceDigest: receipt.evidenceDigest,
      replaySeqs,
      source: Object.freeze({ bundleDigest: result.bundle.bundleDigest }),
    }));
    nodes.push({ id: receiptNode, kind: 'receipt', label: `${receipt.kind} · ${traceText(receipt.subject)}`, state: 'OBSERVED', source: { receiptId: receipt.receiptId, bundleDigest: result.bundle.bundleDigest }, details: { outcome: receipt.outcome, subject: receipt.subject } });
    edges.push({ id: `${judgeNode}->${receiptNode}`, from: judgeNode, to: receiptNode, kind: 'linked', source: { receiptId: receipt.receiptId } });
    for (const seq of replaySeqs) {
      const eventNode = id('event', seq);
      edges.push({ id: `${eventNode}->${receiptNode}`, from: eventNode, to: receiptNode, kind: 'reports', source: { replaySeq: seq, receiptId: receipt.receiptId } });
    }
    for (const worker of workers.values()) {
      if (worker.receiptIds.includes(receipt.receiptId)) {
        const workerNode = workerNodes.get(worker.workerId);
        if (workerNode) edges.push({ id: `${workerNode}->${receiptNode}`, from: workerNode, to: receiptNode, kind: 'linked', source: { receiptId: receipt.receiptId } });
      }
    }
  }

  return Object.freeze({
    format: FURY_TRACE_FORMAT,
    runId: input.runId,
    runStatus: input.runStatus,
    status: 'READY',
    executionAuthority: false,
    replayIntegrity: Object.freeze({ status: 'PASS', checkedEntries: replay.entries.length, expectedHead: head }),
    summary: Object.freeze({
      replayEntries: replay.entries.length,
      workers: workers.size,
      receipts: evidence.length,
      verdict: result.judgement.verdict,
      bundleDigest: result.bundle.bundleDigest,
      outputDigest: result.bundle.outputDigest,
    }),
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    evidence: Object.freeze(evidence),
  });
}
