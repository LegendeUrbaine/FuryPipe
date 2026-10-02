# FuryPipe — Final security audit

Date: 2026-09-28

Audited runtime/source head: `770f354731b264771e27bd71df08500c642c38f4`

Branch: `codex/pr233-finalization`

PR: #233 — `OPEN / DRAFT / NOT MERGED`

## Decision

`LOCAL_SECURITY_AUDIT = PASS_WITH_LIMITS`

No authority bypass, secret-bearing headless response, unbounded headless
input, or new execution path was found in the audited source head. The
headless tranche is analysis-only: it reuses FuryEval and the workflow-plan
compiler, accepts exactly one bounded request shape, and keeps execution and
workflow registration disabled.

This is not a claim of exploit immunity, production security, or universal
provider safety. Hosted checks, real credentials, external DNS behavior,
operator configuration, Windows ACL enforcement and production deployment
remain separate boundaries.

## Required audit surfaces

| Surface | Local evidence | Result / limit |
| --- | --- | --- |
| Authority bypass | `src/fury-headless.ts`, `src/fury-eval.ts`, `src/fury-workflow-sdk.ts`; `tests/fury-headless.test.ts`, `tests/fury-eval.test.ts`, `tests/fury-workflow-sdk.test.ts` | `PASS` for the audited analysis boundaries; no execution, registration or scheduling authority is returned. Other runtime authorities remain independently governed. |
| Duplicate authority systems | Headless delegates to existing FuryEval/workflow cores; Gateway trigger normalization remains the source of truth | `PASS` for this tranche; full parity across every Studio surface is still a product gap. |
| SSRF | `src/fury-web.ts`, `src/fury-local-fabric.ts`, `src/browser-runtime.ts`, `src/browser-playwright-host-node.ts`; corresponding negative tests | `PASS` local coverage for private addresses, redirects, loopback/metadata and bounded responses; no arbitrary external target was exercised. |
| DNS rebinding | Browser/Web validation resolves and revalidates bounded addresses; redirect paths are manual and rechecked | `PASS` local contract coverage; not a guarantee against every host/network race outside the process. |
| Path traversal | Coding runtime, ACP capability runtime and project-confined Studio paths | `PASS` local traversal rejection; tests cover lexical escape, UNC/device forms and project boundaries. |
| Symlink escape | Realpath-confinement paths in browser, coding and knowledge boundaries | `PASS` local symlink/junction coverage; host filesystem and ACL behavior remain environment-dependent. |
| Command injection | ACP command allowlists, bounded args/env/cwd, harness restrictions and no implicit shell authority | `PASS` local tests; configured child processes are fixtures, not arbitrary production commands. |
| Plugin escalation | `src/fury-plugin-sandbox-node.ts`, `src/agent-plugin-inspector.ts`, plugin/skill tests | `PASS` fail-closed zero-authority and secret-name-only contracts; governed runtime loading remains separately scoped. |
| MCP poisoning | MCP policy, trust, schema and hosted-fixture conformance tests | `PASS` local contract coverage; no untrusted third-party MCP server or OAuth account was certified here. |
| Prompt injection | `src/context-prompt-injection.ts`, `src/fury-prompt.ts`, memory/ACP untrusted-content tests | `PASS` structural/data-versus-instruction boundaries; semantic injection resistance is not absolute. |
| Secret exfiltration | Secret-safe ACP, Studio, memory, provider, media and gateway tests; targeted Git scan found no high-confidence private-key/token pattern | `PASS` for tested redaction and metadata boundaries; local Gitleaks binary was unavailable, while hosted Secret Scan/Gitleaks passed for the exact audited head. |
| Media abuse | Media generation, ingestion, device capture and voice authorization tests | `PASS` local bounds, MIME checks, buffer clearing, consent and one-shot permit coverage; real provider/media devices were not used. |
| Permit replay | Browser, ACP, media, provider and MCP replay tests | `PASS` local one-shot/process-local binding; no cross-process production authorization claim. |
| Stale state | Provider health, capability signals, gateway sessions, media leases and recovery tests | `PASS` stale/expired evidence is rejected in tested paths; distributed clock/process behavior remains outside local proof. |
| Unknown provider outcome | Provider attempt/stream and media/ACP adapter failure tests | `PASS` post-dispatch uncertainty is classified unknown and not retry-safe; no real provider billing outcome was observed. |
| Unbounded loops | Agent concurrency/append bounds, MCP replay bounds, workflow validation and local contract tests | `PASS` bounded local paths; exhaustive denial-of-service analysis is not claimed. |
| Unbounded storage | Recovery Store, agent memory, provider ledger, continuous memory and media bounds | `PASS` tested quotas/limits; physical power-loss durability and operator filesystem policy remain limits. |

## Exact-head proof

Commands and results executed against the audited source:

- Full Vitest: `344 files / 3587 passed / 6 skipped`, exit `0`.
- Security-focused Vitest: `12 files / 127 passed`, exit `0`.
- Local contracts: `21 files / 186 passed`, exit `0`.
- Direct dependency audit with the real pnpm `10.21.0` binary: `No known vulnerabilities found`.
- GitHub Actions pinning: `93 action references / 22 workflows`, `PASS`.
- TypeScript source and hosted-MCP typechecks: `PASS`.
- Build: `0.16.0`, `PASS`.
- Packed artifact and installed Gateway/MCP/package smoke chain: `PASS`; tarball SHA-256 `dd79e127cd39e1634041fa916cf7f6903914bae02184b6c4e96e1291c5870b84`.
- Hosted exact-head checks for `770f3547`: CI matrix, Cross-Browser, Dashboard Browser, Web Studio Browser, Accessibility, Clean Room, Recovery, Upgrade/Rollback, FuryBench, Local Contracts, RC Evidence and Secret Scan all reported `PASS`.

The repository `pnpm run audit` wrapper itself could not run because the
machine's global pnpm shim recursively points at itself. The equivalent direct
pnpm audit command passed; this environment defect is recorded separately and
is not promoted to a workflow failure.

## Remaining limits

- No merge, release, tag, npm publish, deploy, force-push or auto-merge was performed.
- PR #233 remains `OPEN / DRAFT / NOT MERGED`.
- Real provider credentials, external OAuth, third-party MCP, production DNS,
  staging, production and human visual/screen-reader approval remain unverified.
- Browser/hosted PASS proves the exact CI fixture and workflow boundaries; it
  does not prove every arbitrary deployment topology.
