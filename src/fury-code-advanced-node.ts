import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';

import {
  CodingRuntimeError,
  createCodingProcessRuntime,
  createCodingSandbox,
  type CodingSandbox,
  type ProcessExecutionPermit,
  type ProcessExecutionReceipt,
} from './coding-runtime.js';
import {
  createPatchEngine,
  discoverPatchRepository,
  type PatchPermit,
  type PatchProposal,
  type PatchReceipt,
} from './patch-engine.js';

export const FURY_CODE_EDIT_PLAN_FORMAT = 'furypipe-code-edit-plan/v1' as const;
export const FURY_CODE_EDIT_APPROVAL_FORMAT = 'furypipe-code-edit-approval/v1' as const;
export const FURY_CODE_SCRIPT_PLAN_FORMAT = 'furypipe-code-script-plan/v1' as const;
export const FURY_CODE_SCRIPT_APPROVAL_FORMAT = 'furypipe-code-script-approval/v1' as const;
export const FURY_CODE_SCRIPT_RECEIPT_FORMAT = 'furypipe-code-script-receipt/v1' as const;

export type FuryCodeScriptName = 'test' | 'typecheck' | 'build';

export interface FuryCodeEditPlan {
  readonly format: typeof FURY_CODE_EDIT_PLAN_FORMAT;
  readonly path: string;
  readonly baseSha: string;
  readonly expectedSha256: string;
  readonly replacementSha256: string;
  readonly replacementBytes: number;
  readonly proposalSha256: string;
  readonly planDigestSha256: string;
  readonly requiresApproval: true;
  readonly writeAuthorized: false;
  readonly executionAuthorized: false;
}

export interface FuryCodeEditApproval {
  readonly format: typeof FURY_CODE_EDIT_APPROVAL_FORMAT;
  readonly planDigestSha256: string;
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly writeAuthorized: true;
  readonly executionAuthorized: false;
}

export interface FuryCodeScriptPlan {
  readonly format: typeof FURY_CODE_SCRIPT_PLAN_FORMAT;
  readonly script: FuryCodeScriptName;
  readonly scriptText: string;
  readonly scriptSha256: string;
  readonly packageJsonSha256: string;
  readonly planDigestSha256: string;
  readonly runner: 'node --run';
  readonly requiresApproval: true;
  readonly executionAuthorized: false;
}

export interface FuryCodeScriptApproval {
  readonly format: typeof FURY_CODE_SCRIPT_APPROVAL_FORMAT;
  readonly planDigestSha256: string;
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly executionAuthorized: true;
}

export interface FuryCodeScriptReceipt {
  readonly format: typeof FURY_CODE_SCRIPT_RECEIPT_FORMAT;
  readonly script: FuryCodeScriptName;
  readonly scriptSha256: string;
  readonly packageJsonSha256: string;
  readonly planDigestSha256: string;
  readonly process: ProcessExecutionReceipt;
  readonly stdout: string;
  readonly stderr: string;
  readonly executionPerformed: true;
  readonly arbitraryCommandAuthorized: false;
}

export interface FuryCodeAdvanced {
  planEdit(input: { readonly path: string; readonly replacement: string }): Promise<FuryCodeEditPlan>;
  approveEdit(plan: FuryCodeEditPlan, input: { readonly confirm: true; readonly approvedBy: string; readonly approvedAt: string }): Promise<FuryCodeEditApproval>;
  applyEdit(plan: FuryCodeEditPlan, approval: FuryCodeEditApproval): Promise<PatchReceipt>;
  planScript(script: FuryCodeScriptName): Promise<FuryCodeScriptPlan>;
  approveScript(plan: FuryCodeScriptPlan, input: { readonly confirm: true; readonly approvedBy: string; readonly approvedAt: string }): Promise<FuryCodeScriptApproval>;
  runScript(plan: FuryCodeScriptPlan, approval: FuryCodeScriptApproval): Promise<FuryCodeScriptReceipt>;
}

interface EditState {
  readonly proposal: PatchProposal;
}

interface EditApprovalState {
  readonly plan: FuryCodeEditPlan;
  readonly permit: PatchPermit;
}

interface ScriptState {
  readonly packageJsonSha256: string;
  readonly scriptText: string;
}

interface ScriptApprovalState {
  readonly plan: FuryCodeScriptPlan;
  readonly permit: ProcessExecutionPermit;
}

const EDIT_PLANS = new WeakMap<object, EditState>();
const EDIT_APPROVALS = new WeakMap<object, EditApprovalState>();
const SCRIPT_PLANS = new WeakMap<object, ScriptState>();
const SCRIPT_APPROVALS = new WeakMap<object, ScriptApprovalState>();

const SAFE_PATH = /^(?![A-Za-z]:)(?![/\\])(?!.*(?:^|[/\\])\.\.(?:[/\\]|$))[^\u0000]{1,1024}$/u;
const SAFE_APPROVER = /^[^\u0000-\u001f\u007f]{1,160}$/u;
const SCRIPT_NAMES = new Set<FuryCodeScriptName>(['test', 'typecheck', 'build']);
const MAX_REPLACEMENT_BYTES = 4 * 1024 * 1024;

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const record = value as Readonly<Record<string, unknown>>;
  return '{' + Object.keys(record).sort().map((key) => JSON.stringify(key) + ':' + canonical(record[key])).join(',') + '}';
}

function normalizedIso(value: string, label: string): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new CodingRuntimeError('invalid-input', label + ' must be an ISO timestamp');
  return new Date(time).toISOString();
}

function approver(value: string): string {
  if (!SAFE_APPROVER.test(value)) throw new CodingRuntimeError('invalid-input', 'approvedBy must be bounded printable text');
  return value;
}

function gitHead(cwd: string): Promise<string> {
  return new Promise((resolve, reject) => execFile('git', ['rev-parse', 'HEAD'], {
    cwd,
    shell: false,
    windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' },
    maxBuffer: 256 * 1024,
  }, (error, stdout) => {
    const value = String(stdout).trim();
    if (error || !/^[0-9a-f]{40,64}$/u.test(value)) {
      reject(new CodingRuntimeError('repository-invalid', 'project HEAD could not be resolved'));
      return;
    }
    resolve(value);
  }));
}

function parsePackageScripts(bytes: Uint8Array): { readonly digest: string; readonly scripts: Readonly<Record<string, string>> } {
  const digest = sha256(bytes);
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(bytes).toString('utf8')) as unknown;
  } catch {
    throw new CodingRuntimeError('invalid-input', 'package.json is not valid JSON');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CodingRuntimeError('invalid-input', 'package.json must be an object');
  const scriptsValue = (value as { scripts?: unknown }).scripts;
  if (!scriptsValue || typeof scriptsValue !== 'object' || Array.isArray(scriptsValue)) {
    return Object.freeze({ digest, scripts: Object.freeze({}) });
  }
  const scripts: Record<string, string> = {};
  for (const [name, script] of Object.entries(scriptsValue as Record<string, unknown>)) {
    if (typeof script === 'string' && script.length <= 16 * 1024 && !script.includes('\0')) scripts[name] = script;
  }
  return Object.freeze({ digest, scripts: Object.freeze(scripts) });
}

function nodeCommand(): string {
  return process.platform === 'win32' ? 'node.exe' : 'node';
}

export async function createFuryCodeAdvanced(options: {
  readonly projectRoot: string;
  readonly now?: () => number;
  readonly allowedScripts?: readonly FuryCodeScriptName[];
}): Promise<FuryCodeAdvanced> {
  const repository = await discoverPatchRepository(options.projectRoot);
  const allowedScripts = Object.freeze([...(options.allowedScripts ?? ['test', 'typecheck', 'build'])]);
  if (allowedScripts.some((script) => !SCRIPT_NAMES.has(script)) || new Set(allowedScripts).size !== allowedScripts.length) {
    throw new CodingRuntimeError('invalid-input', 'allowedScripts contains an unsupported or duplicate script');
  }
  const sandbox: CodingSandbox = await createCodingSandbox({
    policyId: 'fury-code-advanced',
    rootPath: options.projectRoot,
    readRoots: ['.'],
    writeRoots: ['.'],
    environmentAllowlist: ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'CI', 'NO_COLOR'],
    allowedCommands: [nodeCommand()],
    maxOutputBytes: 2 * 1024 * 1024,
    maxFileBytes: MAX_REPLACEMENT_BYTES,
    maxProcesses: 1,
    maxTimeoutMs: 120_000,
  });
  const patch = createPatchEngine({
    repository,
    sandbox,
    currentHeadSha: () => gitHead(options.projectRoot),
    now: options.now,
    maxFiles: 1,
    maxBytes: MAX_REPLACEMENT_BYTES,
  });
  const processRuntime = createCodingProcessRuntime({ sandbox, now: options.now });

  return Object.freeze({
    async planEdit(input) {
      if (typeof input?.path !== 'string' || !SAFE_PATH.test(input.path) || input.path.includes('\\')) {
        throw new CodingRuntimeError('path-denied', 'edit path must be a normalized project-relative path');
      }
      if (typeof input.replacement !== 'string' || input.replacement.includes('\0') || Buffer.byteLength(input.replacement, 'utf8') > MAX_REPLACEMENT_BYTES) {
        throw new CodingRuntimeError('invalid-input', 'replacement exceeds the FuryCode edit bound');
      }
      const current = await sandbox.readFile(input.path);
      if (current.includes(0)) throw new CodingRuntimeError('policy-denied', 'binary files cannot be edited through FuryCode text replacement');
      const baseSha = await gitHead(options.projectRoot);
      const expectedSha256 = sha256(current);
      const proposal = await patch.propose([{
        path: input.path,
        expectedSha256,
        replacement: input.replacement,
      }], baseSha);
      const payload = Object.freeze({
        path: input.path,
        baseSha,
        expectedSha256,
        replacementSha256: sha256(input.replacement),
        replacementBytes: Buffer.byteLength(input.replacement, 'utf8'),
        proposalSha256: proposal.proposalSha256,
      });
      const plan = Object.freeze({
        format: FURY_CODE_EDIT_PLAN_FORMAT,
        ...payload,
        planDigestSha256: sha256(canonical(payload)),
        requiresApproval: true as const,
        writeAuthorized: false as const,
        executionAuthorized: false as const,
      });
      EDIT_PLANS.set(plan, Object.freeze({ proposal }));
      return plan;
    },

    async approveEdit(plan, input) {
      const state = EDIT_PLANS.get(plan as unknown as object);
      if (!state) throw new CodingRuntimeError('permit-invalid', 'edit plan is not process-local FuryPipe evidence');
      if (input.confirm !== true) throw new CodingRuntimeError('policy-denied', 'edit approval requires confirm: true');
      const permit = await patch.authorize(state.proposal);
      const approval = Object.freeze({
        format: FURY_CODE_EDIT_APPROVAL_FORMAT,
        planDigestSha256: plan.planDigestSha256,
        approvedBy: approver(input.approvedBy),
        approvedAt: normalizedIso(input.approvedAt, 'approvedAt'),
        writeAuthorized: true as const,
        executionAuthorized: false as const,
      });
      EDIT_APPROVALS.set(approval, Object.freeze({ plan, permit }));
      return approval;
    },

    async applyEdit(plan, approval) {
      const state = EDIT_APPROVALS.get(approval as unknown as object);
      if (!state || state.plan !== plan || approval.planDigestSha256 !== plan.planDigestSha256) {
        throw new CodingRuntimeError('permit-invalid', 'edit approval does not match the process-local plan');
      }
      return patch.apply(state.permit);
    },

    async planScript(script) {
      if (!SCRIPT_NAMES.has(script) || !allowedScripts.includes(script)) throw new CodingRuntimeError('policy-denied', 'script is outside the FuryCode allowlist');
      const packageBytes = await sandbox.readFile('package.json');
      const parsed = parsePackageScripts(packageBytes);
      const scriptText = parsed.scripts[script];
      if (!scriptText) throw new CodingRuntimeError('invalid-input', 'package.json does not define the requested script');
      const scriptSha256 = sha256(scriptText);
      const payload = Object.freeze({
        script,
        scriptText,
        scriptSha256,
        packageJsonSha256: parsed.digest,
        runner: 'node --run' as const,
      });
      const plan = Object.freeze({
        format: FURY_CODE_SCRIPT_PLAN_FORMAT,
        ...payload,
        planDigestSha256: sha256(canonical(payload)),
        requiresApproval: true as const,
        executionAuthorized: false as const,
      });
      SCRIPT_PLANS.set(plan, Object.freeze({ packageJsonSha256: parsed.digest, scriptText }));
      return plan;
    },

    async approveScript(plan, input) {
      const state = SCRIPT_PLANS.get(plan as unknown as object);
      if (!state) throw new CodingRuntimeError('permit-invalid', 'script plan is not process-local FuryPipe evidence');
      if (input.confirm !== true) throw new CodingRuntimeError('policy-denied', 'script approval requires confirm: true');
      const current = parsePackageScripts(await sandbox.readFile('package.json'));
      if (current.digest !== state.packageJsonSha256 || current.scripts[plan.script] !== state.scriptText) {
        throw new CodingRuntimeError('permit-invalid', 'package.json changed after the script plan was created');
      }
      const permit = await processRuntime.authorize({
        command: nodeCommand(),
        args: ['--run', plan.script],
        cwd: '.',
        timeoutMs: 120_000,
      });
      const approval = Object.freeze({
        format: FURY_CODE_SCRIPT_APPROVAL_FORMAT,
        planDigestSha256: plan.planDigestSha256,
        approvedBy: approver(input.approvedBy),
        approvedAt: normalizedIso(input.approvedAt, 'approvedAt'),
        executionAuthorized: true as const,
      });
      SCRIPT_APPROVALS.set(approval, Object.freeze({ plan, permit }));
      return approval;
    },

    async runScript(plan, approval) {
      const state = SCRIPT_APPROVALS.get(approval as unknown as object);
      if (!state || state.plan !== plan || approval.planDigestSha256 !== plan.planDigestSha256) {
        throw new CodingRuntimeError('permit-invalid', 'script approval does not match the process-local plan');
      }
      const current = parsePackageScripts(await sandbox.readFile('package.json'));
      if (current.digest !== plan.packageJsonSha256 || current.scripts[plan.script] !== plan.scriptText) {
        throw new CodingRuntimeError('permit-invalid', 'package.json changed after script approval');
      }
      const result = await processRuntime.execute(state.permit);
      return Object.freeze({
        format: FURY_CODE_SCRIPT_RECEIPT_FORMAT,
        script: plan.script,
        scriptSha256: plan.scriptSha256,
        packageJsonSha256: plan.packageJsonSha256,
        planDigestSha256: plan.planDigestSha256,
        process: result.receipt,
        stdout: result.stdout,
        stderr: result.stderr,
        executionPerformed: true as const,
        arbitraryCommandAuthorized: false as const,
      });
    },
  });
}
