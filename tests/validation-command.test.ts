import { describe, expect, it } from 'vitest';
import { isPnpmCommand, resolvePnpmCommand } from '../scripts/validation-command.mjs';

describe('validation command resolution', () => {
  it('recognizes pnpm command forms', () => {
    expect(isPnpmCommand('pnpm')).toBe(true);
    expect(isPnpmCommand('/usr/local/bin/pnpm')).toBe(true);
    expect(isPnpmCommand('node')).toBe(false);
  });

  it('pins Unix validation subprocesses to the project package manager', () => {
    if (process.platform === 'win32') return;
    expect(resolvePnpmCommand()).toMatchObject({ executable: 'corepack', prefixArgs: ['pnpm'], shell: false });
  });

  it('uses the command shell for the Windows package-manager shim', () => {
    if (process.platform !== 'win32') return;
    const command = resolvePnpmCommand();
    expect(command.shell).toBe(true);
    if (command.executable === 'corepack.cmd') {
      expect(command.prefixArgs).toEqual(['pnpm']);
      return;
    }
    expect(command).toMatchObject({ executable: 'pnpm.cmd', prefixArgs: [], shell: true });
  });
});
