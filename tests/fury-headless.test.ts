import { describe, expect, it } from 'vitest';

import {
  executeFuryHeadless,
  FuryHeadlessError,
} from '../src/fury-headless.js';
import {
  furyHeadlessCliHelp,
  parseFuryHeadlessCliArgs,
  runFuryHeadlessCli,
  FuryHeadlessCliUsageError,
} from '../src/fury-headless-cli.js';

async function* input(value: string): AsyncIterable<string> {
  yield value;
}

const workflow = {
  format: 'furypipe-flow/v1',
  id: 'headless-brief',
  version: 1,
  name: 'Headless brief',
  nodes: [
    { id: 'trigger', type: 'TRIGGER', label: 'Support webhook', config: { kind: 'webhook', sourceId: 'support' } },
    { id: 'work', type: 'CODE', label: 'Prepare brief' },
  ],
  edges: [{ from: 'trigger', to: 'work' }],
};

describe('FuryPipe shared headless boundary', () => {
  it('reuses evaluation and workflow cores with explicit non-execution authority', () => {
    const workflowResponse = executeFuryHeadless({
      format: 'furypipe-headless-request/v1',
      operation: 'workflow-automation-plan',
      input: workflow,
    });
    expect(workflowResponse).toMatchObject({
      format: 'furypipe-headless-response/v1',
      operation: 'workflow-automation-plan',
      authority: 'shared-core-analysis-only',
      executionAuthorized: false,
      result: { workflowId: 'headless-brief', registrationAuthorized: false, executionAuthorized: false },
    });

    const evalResponse = executeFuryHeadless({
      format: 'furypipe-headless-request/v1',
      operation: 'eval',
      input: {
        format: 'furypipe-eval-dataset/v1',
        id: 'headless-eval',
        version: '1.0.0',
        cases: [{ id: 'case-1', domain: 'context', objective: 'Inspect context', expected: ['bounded'], observed: ['bounded'], success: true }],
      },
    });
    expect(evalResponse).toMatchObject({ operation: 'eval', result: { format: 'furypipe-eval-report/v1', executionAuthorized: false } });
  });

  it('rejects unknown operations and request keys before reaching a core', () => {
    expect(() => executeFuryHeadless({ format: 'furypipe-headless-request/v1', operation: 'unknown', input: {} })).toThrow(FuryHeadlessError);
    expect(() => executeFuryHeadless({ format: 'furypipe-headless-request/v1', operation: 'eval', input: {}, extra: true })).toThrow(/unknown or missing keys/u);
  });

  it('provides a bounded stdin CLI adapter over the same request contract', async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const code = await runFuryHeadlessCli(['--json'], {
      stdin: input(JSON.stringify({ format: 'furypipe-headless-request/v1', operation: 'workflow-automation-plan', input: workflow })),
      stdout: { write: (value) => { stdout.push(value); } },
      stderr: { write: (value) => { stderr.push(value); } },
    });
    expect(code).toBe(0);
    expect(stderr).toEqual([]);
    expect(JSON.parse(stdout.join(''))).toMatchObject({ format: 'furypipe-headless-response/v1', executionAuthorized: false });
    expect(await runFuryHeadlessCli(['--help'], { stdin: input(''), stdout: { write: () => undefined }, stderr: { write: () => undefined } })).toBe(0);
    expect(furyHeadlessCliHelp()).toContain('furypipe-headless-request/v1');
    expect(parseFuryHeadlessCliArgs(['--json'])).toEqual({ help: false });
    expect(() => parseFuryHeadlessCliArgs(['--remote'])).toThrow(FuryHeadlessCliUsageError);
  });
});
