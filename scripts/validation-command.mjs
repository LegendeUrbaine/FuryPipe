/**
 * Resolve the project-declared pnpm through Corepack without invoking a shell.
 */
export function resolvePnpmCommand() {
  // Validation subprocesses must honor package.json#packageManager. Calling
  // the first `pnpm` on PATH can silently select a different major version
  // (and therefore a different lockfile/config contract), especially inside
  // temporary baseline worktrees.
  return Object.freeze({
    executable: process.platform === 'win32' ? 'corepack.cmd' : 'corepack',
    prefixArgs: ['pnpm'],
    shell: false,
  });
}

export function isPnpmCommand(value) {
  return /(?:^|[\\/])pnpm(?:\.cmd)?$/iu.test(value) || value === 'pnpm';
}
