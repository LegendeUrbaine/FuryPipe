/**
 * Resolve the project-declared pnpm through Corepack.
 *
 * Windows exposes Corepack as a `.cmd` shim. Node cannot execute that shim
 * with `shell: false` (`spawnSync ... EINVAL`), so the Windows path must use
 * the platform command shell. All arguments here are fixed validation
 * arguments assembled by the repository scripts, not user input.
 */
export function resolvePnpmCommand() {
  // Validation subprocesses must honor package.json#packageManager. Calling
  // the first `pnpm` on PATH can silently select a different major version
  // (and therefore a different lockfile/config contract), especially inside
  // temporary baseline worktrees.
  return Object.freeze({
    executable: process.platform === 'win32' ? 'corepack.cmd' : 'corepack',
    prefixArgs: ['pnpm'],
    shell: process.platform === 'win32',
  });
}

export function isPnpmCommand(value) {
  return /(?:^|[\\/])pnpm(?:\.cmd)?$/iu.test(value) || value === 'pnpm';
}
