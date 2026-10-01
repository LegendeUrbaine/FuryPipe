# FuryPipe workflow automation evidence — 2026-09-28

## Scope

This tranche closes the local contract gap between `FuryFlow` and the
existing Gateway automation trigger boundary. It adds an inspectable plan;
it does not add a second scheduler or workflow executor.

## Implementation

- `src/fury-workflow-sdk.ts`
  - compiles a validated `FuryFlow` trigger into
    `furypipe-workflow-automation-plan/v1`;
  - delegates interval, cron and webhook normalization to the existing
    Gateway trigger contract rather than duplicating scheduler rules;
  - emits the workflow digest, trigger node, normalized trigger and a
    deterministic plan SHA-256;
  - fails closed on invalid interval bounds, invalid time zones, missing
    webhook source IDs and unknown trigger keys;
  - declares `registrationAuthorized:false` and `executionAuthorized:false`.
- `POST /api/studio/flow-automation-preview` exposes the plan through the
  loopback Studio API and returns `422` for unschedulable trigger metadata.
- `package.json` and `scripts/package-smoke.mjs` expose and verify the public
  `furypipe/fury-workflow-sdk` package subpath.
- Studio architecture, capability inventory, gap analysis and master sync now
  record the partial locally verified state.

The route and SDK do not persist definitions, register schedules, invoke
webhooks, dispatch runs, execute flow nodes, read credentials or create
network/filesystem authority.

## Local proof

- focused workflow SDK tests: `5/5` passed;
- Studio API tests: `27/27` passed, including valid and invalid automation
  preview requests;
- source TypeScript check: passed;
- hosted-MCP TypeScript check: passed;
- capability inventory JSON parse: passed;
- full Vitest: `343` files, `3581` passed, `6` skipped;
- build: passed, version smoke `0.16.0`;
- packed package smoke: passed, including `furypipe/fury-workflow-sdk`;
- complete `package:smoke`: passed, including Gateway installed package,
  MCP, Phase 6/7/8 ACP, benchmark-claim, provider-attempt and governed-
  provider checks;
- current Gateway installed-package tarball SHA-256:
  `e9ee1fc15a87b510cedfaef30d175ad2db8ba0b1c9868227978c802ae105fe52`.

## Limits

This proves the local declarative contract and installed public export. It
does not prove durable automation registration, scheduler persistence,
workflow execution, crash recovery, real webhook/cron delivery, hosted
exact-head checks, current browser/client rendering after this tranche, or
production behavior. Browser QA was not repeated because the roadmap marks
Browser and Media Runtime as already completed intermediate work.

Status: `PARTIAL_WORKFLOW_AUTOMATION_LOCAL_CONTRACT_VERIFIED`.
