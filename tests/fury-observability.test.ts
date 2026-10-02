import { describe, expect, it } from 'vitest';

import {
  FURY_OBSERVABILITY_FORMAT,
  createFuryObservabilityNotConfiguredSnapshot,
  createFuryObservabilityRegistry,
  createFuryObservabilitySnapshot,
} from '../src/fury-observability.js';

const NOW = Date.UTC(2026, 8, 27, 12, 0, 0);

function event(overrides: Record<string, unknown> = {}) {
  return {
    format: FURY_OBSERVABILITY_FORMAT,
    eventId: 'event-root',
    traceId: 'trace-main',
    spanId: 'span-root',
    kind: 'request',
    source: 'studio-request',
    status: 'success',
    startedAt: NOW - 500,
    finishedAt: NOW - 400,
    ...overrides,
  } as const;
}

describe('FuryObservability', () => {
  it('builds digest-only trace, latency, health and cost evidence', () => {
    const snapshot = createFuryObservabilitySnapshot({
      now: () => NOW,
      events: [
        event(),
        event({
          eventId: 'event-provider',
          spanId: 'span-provider',
          parentSpanId: 'span-root',
          kind: 'provider',
          source: 'provider-transport',
          health: 'ready',
          startedAt: NOW - 350,
          finishedAt: NOW - 100,
          cost: { status: 'known', totalUsd: 0.12, costBasis: 'usd/request', source: 'provider-usage', observedAt: NOW - 100 },
        }),
        event({
          eventId: 'event-tool',
          traceId: 'trace-main',
          spanId: 'span-tool',
          parentSpanId: 'span-provider',
          kind: 'tool',
          source: 'tool-runtime',
          status: 'pending',
          health: 'degraded',
          startedAt: NOW - 50,
          finishedAt: undefined,
          cost: { status: 'unknown', reason: 'provider usage not reported' },
        }),
      ],
    });

    expect(snapshot).toMatchObject({
      format: 'furypipe-observability-snapshot/v1',
      state: 'READY',
      authority: 'observed-evidence-only',
      executionAuthority: false,
      counts: { events: 3, traces: 1 },
      latency: { sampleCount: 2, minMs: 100, p50Ms: 100, p95Ms: 250, maxMs: 250 },
      cost: { knownEventCount: 1, unknownEventCount: 1, notRecordedEventCount: 1 },
    });
    expect(snapshot.traces[0]).toMatchObject({ traceId: 'trace-main', eventCount: 3, rootSpanCount: 1, maxDepth: 2 });
    expect(snapshot.cost.knownTotalUsdByBasis).toEqual([{ costBasis: 'usd/request', totalUsd: 0.12, eventCount: 1 }]);
    expect(JSON.stringify(snapshot)).not.toContain('provider usage not reported');
    expect(JSON.stringify(snapshot)).not.toContain('private prompt');
  });

  it('never treats incomplete cost evidence as zero for budgets', () => {
    const snapshot = createFuryObservabilitySnapshot({
      now: () => NOW,
      budgets: [
        { scope: 'request', traceId: 'trace-main', limitUsd: 1, costBasis: 'usd/request' },
        { scope: 'daily', limitUsd: 1, costBasis: 'usd/request' },
        { scope: 'monthly', limitUsd: 1, costBasis: 'usd/request' },
        { scope: 'workspace', limitUsd: 1, costBasis: 'usd/request' },
      ],
      events: [
        event({
          eventId: 'event-known',
          spanId: 'span-known',
          source: 'provider-transport',
          startedAt: NOW - 500,
          finishedAt: NOW - 300,
          cost: { status: 'known', totalUsd: 0.4, costBasis: 'usd/request', source: 'provider-usage', observedAt: NOW - 300 },
        }),
        event({
          eventId: 'event-unknown',
          spanId: 'span-unknown',
          source: 'provider-transport',
          status: 'error',
          startedAt: NOW - 250,
          finishedAt: NOW - 200,
          cost: { status: 'unknown', reason: 'transport did not report usage' },
        }),
      ],
    });

    expect(snapshot.budgets).toHaveLength(4);
    expect(snapshot.budgets.every((budget) => budget.status === 'UNKNOWN_INCOMPLETE_EVIDENCE')).toBe(true);
    expect(snapshot.budgets[0]).toMatchObject({ knownCostUsd: 0.4, knownEventCount: 1, unknownCostEventCount: 1 });
  });

  it('reports exceeded known cost and keeps cost bases separate', () => {
    const snapshot = createFuryObservabilitySnapshot({
      now: () => NOW,
      budgets: [{ scope: 'workspace', limitUsd: 1, costBasis: 'usd/request' }],
      events: [
        event({
          eventId: 'event-one',
          spanId: 'span-one',
          cost: { status: 'known', totalUsd: 1.25, costBasis: 'usd/request', source: 'provider-usage', observedAt: NOW - 100 },
        }),
        event({
          eventId: 'event-two',
          spanId: 'span-two',
          cost: { status: 'known', totalUsd: 9, costBasis: 'tokens/input', source: 'provider-usage', observedAt: NOW - 90 },
        }),
      ],
    });

    expect(snapshot.budgets[0]).toMatchObject({ status: 'EXCEEDED_KNOWN_COST', knownCostUsd: 1.25, mismatchedCostEventCount: 1 });
    expect(snapshot.cost.knownTotalUsdByBasis).toEqual([
      { costBasis: 'tokens/input', totalUsd: 9, eventCount: 1 },
      { costBasis: 'usd/request', totalUsd: 1.25, eventCount: 1 },
    ]);
  });

  it('keeps estimated and not-applicable cost states separate from known cost', () => {
    const snapshot = createFuryObservabilitySnapshot({
      now: () => NOW,
      budgets: [{ scope: 'workspace', limitUsd: 1, costBasis: 'usd/request' }],
      events: [
        event({
          eventId: 'event-estimated',
          spanId: 'span-estimated',
          kind: 'model',
          cost: { status: 'estimated', totalUsd: 0.2, costBasis: 'usd/request', source: 'local-estimator', observedAt: NOW - 100 },
        }),
        event({
          eventId: 'event-not-applicable',
          spanId: 'span-not-applicable',
          kind: 'tool',
          cost: { status: 'not-applicable', reason: 'local tool has no billable provider usage' },
        }),
      ],
    });

    expect(snapshot.cost).toMatchObject({ knownEventCount: 0, estimatedEventCount: 1, unknownEventCount: 0, notApplicableEventCount: 1 });
    expect(snapshot.cost.estimatedTotalUsdByBasis).toEqual([{ costBasis: 'usd/request', totalUsd: 0.2, eventCount: 1 }]);
    expect(snapshot.budgets[0]).toMatchObject({ status: 'UNKNOWN_INCOMPLETE_EVIDENCE', knownCostUsd: 0, estimatedCostEventCount: 1, notApplicableCostEventCount: 1 });
  });

  it('is idempotent for exact evidence and rejects conflicting evidence', () => {
    const registry = createFuryObservabilityRegistry({ now: () => NOW, maxRecords: 1 });
    const first = registry.observe(event());
    expect(registry.observe(event())).toBe(first);
    expect(registry.size()).toBe(1);
    expect(() => registry.observe(event({ source: 'different-source' }))).toThrow(/conflicts/u);
    expect(() => registry.observe(event({ eventId: 'event-overflow', spanId: 'span-overflow' }))).toThrow(/capacity/u);
    expect(registry.remove('event-root')).toBe(true);
    expect(registry.size()).toBe(0);
  });

  it('rejects trace cycles and marks absent observability as not configured', () => {
    expect(() => createFuryObservabilitySnapshot({
      events: [
        event({ parentSpanId: 'span-two' }),
        event({ eventId: 'event-two', spanId: 'span-two', parentSpanId: 'span-root' }),
      ],
    })).toThrow(/cycle/u);
    expect(createFuryObservabilityNotConfiguredSnapshot(() => NOW)).toMatchObject({
      state: 'NOT_CONFIGURED',
      counts: { events: 0, traces: 0 },
      executionAuthority: false,
    });
  });
});
