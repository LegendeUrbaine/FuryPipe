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

## Exact verification evidence

- CI run: 36918897631 — 9/9 matrix legs green; lint, typecheck, tests,
  build, package smoke, reproducibility and audit included.
- Test result: 357 test files, 3,633 tests passed.
- Clean Room run: 36918897721 — Ubuntu/macOS/Windows × Node 22/24/26;
  installed package start, readiness, stop, restart, persistence,
  uninstall/reinstall and Studio API checks pass.
- Windows clean-room artifact:
  furypipe-clean-room-windows-2025-node-24.21.0-41645fbaf90d53277de57df8f63468158ae2e529;
  artifact digest sha256:9ff3a3629010f0587ad32f5f505528a201bd49ef69b1625af425e64133cd427f.
- RC Preparation run: 36918897640; artifact digest
  sha256:66c2be8bd3658786c0844a5327ef9be599db40edf03829377e2a2e06fa152a4a.
- Cross-Browser QA run: 36918897596 — Chromium 153, Firefox 155 and
  WebKit 26.6; Dashboard 117/117 and Studio 120/120, no viewport overflow or
  runtime errors.
- Web Studio QA run: 36918897579 — 16 Chromium screenshots, 6 dispatch
  rows per browser, 0 console errors.
- Accessibility run: 36918897730 — PASS, 0 console errors, 40 focusable
  controls, 0 unnamed controls and 0 heading jumps.
- FuryBench run: 36918897478 — PASS, 3 paired rounds / 25 samples,
  offline-only and no provider performance claim.
- RC package evidence is read from the exact RC artifact attached to the
  candidate workflow; do not copy a digest from another commit.
- Local fixture media is not promoted to exact-head evidence. It remains
  available for deterministic renderer inspection only.

## Release boundary

The candidate remains NOT_READY for unconditional production release because
live provider credentials, hosted integrations, signed non-PR provenance,
protected-branch release integration and production rollback evidence are
external gates. No provider success is fabricated.
