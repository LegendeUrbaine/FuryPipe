import {
  evaluateFuryDataset,
  type FuryEvalDataset,
  type FuryEvalReport,
} from './fury-eval.js';
import {
  compileFuryWorkflowAutomationPlan,
  type FuryWorkflowAutomationPlan,
} from './fury-workflow-sdk.js';

export const FURY_HEADLESS_REQUEST_FORMAT = 'furypipe-headless-request/v1' as const;
export const FURY_HEADLESS_RESPONSE_FORMAT = 'furypipe-headless-response/v1' as const;

export type FuryHeadlessOperation = 'eval' | 'workflow-automation-plan';

export interface FuryHeadlessRequest {
  readonly format: typeof FURY_HEADLESS_REQUEST_FORMAT;
  readonly operation: FuryHeadlessOperation;
  readonly input: unknown;
}

export interface FuryHeadlessResponse {
  readonly format: typeof FURY_HEADLESS_RESPONSE_FORMAT;
  readonly operation: FuryHeadlessOperation;
  readonly result: FuryEvalReport | FuryWorkflowAutomationPlan;
  readonly authority: 'shared-core-analysis-only';
  readonly executionAuthorized: false;
}

export class FuryHeadlessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FuryHeadlessError';
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new FuryHeadlessError('headless request must be an object');
  }
  return value as Record<string, unknown>;
}

function exactRequest(value: unknown): FuryHeadlessRequest {
  const input = record(value);
  const keys = Object.keys(input).sort();
  if (keys.length !== 3 || keys[0] !== 'format' || keys[1] !== 'input' || keys[2] !== 'operation') {
    throw new FuryHeadlessError('headless request has unknown or missing keys');
  }
  if (input.format !== FURY_HEADLESS_REQUEST_FORMAT) {
    throw new FuryHeadlessError('unsupported headless request format');
  }
  if (input.operation !== 'eval' && input.operation !== 'workflow-automation-plan') {
    throw new FuryHeadlessError('unsupported headless operation');
  }
  return input as unknown as FuryHeadlessRequest;
}

/**
 * Execute one bounded analysis operation through an existing shared core.
 * No server, provider, tool, browser, filesystem or workflow execution is
 * created by this adapter.
 */
export function executeFuryHeadless(value: unknown): FuryHeadlessResponse {
  const request = exactRequest(value);
  let result: FuryEvalReport | FuryWorkflowAutomationPlan;
  try {
    result = request.operation === 'eval'
      ? evaluateFuryDataset(request.input as FuryEvalDataset)
      : compileFuryWorkflowAutomationPlan(request.input);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'headless operation rejected';
    throw new FuryHeadlessError(`${request.operation} rejected: ${message}`);
  }
  return Object.freeze({
    format: FURY_HEADLESS_RESPONSE_FORMAT,
    operation: request.operation,
    result,
    authority: 'shared-core-analysis-only' as const,
    executionAuthorized: false as const,
  });
}
