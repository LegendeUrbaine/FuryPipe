import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createRecoveryStore } from '../src/core/recovery-store.js';
import { createFuryEvalHistoryRepository } from '../src/fury-eval-history.js';
import { evaluateFuryDataset, FURY_EVAL_DATASET_FORMAT, type FuryEvalDataset } from '../src/fury-eval.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function dataset(observed: readonly string[]): FuryEvalDataset {
  return {
    format: FURY_EVAL_DATASET_FORMAT,
    id: 'history-routing',
    version: '1.0.0',
    cases: [{
      id: 'route-1',
      domain: 'routing',
      objective: 'Route a bounded local task.',
      expected: ['local'],
      observed,
      success: observed.includes('local'),
    }],
  };
}

async function repository(root: string, now: () => number) {
  return createFuryEvalHistoryRepository({
    store: createRecoveryStore(root, { namespace: 'eval-history', maxObjectBytes: 2 * 1024 * 1024 }),
    projectId: 'project-test',
    now,
  });
}

describe('FuryEval durable history', () => {
  it('persists reports across repository restart and compares a candidate', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'furypipe-eval-history-'));
    roots.push(root);
    let clock = 1_700_000_000_000;
    const first = await repository(root, () => clock);
    const baseline = await first.append(evaluateFuryDataset(dataset(['local'])));
    clock += 1_000;
    const candidateReport = evaluateFuryDataset(dataset([]));

    const restarted = await repository(root, () => clock);
    expect(await restarted.get(baseline.runId)).toMatchObject({
      runId: baseline.runId,
      projectId: 'project-test',
      executionAuthorized: false,
      report: { resultDigestSha256: baseline.report.resultDigestSha256 },
    });
    expect((await restarted.list()).map((record) => record.runId)).toEqual([baseline.runId]);
    const comparison = await restarted.compare(baseline.runId, candidateReport);
    expect(comparison).toMatchObject({
      format: 'furypipe-eval-comparison/v1',
      comparable: true,
      executionAuthorized: false,
      baselineResultDigestSha256: baseline.report.resultDigestSha256,
      candidateResultDigestSha256: candidateReport.resultDigestSha256,
    });
  });
});
