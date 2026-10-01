# FuryPipe reality gap matrix

This matrix is the bounded product status for the current release-candidate
validation. Exact commit, package digest and workflow artifacts are recorded by
the RC Preparation and CI runs; this document does not replace those
source-bound artifacts.

| Feature | Evidence-backed status | Boundary |
| --- | --- | --- |
| Chat | PASS | Installed local Studio chat persistence and API contracts pass; live provider inference remains external. |
| Models / model routing | PARTIAL | Routing, capability detection and fallback contracts pass; live provider health/auth are not configured here. |
| Skills / auto skill routing | PASS | Discovery, selection, activation and permission-boundary contracts pass. |
| MCP | PARTIAL | Local/installed MCP discovery, policy and stdio contracts pass; third-party hosted MCP was not executed. |
| Instructions | PASS | Instruction ledger and capability routing contracts pass. |
| Agents / subagents | PARTIAL | Governed runtime contracts pass; live provider-backed execution is not configured. |
| Memory | PASS | Persistence/retrieval/restart contracts pass within the local encrypted-store scope. |
| Graphify | PASS | Lifecycle, fallback and retrieval integration contracts pass; Graphify remains optional. |
| Caveman | PASS | Output-mode routing is covered; it does not reduce internal validation. |
| Studio | PASS | Installed-package clean-room proves furypipe start serves / and /studio plus /api/studio/*; automated browser QA passes. |
| Browser / computer | PASS | Chromium/Firefox/WebKit autonomous QA and accessibility automation pass; no human visual or screen-reader claim is made. |
| Coding / research | PASS | Local bounded repository and research surfaces pass their contracts. |
| Headless | PASS | CLI/headless contract and machine-readable output pass. |
| CLI | PASS | Help, invalid-input exits, setup/doctor, package bin and port-conflict paths pass. |
| FuryEval | PASS | Deterministic evaluator and regression fixtures pass. |
| Artifacts | PASS | Typed artifact/provenance manifests and local repository contracts pass. |
| Image | BLOCKED_EXTERNAL | Deterministic media contracts pass; no real image-provider credential/response was available. |
| Audio | BLOCKED_EXTERNAL | Audio contracts exist; no cleared real TTS/ASR/music provider was available. |
| Video | PARTIAL | Local renderer/timeline/QC contracts pass and a fixture render exists, but the recorded MP4 was produced from an earlier local source commit, not the final RC HEAD. |
| Video render | PASS | Renderer, cancellation, duration, aspect-ratio and MP4 contract tests pass. |
| Video QC | PASS | ffprobe/decode and quality-gate contracts pass on fixture media. |
| Provider management | PARTIAL | Provider registry, policy and failure classification pass; live credentials and external health are absent. |
| Settings / doctor | PASS | Safe diagnostics and invalid-configuration handling pass. |
| Security | PASS within verified scope | Secret scan, audit, path/SSRF, command, body-size, loopback and permission-boundary checks pass. |
| Build / typecheck / lint / tests | PASS | CI exact-candidate matrix passes: 357 files and 3,633 tests, with lint, typecheck and build. |
| Packaging / installation | PASS | RC tarball, reproducibility, installed-package clean-room and Windows 2025 Node 24/22/26 jobs pass. |
| Documentation | PASS | Canonical repository links, release state and external limitations are stated without a false publication claim. |

## Verification evidence

- CI: the exact candidate matrix passes lint, typecheck, tests, build, package
  smoke, reproducibility and audit on the supported OS/Node matrix.
- Tests: 357 test files and 3,633 tests passed on the candidate validation.
- Clean Room: installed-package start, readiness, stop, restart, persistence,
  uninstall/reinstall and Studio API checks pass on Ubuntu, macOS and Windows
  across Node 22, 24 and 26.
- RC Preparation: the artifact is source-bound to the candidate commit and
  contains the package tarball, installation smoke, upgrade/rollback evidence,
  SBOM and release-readiness JSON. Read the SHA-256, byte count and artifact
  digest from that exact workflow artifact; never copy them from an older run.
- Cross-Browser QA: Chromium, Firefox and WebKit matrices pass for Dashboard
  and Studio with no viewport overflow or runtime errors.
- Web Studio QA: the installed local route and browser surface pass; screenshots
  are autonomous QA evidence, not human visual acceptance.
- Accessibility: automated focus, naming, heading and console-error checks pass.
- FuryBench: bounded offline comparison passes; no provider performance claim is
  made.
- Local fixture media remains deterministic renderer evidence only. It is not
  promoted to exact-head generative-provider evidence.

## Release boundary

The candidate remains NOT_READY for unconditional production release because
live provider credentials, hosted integrations, signed non-PR provenance,
protected-branch release integration and production rollback evidence are
external gates. No provider success is fabricated.
