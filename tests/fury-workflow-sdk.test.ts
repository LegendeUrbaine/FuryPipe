import { describe, expect, it } from 'vitest';

import {
  compileFuryWorkflowAutomationPlan,
  FuryWorkflowAutomationError,
} from '../src/fury-workflow-sdk.js';

const flow = (trigger: Record<string, unknown>) => ({
  format: 'furypipe-flow/v1',
  id: 'daily-brief',
  version: 1,
  name: 'Daily brief',
  nodes: [
    { id: 'trigger', type: 'TRIGGER', label: 'Gateway trigger', config: trigger },
    { id: 'work', type: 'CODE', label: 'Prepare brief' },
  ],
  edges: [{ from: 'trigger', to: 'work' }],
});

describe('Fury workflow automation plan', () => {
  it('reuses Gateway trigger normalization and remains metadata-only', () => {
    const first = compileFuryWorkflowAutomationPlan(flow({
      kind: 'cron', expression: '0 9 * * *', timeZone: 'Europe/Paris', misfirePolicy: 'run-once',
    }));
    const second = compileFuryWorkflowAutomationPlan(flow({
      kind: 'cron', expression: '0 9 * * *', timeZone: 'Europe/Paris', misfirePolicy: 'run-once',
    }));

    expect(first).toMatchObject({
      format: 'furypipe-workflow-automation-plan/v1',
      workflowId: 'daily-brief',
      triggerNodeId: 'trigger',
      trigger: { kind: 'cron', expression: '0 9 * * *', timeZone: 'Europe/Paris', misfirePolicy: 'run-once' },
      gatewayTriggerAuthority: 'gateway-automation-definition-and-scheduler',
      authority: 'metadata-only-automation-plan',
      registrationAuthorized: false,
      executionAuthorized: false,
    });
    expect(first.planDigestSha256).toBe(second.planDigestSha256);
    expect(first.planDigestSha256).toMatch(/^[0-9a-f]{64}$/u);
  });

  it.each([
    ['interval', { kind: 'interval', everyMs: 500, startAt: 10, misfirePolicy: 'run-once' }],
    ['cron timezone', { kind: 'cron', expression: '0 9 * * *', timeZone: 'Mars/Olympus', misfirePolicy: 'run-once' }],
    ['webhook source', { kind: 'webhook' }],
    ['unknown key', { kind: 'manual', unexpected: true }],
  ])('rejects invalid %s trigger metadata', (_name, trigger) => {
    expect(() => compileFuryWorkflowAutomationPlan(flow(trigger))).toThrow(FuryWorkflowAutomationError);
  });
});
