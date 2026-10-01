import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createRecoveryStore } from '../src/core/recovery-store.js';
import { createFuryMemoryTimeMachine } from '../src/fury-memory-time-machine.js';
import { createMemoryVNextStore, type MemoryVNextCandidate, type MemoryVNextStore } from '../src/memory-vnext.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture(): Promise<{ root: string; memory: MemoryVNextStore }> {
  const root = await mkdtemp(join(tmpdir(), 'furypipe-memory-time-machine-'));
  roots.push(root);
  return {
    root,
    memory: createMemoryVNextStore({
      recovery: createRecoveryStore(root, { namespace: 'memory-time-machine' }),
      authorize: () => true,
      now: () => 1_000,
    }),
  };
}

function candidate(memory: MemoryVNextStore, input: {
  readonly key: string;
  readonly text: string;
  readonly scope: { readonly kind: 'project' | 'user'; readonly id: string };
  readonly sourceId?: string;
}): MemoryVNextCandidate {
  return memory.observe({
    key: input.key,
    text: input.text,
    memoryClass: 'Project',
    scope: input.scope,
    source: { kind: 'user-message', id: input.sourceId ?? 'conversation-1' },
    evidenceClass: 'user-declared',
    confidence: 1,
    terms: ['memory', 'checkpoint', input.key],
  }, 1_000);
}

async function acceptAndActivate(memory: MemoryVNextStore, value: MemoryVNextCandidate, now: number): Promise<void> {
  await memory.accept({ candidate: value, acceptedBy: 'user-declared', retention: { kind: 'until-revoked' }, visibility: 'project', now });
  await memory.activate({ memoryId: value.memoryId, scope: { kind: value.scope.kind, id: value.scope.kind === 'project' ? 'project-a' : 'user-a' }, now: now + 1 });
}

describe('Fury Memory Time Machine', () => {
  it('projects Recovery-backed history into digest-only snapshots and deterministic diffs', async () => {
    const { memory } = await fixture();
    const first = candidate(memory, { key: 'project.preference.style', text: 'Original project memory', scope: { kind: 'project', id: 'project-a' } });
    await acceptAndActivate(memory, first, 1_000);
    const before = createFuryMemoryTimeMachine({ memory, now: () => 2_000 });
    const firstSnapshot = await before.snapshot({ scopes: [{ kind: 'project', id: 'project-a' }], now: 1_010 });

    const second = candidate(memory, { key: 'project.preference.style', text: 'Updated project memory', scope: { kind: 'project', id: 'project-a' } });
    await memory.accept({ candidate: second, acceptedBy: 'user-declared', retention: { kind: 'until-revoked' }, visibility: 'project', now: 1_020 });
    await memory.activate({ memoryId: second.memoryId, scope: { kind: 'project', id: 'project-a' }, now: 1_021 });

    const secondSnapshot = await before.snapshot({ scopes: [{ kind: 'project', id: 'project-a' }], now: 1_030 });
    expect(secondSnapshot.timeline.length).toBe(4);
    expect(secondSnapshot.timeline.map((entry) => entry.version)).toEqual([1, 2, 3, 4]);
    expect(JSON.stringify(secondSnapshot)).not.toContain('Original project memory');
    expect(JSON.stringify(secondSnapshot)).not.toContain('Updated project memory');
    expect(secondSnapshot.graph.nodes.some((node) => node.kind === 'source')).toBe(true);

    const change = before.diff({ from: firstSnapshot, to: secondSnapshot });
    expect(change.summary).toEqual({ added: 2, removed: 0, changed: 1 });
    expect(change.changed[0]).toMatchObject({ memoryId: first.memoryId, from: { version: 2 }, to: { version: 4 } });

    const tampered = { ...secondSnapshot, timeline: secondSnapshot.timeline.slice(1) };
    expect(() => before.diff({ from: firstSnapshot, to: tampered })).toThrow('digest does not match');

    const exported = before.exportSnapshot({ snapshot: secondSnapshot, now: 1_031 });
    expect(exported).toMatchObject({ content: 'excluded-by-default', executionAuthority: false });
    expect(exported.snapshot.snapshotDigestSha256).toHaveLength(64);
  });

  it('restores a real prior checkpoint through Memory VNext and never resurrects forgotten state', async () => {
    const { memory } = await fixture();
    const original = candidate(memory, { key: 'project.restore.contract', text: 'Original recoverable value', scope: { kind: 'project', id: 'project-a' } });
    await acceptAndActivate(memory, original, 1_000);
    const changed = candidate(memory, { key: 'project.restore.contract', text: 'Changed value', scope: { kind: 'project', id: 'project-a' } });
    await memory.accept({ candidate: changed, acceptedBy: 'user-declared', retention: { kind: 'until-revoked' }, visibility: 'project', now: 1_020 });
    await memory.activate({ memoryId: changed.memoryId, scope: { kind: 'project', id: 'project-a' }, now: 1_021 });

    const machine = createFuryMemoryTimeMachine({ memory, now: () => 2_000 });
    await expect(machine.executeAction({ action: 'restore', memoryId: original.memoryId, scope: { kind: 'project', id: 'project-a' }, version: 2, confirm: false, now: 1_030 })).rejects.toThrow('confirm: true');
    const restored = await machine.executeAction({ action: 'restore', memoryId: original.memoryId, scope: { kind: 'project', id: 'project-a' }, version: 2, confirm: true, now: 1_030 });
    expect(restored).toMatchObject({ operation: 'restored', fromVersion: 2, version: 5, state: 'active', executionAuthority: false });
    const recalled = await memory.search({ scopes: [{ kind: 'project', id: 'project-a' }], terms: ['memory'], now: 1_031 });
    expect(recalled).toHaveLength(1);
    expect(recalled[0]?.text).toBe('Original recoverable value');

    const archived = await machine.executeAction({ action: 'archive', memoryId: original.memoryId, scope: { kind: 'project', id: 'project-a' }, confirm: true, now: 1_040 });
    expect(archived).toMatchObject({ operation: 'disabled', state: 'disabled' });
    expect(machine.planAction({ action: 'pin', memoryId: original.memoryId, scope: { kind: 'project', id: 'project-a' } })).toMatchObject({ status: 'PLAN_ONLY', requiresExplicitConfirmation: true });
    await expect(machine.executeAction({ action: 'pin', memoryId: original.memoryId, scope: { kind: 'project', id: 'project-a' }, confirm: true })).rejects.toThrow('no canonical persisted authority');
    await expect(machine.executeAction({ action: 'delete', memoryId: original.memoryId, scope: { kind: 'project', id: 'project-a' }, confirm: false })).rejects.toThrow('confirm: true');
  });

  it('links multiple project scopes without leaking raw project identities', async () => {
    const { memory } = await fixture();
    const a = candidate(memory, { key: 'project.shared.fact', text: 'Shared fact A', scope: { kind: 'project', id: 'project-a' }, sourceId: 'shared-conversation' });
    const b = candidate(memory, { key: 'project.shared.fact', text: 'Shared fact B', scope: { kind: 'project', id: 'project-b' }, sourceId: 'shared-conversation' });
    await acceptAndActivate(memory, a, 1_000);
    await memory.accept({ candidate: b, acceptedBy: 'user-declared', retention: { kind: 'until-revoked' }, visibility: 'project', now: 1_000 });
    await memory.activate({ memoryId: b.memoryId, scope: { kind: 'project', id: 'project-b' }, now: 1_001 });

    const machine = createFuryMemoryTimeMachine({ memory, now: () => 2_000 });
    const graph = await machine.graph({ scopes: [{ kind: 'project', id: 'project-a' }, { kind: 'project', id: 'project-b' }], now: 1_010 });
    expect(graph.crossProject).toBe(true);
    expect(graph.nodes.filter((node) => node.kind === 'scope')).toHaveLength(2);
    expect(graph.edges.filter((edge) => edge.relation === 'provenance')).toHaveLength(2);
    expect(JSON.stringify(graph)).not.toContain('project-a');
    expect(JSON.stringify(graph)).not.toContain('project-b');
  });
});
