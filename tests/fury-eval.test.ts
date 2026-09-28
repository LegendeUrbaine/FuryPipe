import { describe, expect, it } from 'vitest';

import {
  compareFuryEvalReports,
  evaluateFuryDataset,
  FURY_EVAL_DATASET_FORMAT,
  FURY_EVAL_DOMAINS,
  type FuryEvalDataset,
} from '../src/fury-eval.js';

function dataset(observed: readonly string[], overrides: Partial<FuryEvalDataset['cases'][number]> = {}): FuryEvalDataset {
  return {
    format: FURY_EVAL_DATASET_FORMAT,
    id: 'routing-core',
    version: '1.0.0',
    cases: [{
      id: 'route-security',
      domain: 'routing',
      objective: 'Review repository security.',
      expected: ['security-skill', 'review-model'],
      observed,
      success: true,
      latencyMs: 100,
      costUsd: 0.01,
      ...overrides,
    }],
  };
}

describe('FuryEval', () => {
  it('computes deterministic selection quality metrics without granting authority', () => {
    const report = evaluateFuryDataset(dataset(['security-skill', 'wrong-model']));

    expect(report.format).toBe('furypipe-eval-report/v1');
    expect(report.overall).toMatchObject({
      cases: 1,
      successes: 1,
      successRate: 1,
      precision: 0.5,
      recall: 0.5,
      f1: 0.5,
      meanLatencyMs: 100,
      meanCostUsd: 0.01,
    });
    expect(report.byDomain.routing?.f1).toBe(0.5);
    expect(report.executionAuthorized).toBe(false);
    expect(report.datasetDigestSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(report.resultDigestSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(report.history).toMatchObject({ commit: null, environment: null, timestamp: null });
  });

  it('treats empty expected/observed selections as exact for selection metrics', () => {
    const report = evaluateFuryDataset(dataset([], { expected: [], observed: [], success: true }));
    expect(report.overall.precision).toBe(1);
    expect(report.overall.recall).toBe(1);
    expect(report.overall.f1).toBe(1);
  });

  it('detects regressions and improvements only for comparable datasets', () => {
    const baseline = evaluateFuryDataset(dataset(['security-skill', 'review-model']));
    const candidate = evaluateFuryDataset(dataset(['security-skill'], {
      latencyMs: 80,
      costUsd: 0.005,
    }));
    const comparison = compareFuryEvalReports(baseline, candidate);

    expect(comparison.comparable).toBe(true);
    expect(comparison.regressions).toEqual(expect.arrayContaining([
      expect.stringMatching(/^precision|recall|f1/u),
    ]));
    expect(comparison.improvements).toEqual(expect.arrayContaining([
      'meanLatencyMs -20',
      'meanCostUsd -0.005',
    ]));
    expect(comparison.executionAuthorized).toBe(false);
  });

  it('refuses to call reports comparable when dataset identity changes', () => {
    const baseline = evaluateFuryDataset(dataset(['security-skill']));
    const other = evaluateFuryDataset({
      ...dataset(['security-skill']),
      id: 'different-dataset',
    });
    const comparison = compareFuryEvalReports(baseline, other);

    expect(comparison.comparable).toBe(false);
    expect(comparison.regressions).toEqual([]);
    expect(comparison.improvements).toEqual([]);
    expect(comparison.baselineResultDigestSha256).toBe(baseline.resultDigestSha256);
    expect(comparison.candidateResultDigestSha256).toBe(other.resultDigestSha256);
  });

  it('fails closed on duplicate ids and invalid numeric evidence', () => {
    const base = dataset(['security-skill']);
    expect(() => evaluateFuryDataset({
      ...base,
      cases: [base.cases[0]!, base.cases[0]!],
    })).toThrow(/duplicate/u);

    expect(() => evaluateFuryDataset(dataset(['security-skill'], {
      latencyMs: Number.NaN,
    }))).toThrow(/latencyMs/u);
  });

  it('covers every roadmap evaluation domain and records explicit history without execution', () => {
    const report = evaluateFuryDataset({
      format: FURY_EVAL_DATASET_FORMAT,
      id: 'roadmap-domain-coverage',
      version: '1.0.0',
      history: {
        commit: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        environment: 'vitest-node26-win32',
        timestamp: '2026-09-28T12:00:00+02:00',
      },
      cases: FURY_EVAL_DOMAINS.map((domain) => ({
        id: `domain-${domain}`,
        domain,
        objective: `Observe ${domain} contract`,
        expected: [`${domain}-contract`],
        observed: [`${domain}-contract`],
        success: true,
      })),
    });

    expect(Object.keys(report.byDomain).sort()).toEqual([...FURY_EVAL_DOMAINS].sort());
    expect(report.history).toMatchObject({
      commit: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      environment: 'vitest-node26-win32',
      timestamp: '2026-09-28T10:00:00.000Z',
    });
    expect(report.history.datasetDigestSha256).toBe(report.datasetDigestSha256);
    expect(report.history.resultDigestSha256).toBe(report.resultDigestSha256);
    expect(report.history.metrics).toEqual(report.overall);
    expect(report.executionAuthorized).toBe(false);
  });

  it('rejects malformed evaluation history instead of inventing provenance', () => {
    const base = dataset(['security-skill']);
    expect(() => evaluateFuryDataset({ ...base, history: { commit: 'not-a-sha' } })).toThrow(/history commit/u);
    expect(() => evaluateFuryDataset({ ...base, history: { timestamp: 'not-a-date' } })).toThrow(/history timestamp/u);
    expect(() => evaluateFuryDataset({ ...base, history: { unexpected: true } as never })).toThrow(/unknown key/u);
  });
});
