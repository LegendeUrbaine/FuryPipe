import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createFuryExternalEffectLedger,
  digestFuryExternalEffect,
  FuryExternalEffectLedgerError,
} from '../src/fury-external-effect-ledger.js';
import { createRecoveryStore } from '../src/core/recovery-store.js';

describe('Fury external effect ledger', () => {
  it('survives a fresh store instance, blocks replay, and settles only with evidence', async () => {
    const root = await mkdtemp(join(tmpdir(), 'furypipe-external-effect-ledger-'));
    try {
      const effectKeySha256 = digestFuryExternalEffect({ kind: 'coding', command: 'node', args: ['-e', 'work'] });
      const intentSha256 = digestFuryExternalEffect({ policy: 'bounded-local-process' });
      const first = createFuryExternalEffectLedger({
        store: createRecoveryStore(root, { namespace: 'external_effects' }),
        now: () => 100,
      });
      const armed = await first.arm({
        operationId: 'op-first',
        kind: 'coding',
        effectKeySha256,
        intentSha256,
      });
      expect(armed).toMatchObject({ state: 'outcome-unknown', automaticReplayAllowed: false, executionAuthority: false });

      const reopened = createFuryExternalEffectLedger({
        store: createRecoveryStore(root, { namespace: 'external_effects' }),
        now: () => 200,
      });
      expect(await reopened.listOutcomeUnknown()).toEqual([armed]);
      await expect(reopened.arm({
        operationId: 'op-replay',
        kind: 'coding',
        effectKeySha256,
        intentSha256,
      })).rejects.toMatchObject({ code: 'recovery-required' });
      await expect(reopened.settle('op-first', {
        outcome: 'succeeded',
        evidenceSha256: 'not-a-sha',
        confirmation: 'operator-confirmed',
      })).rejects.toBeInstanceOf(FuryExternalEffectLedgerError);

      const settled = await reopened.settle('op-first', {
        outcome: 'succeeded',
        evidenceSha256: 'a'.repeat(64),
        confirmation: 'operator-confirmed',
      });
      expect(settled).toMatchObject({ state: 'terminal', outcome: 'succeeded', resolvedAt: 200 });
      expect(await reopened.listOutcomeUnknown()).toEqual([]);
      const next = await reopened.arm({
        operationId: 'op-after-settlement',
        kind: 'coding',
        effectKeySha256,
        intentSha256,
        now: 201,
      });
      expect(next.operationId).toBe('op-after-settlement');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
