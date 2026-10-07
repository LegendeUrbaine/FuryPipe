import { existsSync } from 'node:fs';
import path from 'node:path';

function findOnPath(command) {
  const pathValue = process.env.Path ?? process.env.PATH ?? '';
  for (const directory of pathValue.split(path.delimiter)) {
    if (!directory) continue;
    const candidate = path.join(directory, command);
    if (existsSync(candidate)) return command;
  }
  return undefined;
}

/**
 * Resolve the project-declared pnpm through Corepack when available.
 *
 * Windows exposes Corepack as a `.cmd` shim. Node cannot execute that shim
 * with `shell: false` (`spawnSync ... EINVAL`), so the Windows path must use
 * the platform command shell. Newer Node distributions may omit Corepack;
 * in that case use the pnpm `.cmd` already installed on PATH. All arguments
 * here are fixed validation arguments assembled by repository scripts, not
 * user input.
 */
export function resolvePnpmCommand() {
  // Validation subprocesses must honor package.json#packageManager. Calling
  // the first `pnpm` on PATH can silently select a different major version
  // (and therefore a different lockfile/config contract), especially inside
  // temporary baseline worktrees.
  if (process.platform === 'win32') {
    const corepack = findOnPath('corepack.cmd');
    if (corepack) {
      return Object.freeze({
        executable: corepack,
        prefixArgs: ['pnpm'],
        shell: true,
      });
    }

    const pnpm = findOnPath('pnpm.cmd');
    if (pnpm) {
      return Object.freeze({
        executable: pnpm,
        prefixArgs: [],
        shell: true,
      });
    }
  }

  return Object.freeze({
    executable: 'corepack',
    prefixArgs: ['pnpm'],
    shell: false,
  });
}

export function isPnpmCommand(value) {
  return /(?:^|[\\/])pnpm(?:\.cmd)?$/iu.test(value) || value === 'pnpm';
}
