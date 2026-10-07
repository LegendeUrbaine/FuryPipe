import { createHash, randomUUID } from 'node:crypto';

import { createRecoveryStore, type RecoveryStore } from './core/recovery-store.js';

export const FURY_WORKSPACE_FORMAT = 'furypipe-workspace/v1' as const;
export const FURY_WORKSPACE_RECORD_FORMAT = 'furypipe-workspace-record/v1' as const;

export type FuryWorkspaceTaskStatus = 'PLANNED' | 'CONFIRMED' | 'SUCCEEDED';

export interface FuryWorkspaceDispatchSummary {
  readonly status: 'PLANNED' | 'BLOCKED' | 'NO_DISPATCH';
  readonly mode: string;
  readonly reasons: readonly string[];
  readonly agents: number;
  readonly estimatedCostUsd: number;
}

export interface FuryWorkspaceTask {
  readonly id: string;
  readonly objective: string;
  readonly plannedFiles: readonly string[];
  readonly planDigest: string;
  readonly dispatch: FuryWorkspaceDispatchSummary;
  readonly status: FuryWorkspaceTaskStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly confirmedAt?: string;
  readonly artifactId?: string;
  readonly artifactContentSha256?: string;
  readonly verification?: 'VERIFIED_CONTENT_SHA256';
  readonly execution: 'NOT_EXECUTED' | 'ARTIFACT_COMMIT';
}

export interface FuryWorkspace {
  readonly format: typeof FURY_WORKSPACE_FORMAT;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly revision: number;
  readonly conversationIds: readonly string[];
  readonly tasks: readonly FuryWorkspaceTask[];
  readonly artifactIds: readonly string[];
}

export interface FuryWorkspaceRepository {
  get(): Promise<FuryWorkspace>;
  rename(title: string): Promise<FuryWorkspace>;
  attachConversation(conversationId: string): Promise<FuryWorkspace>;
  planTask(input: FuryWorkspacePlanTaskInput): Promise<FuryWorkspace>;
  confirmTask(taskId: string, now: string): Promise<FuryWorkspace>;
  commitArtifact(input: FuryWorkspaceCommitArtifactInput): Promise<FuryWorkspace>;
}

export interface FuryWorkspacePlanTaskInput {
  readonly task: Omit<FuryWorkspaceTask, 'status' | 'createdAt' | 'updatedAt' | 'execution'>;
  readonly now: string;
}

export interface FuryWorkspaceCommitArtifactInput {
  readonly taskId: string;
  readonly artifactId: string;
  readonly contentSha256: string;
  readonly now: string;
}

const WORKSPACE_ID = /^[a-z][a-z0-9._-]{0,127}$/u;
const ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const MAX_REVISIONS = 1024;
const MAX_CONVERSATIONS = 500;
const MAX_TASKS = 256;
const MAX_ARTIFACTS = 500;
const MAX_OBJECTIVE = 32_768;
const SAFE_RELATIVE_PATH = /^(?![\\/])(?!.*(?:^|[\\/])\.\.(?:[\\/]|$))[A-Za-z0-9._@/-]{1,512}$/u;

function boundedText(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > max || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new Error(`${label} must be bounded printable text`);
  }
  return value;
}

function iso(value: string): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error('workspace timestamp is invalid');
  const normalized = new Date(time).toISOString();
  if (normalized !== value) throw new Error('workspace timestamp must be normalized ISO');
  return normalized;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}

function freezeWorkspace(workspace: FuryWorkspace): FuryWorkspace {
  return Object.freeze({
    ...workspace,
    conversationIds: Object.freeze([...workspace.conversationIds]),
    tasks: Object.freeze(workspace.tasks.map((task) => Object.freeze({ ...task, plannedFiles: Object.freeze([...task.plannedFiles]), dispatch: Object.freeze({ ...task.dispatch, reasons: Object.freeze([...task.dispatch.reasons]) }) }))),
    artifactIds: Object.freeze([...workspace.artifactIds]),
  });
}

function validateTask(raw: unknown): FuryWorkspaceTask {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('workspace task is invalid');
  const value = raw as Record<string, unknown>;
  const id = boundedText(value.id, 'workspace task id', 128);
  if (!ID.test(id)) throw new Error('workspace task id is invalid');
  const objective = boundedText(value.objective, 'workspace task objective', MAX_OBJECTIVE);
  if (!Array.isArray(value.plannedFiles) || value.plannedFiles.length > 200 || !value.plannedFiles.every((file) => typeof file === 'string' && SAFE_RELATIVE_PATH.test(file.replaceAll('\\', '/')))) {
    throw new Error('workspace task plannedFiles is invalid');
  }
  const plannedFiles = [...new Set((value.plannedFiles as string[]).map((file) => file.replaceAll('\\', '/')))].sort();
  const planDigest = boundedText(value.planDigest, 'workspace task planDigest', 128);
  if (!SHA256.test(planDigest)) throw new Error('workspace task planDigest is invalid');
  if (!value.dispatch || typeof value.dispatch !== 'object' || Array.isArray(value.dispatch)) throw new Error('workspace task dispatch is invalid');
  const dispatch = value.dispatch as Record<string, unknown>;
  if (dispatch.status !== 'PLANNED' && dispatch.status !== 'BLOCKED' && dispatch.status !== 'NO_DISPATCH') throw new Error('workspace task dispatch status is invalid');
  if (typeof dispatch.mode !== 'string' || dispatch.mode.length > 64) throw new Error('workspace task dispatch mode is invalid');
  if (!Array.isArray(dispatch.reasons) || dispatch.reasons.length > 64 || !dispatch.reasons.every((reason) => typeof reason === 'string' && reason.length <= 512)) throw new Error('workspace task dispatch reasons are invalid');
  if (!Number.isSafeInteger(dispatch.agents) || Number(dispatch.agents) < 0 || !Number.isFinite(dispatch.estimatedCostUsd) || Number(dispatch.estimatedCostUsd) < 0) throw new Error('workspace task dispatch metrics are invalid');
  if (value.status !== 'PLANNED' && value.status !== 'CONFIRMED' && value.status !== 'SUCCEEDED') throw new Error('workspace task status is invalid');
  const createdAt = iso(String(value.createdAt));
  const updatedAt = iso(String(value.updatedAt));
  if (value.execution !== 'NOT_EXECUTED' && value.execution !== 'ARTIFACT_COMMIT') throw new Error('workspace task execution state is invalid');
  if (value.confirmedAt !== undefined) iso(String(value.confirmedAt));
  if (value.artifactId !== undefined && (typeof value.artifactId !== 'string' || !ID.test(value.artifactId))) throw new Error('workspace task artifactId is invalid');
  if (value.artifactContentSha256 !== undefined && (typeof value.artifactContentSha256 !== 'string' || !SHA256.test(value.artifactContentSha256))) throw new Error('workspace task artifactContentSha256 is invalid');
  if (value.status === 'SUCCEEDED' && (typeof value.artifactContentSha256 !== 'string' || !SHA256.test(value.artifactContentSha256))) throw new Error('succeeded workspace task requires artifactContentSha256');
  if (value.verification !== undefined && value.verification !== 'VERIFIED_CONTENT_SHA256') throw new Error('workspace task verification is invalid');
  const status = value.status as FuryWorkspaceTaskStatus;
  const execution = value.execution as FuryWorkspaceTask['execution'];
  return Object.freeze({
    id,
    objective,
    plannedFiles: Object.freeze(plannedFiles),
    planDigest,
    dispatch: Object.freeze({
      status: dispatch.status,
      mode: dispatch.mode,
      reasons: Object.freeze([...(dispatch.reasons as string[])]),
      agents: Number(dispatch.agents),
      estimatedCostUsd: Number(dispatch.estimatedCostUsd),
    }),
    status,
    createdAt,
    updatedAt,
    ...(value.confirmedAt !== undefined ? { confirmedAt: iso(String(value.confirmedAt)) } : {}),
    ...(value.artifactId !== undefined ? { artifactId: value.artifactId as string } : {}),
    ...(value.artifactContentSha256 !== undefined ? { artifactContentSha256: value.artifactContentSha256 as string } : {}),
    ...(value.verification !== undefined ? { verification: 'VERIFIED_CONTENT_SHA256' as const } : {}),
    execution,
  });
}

function validateWorkspace(raw: unknown): FuryWorkspace {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('workspace record is invalid');
  const value = raw as Record<string, unknown>;
  if (value.format !== FURY_WORKSPACE_FORMAT) throw new Error('workspace format is invalid');
  const workspaceId = boundedText(value.workspaceId, 'workspaceId', 128);
  if (!WORKSPACE_ID.test(workspaceId)) throw new Error('workspaceId is invalid');
  const projectId = boundedText(value.projectId, 'projectId', 256);
  const title = boundedText(value.title, 'workspace title', 256);
  const createdAt = iso(String(value.createdAt));
  const updatedAt = iso(String(value.updatedAt));
  if (!Number.isSafeInteger(value.revision) || Number(value.revision) < 0) throw new Error('workspace revision is invalid');
  if (!Array.isArray(value.conversationIds) || value.conversationIds.length > MAX_CONVERSATIONS || !value.conversationIds.every((id) => typeof id === 'string' && ID.test(id))) throw new Error('workspace conversationIds are invalid');
  if (!Array.isArray(value.tasks) || value.tasks.length > MAX_TASKS) throw new Error('workspace tasks are invalid');
  if (!Array.isArray(value.artifactIds) || value.artifactIds.length > MAX_ARTIFACTS || !value.artifactIds.every((id) => typeof id === 'string' && ID.test(id))) throw new Error('workspace artifactIds are invalid');
  return freezeWorkspace({
    format: FURY_WORKSPACE_FORMAT,
    workspaceId,
    projectId,
    title,
    createdAt,
    updatedAt,
    revision: Number(value.revision),
    conversationIds: Object.freeze([...new Set(value.conversationIds as string[])]),
    tasks: Object.freeze((value.tasks as unknown[]).map(validateTask)),
    artifactIds: Object.freeze([...new Set(value.artifactIds as string[])]),
  });
}

function metadata(projectId: string, workspaceId: string, revision: number) {
  return Object.freeze({ recordFormat: FURY_WORKSPACE_RECORD_FORMAT, projectId, workspaceId, revision });
}

export function createFuryWorkspaceRepository(options: {
  readonly root: string;
  readonly projectId: string;
  readonly workspaceId?: string;
  readonly title?: string;
  readonly recovery?: RecoveryStore;
  readonly now?: () => number;
}): FuryWorkspaceRepository {
  const projectId = boundedText(options.projectId, 'workspace projectId', 256);
  const workspaceId = options.workspaceId ?? `workspace-${sha256(projectId).slice(0, 16)}`;
  if (!WORKSPACE_ID.test(workspaceId)) throw new Error('workspaceId is invalid');
  const defaultTitle = options.title?.trim() || 'FuryPipe workspace';
  boundedText(defaultTitle, 'workspace title', 256);
  const now = options.now ?? Date.now;
  const recovery = options.recovery ?? createRecoveryStore(options.root, {
    namespace: 'workspace',
    maxObjectBytes: 2 * 1024 * 1024,
    maxTotalBytes: 128 * 1024 * 1024,
  });
  if (!recovery.list || !recovery.putBounded) throw new Error('workspace repository requires RecoveryStore list and putBounded support');

  let writeChain = Promise.resolve();
  const defaultWorkspace = (): FuryWorkspace => {
    const timestamp = new Date(now()).toISOString();
    return freezeWorkspace({ format: FURY_WORKSPACE_FORMAT, workspaceId, projectId, title: defaultTitle, createdAt: timestamp, updatedAt: timestamp, revision: 0, conversationIds: [], tasks: [], artifactIds: [] });
  };
  const readCurrent = async (): Promise<FuryWorkspace> => {
    const handles = await recovery.list!({ metadata: { recordFormat: FURY_WORKSPACE_RECORD_FORMAT, projectId, workspaceId }, limit: MAX_REVISIONS });
    const latest = [...handles].sort((a, b) => Number(b.metadata?.revision ?? 0) - Number(a.metadata?.revision ?? 0))[0];
    if (!latest) return defaultWorkspace();
    const record = JSON.parse(Buffer.from(await recovery.get(latest)).toString('utf8')) as { format?: unknown; workspace?: unknown };
    if (record.format !== FURY_WORKSPACE_RECORD_FORMAT) throw new Error('workspace persisted record format is invalid');
    return validateWorkspace(record.workspace);
  };
  const persist = async (workspace: FuryWorkspace): Promise<void> => {
    const bytes = Buffer.from(JSON.stringify({ format: FURY_WORKSPACE_RECORD_FORMAT, workspace }), 'utf8');
    await recovery.putBounded!(bytes, metadata(projectId, workspaceId, workspace.revision), {
      metadata: { recordFormat: FURY_WORKSPACE_RECORD_FORMAT, projectId, workspaceId },
      maxMatches: MAX_REVISIONS,
      additionalBounds: [{ metadata: { recordFormat: FURY_WORKSPACE_RECORD_FORMAT, projectId, workspaceId, revision: workspace.revision }, maxMatches: 1 }],
    });
  };
  const mutate = <T>(fn: (workspace: FuryWorkspace) => { readonly workspace: FuryWorkspace; readonly result: T }): Promise<T> => {
    const next = writeChain.then(async () => {
      const current = await readCurrent();
      const changed = fn(current);
      await persist(changed.workspace);
      return changed.result;
    });
    writeChain = next.then(() => undefined, () => undefined);
    return next;
  };
  const nextRevision = (workspace: FuryWorkspace, patch: Omit<FuryWorkspace, 'revision' | 'updatedAt'>, timestamp: string): FuryWorkspace => freezeWorkspace({ ...patch, revision: workspace.revision + 1, updatedAt: timestamp });

  return Object.freeze({
    get: readCurrent,
    rename(title: string) {
      const normalized = boundedText(title.trim(), 'workspace title', 256);
      return mutate((workspace) => {
        const next = nextRevision(workspace, { ...workspace, title: normalized }, new Date(now()).toISOString());
        return { workspace: next, result: next };
      });
    },
    attachConversation(conversationId: string) {
      if (!ID.test(conversationId)) throw new Error('conversationId is invalid');
      return mutate((workspace) => {
        const next = nextRevision(workspace, { ...workspace, conversationIds: workspace.conversationIds.includes(conversationId) ? workspace.conversationIds : [...workspace.conversationIds, conversationId] }, new Date(now()).toISOString());
        return { workspace: next, result: next };
      });
    },
    planTask(input: FuryWorkspacePlanTaskInput) {
      const task = validateTask({ ...input.task, status: 'PLANNED', createdAt: input.now, updatedAt: input.now, execution: 'NOT_EXECUTED' });
      return mutate((workspace) => {
        if (workspace.tasks.some((existing) => existing.id === task.id)) throw new Error('workspace task already exists');
        if (workspace.tasks.length >= MAX_TASKS) throw new Error('workspace task limit reached');
        const next = nextRevision(workspace, { ...workspace, tasks: [...workspace.tasks, task] }, iso(input.now));
        return { workspace: next, result: next };
      });
    },
    confirmTask(taskId: string, timestamp: string) {
      if (!ID.test(taskId)) throw new Error('taskId is invalid');
      const at = iso(timestamp);
      return mutate((workspace) => {
        const task = workspace.tasks.find((candidate) => candidate.id === taskId);
        if (!task) throw new Error('workspace task not found');
        if (task.status !== 'PLANNED') throw new Error('workspace task is not awaiting confirmation');
        const tasks = workspace.tasks.map((candidate) => candidate.id === taskId ? Object.freeze({ ...candidate, status: 'CONFIRMED' as const, confirmedAt: at, updatedAt: at }) : candidate);
        const next = nextRevision(workspace, { ...workspace, tasks }, at);
        return { workspace: next, result: next };
      });
    },
    commitArtifact(input: FuryWorkspaceCommitArtifactInput) {
      if (!ID.test(input.taskId) || !ID.test(input.artifactId) || !SHA256.test(input.contentSha256)) throw new Error('workspace artifact link is invalid');
      const at = iso(input.now);
      return mutate((workspace) => {
        const task = workspace.tasks.find((candidate) => candidate.id === input.taskId);
        if (!task) throw new Error('workspace task not found');
        if (task.status !== 'CONFIRMED') throw new Error('workspace task must be confirmed before artifact commit');
        if (workspace.artifactIds.length >= MAX_ARTIFACTS) throw new Error('workspace artifact limit reached');
        const tasks = workspace.tasks.map((candidate) => candidate.id === input.taskId ? Object.freeze({ ...candidate, status: 'SUCCEEDED' as const, updatedAt: at, artifactId: input.artifactId, artifactContentSha256: input.contentSha256, verification: 'VERIFIED_CONTENT_SHA256' as const, execution: 'ARTIFACT_COMMIT' as const }) : candidate);
        const artifactIds = workspace.artifactIds.includes(input.artifactId) ? workspace.artifactIds : [...workspace.artifactIds, input.artifactId];
        const next = nextRevision(workspace, { ...workspace, tasks, artifactIds }, at);
        return { workspace: next, result: next };
      });
    },
  });
}
