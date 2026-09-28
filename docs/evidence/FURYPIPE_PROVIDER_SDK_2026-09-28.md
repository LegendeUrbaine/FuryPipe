# FuryPipe Provider SDK evidence — 2026-09-28

## Scope

This tranche adds the provider/model authoring contract required to extend
FuryPipe without coupling Studio code to a provider implementation. It is a
metadata foundation, not a runtime adapter loader.

## Implementation

- `src/fury-provider-sdk.ts`
  - `defineFuryProviderAdapter()` validates bounded provider and model metadata;
  - every modality and capability is explicit: `yes`, `no` or `unknown`;
  - power controls are opt-in declarations: reasoning effort, thinking budget,
    temperature, max tokens, latency profiles, tool use and context strategy;
  - `compileFuryProviderSdkManifest()` emits deterministic, digest-bound
    metadata with `furypipe-provider-sdk-manifest/v1`;
  - no transport callback, credential, network operation, filesystem operation,
    registration mutation or execution authority exists in this SDK.
- `package.json` exposes the public `furypipe/fury-provider-sdk` subpath.
- `scripts/package-smoke.mjs` verifies that export from the packed install.

The existing `Provider Fabric`, `Provider Transport`, `Provider Transport
Health` and `Provider Retry/Fallback` modules remain the runtime authorities.
The Model Hub continues to project their observed truth through its existing
inspection/routing-only surface.

## Local proof

- focused Provider SDK tests: `2/2` passed;
- source TypeScript check: passed;
- hosted-MCP TypeScript check: passed;
- invalid IDs, duplicate models, invalid ranges and missing explicit
  capabilities fail closed in tests.

- full Vitest: `341` files, `3572` passed, `6` skipped;
- build: passed, version smoke `0.16.0`;
- installed package smoke: `furypipe-0.16.0.tgz` passed, including the new
  `furypipe/fury-provider-sdk` export and Gateway/MCP/Phase 6/7/8/provider
  package checks; Gateway installed-package smoke observed SHA-256
  `807b6d74f750fb9c33be057bcfc33212ff838a44831a78d931b770ccf9a64916`;
- Chromium, Firefox and WebKit Studio Browser QA: passed.

## Limits

This does not register a new runtime transport, read provider credentials,
perform live capability detection, implement Studio power-control widgets or
prove provider resilience against real services. Host approval and isolation
remain required before any runtime adapter can execute.

Status: `PARTIAL_PROVIDER_SDK_FOUNDATION_LOCAL_CONTRACT_VERIFIED`.
