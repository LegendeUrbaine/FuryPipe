import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateFuryDataset, type FuryEvalDataset } from '../src/fury-eval.js';

describe('Video Studio FuryEval dataset', () => {
  it('evaluates the checked-in deterministic video contract cases', () => {
    const file = path.join(process.cwd(), 'eval', 'video', 'video-studio-dataset.json');
    const dataset = JSON.parse(readFileSync(file, 'utf8')) as FuryEvalDataset;
    const report = evaluateFuryDataset(dataset);
    expect(report.datasetId).toBe('video-studio-core');
    expect(report.byDomain.video).toMatchObject({ cases: 5, successRate: 1, f1: 1 });
    expect(report.executionAuthorized).toBe(false);
  });
});
