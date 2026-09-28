# FuryPipe Graphify lifecycle evidence — 2026-09-28

## Scope

This tranche closes the governed Graphify lifecycle boundary requested by the
continuation roadmap:

- stale-output detection and relevant source-change recommendation;
- explicit native fallback when Graphify is unavailable;
- deterministic refresh plan with an absolute root and bounded timeout;
- explicit `confirm: true` approval before subprocess execution;
- metadata-only success/failure receipt with plan and command digests;
- Studio lifecycle and refresh routes.

## Implementation

- `src/fury-graph.ts`
  - `planGraphifyLifecycle()` keeps refresh recommendation and native fallback
    non-authorizing;
  - `planGraphifyRefresh()` emits `furypipe-graph-refresh-plan/v1`;
  - `executeGraphifyRefresh()` rejects missing approval, revalidates the plan,
    uses `execFile(..., { shell: false })`, bounds the timeout to `1..3600000`
    ms, and returns `furypipe-graph-refresh-receipt/v1`;
  - `refreshGraphify()` remains the compatibility wrapper and stays explicit.
- `src/studio/studio-api.ts`
  - `POST /api/studio/graph/lifecycle` returns the recommendation plan;
  - `POST /api/studio/graph/refresh` rejects absent confirmation and returns
    the plan plus receipt after an approved refresh, including a bounded
    failure receipt in the 502 response.

No route automatically invokes refresh after a patch, merge, checkout or
background timer. No network, LLM, provider credential or package execution
is introduced by this boundary.

## Local proof

- focused Graphify + Studio API tests: `38/38` passed;
- source TypeScript check: passed;
- hosted-MCP TypeScript check: passed;
- Chromium, Firefox and WebKit Studio Browser QA: passed;
- full Vitest: `340` files, `3570` passed, `6` skipped;
- build: passed, version smoke `0.16.0`;
- installed package smoke: `furypipe-0.16.0.tgz` passed, including Gateway,
  MCP, Phase 6/7/8, benchmark-claim, provider-attempt and governed-provider
  package checks; Gateway installed-package smoke observed SHA-256
  `6fed695656ebbc31ea5503da9c2fc536dc2608d2d986684495b353167a4738fa`.

## Limits

This is local contract and browser proof. It is not hosted exact-head proof,
client visual approval, production Graphify execution, post-merge/checkout
automation proof or a claim that Graphify is installed on every host.

Status: `PARTIAL_GRAPHIFY_LIFECYCLE_LOCAL_CONTRACT_VERIFIED`.
