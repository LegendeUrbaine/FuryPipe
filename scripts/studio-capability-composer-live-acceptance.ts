import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { FURY_HARNESS_REGISTRY, type FuryHarnessDiscovery } from '../src/fury-harness-hub.js';
import type { FuryLocalBackendStatus } from '../src/fury-local-fabric.js';
import { createFuryMcpHub } from '../src/fury-mcp-hub.js';
import { createFurySkillHub } from '../src/fury-skill-hub.js';
import { createStudioApi } from '../src/studio/studio-api.js';

const OUT = path.resolve(process.env.FURYPIPE_COMPOSER_LIVE_OUTPUT_DIR?.trim() || 'artifacts/studio-capability-composer-live');
const OLLAMA_BASE_URL = (process.env.FURYPIPE_OLLAMA_URL?.trim() || 'http://127.0.0.1:11434').replace(/\/+$/u, '');
const MODEL_ID = process.env.FURYPIPE_OLLAMA_MODEL?.trim() || 'qwen3.5:latest';
const EXPECTED_OUTPUT = `Local Composer inference reached ${MODEL_ID}.`;
const OBJECTIVE = `Reply with exactly this one sentence and nothing else: ${EXPECTED_OUTPUT}`;

type JsonRecord = Record<string, unknown>;

const harnesses: FuryHarnessDiscovery = {
  format: 'furypipe-harness-discovery/v1',
  platform: process.platform,
  harnesses: FURY_HARNESS_REGISTRY.map((definition) => ({
    id: definition.id,
    displayName: definition.displayName,
    authentication: 'not-probed' as const,
    definition,
    installed: definition.id === 'furypipe-native',
    versionStatus: definition.id === 'furypipe-native' ? 'builtin' as const : 'not-installed' as const,
  })),
};

function writeEvidence(value: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(path.join(OUT, 'live-acceptance.json'), `${JSON.stringify(value, null, 2)}\n`);
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// The live result must have the documented shape; anything else fails the run
// instead of being reported with missing fields.
function requireRecord(value: unknown, label: string): JsonRecord {
  if (!isRecord(value)) throw new Error(`Composer ${label} is malformed: ${JSON.stringify(value)}`);
  return value;
}

function requireRecords(value: unknown, label: string): JsonRecord[] {
  if (!Array.isArray(value) || !value.every(isRecord)) throw new Error(`Composer ${label} is malformed: ${JSON.stringify(value)}`);
  return value;
}

function modelEntries(tags: JsonRecord): JsonRecord[] {
  return Array.isArray(tags.models) ? tags.models.filter(isRecord) : [];
}

function findModel(tags: JsonRecord): JsonRecord | undefined {
  return modelEntries(tags).find((candidate) => candidate.name === MODEL_ID || candidate.model === MODEL_ID);
}

async function readJson(response: Response): Promise<JsonRecord> {
  const payload: unknown = await response.json();
  if (!isRecord(payload)) throw new Error('expected JSON object response');
  return payload;
}

async function ollamaTags(): Promise<JsonRecord> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`Ollama tags answered HTTP ${response.status}`);
  return await readJson(response);
}

async function ollamaLoadedModels(): Promise<Set<string>> {
  // /api/ps is advisory: an unreachable endpoint means "not known loaded", which
  // keeps the resource estimate conservative (weights are charged in full).
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/ps`, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) {
      console.warn(`Ollama /api/ps answered HTTP ${response.status}; treating model as not loaded`);
      return new Set();
    }
    const payload = await readJson(response);
    return new Set(modelEntries(payload).flatMap((entry) => [entry.name, entry.model]).filter((value): value is string => typeof value === 'string'));
  } catch (error) {
    console.warn(`Ollama /api/ps probe failed; treating model as not loaded: ${error instanceof Error ? error.message : String(error)}`);
    return new Set();
  }
}

function localBackend(tags: JsonRecord, loaded: ReadonlySet<string>): FuryLocalBackendStatus {
  const model = findModel(tags);
  if (!model) throw new Error(`required local model is not installed: ${MODEL_ID}`);
  // The QA-001 resource gate fails closed on unknown model size, so the live
  // probe must forward the real installed size reported by Ollama.
  const sizeBytes = typeof model.size === 'number' && Number.isSafeInteger(model.size) && model.size > 0 ? model.size : undefined;
  return {
    kind: 'ollama',
    baseUrl: OLLAMA_BASE_URL,
    reachable: true,
    version: 'live-probed',
    protocols: ['native', 'openai-chat'],
    models: [{
      backend: 'ollama',
      baseUrl: OLLAMA_BASE_URL,
      id: MODEL_ID,
      modality: 'text',
      ...(sizeBytes !== undefined ? { sizeBytes } : {}),
      loaded: loaded.has(MODEL_ID),
    }],
  };
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  let tags: JsonRecord;
  try {
    tags = await ollamaTags();
  } catch (error) {
    const evidence = {
      format: 'furypipe-capability-composer-live-acceptance/v1',
      status: 'NOT_EXECUTED',
      locality: 'loopback',
      endpoint: OLLAMA_BASE_URL,
      model: MODEL_ID,
      reason: error instanceof Error ? error.message : String(error),
      download: 'NOT_REQUESTED',
      fixtureEvidence: 'SEPARATE: tests/fury-capability-composer.test.ts',
    };
    writeEvidence(evidence);
    console.log(JSON.stringify(evidence, null, 2));
    return;
  }

  let backend: FuryLocalBackendStatus;
  try {
    backend = localBackend(tags, await ollamaLoadedModels());
  } catch (error) {
    const evidence = {
      format: 'furypipe-capability-composer-live-acceptance/v1',
      status: 'NOT_EXECUTED',
      locality: 'loopback',
      endpoint: OLLAMA_BASE_URL,
      model: MODEL_ID,
      ollamaModels: modelEntries(tags).map((candidate) => ({ name: candidate.name, digest: candidate.digest })),
      reason: error instanceof Error ? error.message : String(error),
      download: 'NOT_REQUESTED',
      fixtureEvidence: 'SEPARATE: tests/fury-capability-composer.test.ts',
    };
    writeEvidence(evidence);
    console.log(JSON.stringify(evidence, null, 2));
    return;
  }

  const composerDir = path.join(OUT, 'recovery-store');
  const api = createStudioApi({
    projectRoot: process.cwd(),
    composerDir,
    discoverHarnesses: async () => harnesses,
    // Re-probe on every discovery: execution-time revalidation must not reuse a
    // stale "loaded" observation, or a since-evicted model is under-charged.
    // Evidence must describe the facts the plan actually saw, so keep the latest probe.
    discoverLocal: async () => {
      backend = localBackend(tags, await ollamaLoadedModels());
      return { backends: [backend] };
    },
    skillHub: createFurySkillHub({ projectRoot: process.cwd(), homeDir: path.join(OUT, 'home'), stateDir: path.join(OUT, 'skill-hub'), projectTrustedForInstructions: true }),
    mcpHub: createFuryMcpHub({ projectRoot: process.cwd(), homeDir: path.join(OUT, 'home'), stateDir: path.join(OUT, 'mcp-hub') }),
  });
  const request = (value: unknown): Request => new Request('http://127.0.0.1/api/studio/capability-composer', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value),
  });

  const plannedResponse = await api.handle('capability-composer-plan', request({ objective: OBJECTIVE, effort: 'low', responseStyle: 'caveman' }));
  const planned = await readJson(plannedResponse);
  if (plannedResponse.status !== 200) throw new Error(`Composer plan failed HTTP ${plannedResponse.status}: ${JSON.stringify(planned)}`);
  const plan = planned.plan;
  if (!isRecord(plan) || typeof plan.planDigestSha256 !== 'string') throw new Error(`Composer plan response is malformed: ${JSON.stringify(planned)}`);
  if (plan.state !== 'READY_FOR_CONFIRMATION') {
    // The resource gate refused local inference on this host right now. That is
    // the intended fail-closed outcome, not a live pass: record it and stop.
    const runtime = isRecord(plan.runtime) ? plan.runtime : {};
    const evidence = {
      format: 'furypipe-capability-composer-live-acceptance/v1',
      status: 'NOT_EXECUTED',
      locality: 'loopback',
      endpoint: OLLAMA_BASE_URL,
      model: MODEL_ID,
      modelFacts: backend.models[0],
      planState: plan.state,
      reason: typeof runtime.reason === 'string' ? runtime.reason : 'composer runtime not ready',
      download: 'NOT_REQUESTED',
      fixtureEvidence: 'SEPARATE: tests/fury-capability-composer.test.ts',
    };
    writeEvidence(evidence);
    console.log(JSON.stringify(evidence, null, 2));
    process.exitCode = 2;
    return;
  }

  const deniedResponse = await api.handle('capability-composer-execute', request({ planDigest: plan.planDigestSha256 }));
  const denied = await readJson(deniedResponse);
  const deniedError = isRecord(denied.error) ? denied.error : {};
  if (deniedResponse.status !== 400 || deniedError.code !== 'confirmation-required') {
    throw new Error(`Composer fail-closed confirmation gate failed: HTTP ${deniedResponse.status} ${JSON.stringify(denied)}`);
  }

  const executedResponse = await api.handle('capability-composer-execute', request({ planDigest: plan.planDigestSha256, confirm: true }));
  const executed = await readJson(executedResponse);
  if (executedResponse.status !== 200) throw new Error(`Composer live execution failed HTTP ${executedResponse.status}: ${JSON.stringify(executed)}`);
  const execution = executed.execution;
  if (!isRecord(execution) || execution.status !== 'COMPLETED' || execution.output !== EXPECTED_OUTPUT) {
    throw new Error(`Composer live execution returned an unexpected bounded result: ${JSON.stringify(execution)}`);
  }
  const planRuntime = requireRecord(plan.runtime, 'plan runtime');
  const planDispatch = requireRecord(plan.dispatch, 'plan dispatch');
  const planEvaluation = requireRecord(plan.evaluation, 'plan evaluation');
  const judgement = requireRecord(execution.judgement, 'execution judgement');
  const receipts = requireRecords(execution.receipts, 'execution receipts');
  const proofBundle = requireRecord(execution.proofBundle, 'execution proof bundle');
  const listedResponse = await api.handle('capability-composer-plans', new Request('http://127.0.0.1/api/studio/capability-composer/plans.json'));
  const listed = await readJson(listedResponse);

  const evidence = {
    format: 'furypipe-capability-composer-live-acceptance/v1',
    status: execution.status === 'COMPLETED' && judgement.verdict === 'ACCEPT' ? 'PASS' : 'UNPROVEN',
    sourceCommit: process.env.FURYPIPE_SOURCE_COMMIT?.trim() || 'not-bound',
    endpoint: OLLAMA_BASE_URL,
    model: { id: MODEL_ID, digest: findModel(tags)?.digest },
    objective: OBJECTIVE,
    path: ['REQUEST', 'COMPOSER_PLAN', 'CAPABILITY_DISCOVERY', 'MODEL_SELECTION', 'FURYIR', 'DISPATCH', 'EXPLICIT_CONFIRMATION', 'REAL_OLLAMA', 'MODEL_RECEIPT', 'INTEGRATION_RECEIPT', 'FURYPROOF', 'DURABLE_RESULT'],
    plan: {
      digest: plan.planDigestSha256,
      state: plan.state,
      selectedModel: planRuntime.model,
      selectedCapabilities: plan.selectedCapabilities,
      blockedCapabilities: plan.blockedCapabilities,
      dispatch: { status: planDispatch.status, requestedMode: planDispatch.requestedMode, profile: planDispatch.profile },
      stages: plan.stages,
      evaluation: planEvaluation.overall,
    },
    confirmation: { deniedStatus: deniedResponse.status, deniedCode: deniedError.code },
    execution: {
      status: execution.status,
      output: execution.output,
      outputDigestSha256: execution.outputDigestSha256,
      judgement: execution.judgement,
      receipts: receipts.map((receipt) => ({ kind: receipt.kind, subject: receipt.subject, outcome: receipt.outcome, evidenceDigest: receipt.evidenceDigest })),
      proofBundle: { bundleDigest: proofBundle.bundleDigest, outputDigest: proofBundle.outputDigest },
      persistence: executed.persistence,
      executionAuthority: execution.executionAuthority,
    },
    durablePlanCount: Array.isArray(listed.plans) ? listed.plans.length : 0,
    download: 'NOT_REQUESTED',
    fixtureEvidence: 'SEPARATE: tests/fury-capability-composer.test.ts',
  };
  writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  if (evidence.status !== 'PASS') process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
