import { createHash } from 'node:crypto';

import { evaluateFuryDataset, type FuryEvalReport } from './fury-eval.js';
import type { FuryCapabilityGraph } from './fury-capability-graph.js';
import { planFuryDispatch, type FuryDispatchPlan } from './fury-dispatcher.js';
import { compileFuryIr, furyIrRequirements, type FuryIrDocument } from './fury-ir.js';
import type { FuryLocalBackendKind } from './fury-local-fabric.js';
import { assertFuryLocalEndpoint } from './fury-local-fabric.js';
import type { FuryRequestBlueprint } from './fury-request-blueprint.js';
import {
  sealFuryProofBundle,
  type FuryJudgement,
  type FuryProofBundle,
  type FuryProofLedger,
  type FuryReceipt,
} from './fury-proof.js';
import { digestMcpDirectJson } from './mcp-direct-json.js';

export const FURY_CAPABILITY_COMPOSER_FORMAT = 'furypipe-capability-composer/v1' as const;
export const FURY_CAPABILITY_COMPOSER_EVAL_DATASET = 'furypipe-capability-composer-route-contracts/v1' as const;

export type FuryCapabilityComposerState = 'READY_FOR_CONFIRMATION' | 'BLOCKED' | 'NOT_CONFIGURED';
export type FuryCapabilityComposerStageStatus = 'PASS' | 'BLOCKED' | 'NOT_CONFIGURED' | 'REQUIRED' | 'READY';

export interface FuryCapabilityComposerCapabilitySummary {
  readonly kind: string;
  readonly id: string;
  readonly score: number;
  readonly reason: string;
  readonly requiredPermissions: readonly string[];
  readonly executionAuthorized: false;
}

export interface FuryCapabilityComposerModelSummary {
  readonly id: string;
  readonly score: number;
  readonly reason: string;
  readonly executionAuthorized: false;
}

export interface FuryCapabilityComposerRouteSnapshot {
  readonly blueprint: FuryRequestBlueprint;
  readonly capabilityGraph: FuryCapabilityGraph;
  readonly capabilities: Readonly<{
    readonly indexDigestSha256: string;
    readonly selectionDigestSha256: string;
    readonly selected: readonly FuryCapabilityComposerCapabilitySummary[];
    readonly blocked: readonly unknown[];
    readonly authority: string;
    readonly executionAuthorized: false;
  }>;
  readonly instructions: Readonly<Record<string, unknown>>;
  readonly skills: Readonly<Record<string, unknown>>;
  readonly models: Readonly<{
    readonly selected: readonly FuryCapabilityComposerModelSummary[];
    readonly suggested: readonly FuryCapabilityComposerModelSummary[];
    readonly executionAuthorized: false;
  }>;
  readonly mcp: Readonly<Record<string, unknown>>;
  readonly contextInspector: unknown;
  readonly prompt: Readonly<{
    readonly mode: string;
    readonly text: string;
    readonly bytes: number;
    readonly digest: string;
    readonly budgetBytes: number;
    readonly exactGuardMode: string;
  }>;
}

export interface FuryCapabilityComposerLocalModel {
  readonly backend: FuryLocalBackendKind;
  readonly baseUrl: string;
  readonly id: string;
  readonly capabilityId: string;
  readonly protocol: 'openai-chat';
}

export interface FuryCapabilityComposerStage {
  readonly id: string;
  readonly status: FuryCapabilityComposerStageStatus;
  readonly evidence: readonly string[];
  readonly reason: string;
}

export interface FuryCapabilityComposerPlan {
  readonly format: typeof FURY_CAPABILITY_COMPOSER_FORMAT;
  readonly objective: string;
  readonly objectiveDigestSha256: string;
  readonly route: FuryCapabilityComposerRouteSnapshot;
  readonly selectedCapabilities: readonly FuryCapabilityComposerCapabilitySummary[];
  readonly blockedCapabilities: readonly Readonly<Record<string, unknown>>[];
  readonly ir: FuryIrDocument;
  readonly dispatch: FuryDispatchPlan;
  readonly stages: readonly FuryCapabilityComposerStage[];
  readonly state: FuryCapabilityComposerState;
  readonly confirmation: Readonly<{
    readonly required: boolean;
    readonly reason: string;
  }>;
  readonly runtime: Readonly<{
    readonly state: 'READY' | 'BLOCKED' | 'NOT_CONFIGURED';
    readonly executionAuthority: false;
    readonly model?: FuryCapabilityComposerLocalModel;
  }>;
  readonly verification: Readonly<{
    readonly requirements: ReturnType<typeof furyIrRequirements>;
    readonly executionAuthority: false;
    readonly modelReceiptSubject: string;
    readonly provenanceReceiptSubject: string;
  }>;
  readonly evaluation: FuryEvalReport;
  readonly prompt: Readonly<{
    readonly text: string;
    readonly digest: string;
    readonly bytes: number;
    readonly budgetBytes: number;
  }>;
  readonly authority: 'composer-plan-only';
  readonly executionAuthorized: false;
  readonly planDigestSha256: string;
}

export interface FuryCapabilityComposerExecutionResult {
  readonly format: 'furypipe-capability-composer-execution/v1';
  readonly status: 'COMPLETED' | 'UNPROVEN';
  readonly planDigestSha256: string;
  readonly output: string;
  readonly outputDigestSha256: string;
  readonly model: Readonly<Pick<FuryCapabilityComposerLocalModel, 'backend' | 'id' | 'capabilityId'>>;
  readonly receipts: readonly FuryReceipt[];
  readonly judgement: FuryJudgement;
  readonly proofBundle: FuryProofBundle;
  readonly runtime: 'existing-local-openai-chat-boundary';
  readonly executionAuthority: false;
}

export class FuryCapabilityComposerError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 422) {
    super(message);
    this.name = 'FuryCapabilityComposerError';
    this.code = code;
    this.status = status;
  }
}

const MAX_PLAN_BYTES = 2 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 128 * 1024;
const MAX_OUTPUT_CHARS = 64 * 1024;
const HEX64 = /^[0-9a-f]{64}$/u;

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function boundedText(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || value.includes('\0')) {
    throw new FuryCapabilityComposerError('invalid-input', `${label} is required and bounded`, 400);
  }
  return value.trim();
}

function objectRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length <= 512 ? value : fallback;
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeBlocked(value: readonly unknown[]): readonly Readonly<Record<string, unknown>>[] {
  return Object.freeze(value.slice(0, 32).flatMap((item) => {
    const record = objectRecord(item);
    if (!record || typeof record.id !== 'string' || typeof record.kind !== 'string') return [];
    return [Object.freeze({
      kind: record.kind,
      id: record.id,
      score: numberValue(record.score),
      reason: stringValue(record.reason, 'blocked by capability policy'),
      requiredPermissions: Array.isArray(record.requiredPermissions)
        ? record.requiredPermissions.filter((entry): entry is string => typeof entry === 'string').slice(0, 16)
        : [],
      executionAuthorized: false as const,
    })];
  }));
}

function composerSubjects(objectiveDigestSha256: string): { readonly model: string; readonly provenance: string } {
  const suffix = objectiveDigestSha256.slice(0, 24);
  return Object.freeze({
    model: `composer:model:${suffix}`,
    provenance: `composer:provenance:${suffix}`,
  });
}

/** Compile the small local-inference contract consumed by the existing dispatcher. */
export function compileFuryCapabilityComposerIr(input: {
  readonly objective: string;
  readonly objectiveDigestSha256: string;
}): FuryIrDocument {
  const objective = boundedText(input.objective, 'objective', 32_768);
  if (!HEX64.test(input.objectiveDigestSha256)) throw new FuryCapabilityComposerError('invalid-input', 'objective digest is invalid', 400);
  const subjects = composerSubjects(input.objectiveDigestSha256);
  return compileFuryIr({
    format: 'furypipe-ir/v1',
    intent: `Compose and verify a local capability route for: ${objective}`,
    must: [
      'Use the existing Capability Autopilot, FuryIR and FuryDispatcher contracts.',
      'Use a reachable local text model only; do not make a cloud call.',
      'Persist the route and signed runtime evidence.',
    ],
    mustNot: [
      'Do not invent a skill, MCP tool, provider, permission or runtime result.',
      'Do not mutate files, invoke MCP tools or perform an external action in this slice.',
    ],
    capabilities: { READ: 'ALLOW', WRITE: 'DENY', EXECUTE: 'ASK', NETWORK: 'DENY', EXTERNAL_ACTION: 'DENY' },
    privacy: 'local-only',
    budget: {
      maxCostUsd: 0,
      maxTokens: 32_768,
      maxWallTimeMs: 300_000,
      maxAgents: 3,
      maxRetries: 0,
      maxCloudCalls: 0,
      maxToolCalls: 0,
    },
    successPredicates: [
      { id: 'local-model-receipt', level: 'MUST', description: 'The selected local model returned a bounded completion.', evidence: [{ kind: 'MODEL_RECEIPT', subject: subjects.model }] },
      { id: 'composer-provenance-receipt', level: 'MUST', description: 'The composer execution is tied to its plan and output digest.', evidence: [{ kind: 'INTEGRATION_RECEIPT', subject: subjects.provenance }] },
    ],
    humanGates: [{ id: 'confirm-local-inference', beforeTask: 'execute', reason: 'Local inference sends the operator objective and compiled prompt to the selected local endpoint.' }],
    tasks: [
      { id: 'analyze', role: 'planner', description: 'Inspect the existing routed capability selection and bounded prompt.', dependsOn: [], capabilities: ['READ'], writeScopes: [] },
      { id: 'execute', role: 'integrator', description: 'Send one confirmed request to the selected loopback local inference endpoint.', dependsOn: ['analyze'], capabilities: ['READ', 'EXECUTE'], writeScopes: [] },
      { id: 'verify', role: 'judge', description: 'Verify signed model and provenance receipts against the FuryIR requirements.', dependsOn: ['execute'], capabilities: ['READ'], writeScopes: [] },
    ],
    rollbackPolicy: 'manual',
  });
}

function evaluateComposerRoute(input: {
  readonly objective: string;
  readonly objectiveDigestSha256: string;
  readonly route: FuryCapabilityComposerRouteSnapshot;
  readonly ir: FuryIrDocument;
  readonly dispatch: FuryDispatchPlan;
  readonly localModel?: FuryCapabilityComposerLocalModel;
}): FuryEvalReport {
  const prefix = `composer:${input.objectiveDigestSha256.slice(0, 16)}`;
  const promptOk = input.route.prompt.bytes <= input.route.prompt.budgetBytes && HEX64.test(input.route.prompt.digest);
  const boundedSelection = input.route.capabilities.selected.length <= 5 && input.route.capabilities.blocked.length <= 128;
  const localRuntime = input.localModel !== undefined;
  const dispatchKnown = input.dispatch.status === 'PLANNED' || input.dispatch.status === 'BLOCKED' || input.dispatch.status === 'NO_DISPATCH';
  return evaluateFuryDataset({
    format: 'furypipe-eval-dataset/v1',
    id: FURY_CAPABILITY_COMPOSER_EVAL_DATASET,
    version: '1',
    cases: [
      { id: `${prefix}:routing`, domain: 'routing', objective: input.objective, expected: ['local-only', 'selection-only', 'dispatch-known'], observed: ['local-only', input.route.capabilities.authority, ...(dispatchKnown ? ['dispatch-known'] : [])], success: input.ir.privacy === 'local-only' && input.route.capabilities.authority === 'selection-only' && dispatchKnown },
      { id: `${prefix}:skills`, domain: 'skills', objective: input.objective, expected: ['bounded-selection'], observed: boundedSelection ? ['bounded-selection'] : [], success: boundedSelection },
      { id: `${prefix}:instructions`, domain: 'instructions', objective: input.objective, expected: ['prompt-digest'], observed: promptOk ? ['prompt-digest'] : [], success: promptOk },
      { id: `${prefix}:providers`, domain: 'providers', objective: input.objective, expected: ['local-model'], observed: localRuntime ? ['local-model'] : [], success: localRuntime },
      { id: `${prefix}:agents`, domain: 'agents', objective: input.objective, expected: ['existing-dispatcher'], observed: input.dispatch.format === 'furypipe-dispatch-plan/v1' ? ['existing-dispatcher'] : [], success: input.dispatch.format === 'furypipe-dispatch-plan/v1' },
    ],
  });
}

/** Build an inspectable, deterministic composition plan above existing primitives. */
export function buildFuryCapabilityComposerPlan(input: {
  readonly objective: string;
  readonly objectiveDigestSha256: string;
  readonly route: FuryCapabilityComposerRouteSnapshot;
  readonly ir: FuryIrDocument;
  readonly dispatch: FuryDispatchPlan;
  readonly localModel?: FuryCapabilityComposerLocalModel;
}): FuryCapabilityComposerPlan {
  const objective = boundedText(input.objective, 'objective', 32_768);
  if (!HEX64.test(input.objectiveDigestSha256)) throw new FuryCapabilityComposerError('invalid-input', 'objective digest is invalid', 400);
  const selectedCapabilities = Object.freeze(input.route.capabilities.selected.map((item) => Object.freeze({ ...item, executionAuthorized: false as const })));
  const blockedCapabilities = normalizeBlocked(input.route.capabilities.blocked);
  const subjects = composerSubjects(input.objectiveDigestSha256);
  const runtimeState = input.localModel === undefined ? 'NOT_CONFIGURED' : input.dispatch.status === 'PLANNED' ? 'READY' : 'BLOCKED';
  const state: FuryCapabilityComposerState = runtimeState === 'NOT_CONFIGURED' ? 'NOT_CONFIGURED' : runtimeState === 'READY' ? 'READY_FOR_CONFIRMATION' : 'BLOCKED';
  const stages = Object.freeze([
    { id: 'intent-analysis', status: 'PASS' as const, evidence: ['bounded objective', `objective:${input.objectiveDigestSha256}`], reason: 'Objective normalized and hashed.' },
    { id: 'capability-discovery', status: selectedCapabilities.length || blockedCapabilities.length ? 'PASS' as const : 'BLOCKED' as const, evidence: [`index:${input.route.capabilities.indexDigestSha256}`, `selection:${input.route.capabilities.selectionDigestSha256}`], reason: selectedCapabilities.length ? `${selectedCapabilities.length} capability(ies) selected by existing Capability Autopilot.` : 'No capability was selected; blocked candidates remain inspectable.' },
    { id: 'compatibility', status: input.localModel ? 'PASS' as const : 'NOT_CONFIGURED' as const, evidence: input.localModel ? [`model:${input.localModel.capabilityId}`, `protocol:${input.localModel.protocol}`] : ['no reachable openai-chat local model'], reason: input.localModel ? 'Reachable local text model matches the execution boundary.' : 'A reachable local openai-chat text model is required.' },
    { id: 'authority', status: 'PASS' as const, evidence: ['executionAuthority:false', 'privacy:local-only', 'cloudCalls:0'], reason: 'Composer does not grant implicit capability authority.' },
    { id: 'execution-plan', status: input.dispatch.status === 'PLANNED' ? 'PASS' as const : 'BLOCKED' as const, evidence: [`dispatch:${input.dispatch.status}`, `ir:${input.ir.digest}`], reason: input.dispatch.status === 'PLANNED' ? 'Existing FuryDispatcher produced a local-only plan.' : input.dispatch.reasons.join('; ') || 'Existing FuryDispatcher could not produce a plan.' },
    { id: 'confirmation', status: state === 'READY_FOR_CONFIRMATION' ? 'REQUIRED' as const : 'BLOCKED' as const, evidence: state === 'READY_FOR_CONFIRMATION' ? ['confirm:true required'] : ['execution unavailable'], reason: state === 'READY_FOR_CONFIRMATION' ? 'Operator confirmation is required before local inference.' : 'Confirmation cannot bypass a missing or blocked runtime.' },
    { id: 'runtime', status: runtimeState === 'READY' ? 'READY' as const : runtimeState === 'NOT_CONFIGURED' ? 'NOT_CONFIGURED' as const : 'BLOCKED' as const, evidence: input.localModel ? [`${input.localModel.backend}:${input.localModel.id}`] : [], reason: input.localModel ? 'Existing local chat boundary is available for an explicit execution request.' : 'No executable local model boundary is available.' },
    { id: 'verification', status: 'PASS' as const, evidence: [`model-receipt:${subjects.model}`, `provenance-receipt:${subjects.provenance}`], reason: 'FuryProof requirements are compiled before execution.' },
    { id: 'provenance', status: 'PASS' as const, evidence: [`route:${input.route.capabilities.selectionDigestSha256}`, `ir:${input.ir.digest}`], reason: 'Route, IR, dispatch and evaluation digests are retained.' },
  ]);
  const evaluation = evaluateComposerRoute(input);
  const body: Omit<FuryCapabilityComposerPlan, 'planDigestSha256'> = {
    format: FURY_CAPABILITY_COMPOSER_FORMAT,
    objective,
    objectiveDigestSha256: input.objectiveDigestSha256,
    route: input.route,
    selectedCapabilities,
    blockedCapabilities,
    ir: input.ir,
    dispatch: input.dispatch,
    stages,
    state,
    confirmation: Object.freeze({ required: state === 'READY_FOR_CONFIRMATION', reason: state === 'READY_FOR_CONFIRMATION' ? 'confirm:true is required for the existing local inference boundary.' : 'Runtime is not ready for confirmation.' }),
    runtime: Object.freeze({ state: runtimeState, executionAuthority: false as const, ...(input.localModel ? { model: input.localModel } : {}) }),
    verification: Object.freeze({ requirements: furyIrRequirements(input.ir), executionAuthority: false as const, modelReceiptSubject: subjects.model, provenanceReceiptSubject: subjects.provenance }),
    evaluation,
    prompt: Object.freeze({ text: input.route.prompt.text, digest: input.route.prompt.digest, bytes: input.route.prompt.bytes, budgetBytes: input.route.prompt.budgetBytes }),
    authority: 'composer-plan-only',
    executionAuthorized: false as const,
  };
  const planDigestSha256 = digestMcpDirectJson(body, { maxBytes: MAX_PLAN_BYTES, label: 'capability composer plan' });
  return Object.freeze({ ...body, planDigestSha256 });
}

export function digestFuryCapabilityComposerPlan(plan: FuryCapabilityComposerPlan): string {
  const { planDigestSha256: _ignored, ...body } = plan;
  return digestMcpDirectJson(body, { maxBytes: MAX_PLAN_BYTES, label: 'capability composer plan' });
}

export function verifyFuryCapabilityComposerPlan(plan: FuryCapabilityComposerPlan): boolean {
  return HEX64.test(plan.planDigestSha256) && digestFuryCapabilityComposerPlan(plan) === plan.planDigestSha256;
}

async function boundedResponseText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new FuryCapabilityComposerError('response-too-large', 'local model response exceeds 128 KiB', 502);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Execute only the already-planned local OpenAI-compatible boundary. */
export async function executeFuryCapabilityComposerLocal(input: {
  readonly plan: FuryCapabilityComposerPlan;
  readonly confirm: boolean;
  readonly ledger: FuryProofLedger;
  readonly fetchImpl?: typeof fetch;
  readonly userMessage?: string;
}): Promise<FuryCapabilityComposerExecutionResult> {
  const plan = input.plan;
  if (!verifyFuryCapabilityComposerPlan(plan)) throw new FuryCapabilityComposerError('plan-integrity-failed', 'persisted composer plan digest does not verify', 409);
  if (input.confirm !== true) throw new FuryCapabilityComposerError('confirmation-required', 'local inference requires confirm: true', 400);
  if (plan.state !== 'READY_FOR_CONFIRMATION' || !plan.runtime.model) throw new FuryCapabilityComposerError('runtime-not-ready', 'composer plan is not ready for local inference', 409);
  const model = plan.runtime.model;
  if (model.protocol !== 'openai-chat') throw new FuryCapabilityComposerError('runtime-not-supported', 'composer execution requires the openai-chat local protocol', 409);
  const userMessage = input.userMessage === undefined ? plan.objective : boundedText(input.userMessage, 'userMessage', 32_768);
  const endpoint = assertFuryLocalEndpoint(model.baseUrl);
  const target = new URL('v1/chat/completions', endpoint.href.endsWith('/') ? endpoint.href : `${endpoint.href}/`);
  const response = await (input.fetchImpl ?? fetch)(target, {
    method: 'POST',
    redirect: 'manual',
    signal: AbortSignal.timeout(300_000),
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ model: model.id, stream: false, messages: [{ role: 'system', content: plan.prompt.text }, { role: 'user', content: userMessage }] }),
  });
  const responseText = await boundedResponseText(response);
  if (response.status !== 200) throw new FuryCapabilityComposerError('local-backend-error', `local backend answered HTTP ${response.status}`, 502);
  let payload: unknown;
  try {
    payload = JSON.parse(responseText) as unknown;
  } catch {
    throw new FuryCapabilityComposerError('local-backend-error', 'local backend returned invalid JSON', 502);
  }
  const payloadRecord = objectRecord(payload);
  const choicesCandidate = payloadRecord?.choices;
  const choices = Array.isArray(choicesCandidate) ? choicesCandidate : [];
  const choice = objectRecord(choices[0]);
  const message = objectRecord(choice?.message);
  const output = boundedText(message?.content, 'local model output', MAX_OUTPUT_CHARS);
  const outputDigestSha256 = sha256(output);
  const evidenceDigest = digestMcpDirectJson({ plan: plan.planDigestSha256, model: model.capabilityId, output: outputDigestSha256 }, { maxBytes: 32 * 1024, label: 'composer evidence' });
  const modelReceipt = input.ledger.issue({
    kind: 'MODEL_RECEIPT', subject: plan.verification.modelReceiptSubject, outcome: 'pass', producer: 'host:fury-capability-composer:local', evidenceDigest,
    details: { backend: model.backend, model: model.id, capabilityId: model.capabilityId, outputDigestSha256, responseBytes: Buffer.byteLength(responseText, 'utf8') },
  });
  const provenanceReceipt = input.ledger.issue({
    kind: 'INTEGRATION_RECEIPT', subject: plan.verification.provenanceReceiptSubject, outcome: 'pass', producer: 'host:fury-capability-composer:provenance', evidenceDigest,
    details: { planDigestSha256: plan.planDigestSha256, irDigest: plan.ir.digest, dispatchStatus: plan.dispatch.status, localOnly: true },
  });
  const receipts = Object.freeze([modelReceipt, provenanceReceipt]);
  const judgement = input.ledger.judge({ requirements: furyIrRequirements(plan.ir), receipts });
  const proofBundle = sealFuryProofBundle({
    taskId: `composer:${plan.objectiveDigestSha256.slice(0, 24)}`,
    judgement,
    receipts,
    commandsExecuted: [],
    filesModified: [],
    uncertainty: judgement.verdict === 'ACCEPT' ? [] : [`FuryProof verdict is ${judgement.verdict}.`],
    outputDigest: outputDigestSha256,
  });
  return Object.freeze({
    format: 'furypipe-capability-composer-execution/v1',
    status: judgement.verdict === 'ACCEPT' ? 'COMPLETED' : 'UNPROVEN',
    planDigestSha256: plan.planDigestSha256,
    output,
    outputDigestSha256,
    model: Object.freeze({ backend: model.backend, id: model.id, capabilityId: model.capabilityId }),
    receipts,
    judgement,
    proofBundle,
    runtime: 'existing-local-openai-chat-boundary',
    executionAuthority: false as const,
  });
}

export function composerPlanToJson(plan: FuryCapabilityComposerPlan): string {
  const json = JSON.stringify(plan);
  if (Buffer.byteLength(json, 'utf8') > MAX_PLAN_BYTES) throw new FuryCapabilityComposerError('plan-too-large', 'composer plan exceeds the persistence byte bound', 422);
  return json;
}
