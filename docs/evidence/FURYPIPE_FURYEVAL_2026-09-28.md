# FuryPipe FuryEval evidence — 2026-09-28

## Scope

This tranche extends the existing evaluation-only engine to the full domain
taxonomy named by the continuation roadmap and adds explicit provenance for a
caller-supplied evaluation history. It does not execute a model, provider,
browser, media job, MCP server or agent.

## Implementation

- `src/fury-eval.ts` now supports these bounded domains:
  `routing`, `skills`, `instructions`, `memory`, `agents`, `browser`,
  `providers`, `media`, `cost` and `context`.
- Reports now carry both `datasetDigestSha256` and a deterministic
  `resultDigestSha256`.
- A dataset may provide `history.commit`, `history.environment` and
  `history.timestamp`. Commit syntax, unknown keys, control characters and
  invalid timestamps fail closed. Missing provenance stays explicit as
  `null`; no current time, Git state or environment is inferred.
- Reports expose the normalized history entry with dataset digest, result
  digest and overall metrics. Comparisons expose both baseline/candidate
  result digests while preserving the existing comparability gate.
- `executionAuthorized:false` remains present on every report and comparison.

## Local proof

- focused FuryEval + Studio API tests: `34/34` passed;
- source TypeScript check: passed;
- hosted-MCP TypeScript check: passed;
- capability inventory JSON parse: passed;
- full Vitest: `343` files, `3583` passed, `6` skipped;
- build: passed, version smoke `0.16.0`;
- complete `package:smoke`: passed, including the packed FuryEval export,
  Gateway installed package, MCP, Phase 6/7/8 ACP, benchmark-claim,
  provider-attempt and governed-provider checks;
- current Gateway installed-package tarball SHA-256:
  `af52bbd352bfbefa0396adf12fd3a322c0942c70c3ae700805ffa1517e070f7d`.

## Limits

The domain-coverage cases are deterministic contract fixtures, not measured
provider, browser, media or production outcomes. Curated versioned real-world
datasets, a durable longitudinal history store, human review and hosted
exact-head validation remain open.

Status: `PARTIAL_EVAL_DOMAIN_HISTORY_LOCAL_CONTRACT_VERIFIED`.
