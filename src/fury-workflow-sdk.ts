import { createHash } from 'node:crypto';

import { compileFuryFlow, type FuryFlowDocument } from './fury-flow.js';
import {
  normalizeFuryGatewayAutomationTrigger,
  type FuryGatewayAutomationTrigger,
} from './gateway-automation-definition-node.js';

export const FURY_WORKFLOW_AUTOMATION_PLAN_FORMAT = 'furypipe-workflow-automation-plan/v1' as const;

export interface FuryWorkflowAutomationPlan {
  readonly format: typeof FURY_WORKFLOW_AUTOMATION_PLAN_FORMAT;
  readonly workflowId: string;
  readonly workflowVersion: number;
  readonly flowDigest: string;
  readonly triggerNodeId: string;
  readonly trigger: FuryGatewayAutomationTrigger;
  readonly gatewayTriggerAuthority: 'gateway-automation-definition-and-scheduler';
  readonly planDigestSha256: string;
  readonly authority: 'metadata-only-automation-plan';
  readonly registrationAuthorized: false;
  readonly executionAuthorized: false;
}

export class FuryWorkflowAutomationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FuryWorkflowAutomationError';
  }
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const record = value as Readonly<Record<string, unknown>>;
  return '{' + Object.keys(record).sort().map((key) => JSON.stringify(key) + ':' + canonical(record[key])).join(',') + '}';
}

function digest(value: unknown): string {
  return createHash('sha256').update(canonical(value), 'utf8').digest('hex');
}

function triggerNode(flow: FuryFlowDocument): FuryFlowDocument['nodes'][number] {
  const node = flow.nodes.find((entry) => entry.type === 'TRIGGER');
  if (!node) throw new FuryWorkflowAutomationError('workflow has no trigger node');
  return node;
}

/**
 * Compile a FuryFlow plus its Gateway trigger into an inspectable plan.
 * This never persists an automation, schedules a run or invokes a workflow.
 */
export function compileFuryWorkflowAutomationPlan(input: unknown): FuryWorkflowAutomationPlan {
  const flow = compileFuryFlow(input);
  const node = triggerNode(flow);
  let trigger: FuryGatewayAutomationTrigger;
  try {
    trigger = normalizeFuryGatewayAutomationTrigger(node.config);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'trigger configuration is invalid';
    throw new FuryWorkflowAutomationError(`workflow trigger is not schedulable: ${message}`);
  }
  const payload = Object.freeze({
    format: FURY_WORKFLOW_AUTOMATION_PLAN_FORMAT,
    workflowId: flow.id,
    workflowVersion: flow.version,
    flowDigest: flow.digest,
    triggerNodeId: node.id,
    trigger,
    gatewayTriggerAuthority: 'gateway-automation-definition-and-scheduler' as const,
    authority: 'metadata-only-automation-plan' as const,
    registrationAuthorized: false as const,
    executionAuthorized: false as const,
  });
  return Object.freeze({ ...payload, planDigestSha256: digest(payload) });
}
