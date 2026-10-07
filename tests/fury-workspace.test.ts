import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createFuryWorkspaceRepository } from '../src/fury-workspace.js';
import { FURY_HARNESS_REGISTRY, type FuryHarnessDiscovery } from '../src/fury-harness-hub.js';
import { createStudioApi } from '../src/studio/studio-api.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const harnesses: FuryHarnessDiscovery = {
  format: 'furypipe-harness-discovery/v1',
  platform: 'win32',
  harnesses: FURY_HARNESS_REGISTRY.map((definition) => ({
    id: definition.id,
    displayName: definition.displayName,
    authentication: 'not-probed' as const,
    definition,
    installed: false,
    versionStatus: 'unknown' as const,
  })),
};

const post = (body: unknown) => new Request('http://127.0.0.1/api/studio/workspace', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

describe('FuryWorkspaceRepository', () => {
  it('publishes immutable snapshots and resumes the linked graph', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'furypipe-workspace-'));
    roots.push(root);
    const make = () => createFuryWorkspaceRepository({ root, projectId: 'project-a', now: () => Date.parse('2026-10-02T10:00:00.000Z') });
    const first = make();
    expect((await first.get()).revision).toBe(0);
    expect(() => first.attachConversation('../outside')).toThrow('conversationId is invalid');
    await first.attachConversation('11111111-1111-4111-8111-111111111111');
    await first.planTask({
      now: '2026-10-02T10:00:01.000Z',
      task: {
        id: 'task-a', objective: 'Prepare a verified note', plannedFiles: ['docs/note.md'], planDigest: 'a'.repeat(64),
        dispatch: { status: 'BLOCKED', mode: 'AUTO', reasons: ['no available local binding'], agents: 0, estimatedCostUsd: 0 },
      },
    });
    await first.confirmTask('task-a', '2026-10-02T10:00:02.000Z');
    await first.commitArtifact({ taskId: 'task-a', artifactId: 'artifact-a', contentSha256: 'b'.repeat(64), now: '2026-10-02T10:00:03.000Z' });

    const resumed = await make().get();
    expect(resumed).toMatchObject({ revision: 4, conversationIds: ['11111111-1111-4111-8111-111111111111'], artifactIds: ['artifact-a'] });
    expect(resumed.tasks[0]).toMatchObject({ id: 'task-a', status: 'SUCCEEDED', execution: 'ARTIFACT_COMMIT', artifactContentSha256: 'b'.repeat(64), verification: 'VERIFIED_CONTENT_SHA256' });
  });
});

describe('Studio VNext-01 workspace routes', () => {
  it('joins conversation, governed task and verified artifact without executing an agent', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'furypipe-studio-workspace-'));
    roots.push(root);
    const studio = createStudioApi({
      projectRoot: process.cwd(),
      chatsDir: path.join(root, 'chats'),
      artifactsDir: path.join(root, 'artifacts'),
      workspaceDir: path.join(root, 'workspace'),
      discoverHarnesses: async () => harnesses,
      discoverLocal: async () => ({ backends: [] }),
      now: () => Date.parse('2026-10-02T11:00:00.000Z'),
    });

    const conversationResponse = await studio.handle('workspace-conversation', post({ title: 'VNext proof', content: 'Keep one project context.' }));
    expect(conversationResponse.status).toBe(201);
    const conversationBody = await conversationResponse.json() as { workspace: { conversationIds: string[] }; conversation: { id: string } };
    expect(conversationBody.workspace.conversationIds).toEqual([conversationBody.conversation.id]);

    const planResponse = await studio.handle('workspace-task-plan', post({ objective: 'Create the verified acceptance note', plannedFiles: ['docs/evidence/VNEXT.md'] }));
    expect(planResponse.status).toBe(201);
    const planBody = await planResponse.json() as { workspace: { tasks: { id: string; status: string; execution: string; dispatch: { status: string } }[] }; task: { id: string; planDigest: string } };
    expect(planBody.task.planDigest).toMatch(/^[0-9a-f]{64}$/u);
    expect(planBody.workspace.tasks[0]).toMatchObject({ status: 'PLANNED', execution: 'NOT_EXECUTED', dispatch: { status: 'BLOCKED' } });

    const rejectedConfirmation = await studio.handle('workspace-task-confirm', post({ taskId: planBody.task.id }));
    expect(rejectedConfirmation.status).toBe(400);
    const malformedConfirmation = await studio.handle('workspace-task-confirm', post({ taskId: '../outside', confirm: true }));
    expect(malformedConfirmation.status).toBe(400);
    const artifactBeforeConfirmation = await studio.handle('workspace-artifact-commit', post({ taskId: planBody.task.id, title: 'Acceptance', kind: 'markdown', content: '# verified', confirm: true }));
    expect(artifactBeforeConfirmation.status).toBe(409);
    const malformedArtifact = await studio.handle('workspace-artifact-commit', post({ taskId: '../outside', title: 'Acceptance', kind: 'markdown', content: '# verified', confirm: true }));
    expect(malformedArtifact.status).toBe(400);

    const confirmation = await studio.handle('workspace-task-confirm', post({ taskId: planBody.task.id, confirm: true }));
    expect(confirmation.status).toBe(200);
    const artifactResponse = await studio.handle('workspace-artifact-commit', post({ taskId: planBody.task.id, title: 'Acceptance', kind: 'markdown', content: '# verified', confirm: true }));
    expect(artifactResponse.status).toBe(201);
    const artifactBody = await artifactResponse.json() as { workspace: { conversationIds: string[]; artifactIds: string[]; tasks: { status: string; execution: string; artifactContentSha256?: string }[] }; verification: { verified: boolean; contentSha256: string } };
    expect(artifactBody.verification).toMatchObject({ verified: true });
    expect(artifactBody.workspace.conversationIds).toHaveLength(1);
    expect(artifactBody.workspace.artifactIds).toHaveLength(1);
    expect(artifactBody.workspace.tasks[0]).toMatchObject({ status: 'SUCCEEDED', execution: 'ARTIFACT_COMMIT', artifactContentSha256: artifactBody.verification.contentSha256 });

    const resumed = await createStudioApi({
      projectRoot: process.cwd(), chatsDir: path.join(root, 'chats'), artifactsDir: path.join(root, 'artifacts'), workspaceDir: path.join(root, 'workspace'),
      discoverHarnesses: async () => harnesses, discoverLocal: async () => ({ backends: [] }),
    });
    const workspaceResponse = await resumed.handle('workspace', new Request('http://127.0.0.1/api/studio/workspace.json'));
    expect(workspaceResponse.status).toBe(200);
    const workspaceBody = await workspaceResponse.json() as { workspace: { conversationIds: string[]; artifactIds: string[]; tasks: { status: string; artifactContentSha256?: string }[] } };
    expect(workspaceBody.workspace).toMatchObject({ conversationIds: conversationBody.workspace.conversationIds, artifactIds: artifactBody.workspace.artifactIds });
    expect(workspaceBody.workspace.tasks[0]?.status).toBe('SUCCEEDED');
    expect(workspaceBody.workspace.tasks[0]?.artifactContentSha256).toBe(artifactBody.verification.contentSha256);
  });
});
