# FuryPipe Agent SDK evidence — 2026-09-28

## Scope

This tranche closes the local contract part of the master requirements for
agent contracts, explicit agent graphs and message channels. It does not add a
second executor: `AgentRuntime`, `FuryIR`, Dispatcher and Mission Control remain
the runtime authorities.

## Implementation

- `src/fury-agent-sdk.ts`
  - `defineFuryAgentContract()` validates bounded role, goal, inputs, context,
    skills, tools, permissions, budget and output-schema metadata;
  - `compileFuryAgentSdkManifest()` normalizes agents and explicit message
    channels into `furypipe-agent-sdk-manifest/v1`;
  - dependencies are explicit and compile to a deterministic lexical
    topological order plus parallel groups;
  - every message channel must correspond to an explicit dependency, so the
    message bus cannot create an implicit scheduling edge;
  - cycles, duplicate IDs, unknown endpoints, incomplete permissions,
    unbounded budgets and unsafe identifiers fail closed;
  - the manifest digest is deterministic and registration, network,
    filesystem, message dispatch and execution authority remain false.
- `package.json` exposes `furypipe/fury-agent-sdk`.
- `scripts/package-smoke.mjs` verifies the public export from the packed
  installation.

The SDK is metadata-only. It does not register callbacks, load modules, read
credentials, invoke providers/tools/MCP, create workers or persist plaintext
agent goals/results.

## Local proof

- focused Agent SDK tests: `3/3` passed;
- source TypeScript check: passed;
- hosted-MCP TypeScript check: passed;
- inventory JSON parse: passed;
- full Vitest: `342` files, `3575` passed, `6` skipped;
- build: passed, version smoke `0.16.0`;
- packed install export smoke: passed;
- Gateway installed-package smoke: passed with tarball SHA-256
  `c8a24d707a21166172753e5419c04109d0c0dd4d492b802556741e0f8e6deb2a`;
- Phase 6, Phase 7, Phase 8 ACP, benchmark-claim, provider-attempt and
  governed-provider package smokes: passed;
- Studio Browser QA: Chromium, Firefox and WebKit passed.

## Limits

This proves the declarative contract and local deterministic graph only. It
does not prove distributed scheduling, real provider/model execution, live MCP
OAuth account UX, crash recovery of a remote agent worker, hosted exact-head
checks, human client validation or production behavior.

Status: `PARTIAL_AGENT_CONTRACT_LOCAL_VERIFIED`.
