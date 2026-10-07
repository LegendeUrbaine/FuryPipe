import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('maintained-source lint contract', () => {
  it('defines a strict lint command over maintained source and tests', () => {
    const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.lint).toBe('eslint src scripts tests --max-warnings 0');
    expect(existsSync(path.join(root, 'eslint.config.mjs'))).toBe(true);
  });

  it('keeps generated and evaluation output outside the lint scope', () => {
    const config = readFileSync(path.join(root, 'eslint.config.mjs'), 'utf8');

    expect(config).toMatch(/dist/u);
    expect(config).toMatch(/artifacts/u);
    expect(config).toMatch(/eval/u);
  });
});
