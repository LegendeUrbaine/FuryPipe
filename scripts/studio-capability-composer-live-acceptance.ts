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

function localBackend(tags: JsonRecord): FuryLocalBackendStatus {
  const model = findModel(tags);
  if (!model) throw new Error(`required local model is not installed: ${MODEL_ID}`);
  return {
    kind: 'ollama',
    baseUrl: OLLAMA_BASE_URL,
    reachable: true,
    version: 'live-probed',
    protocols: ['native', 'openai-chat'],
    models: [{ backend: 'ollama', baseUrl: OLLAMA_BASE_URL, id: MODEL_ID, modality: 'text' }],
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
    backend = localBackend(tags);
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
    discoverLocal: async () => ({ backends: [backend] }),
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
  const listedResponse = await api.handle('capability-composer-plans', new Request('http://127.0.0.1/api/studio/capability-composer/plans.json'));
  const listed = await readJson(listedResponse);

  const evidence = {
    format: 'furypipe-capability-composer-live-acceptance/v1',
    status: execution.status === 'COMPLETED' && execution.judgement?.verdict === 'ACCEPT' ? 'PASS' : 'UNPROVEN',
    sourceCommit: process.env.FURYPIPE_SOURCE_COMMIT?.trim() || 'not-bound',
    endpoint: OLLAMA_BASE_URL,
    model: { id: MODEL_ID, digest: findModel(tags)?.digest },
    objective: OBJECTIVE,
    path: ['REQUEST', 'COMPOSER_PLAN', 'CAPABILITY_DISCOVERY', 'MODEL_SELECTION', 'FURYIR', 'DISPATCH', 'EXPLICIT_CONFIRMATION', 'REAL_OLLAMA', 'MODEL_RECEIPT', 'INTEGRATION_RECEIPT', 'FURYPROOF', 'DURABLE_RESULT'],
    plan: {
      digest: plan.planDigestSha256,
      state: plan.state,
      selectedModel: plan.runtime.model,
      selectedCapabilities: plan.selectedCapabilities,
      blockedCapabilities: plan.blockedCapabilities,
      dispatch: { status: plan.dispatch.status, requestedMode: plan.dispatch.requestedMode, profile: plan.dispatch.profile },
      stages: plan.stages,
      evaluation: plan.evaluation.overall,
    },
    confirmation: { deniedStatus: deniedResponse.status, deniedCode: deniedError.code },
    execution: {
      status: execution.status,
      output: execution.output,
      outputDigestSha256: execution.outputDigestSha256,
      judgement: execution.judgement,
      receipts: execution.receipts.map((receipt: JsonRecord) => ({ kind: receipt.kind, subject: receipt.subject, outcome: receipt.outcome, evidenceDigest: receipt.evidenceDigest })),
      proofBundle: { bundleDigest: execution.proofBundle.bundleDigest, outputDigest: execution.proofBundle.outputDigest },
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
