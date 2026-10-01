import { describe, expect, it } from 'vitest';

import {
  compileFuryProviderSdkManifest,
  defineFuryProviderAdapter,
  type FuryProviderSdkAdapter,
  type FuryProviderSdkModel,
} from '../src/fury-provider-sdk.js';

const model = (id: string): FuryProviderSdkModel => ({
  id,
  displayName: id,
  modalities: {
    textInput: 'yes', imageInput: 'unknown', audioInput: 'unknown', videoInput: 'unknown',
    fileInput: 'unknown', textOutput: 'yes', imageOutput: 'unknown', audioOutput: 'unknown',
  },
  capabilities: { reasoning: 'yes', tools: 'yes', structuredOutput: 'unknown', streaming: 'yes' },
  limits: { contextTokens: 128_000, outputTokens: 8_192 },
});

const adapter = (): FuryProviderSdkAdapter => ({
  id: 'example-provider',
  displayName: 'Example Provider',
  protocol: 'openai-compatible',
  models: [
    {
      ...model('zeta-model'),
      powerControls: {
        reasoningEffort: ['maximum', 'low'],
        temperature: { min: 0, max: 1, step: 0.1 },
        latencyProfiles: ['quality', 'fast'],
        toolUse: 'yes',
        contextStrategies: ['full', 'compact'],
      },
    },
    model('alpha-model'),
  ],
});

describe('Fury Provider SDK', () => {
  it('normalizes explicit model capabilities and compiles deterministic metadata only', () => {
    const defined = defineFuryProviderAdapter(adapter());
    const first = compileFuryProviderSdkManifest(adapter());
    const second = compileFuryProviderSdkManifest(adapter());

    expect(defined.models.map((entry) => entry.id)).toEqual(['alpha-model', 'zeta-model']);
    expect(defined.models[1]?.powerControls).toMatchObject({
      reasoningEffort: ['low', 'maximum'],
      latencyProfiles: ['fast', 'quality'],
      contextStrategies: ['compact', 'full'],
    });
    expect(first.manifestDigestSha256).toBe(second.manifestDigestSha256);
    expect(first.manifestDigestSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(first).toMatchObject({
      format: 'furypipe-provider-sdk-manifest/v1',
      authority: 'authoring-and-inspection-only',
      registrationAuthorized: false,
      networkAuthorized: false,
      filesystemAuthorized: false,
      executionAuthorized: false,
    });
  });

  it('requires explicit unknowns and rejects duplicate or unsafe metadata', () => {
    const base = adapter();
    expect(() => defineFuryProviderAdapter({ ...base, id: 'Bad Provider' })).toThrow(/adapter.id/u);
    expect(() => defineFuryProviderAdapter({ ...base, models: [base.models[0]!, base.models[0]!] })).toThrow(/duplicate id/u);
    expect(() => defineFuryProviderAdapter({
      ...base,
      models: [{ ...base.models[0]!, powerControls: { temperature: { min: 2, max: 1 } } }],
    })).toThrow(/temperature range/u);
    expect(() => defineFuryProviderAdapter({
      ...base,
      models: [{ ...base.models[0]!, modalities: { ...base.models[0]!.modalities, textInput: undefined as never } }],
    })).toThrow(/modalities\.textInput/u);
  });
});
