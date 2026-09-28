import { describe, expect, it } from 'vitest';

import {
  compileFuryAgentSdkManifest,
  defineFuryAgentContract,
  type FuryAgentSdkAgent,
  type FuryAgentSdkManifestInput,
  type FuryAgentSdkSchema,
} from '../src/fury-agent-sdk.js';

const schema = (id: string): FuryAgentSdkSchema => ({
  id,
  format: 'json',
  fields: [
    { name: 'answer', type: 'string', required: true },
    { name: 'confidence', type: 'number', required: false },
  ],
});

const agent = (id: string, dependsOn: readonly string[] = []): FuryAgentSdkAgent => ({
  id,
  displayName: id,
  role: id === 'reviewer' ? 'reviewer' : id === 'coder' ? 'coder' : 'researcher',
  goal: `Bounded ${id} goal`,
  inputs: [
    { name: 'task', type: 'string', required: true },
    { name: 'context', type: 'object', required: false },
  ],
  context: [{ name: 'workspace', source: 'workspace', required: true, maxBytes: 32_768 }],
  skills: ['z-skill', 'a-skill'],
  tools: [
    { id: 'z-tool', kind: 'builtin' },
    { id: 'a-tool', kind: 'mcp' },
  ],
  permissions: {
    capabilities: { READ: 'ALLOW', WRITE: 'ASK', EXECUTE: 'DENY', NETWORK: 'DENY', EXTERNAL_ACTION: 'DENY' },
    secrets: 'never-requested',
  },
  budget: { maxTokens: 4_096, maxToolCalls: 8, maxWallTimeMs: 30_000, maxSubagents: 2 },
  outputSchema: schema(`${id}-output`),
  dependsOn,
});

function manifest(overrides: Partial<FuryAgentSdkManifestInput> = {}): FuryAgentSdkManifestInput {
  return {
    id: 'bounded-agent-graph',
    displayName: 'Bounded agent graph',
    version: 1,
    agents: [agent('reviewer', ['coder']), agent('coder', ['researcher']), agent('researcher'), agent('designer')],
    channels: [
      { id: 'coder-to-reviewer', from: 'coder', to: 'reviewer', messageSchema: schema('review-request') },
      { id: 'research-to-coder', from: 'researcher', to: 'coder', messageSchema: schema('research-result') },
    ],
    ...overrides,
  };
}

describe('Fury Agent SDK', () => {
  it('normalizes an explicit contract and compiles a deterministic graph', () => {
    const defined = defineFuryAgentContract(agent('coder', ['researcher']));
    const first = compileFuryAgentSdkManifest(manifest());
    const second = compileFuryAgentSdkManifest({
      ...manifest(),
      agents: [...manifest().agents].reverse(),
      channels: [...manifest().channels].reverse(),
    });

    expect(defined.skills).toEqual(['a-skill', 'z-skill']);
    expect(defined.tools.map((tool) => tool.id)).toEqual(['a-tool', 'z-tool']);
    expect(defined.inputs.map((input) => input.name)).toEqual(['context', 'task']);
    expect(defined.outputSchema.fields.map((field) => field.name)).toEqual(['answer', 'confidence']);
    expect(first.manifestDigestSha256).toBe(second.manifestDigestSha256);
    expect(first.manifestDigestSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(first.order).toEqual(['designer', 'researcher', 'coder', 'reviewer']);
    expect(first.parallelGroups).toEqual([['designer', 'researcher'], ['coder'], ['reviewer']]);
    expect(first).toMatchObject({
      format: 'furypipe-agent-sdk-manifest/v1',
      messageBus: { mode: 'explicit-channel-only', implicitDependencies: false, executionAuthorized: false },
      authority: 'authoring-and-inspection-only',
      registrationAuthorized: false,
      networkAuthorized: false,
      filesystemAuthorized: false,
      executionAuthorized: false,
    });
  });

  it('rejects implicit message dependencies, cycles and unbounded authority metadata', () => {
    const base = manifest();
    expect(() => compileFuryAgentSdkManifest({
      ...base,
      channels: [{ ...base.channels[0]!, to: 'reviewer', from: 'researcher' }],
    })).toThrow(/implicit dependency/u);

    expect(() => compileFuryAgentSdkManifest({
      ...base,
      agents: [agent('a', ['b']), agent('b', ['a'])],
      channels: [],
    })).toThrow(/cycle/u);

    expect(() => defineFuryAgentContract({
      ...agent('unsafe'),
      id: 'Bad Agent',
    })).toThrow(/agent\.id/u);

    expect(() => defineFuryAgentContract({
      ...agent('duplicate-tool'),
      tools: [{ id: 'same', kind: 'builtin' }, { id: 'same', kind: 'mcp' }],
    })).toThrow(/duplicate/u);

    expect(() => defineFuryAgentContract({
      ...agent('too-large'),
      budget: { ...agent('too-large').budget, maxWallTimeMs: 7 * 24 * 60 * 60 * 1000 + 1 },
    })).toThrow(/maxWallTimeMs/u);
  });

  it('requires complete permission and schema declarations', () => {
    const base = agent('strict');
    expect(() => defineFuryAgentContract({
      ...base,
      permissions: {
        capabilities: { READ: 'ALLOW', WRITE: 'ASK', EXECUTE: 'DENY', NETWORK: 'DENY' } as never,
        secrets: 'never-requested',
      },
    })).toThrow(/EXTERNAL_ACTION/u);
    expect(() => defineFuryAgentContract({
      ...base,
      outputSchema: { ...base.outputSchema, fields: [{ name: 'answer', type: 'not-a-type', required: true }] } as never,
    })).toThrow(/unsupported/u);
  });
});
