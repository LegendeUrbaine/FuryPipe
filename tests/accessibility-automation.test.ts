import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

describe('accessibility automation lifecycle', () => {
  it('fails fast and exits when the Playwright browser executable is missing', async () => {
    const sandbox = await mkdtemp(path.join(os.tmpdir(), 'furypipe-accessibility-test-'));
    const outputDir = path.join(sandbox, 'validation');
    const missingBrowsers = path.join(sandbox, 'empty-browsers');

    try {
      let failure: Error & { code?: string | number; killed?: boolean; stderr?: string; stdout?: string } | undefined;
      try {
        await execFileAsync(process.execPath, ['scripts/accessibility-automation.mjs'], {
          cwd: process.cwd(),
          env: {
            ...process.env,
            PLAYWRIGHT_BROWSERS_PATH: missingBrowsers,
            FURYPIPE_VALIDATION_OUTPUT_DIR: outputDir,
          },
          timeout: 2_000,
          killSignal: 'SIGKILL',
          maxBuffer: 2 * 1024 * 1024,
        });
      } catch (error) {
        failure = error as typeof failure;
      }

      expect(failure).toBeDefined();
      expect(failure?.killed).not.toBe(true);
      expect(failure?.code).toBe(1);
      expect(`${failure?.stdout ?? ''}${failure?.stderr ?? ''}`).toMatch(/Executable doesn't exist/u);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });
});
