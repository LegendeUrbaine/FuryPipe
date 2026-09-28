# FuryPipe CLI/API/headless parity evidence — 2026-09-28

## Scope

This tranche establishes one bounded shared-core boundary across the Studio
API, the stdin CLI and the public package surface. It does not claim complete
parity for every Studio action or a desktop application.

## Implementation

- `src/fury-headless.ts` defines
  `furypipe-headless-request/v1` and `furypipe-headless-response/v1`.
- Supported operations are deliberately limited to existing analysis cores:
  `eval` delegates to `evaluateFuryDataset()` and
  `workflow-automation-plan` delegates to
  `compileFuryWorkflowAutomationPlan()`.
- `src/fury-headless-cli.ts` reads one bounded stdin JSON request, emits one
  JSON response and rejects unknown flags or input larger than 256 KiB.
- `src/node.ts` exposes `furypipe headless [--json]` without starting the
  proxy server.
- Studio exposes `POST /api/studio/headless`; `package.json` exposes
  `furypipe/fury-headless`; both use the same shared core.
- Every response carries `executionAuthorized:false`. No provider, tool,
  browser, filesystem, scheduler or workflow execution is introduced.

## Local proof

- focused headless + Studio API tests: `31/31` passed;
- source TypeScript check: passed;
- hosted-MCP TypeScript check: passed;
- full Vitest: `344` files, `3587` passed, `6` skipped;
- build: passed, version smoke `0.16.0`;
- compiled stdin CLI smoke: passed;
- complete package smoke chain: passed;
- Gateway installed-package smoke: passed with current tarball SHA-256
  `dd79e127cd39e1634041fa916cf7f6903914bae02184b6c4e96e1291c5870b84`;
- installed public export check is included in `scripts/package-smoke.mjs`;

## Limits

This proves only the shared analysis boundary for two operations. Complete
Studio command parity, desktop UI integration, long-running headless service
lifecycle and production deployment behavior remain open.

Status: `PARTIAL_HEADLESS_SHARED_CORE_LOCAL_CONTRACT_VERIFIED`.
