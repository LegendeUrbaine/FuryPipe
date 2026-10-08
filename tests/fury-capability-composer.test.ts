import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { FURY_HARNESS_REGISTRY, type FuryHarnessDiscovery } from '../src/fury-harness-hub.js';
import type { FuryLocalBackendStatus } from '../src/fury-local-fabric.js';
import { createFuryMcpHub } from '../src/fury-mcp-hub.js';
import { createFurySkillHub } from '../src/fury-skill-hub.js';
import { createStudioApi } from '../src/studio/studio-api.js';
import { digestFuryCapabilityComposerPlan, executeFuryCapabilityComposerLocal, type FuryCapabilityComposerPlan } from '../src/fury-capability-composer.js';
import { createFuryProofLedger } from '../src/fury-proof.js';

const servers: Server[] = [];
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const harnesses: FuryHarnessDiscovery = {
  format: 'furypipe-harness-discovery/v1', platform: 'linux',
  harnesses: FURY_HARNESS_REGISTRY.map((definition) => ({
    id: definition.id, displayName: definition.displayName, authentication: 'not-probed' as const, definition,
    installed: definition.id === 'furypipe-native',
    versionStatus: definition.id === 'furypipe-native' ? 'builtin' as const : 'not-installed' as const,
  })),
};

async function localCompletionServer(calls = { count: 0 }, onInference?: () => void): Promise<string> {
  const server = createServer((request, response) => {
    if (request.url !== '/v1/chat/completions') {
      response.writeHead(404).end();
      return;
    }
    calls.count += 1;
    onInference?.();
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      const input = JSON.parse(body) as { model?: string };
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ choices: [{ message: { content: `local answer from ${input.model ?? 'unknown'}` } }] }));
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function localBackend(baseUrl: string, sizeBytes = 2 * 1024 ** 3): FuryLocalBackendStatus[] {
  return [{
    kind: 'ollama', baseUrl, reachable: true, protocols: ['openai-chat'],
    models: [{ backend: 'ollama', baseUrl, id: 'qwen-local:7b', sizeBytes, modality: 'text' }],
  }];
}

async function makeStudio(
  baseUrl: string,
  withLocal = true,
  freeMemory: () => number = () => 16 * 1024 ** 3,
) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'furypipe-composer-test-'));
  roots.push(root);
  const studio = createStudioApi({
    projectRoot: root,
    discoverHarnesses: async () => harnesses,
    discoverLocal: async () => ({ backends: withLocal ? localBackend(baseUrl) : [] }),
    discoverHardware: async () => ({ platform: 'win32', arch: 'x64', cpuModel: 'test', cpuCount: 8,
      totalMemoryBytes: 32 * 1024 ** 3, freeMemoryBytes: freeMemory(), unifiedMemory: false, gpus: [] }),
    skillHub: createFurySkillHub({ projectRoot: root, stateDir: path.join(root, 'skills') }),
    mcpHub: createFuryMcpHub({ projectRoot: root, homeDir: path.join(root, 'home'), stateDir: path.join(root, 'mcp') }),
    composerDir: path.join(root, 'composer'),
  });
  return studio;
}

const post = (body: unknown) => new Request('http://127.0.0.1/api/studio/capability-composer', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

describe('Fury Capability Composer VNext-03', () => {
  it('composes local model, skills/MCP advisory state, dispatch and FuryEval evidence', async () => {
    const baseUrl = await localCompletionServer();
    const studio = await makeStudio(baseUrl);
    const response = await studio.handle('capability-composer-plan', post({ objective: 'Explain the local route and available capabilities.' }));
    expect(response.status).toBe(200);
    const body = await response.json() as {
      plan: {
        state: string;
        authority: string;
        executionAuthorized: boolean;
        selectedCapabilities: { kind: string; id: string }[];
        dispatch: { status: string; requestedMode: string; mode: string; profile: string };
        runtime: { state: string; model?: { id: string; protocol: string } };
        evaluation: { overall: { cases: number; f1: number } };
        route: { mcp: { executionAuthorized: boolean } };
        stages: { id: string }[];
        planDigestSha256: string;
      };
    };
    expect(body.plan).toMatchObject({
      state: 'READY_FOR_CONFIRMATION', authority: 'composer-plan-only', executionAuthorized: false,
      dispatch: { status: 'PLANNED', requestedMode: 'LOCAL_ONLY', profile: 'PRIVATE' },
      runtime: { state: 'READY', model: { id: 'qwen-local:7b', protocol: 'openai-chat' } },
    });
    expect(body.plan.selectedCapabilities.some((item) => item.kind === 'model')).toBe(true);
    expect(body.plan.route.mcp.executionAuthorized).toBe(false);
    expect(body.plan.evaluation.overall.cases).toBe(5);
    expect(body.plan.evaluation.overall.f1).toBeGreaterThan(0);
    expect(body.plan.stages.map((stage) => stage.id)).toEqual([
      'intent-analysis', 'capability-discovery', 'compatibility', 'authority', 'execution-plan', 'confirmation', 'runtime', 'verification', 'provenance',
    ]);
    expect(body.plan.planDigestSha256).toMatch(/^[0-9a-f]{64}$/u);
    const listed = await studio.handle('capability-composer-plans', new Request('http://127.0.0.1/api/studio/capability-composer/plans.json'));
    expect(listed.status).toBe(200);
    expect(((await listed.json()) as { plans: unknown[] }).plans).toHaveLength(1);
  });

  it('fails closed without confirmation, then executes one local request and seals proof', async () => {
    const baseUrl = await localCompletionServer();
    const studio = await makeStudio(baseUrl);
    const planned = await studio.handle('capability-composer-plan', post({ objective: 'Answer with the local model.' }));
    const plan = (await planned.json() as { plan: { planDigestSha256: string } }).plan;
    const denied = await studio.handle('capability-composer-execute', post({ planDigest: plan.planDigestSha256 }));
    expect(denied.status).toBe(400);

    const executed = await studio.handle('capability-composer-execute', post({ planDigest: plan.planDigestSha256, confirm: true }));
    expect(executed.status).toBe(200);
    const body = await executed.json() as { execution: { status: string; output: string; judgement: { verdict: string }; receipts: unknown[]; proofBundle: { bundleDigest: string }; executionAuthority: boolean } };
    expect(body.execution).toMatchObject({ status: 'COMPLETED', judgement: { verdict: 'ACCEPT' }, executionAuthority: false });
    expect(body.execution.output).toContain('local answer from qwen-local:7b');
    expect(body.execution.receipts).toHaveLength(2);
    expect(body.execution.proofBundle.bundleDigest).toMatch(/^[0-9a-f]{64}$/u);
  });

  it('exposes NOT_CONFIGURED and never falls back to a cloud provider', async () => {
    const studio = await makeStudio('http://127.0.0.1:1', false);
    const response = await studio.handle('capability-composer-plan', post({ objective: 'Use a local model if one exists.' }));
    expect(response.status).toBe(200);
    const body = await response.json() as { plan: { state: string; runtime: { state: string }; dispatch: { status: string; reasons: string[] }; evaluation: { byDomain: { providers?: { successRate: number } } } } };
    expect(body.plan).toMatchObject({ state: 'NOT_CONFIGURED', runtime: { state: 'NOT_CONFIGURED' }, dispatch: { status: 'BLOCKED' } });
    expect(body.plan.dispatch.reasons.join(' ')).toMatch(/local binding|available/u);
    expect(body.plan.evaluation.byDomain.providers?.successRate).toBe(0);
  });

  it('does not auto-select a reachable local model that exceeds currently free RAM', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'furypipe-composer-resource-test-'));
    roots.push(root);
    const baseUrl = 'http://127.0.0.1:11434';
    const studio = createStudioApi({
      projectRoot: root,
      discoverHarnesses: async () => harnesses,
      discoverLocal: async () => ({ backends: localBackend(baseUrl, 30 * 1024 ** 3) }),
      discoverHardware: async () => ({ platform: 'win32', arch: 'x64', cpuModel: 'test', cpuCount: 8,
        totalMemoryBytes: 32 * 1024 ** 3, freeMemoryBytes: 4 * 1024 ** 3, unifiedMemory: false, gpus: [] }),
      skillHub: createFurySkillHub({ projectRoot: root, stateDir: path.join(root, 'skills') }),
      mcpHub: createFuryMcpHub({ projectRoot: root, homeDir: path.join(root, 'home'), stateDir: path.join(root, 'mcp') }),
      composerDir: path.join(root, 'composer'),
    });
    const response = await studio.handle('capability-composer-plan', post({ objective: 'Answer with the local model.' }));
    expect(response.status).toBe(200);
    expect((await response.json() as { plan: { state: string; runtime: { state: string; model?: unknown } } }).plan)
      .toMatchObject({ state: 'NOT_CONFIGURED', runtime: { state: 'NOT_CONFIGURED' } });
  });

  it('falls back to a smaller local candidate when the requested larger model is constrained', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'furypipe-composer-fallback-test-'));
    roots.push(root);
    const baseUrl = 'http://127.0.0.1:11434';
    const studio = createStudioApi({
      projectRoot: root,
      discoverHarnesses: async () => harnesses,
      discoverLocal: async () => ({ backends: [{
        kind: 'ollama', baseUrl, reachable: true, protocols: ['openai-chat'],
        models: [
          { backend: 'ollama', baseUrl, id: 'qwen-coder:30b', sizeBytes: 30 * 1024 ** 3, modality: 'text' },
          { backend: 'ollama', baseUrl, id: 'qwen-coder:7b', sizeBytes: 4 * 1024 ** 3, modality: 'text' },
        ],
      }] }),
      discoverHardware: async () => ({ platform: 'win32', arch: 'x64', cpuModel: 'test', cpuCount: 8,
        totalMemoryBytes: 32 * 1024 ** 3, freeMemoryBytes: 10 * 1024 ** 3, unifiedMemory: false, gpus: [] }),
      skillHub: createFurySkillHub({ projectRoot: root, stateDir: path.join(root, 'skills') }),
      mcpHub: createFuryMcpHub({ projectRoot: root, homeDir: path.join(root, 'home'), stateDir: path.join(root, 'mcp') }),
      composerDir: path.join(root, 'composer'),
    });
    const response = await studio.handle('capability-composer-plan', post({ objective: 'Use qwen-coder:30b to explain the TypeScript route.' }));
    const plan = (await response.json() as { plan: { state: string; runtime: { model?: { id: string; resourceFit: string } } } }).plan;
    expect(plan.state).toBe('READY_FOR_CONFIRMATION');
    expect(plan.runtime.model).toMatchObject({ id: 'qwen-coder:7b', resourceFit: 'FITS' });
  });

  it('uses fresh local resources when building a new plan instead of refreshing cached observations', async () => {
    const baseUrl = 'http://127.0.0.1:11434';
    let hardwareCalls = 0;
    const root = await mkdtemp(path.join(os.tmpdir(), 'furypipe-composer-fresh-plan-test-'));
    roots.push(root);
    const studio = createStudioApi({
      projectRoot: root,
      discoverHarnesses: async () => harnesses,
      discoverLocal: async () => ({ backends: [{
        kind: 'ollama', baseUrl, reachable: true, protocols: ['openai-chat'],
        models: [{ backend: 'ollama', baseUrl, id: 'qwen-coder:7b', sizeBytes: 2 * 1024 ** 3, modality: 'text' }],
      }] }),
      discoverHardware: async () => ({ platform: 'win32', arch: 'x64', cpuModel: 'test', cpuCount: 8,
        totalMemoryBytes: 32 * 1024 ** 3, freeMemoryBytes: ++hardwareCalls === 1 ? 16 * 1024 ** 3 : 1 * 1024 ** 3, unifiedMemory: false, gpus: [] }),
      skillHub: createFurySkillHub({ projectRoot: root, stateDir: path.join(root, 'skills') }),
      mcpHub: createFuryMcpHub({ projectRoot: root, homeDir: path.join(root, 'home'), stateDir: path.join(root, 'mcp') }),
      composerDir: path.join(root, 'composer'),
    });

    await studio.handle('local', new Request('http://127.0.0.1/api/studio/local'));
    const planned = await studio.handle('capability-composer-plan', post({ objective: 'Plan with current resources.' }));
    const plan = (await planned.json() as { plan: { state: string; runtime: { state: string } } }).plan;
    expect(hardwareCalls).toBe(2);
    expect(plan).toMatchObject({ state: 'NOT_CONFIGURED', runtime: { state: 'NOT_CONFIGURED' } });
  });

  it('revalidates resources immediately before inference and sends no request when RAM fell', async () => {
    const calls = { count: 0 };
    const baseUrl = await localCompletionServer(calls);
    let freeMemory = 16 * 1024 ** 3;
    const studio = await makeStudio(baseUrl, true, () => freeMemory);
    const planned = await studio.handle('capability-composer-plan', post({ objective: 'Answer with the local model.' }));
    const plan = (await planned.json() as { plan: { planDigestSha256: string } }).plan;
    freeMemory = 1 * 1024 ** 3;

    const refused = await studio.handle('capability-composer-execute', post({ planDigest: plan.planDigestSha256, confirm: true }));
    expect(refused.status).toBe(409);
    expect(await refused.json()).toMatchObject({ error: { code: 'resources-changed-replan-required' } });
    expect(calls.count).toBe(0);
  });

  it('serializes concurrent confirmations and rechecks the second request after the first inference', async () => {
    let freeMemory = 16 * 1024 ** 3;
    const calls = { count: 0 };
    const baseUrl = await localCompletionServer(calls, () => { freeMemory = 1 * 1024 ** 3; });
    const studio = await makeStudio(baseUrl, true, () => freeMemory);
    const planned = await studio.handle('capability-composer-plan', post({ objective: 'Answer with the local model.' }));
    const plan = (await planned.json() as { plan: { planDigestSha256: string } }).plan;
    const request = () => studio.handle('capability-composer-execute', post({ planDigest: plan.planDigestSha256, confirm: true }));

    const [first, second] = await Promise.all([request(), request()]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(calls.count).toBe(1);
  });

  it('rejects a legacy persisted plan without resource evidence before fetch', async () => {
    const baseUrl = await localCompletionServer();
    const studio = await makeStudio(baseUrl);
    const planned = await studio.handle('capability-composer-plan', post({ objective: 'Create a legacy plan fixture.' }));
    const plan = (await planned.json() as { plan: FuryCapabilityComposerPlan }).plan;
    const legacy = structuredClone(plan) as FuryCapabilityComposerPlan;
    const model = legacy.runtime.model as unknown as Record<string, unknown>;
    delete model.resourceFit;
    delete model.resourcesObservedAt;
    const legacyPlan = { ...legacy, planDigestSha256: digestFuryCapabilityComposerPlan(legacy) };
    const fetchCalls = { count: 0 };

    await expect(executeFuryCapabilityComposerLocal({
      plan: legacyPlan,
      confirm: true,
      ledger: createFuryProofLedger(),
      revalidateResources: async () => true,
      fetchImpl: async () => { fetchCalls.count += 1; throw new Error('must not fetch'); },
    })).rejects.toMatchObject({ code: 'resources-changed-replan-required' });
    expect(fetchCalls.count).toBe(0);
  });

  it('reopens the persisted plan in a fresh Studio API instance', async () => {
    const baseUrl = await localCompletionServer();
    const root = await mkdtemp(path.join(os.tmpdir(), 'furypipe-composer-reopen-'));
    roots.push(root);
    const composerDir = path.join(root, 'composer');
    const make = () => createStudioApi({
      projectRoot: root,
      discoverHarnesses: async () => harnesses,
      discoverLocal: async () => ({ backends: localBackend(baseUrl) }),
      discoverHardware: async () => ({ platform: 'win32', arch: 'x64', cpuModel: 'test', cpuCount: 8,
        totalMemoryBytes: 32 * 1024 ** 3, freeMemoryBytes: 16 * 1024 ** 3, unifiedMemory: false, gpus: [] }),
      skillHub: createFurySkillHub({ projectRoot: root, stateDir: path.join(root, 'skills') }),
      mcpHub: createFuryMcpHub({ projectRoot: root, homeDir: path.join(root, 'home'), stateDir: path.join(root, 'mcp') }),
      composerDir,
    });
    const first = make();
    const planned = await first.handle('capability-composer-plan', post({ objective: 'Persist this local composer plan.' }));
    const digest = (await planned.json() as { plan: { planDigestSha256: string } }).plan.planDigestSha256;
    const reopened = make();
    const executed = await reopened.handle('capability-composer-execute', post({ planDigest: digest, confirm: true }));
    expect(executed.status).toBe(200);
    expect((await executed.json() as { execution: { status: string } }).execution.status).toBe('COMPLETED');
  });
});
