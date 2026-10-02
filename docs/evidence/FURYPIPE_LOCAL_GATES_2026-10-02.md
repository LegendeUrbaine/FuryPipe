# FuryPipe — Local Gates Evidence — 2026-10-02

## Provenance

- Worktree: `C:\Users\loicd\.codex\worktrees\furypipe-production-finalization\FuryPipe`
- Branch: `codex/furypipe-production-finalization-2026`
- Source head verified before this evidence patch: `6f250b6acbf511d99e19b2637adb167a83af381e`
- Candidate version: `0.16.0`
- Platform: Windows x64, Node `v26.8.2`
- Project package manager: `pnpm@10.21.0`
- No production endpoint, paid provider, OAuth account, hosted MCP, OpenClaw, Figma, npm publish, release, merge, tag or deploy was used.

## Change closed by this pass

`scripts/validation-command.mjs` now marks the Windows `corepack.cmd` path as
`shell: true`. Node rejects a Windows `.cmd` shim with `shell: false` using
`EINVAL`; the validation runner therefore could not execute its own pinned
package manager on this host. The arguments are assembled by repository
validation scripts. `tests/validation-command.test.ts` covers the Windows
resolver contract. No runtime product authority or provider path changed.

## Local gates

| Gate | Result | Evidence |
|---|---|---|
| Focused resolver test | PASS | `1` file, `3/3` tests |
| Full test suite | PASS | `359` files, `3,638` passed, `6` skipped, `3,644` total |
| Typecheck | PASS | main TypeScript + hosted MCP project |
| Lint | PASS | ESLint with `--max-warnings 0` |
| Build | PASS | library/declarations, `dist/node.js`, `dist/mcp.js`, version `0.16.0` |
| Installed package smoke | PASS | Gateway, MCP stdio, phases 6–8, benchmark/provider governed smokes |
| Package tarball | PASS | `furypipe-0.16.0.tgz`, SHA-256 `4038f2d166b4c09efa08aba55faaadff17e8479cfb7942854cb377f7e7ae3058` |
| Clean-room package | PASS | isolated home/config/data, setup, doctor, migration, task plan, start, restart, rollback, reinstall |
| Package reproducibility | PASS | content digest `e65b7d409dff3ed98bb48645887323b0d052903ab4cc8087834a6a921a24b4dd` |
| Upgrade and rollback | PASS | exact source `6f250b6a`; previous `v0.15.0`; config migration/rollback, binary rollback, restart and user-owned state preservation |
| FuryBench | PASS on rerun | 3 paired rounds, 25 samples/metric, p95 threshold `×1.25`; first run observed a Windows process-boundary regression, rerun passed all rounds; neither result was hidden |
| Production dependency audit | PASS | direct pnpm `10.21.0` invocation: `No known vulnerabilities found` |
| Supply-chain evidence | PASS | CycloneDX `1.6`, `305` components, `356` dependency edges, signing `UNSIGNED` |
| Document summary | NOT_CONFIGURED | no explicitly configured local model/base URL; no fixture promoted to inference evidence |

## Browser and hosted boundaries

The previously recorded local browser suites remain separate evidence: Dashboard
`117/117`, Web Studio `120/120`, WebChat `15/15`, browser host `12/12` on the
recorded engines. The source patch in this pass only changes validation command
resolution. Hosted CI must still be read again after the final commit SHA; an
older green run is not promoted automatically.

Provider-live, OAuth/OIDC, hosted MCP, OpenClaw, Figma, human visual review,
screen-reader review, production deployment and production rollback remain
`NOT_EXECUTED` or `NOT_VERIFIED`. The package rollback proof is not a
production rollback proof.

## Read-only architecture reference

DeepSeek Harness was inspected read-only at its public repository. Its own
safety notice calls the project experimental, unaudited and not production
ready. Its architecture documents describe plugin composition, append-only
session history, guarded tool waterfalls, approval/guard ordering and explicit
outcome handling. These observations remain reference material only; no
DeepSeek Harness code, plugin or speculative architecture was copied into
FuryPipe.

## Release decision

`LOCAL_FIRST_PACKAGE_READY` for the proven local slice.

Public release remains `BLOCKED_EXTERNAL` by the still-open Draft PR/review,
release provenance/attestation, npm ownership/metadata confirmation, external
provider and hosted integration evidence, and human/client acceptance.
