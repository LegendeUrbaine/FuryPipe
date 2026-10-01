# FuryPipe Reality Gap Matrix

Evidence is from the finalization branch and exact-head local checks. `PASS` means a bounded current contract is exercised; `PARTIAL` means a real subset exists and the missing boundary is explicit; `BLOCKED` means the gate could not run in this environment.

| Feature | Expected | Current evidence | Status | Action / limitation |
| --- | --- | --- | --- | --- |
| Chat | Studio conversation and tools | Existing Studio runtime and chat API tests | PASS | Continue provider-specific live checks when credentials exist |
| Models / model routing | Provider abstraction and observable routing | Existing model fabric and routing tests | PASS | Cloud model health depends on configured provider |
| Skills / auto skill routing | Discover and select relevant skills | Existing skill hub plus video skill selection evidence | PASS | Video skills are local workflow metadata, not an external installer |
| MCP | Discoverable, permission-aware, failure-isolated | Existing MCP hub/API/security tests | PASS | External MCP availability is environment-dependent |
| Instructions | Context-bounded selection | Existing instruction ledger/routing tests | PASS | No video model prompt is claimed as installed |
| Agents / subagents | Governed agent runtime | Existing agent fabric/runtime tests | PASS | Live provider invocation is config-dependent |
| Memory | Durable retrieval and artifact references | Existing memory/runtime tests | PASS | Video recipe persistence is project-local; graph sync remains separate |
| Graphify | Enrichment with fallback | Existing lifecycle/fallback tests | PASS | Graphify is optional and never a render dependency |
| Caveman | Output mode | Existing routing tests | PASS | Does not reduce internal validation |
| Studio | Usable central UI | Studio build/navigation/API tests; Video view integrated; current browser script reached the launch gate | PARTIAL | Exact-head browser run is blocked here: Playwright Chromium executable is unavailable; prior screenshots are not re-used as current proof |
| Browser / computer | Upload/navigation/download/recovery | `validation:accessibility` and `browser:studio:qa` fail fast with the explicit missing Chromium executable | BLOCKED | Run the same scripts in CI/Windows with Chromium installed; no current human-review claim is made |
| Coding / research | Core workflows | Existing repository and research boundaries | PASS | Live credentials/tools vary |
| Headless | Workflow without UI | Eval/automation plus video-render async boundary tests | PASS | Video path requires local FFmpeg/FFprobe |
| CLI | Help and supported operations | Node entrypoint and `video` CLI tests | PASS | GitHub install/push not authenticated |
| FuryEval | Regression metrics | Existing evaluator plus checked-in video dataset | PASS | Dataset is deterministic contract evidence, not aesthetic scoring |
| Artifacts | Discoverable typed evidence | Core artifact runtime plus video artifact manifests | PASS | Global artifact indexing remains existing subsystem |
| Image | Generation/processing | Existing media generation subsystem/tests and deterministic local contracts | PARTIAL | No live image-provider credential/response was available for this exact-head run |
| Audio | TTS/ASR/music | Provider slots and audio mix plan exist | PARTIAL | No cleared local French TTS/ASR/music provider installed |
| Video | Real import/timeline/render/QC | FuryCraft OPPrison fixture rendered to `/workspace/scratch/furypipe-finalization-artifacts-2026-10-01/workspace/furycraft-opprison-final-2026/renders/final.mp4`; 30s, 1080x1920, 30fps, H.264/AAC, decode/QC PASS; timeline describes the actual sequential render segments | PASS | Semantic scene understanding and generative providers are optional and explicit |
| Video director | Creative planning and repair loop | Storyboard, three hook variants, recipe, policy, QC loop | PARTIAL | Built-in director is deterministic; AI semantic director is optional |
| Approvals / permits | Plan → approval → bounded execution | Existing permit architecture plus video `confirm` boundary | PASS | End-user approval remains required |
| Receipts / provenance | No fake values | Render receipt and provenance persisted | PASS | Unknown model fields remain `unknown` |
| Provider management | Health, license, availability | Video provider registry and doctor | PASS | Optional providers remain non-default until cleared |
| Settings / doctor | Runtime health and safe diagnostics | Core doctor plus FFmpeg/FFprobe checks | PASS | GPU/model inventory is not fully surfaced by local video doctor |
| Security | Path, command, body, secret controls | Existing security tests plus manifest path/hash/size confinement, symlink-destination rejection, immutable re-ingest, and cancellation regressions | PASS | Browser console evidence and external-provider security remain blocked/configuration-dependent |

## Exact-head finalization evidence

- `pnpm lint`: PASS; maintained `src`, `scripts`, and `tests` are checked with zero warnings.
- `pnpm typecheck`: PASS; both the main and hosted-MCP TypeScript projects pass.
- `pnpm test -- --reporter=dot`: PASS; 357 test files / 3,633 tests on the current correction set.
- `pnpm build`: PASS; `dist/node.js`, `dist/mcp.js`, declarations, and version smoke emitted successfully.
- `pnpm run package:smoke`: PASS; all Gateway, MCP, ACP, memory, provider, installed-package, and public-export contracts passed. Tarball: `furypipe-0.16.0.tgz`, 6,032,439 bytes, SHA-256 `8d4c7199a022eacccdf1c6ba8c8acfd793078ab1f9a7b2e0c0d413d3296305bb`.
- `validation:local-contracts`: PASS; 21 files / 186 tests.
- `validation:recovery`: PASS; real subprocess kill, durable state, migration interruption and temporary-file cleanup. Automatic replay remains denied; directory fsync is not claimed.
- `validation:gateway`: PASS; local auth boundary, reconnect, restart and stale-origin denial.
- `validation:clean-room`: PASS; installed-package-only setup, doctor, migration, start, restart, rollback and uninstall/reinstall in isolated home/config/data.
- `validation:package-reproducibility`: PASS; source-bound package identity, 760 files, 0 unknown modes, 0 CR files, tarball SHA above.
- `supply-chain-evidence`: PASS locally; 305 components, 356 dependency edges, 305 licensed, 0 unknown licenses, CycloneDX 1.6. Evidence is unsigned until CI/release signing is available.
- `pnpm audit --prod --audit-level high`: PASS; no known vulnerabilities found.
- `validation:furybench`: INCONCLUSIVE on the final local runner. Exact-source runs on `e19d672` and `88e1d656` passed; a later run on the documentation-only successor `57d4c776` reported one `taskPlan` p95 regression. No runtime files differ between those two candidates; keep the performance gate open for a controlled CI/Windows runner. Offline process-boundary benchmark only.
- `node dist/node.js --version`: PASS (`0.16.0`).
- `node dist/node.js headless --json` with a workflow request: PASS; machine-readable response, `executionAuthorized: false`.
- Invalid CLI/headless/video commands: PASS; exit code `2` with actionable errors.
- `node dist/node.js video doctor --json`: PASS; FFmpeg/FFprobe `6.1.1`, status `READY`.
- Video regression tests: PASS; targeted video engine/workflow checks 13/13, including symlinked destination rejection and immutable re-ingest.
- FuryCraft local render: PASS; receipt, provenance, captions, MP4, preview PNG, and QC report are under `/workspace/scratch/furypipe-finalization-artifacts-2026-10-01/`. Final MP4: 30.000 s, 1080×1920, 30 fps, H.264/AAC 48 kHz stereo, 213,073 bytes, SHA-256 `cc5feab0999b96aa33f3aea414eecb878fa9973a9497c1b12cceef586d1a7ddd`, FFmpeg decode exit `0`, QC `PASS`, 14 files.
- Live image/audio/provider generation: not claimed; no configured credential or real provider response was available.
