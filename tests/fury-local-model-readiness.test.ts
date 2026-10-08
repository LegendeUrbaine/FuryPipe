import { describe, expect, it } from 'vitest';

import { assessFuryLocalModelReadiness } from '../src/fury-local-model-readiness.js';
import type { FuryHardwareProfile, FuryLocalBackendStatus } from '../src/fury-local-fabric.js';

const GiB = 1024 ** 3;
const hardware = (overrides: Partial<FuryHardwareProfile> = {}): FuryHardwareProfile => ({
  platform: 'win32', arch: 'x64', cpuModel: 'fixture', cpuCount: 8,
  totalMemoryBytes: 32 * GiB, freeMemoryBytes: 16 * GiB, unifiedMemory: false,
  gpus: [], ...overrides,
});
const backend = (models: FuryLocalBackendStatus['models'], reachable = true): FuryLocalBackendStatus => ({
  kind: 'ollama', baseUrl: 'http://127.0.0.1:11434', reachable,
  protocols: ['openai-chat'], models,
});

describe('local model resource readiness', () => {
  it('requires a reachable chat backend, model size, free-memory fit and operator policy', () => {
    const models = [
      { backend: 'ollama', baseUrl: 'http://127.0.0.1:11434', id: 'coder:small', sizeBytes: 2 * GiB },
      { backend: 'ollama', baseUrl: 'http://127.0.0.1:11434', id: 'coder:large', sizeBytes: 30 * GiB },
      { backend: 'ollama', baseUrl: 'http://127.0.0.1:11434', id: 'coder:unknown' },
    ] as FuryLocalBackendStatus['models'];
    const decisions = assessFuryLocalModelReadiness([backend(models)], hardware({ freeMemoryBytes: 8 * GiB }), {
      envValue: 'coder:small,coder:large,coder:unknown', now: 1_800_000_000_000,
    });
    expect(decisions.map(({ model, state, resourceFit }) => ({ id: model.id, state, resourceFit }))).toEqual([
      { id: 'coder:small', state: 'READY', resourceFit: 'FITS' },
      { id: 'coder:large', state: 'RESOURCE_CONSTRAINED', resourceFit: 'DOES_NOT_FIT' },
      { id: 'coder:unknown', state: 'RESOURCE_UNKNOWN', resourceFit: 'UNKNOWN' },
    ]);
    expect(decisions.every((decision) => decision.observedAt === '2027-01-15T08:00:00.000Z')).toBe(true);
  });

  it('keeps FURYPIPE_MODELS scoped to the existing Visual Engine policy', () => {
    const model: FuryLocalBackendStatus['models'] = [{ backend: 'ollama', baseUrl: 'http://127.0.0.1:11434', id: 'qwen:7b', sizeBytes: GiB }];
    const previous = process.env.FURYPIPE_MODELS;
    try {
      process.env.FURYPIPE_MODELS = 'off';
      // The documented scope is Visual Engine image compression, not local Composer authorization.
      expect(assessFuryLocalModelReadiness([backend(model)], hardware())[0]).toMatchObject({ state: 'READY', executionPolicy: 'local-discovery-confirm-required' });
    } finally {
      if (previous === undefined) delete process.env.FURYPIPE_MODELS;
      else process.env.FURYPIPE_MODELS = previous;
    }
    expect(assessFuryLocalModelReadiness([backend(model)], hardware())[0]?.state).toBe('READY');
  });

  it('does not confuse unreachable service health with local model fit', () => {
    const model: FuryLocalBackendStatus['models'] = [{ backend: 'ollama', baseUrl: 'http://127.0.0.1:11434', id: 'qwen:7b', sizeBytes: GiB }];
    const decision = assessFuryLocalModelReadiness([backend(model, false)], hardware())[0];
    expect(decision).toMatchObject({ state: 'UNAVAILABLE', resourceFit: 'FITS' });
  });

  it('keeps missing GPU free-memory telemetry unknown when CPU RAM cannot safely carry the model', () => {
    const model: FuryLocalBackendStatus['models'] = [{ backend: 'ollama', baseUrl: 'http://127.0.0.1:11434', id: 'qwen:7b', sizeBytes: 5 * GiB }];
    const decision = assessFuryLocalModelReadiness([backend(model)], hardware({
      freeMemoryBytes: 2 * GiB,
      gpus: [{ name: 'GPU', memoryBytes: 16 * GiB }],
    }))[0];
    expect(decision).toMatchObject({ state: 'RESOURCE_UNKNOWN', resourceFit: 'UNKNOWN', executionPolicy: 'local-discovery-confirm-required' });
  });
});
