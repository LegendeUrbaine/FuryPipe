import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createFuryCodeAdvanced } from '../src/fury-code-advanced-node.js';

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function fixture(): { readonly root: string; readonly env: NodeJS.ProcessEnv } {
  const root = mkdtempSync(join(tmpdir(), 'furypipe-code-advanced-'));
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: 'FuryPipe QA',
    GIT_AUTHOR_EMAIL: 'qa@furypipe.local',
    GIT_COMMITTER_NAME: 'FuryPipe QA',
    GIT_COMMITTER_EMAIL: 'qa@furypipe.local',
  };
  execFileSync('git', ['init', '-q'], { cwd: root, env });
  execFileSync('git', ['config', 'core.autocrlf', 'false'], { cwd: root, env });
  writeFileSync(join(root, 'source.ts'), 'export const value = 1;\n');
  writeFileSync(join(root, 'qa-script.mjs'), "process.stdout.write('FURY_CODE_OK');\n");
  writeFileSync(join(root, 'package.json'), JSON.stringify({
    name: 'fury-code-fixture',
    private: true,
    scripts: {
      test: 'node qa-script.mjs',
      typecheck: 'node qa-script.mjs',
      build: 'node qa-script.mjs',
      dangerous: 'node qa-script.mjs',
    },
  }, null, 2) + '\n');
  execFileSync('git', ['add', '.'], { cwd: root, env });
  execFileSync('git', ['commit', '-q', '-m', 'fixture'], { cwd: root, env });
  return { root, env };
}

describe('FuryCode Advanced', () => {
  it('plans and applies an exact-base exact-file edit only after process-local approval', async () => {
    const { root } = fixture();
    try {
      const code = await createFuryCodeAdvanced({ projectRoot: root });
      const original = readFileSync(join(root, 'source.ts'));
      const plan = await code.planEdit({
        path: 'source.ts',
        replacement: 'export const value = 2;\n',
      });
      expect(plan).toMatchObject({
        format: 'furypipe-code-edit-plan/v1',
        path: 'source.ts',
        expectedSha256: sha256(original),
        requiresApproval: true,
        writeAuthorized: false,
        executionAuthorized: false,
      });
      expect(plan.planDigestSha256).toMatch(/^[0-9a-f]{64}$/u);

      await expect(code.approveEdit({ ...plan }, {
        confirm: true,
        approvedBy: 'operator',
        approvedAt: '2026-09-26T19:00:00.000Z',
      })).rejects.toThrow(/process-local/u);

      const approval = await code.approveEdit(plan, {
        confirm: true,
        approvedBy: 'LégendeUrbaine',
        approvedAt: '2026-09-26T19:00:00.000Z',
      });
      expect(approval).toMatchObject({
        format: 'furypipe-code-edit-approval/v1',
        writeAuthorized: true,
        executionAuthorized: false,
      });

      const receipt = await code.applyEdit(plan, approval);
      expect(receipt).toMatchObject({
        outcome: 'succeeded',
        appliedFiles: 1,
        verificationStatus: 'locally-verified',
        executionAuthority: false,
      });
      expect(readFileSync(join(root, 'source.ts'), 'utf8')).toBe('export const value = 2;\n');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when a planned file changes before apply', async () => {
    const { root } = fixture();
    try {
      const code = await createFuryCodeAdvanced({ projectRoot: root });
      const plan = await code.planEdit({
        path: 'source.ts',
        replacement: 'export const value = 2;\n',
      });
      writeFileSync(join(root, 'source.ts'), 'export const value = 99;\n');
      const approval = await code.approveEdit(plan, {
        confirm: true,
        approvedBy: 'operator',
        approvedAt: '2026-09-26T19:00:00.000Z',
      });
      const receipt = await code.applyEdit(plan, approval);
      expect(receipt).toMatchObject({ outcome: 'failed', errorCode: 'stale-file', appliedFiles: 0 });
      expect(readFileSync(join(root, 'source.ts'), 'utf8')).toBe('export const value = 99;\n');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('plans only allowlisted package scripts and binds approval to exact package content', async () => {
    const { root } = fixture();
    try {
      const code = await createFuryCodeAdvanced({ projectRoot: root });
      const plan = await code.planScript('test');
      expect(plan).toMatchObject({
        format: 'furypipe-code-script-plan/v1',
        script: 'test',
        scriptText: 'node qa-script.mjs',
        runner: 'node --run',
        requiresApproval: true,
        executionAuthorized: false,
      });
      expect(plan.scriptSha256).toBe(sha256('node qa-script.mjs'));
      await expect(code.planScript('dangerous' as never)).rejects.toThrow(/allowlist/u);

      writeFileSync(join(root, 'package.json'), JSON.stringify({
        name: 'fury-code-fixture',
        private: true,
        scripts: { test: 'node -e "process.exit(9)"' },
      }));
      await expect(code.approveScript(plan, {
        confirm: true,
        approvedBy: 'operator',
        approvedAt: '2026-09-26T19:00:00.000Z',
      })).rejects.toThrow(/changed/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('runs an exact approved script through one-shot coding-runtime authority', async () => {
    const { root } = fixture();
    try {
      const code = await createFuryCodeAdvanced({ projectRoot: root });
      const plan = await code.planScript('test');
      const approval = await code.approveScript(plan, {
        confirm: true,
        approvedBy: 'LégendeUrbaine',
        approvedAt: '2026-09-26T19:00:00.000Z',
      });
      expect(approval).toMatchObject({
        format: 'furypipe-code-script-approval/v1',
        executionAuthorized: true,
      });

      const receipt = await code.runScript(plan, approval);
      expect(receipt).toMatchObject({
        format: 'furypipe-code-script-receipt/v1',
        script: 'test',
        executionPerformed: true,
        arbitraryCommandAuthorized: false,
        process: {
          outcome: 'succeeded',
          verificationStatus: 'not-verified',
          executionAuthority: false,
        },
      });
      expect(receipt.stdout).toContain('FURY_CODE_OK');
      await expect(code.runScript(plan, approval)).rejects.toThrow(/already consumed/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);

  it('rejects traversal and binary edit targets', async () => {
    const { root } = fixture();
    try {
      mkdirSync(join(root, 'nested'));
      writeFileSync(join(root, 'binary.bin'), Buffer.from([0, 1, 2]));
      const code = await createFuryCodeAdvanced({ projectRoot: root });
      await expect(code.planEdit({ path: '../outside.ts', replacement: 'x' })).rejects.toThrow(/relative|path/u);
      await expect(code.planEdit({ path: 'binary.bin', replacement: 'x' })).rejects.toThrow(/binary/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
