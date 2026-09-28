# Master product doc — sync log

Append-only. Records every product decision taken in the repository that must
be reconciled with the Google Docs master specification
("FuryPipe — Master Product Vision & Completion Specification 2026",
document id `1xZXo7Y-FBZTu0tMhO5WIGEvCCjLRFBn0R9xnnwfSFQo`).

Conflict rule: technical state → GitHub wins; product intent → master doc wins.

| Date (UTC) | Decision | Reason | Commit | Master doc section | Sync status |
|---|---|---|---|---|---|
| 2026-09-25 | Master doc could not be read in this session. | `docs.google.com` is blocked by the session egress proxy (`EGRESS_BLOCKED` on both direct export and WebFetch). No Google Drive connector is attached. | this commit | whole document | NOT_READ — requirements taken from the operator's 2026-09-25 mission prompt only |
| 2026-09-25 | PR #226 (`69e2832`) is frozen as the foundation; new work lives on `claude/furypipe-studio-universal-ai-workspace`. | Mission §8. | this commit | Release / branching | PENDING_SYNC |
| 2026-09-25 | Graphify integrates through a `FuryGraph` provider interface; the Graphify provider reads the real `graphify-out/graph.json` schema observed with graphifyy 0.9.67 (`nodes`, `links` with `relation` and `confidence` EXTRACTED/INFERRED; `GRAPH_REPORT.md`, `graph.html`, `manifest.json`). A native fallback uses the existing `codegraph` indexer. | Mission §41–§49, §113; verified against the installed tool, not assumed. | this commit | FuryGraph | PENDING_SYNC |
| 2026-09-25 | The Completion Spec in `docs/product/FURYPIPE_PRODUCT_COMPLETION_SPEC_2026.md` is the single definition of done for this track; no new numbered phases. | Mission §20–§21. | this commit | Completion criteria | PENDING_SYNC |
| 2026-09-25 | Master doc read in full from the operator's local export (version 2026-09-25, 2 606 lines); it supersedes the NOT_READ entry above for this session. The export itself is not committed (public repository; the operator owns the document). | Operator provided the export after the egress block. | this commit | whole document | READ |
| 2026-09-25 | Harness integration preference aligned to master §15: 1 ACP/official protocol, 2 official SDK/API, 3 A2A, 4 structured CLI, 5 PTY fallback. | §15 | this commit | §15 Universal Harness Hub | SYNCED |
| 2026-09-25 | Harness `authenticated` state (§15) is reported as `not-probed`: FuryPipe must not read another tool's credential stores, and no harness exposes a safe, side-effect-free auth probe that we have verified. Resolution: technical safety wins; revisit per harness when an official status command is verified. | §15 vs §29 (no credential scraping) | this commit | §15 | CONFLICT_DOCUMENTED |
| 2026-09-25 | Completion Spec extended with master-doc items not yet listed: budget modes FAST/BALANCED/QUALITY/BUDGET/LOCAL-FIRST/PRIVATE/CUSTOM (§28), Graphify refresh on changed files (§47.2), predicted vs actual impact for the Judge (§47.5), simple→expert progressive UX (§37). | §28, §37, §47 | this commit | §28/§37/§47 | SYNCED |
| 2026-09-25 | Frontier Lab items (§46: Teleport, Multiverse, Shadow Twin, Epistemic Graph, Collective Cortex, Self-Science, Outcome Loop, Failure Genome, Agent Market, Determinism Envelope, Time Machine, Adaptive Workspace, Trust Fabric, Compute Mesh) stay OPTIONAL/FRONTIER_BET per §48; FuryIR, FuryProof, Intent Kernel, Context Compiler and Zero-Trust state are implemented as core because the dispatcher and judge depend on them. | §46, §48 | this commit | §46 | SYNCED |
| 2026-09-25 | Independent audit, master doc vs Completion Spec vs code. Master items outside the frozen MUST set, recorded as post-closure gaps (not silently dropped): Universal Chat breadth (§7: cloud models inside Studio, attachments/images/audio, compare responses, council, export/import, prompt library, cost/tokens/latency per answer, verify with a second model); cloud Model Fabric selection inside Studio (§14; the governed providers exist in the foundation and are used by Gateway WebChat); Artifact graph (§31); FuryLearning and learned auto-routing (§27, §34: routing scores stay 0 until FuryBench records them); Visual Engine (§24: retained from the foundation, not extended here); Marketplace (§32, SHOULD-02); Voice/realtime (§21, SHOULD-01). | Frozen spec scope (§41). Cloud chat in Studio would make paid calls and needs the governed provider path plus credentials, which this track may not use. | this commit | §7, §14, §21, §24, §27, §31, §32, §34 | GAP_RECORDED |
| 2026-09-25 | Frontier Lab classification refreshed: implemented as core = FuryIR, FuryProof, Intent Kernel, Context Compiler; partial primitives = Time Machine (replay fork), Determinism Envelope (flow zones), Trust Fabric, Zero-Trust Agent State; not started = Teleport, Multiverse, Shadow Twin, Skill Compiler (§46.8), Epistemic Graph, Collective Cortex, Self-Science, Outcome Loop, Failure Genome, Agent Market, Adaptive Workspace, Compute Mesh. None is called a differentiator without a benchmark. | §46, §48 | this commit | §46 | SYNCED |
| 2026-09-25 | Graphify auto-refresh after merge/checkout (§47.2) is not wired: `refreshGraphify` is an explicit API only; SHOULD-04 reclassified PARTIAL. `graphify-out/` at the repository root is git-ignored; only the 60 KB test fixture is committed. | §47.2 | this commit | §47 | SYNCED |
| 2026-09-25 | Harness Hub gains generic ACP and A2A protocol entries (§15 preference 1 and 3) backed by the foundation's ACP/A2A runtimes; they are configured endpoints, never discovered on PATH. | §15 | this commit | §15 | SYNCED |
| 2026-09-25 | Studio UX-01 human verdict REWORK_REQUIRED → reworked as "Fury Lux" (black × orange); UX-01 now PENDING_HUMAN_RETEST. The operator-supplied 21st.dev `claude-style-chat-input` (React/Tailwind/lucide) is ported to a vanilla FuryComposer, not added as a dependency; its fake behaviours (hardcoded Claude models, simulated uploads, prefilled analysis, Thinking toggle) are dropped. `ai-prompt-box` was not received. | Studio is a zero-build page under a nonce CSP; a React/Tailwind build would break that model and grow the npm package. Honesty rule: no simulated capability. | this commit | §37 Progressive UX, §7 Universal Chat | SYNCED |
| 2026-09-26 | Operator supplied the new `FURYPIPE — ULTIMATE MASTER CONTINUATION PROMPT 2026` (347 sections). It is persisted verbatim in `docs/product/FURYPIPE_ULTIMATE_MASTER_CONTINUATION_PROMPT_2026-09-26.md`; the evidence-based machine inventory and gap analysis are `FURYPIPE_CAPABILITY_INVENTORY_2026-09-26.json` and `FURYPIPE_GAP_ANALYSIS_2026-09-26.md`. The 2026-09-25 Completion Spec remains a track closure ledger, not the full future product definition. | Product vision expanded after the 2026-09-25 master document. Preserve existing validated capabilities and converge existing registry/router primitives rather than creating parallel systems. | current continuation track | whole product | SYNCED_TO_REPO |

| 2026-09-26 | Capability Convergence checkpoint: Studio skill/agent routing now consumes the shared Capability Index/Autopilot path; Fury Request Blueprint is process-local/attested; Fury Capability Graph projects and renders request→decision→capability/advisory/blocked relationships without execution authority. FuryGraph remains authoritative for repository/code relationships. | Continue the master continuation spec by converging existing primitives rather than creating a second registry/router/graph. Remaining P1 gaps are recorded in the gap ledger. | implementation checkpoint `42d33f472eaa590bf399521a167c13c5adc96ed6` | Capability Registry / Router / Graph | SYNCED_TO_REPO |

| 2026-09-26 | Capability Convergence closed at the code-contract level: shared Capability Index/Autopilot drives Studio skill/agent/model advisories; MCP/model candidates without runtime authority remain advisory-only; Workspace Graph composes project/repository/files/memory/decisions/artifacts; instruction precedence is deterministic and fail-closed. The next P1 milestone adds FuryPrompt modes/analyzer plus Context Inspector/Context Diff. | This preserves the master continuation rule that selection is not execution, reuses authoritative stores instead of parallel registries, and exposes truth states rather than fabricated capability availability. | continuation checkpoint `808c556d91d06f6af32575c161bf08515e1965c5` | Capability Registry / Router / Graph / FuryPrompt / FuryContext | PENDING_EXACT_HEAD_EVIDENCE |
| 2026-09-26 | P1 Prompt/Context + Skill Creator checkpoint: FuryPrompt exposes nine bounded modes and deterministic analysis; FuryContext exposes truth-state inspection plus deterministic capsule diff; Skill Hub can create validated project-local SKILL.md files from Studio/API with explicit confirmation. Tool declarations remain metadata-only and never widen runtime authority. | Implements the continuation specification without creating parallel prompt/context/skill authority systems. Existing compiler, context capsule, Skill Hub snapshots and runtime policy remain authoritative. | checkpoint `4ab955841ee9e6bc98b0caea6b91d11a7c4a71a4` | FuryPrompt / FuryContext / Skills | PENDING_EXACT_HEAD_EVIDENCE |
| 2026-09-27 | Browser Advanced QA gate closed on source commit `59064a17617696837b554aba046f4237fd9e1a66`: governed upload/submit fixture corrected, hosted Cross-Browser SUCCESS, CI 9/9 SUCCESS, and 13/13 hosted workflows SUCCESS. | The exact-head hosted evidence now covers the Browser Advanced boundary; no provider, human-client or production claim is inferred. | source commit `59064a17617696837b554aba046f4237fd9e1a66` | Browser Advanced / QA-03 | SYNCED_TO_REPO — this documentation commit requires its own exact-head hosted evidence |
| 2026-09-27 | Browser Advanced QA revalidated on implementation commit `96fa90b7a79955eac12ca9c0a1f1d25b06df9353` after the governed host QA began awaiting the asynchronous transport observation; Cross-Browser run `36278188036`, CI 9/9 and 13/13 hosted workflows are SUCCESS, with 31/31 PR checks green. | This is the current implementation checkpoint. The previous source evidence remains historical; no provider, human-client or production claim is inferred. | implementation commit `96fa90b7a79955eac12ca9c0a1f1d25b06df9353` | Browser Advanced / QA-03 | SYNCED_TO_REPO — this documentation candidate requires its own exact-head hosted evidence |
| 2026-09-27 | Common governed Media Generation Runtime added on implementation commit `b1acaeb2b2dca24424627b00d4f854a585d68afe`: image/audio/video request→plan→approval→single-use permit→exact adapter→bounded output→governed media-ingestion→Artifact→receipt/provenance. Focused runtime `10/10`, full Vitest `3,538 passed / 6 skipped`, build/package smoke passed; Cross-Browser `36281026112`, CI `36281026119`, 13/13 workflows and 31/31 PR checks are SUCCESS. | This closes the provider-neutral common runtime foundation without claiming provider credentials, Studio UI, async job recovery, human client validation or production execution. | implementation commit `b1acaeb2b2dca24424627b00d4f854a585d68afe` | Media Generation Runtime / Image Studio / Video Studio / Audio-Voice | SYNCED_TO_REPO — this documentation candidate requires its own exact-head hosted evidence |


## 2026-09-26 — Supply Chain + Marketplace foundation

- Validated implementation SHA: `effbf0312bab129c4940bab3bce7f5d38bb1d5d3`.
- Exact-head evidence on that SHA: 13/13 hosted workflows SUCCESS; CI 9/9; Clean Room 9/9.
- Added detached Ed25519 Supply Chain attestations and public `furypipe/fury-supply-chain` export.
- Added deterministic signed Marketplace manifest/trust/approval-only transition foundation and public `furypipe/fury-marketplace` export.
- Marketplace remains non-executing: no automatic download/install/network/filesystem authority.
- Gap ledger updated from Marketplace NOT_STARTED → PARTIAL FOUNDATION and Supply Chain PARTIAL → DONE CORE / PARTIAL DISTRIBUTION.
- Documentation synchronization commit is newer than the validated implementation SHA and therefore requires its own exact-head hosted evidence before being treated as the final PR checkpoint.
- No merge, tag, release, npm publish or deploy performed.


## 2026-09-26 — FuryEval core

- Added deterministic FuryEval datasets/reports/comparisons for routing, skills, memory and agents.
- Metrics: success rate, precision, recall, F1, optional latency/cost when supplied by observed evidence.
- Dataset identity/version gates comparability; non-comparable reports are not ranked against each other.
- Studio evaluation endpoint is analysis-only and never grants runtime authority.
- Public package export: `furypipe/fury-eval`.
- Remaining work: curated production datasets, longitudinal effectiveness history and UI visualization.
- Status: `IMPLEMENTED_PENDING_EXACT_HEAD`.
- No merge, release, tag, npm publish or deploy performed.


## 2026-09-26 — Graphify lifecycle recommendation

- Added non-executing Graphify lifecycle planning.
- Stale graph or relevant code changes → `RECOMMEND_REFRESH`.
- Missing Graphify output → `USE_NATIVE_FALLBACK`.
- Path traversal inputs are discarded from changed-file consideration.
- Existing explicit `refreshGraphify()` remains the only subprocess boundary.
- No automatic refresh, merge hook, checkout hook or hidden subprocess was introduced.
- Status: `IMPLEMENTED_PENDING_EXACT_HEAD`.
- No merge, release, tag, npm publish or deploy performed.


## 2026-09-26 — Plugin SDK authoring foundation

- Added public non-executing Plugin SDK.
- Reuses the canonical FuryPluginBundle validator; no parallel plugin authority model.
- Produces deterministic secret-redacted manifests with stable digest.
- Environment variable names may be declared; credential values remain absent.
- SDK cannot install packages, connect MCP, invoke providers, load plugin code or mutate the filesystem.
- Remaining work: governed runtime isolation, UI extension lifecycle, compatibility/migration coverage.
- Status: `IMPLEMENTED_PENDING_EXACT_HEAD`.
- No merge, release, tag, npm publish or deploy performed.


## 2026-09-27 — Media async job engine

- Added the provider-neutral async media job contract and bounded lifecycle:
  `CREATED`, `SUBMITTED`, `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`,
  `CANCELLED`, `UNKNOWN`.
- Reused the existing `RecoveryStore` for atomic job creation, revision-guarded
  updates, immutable output references, receipts and restart reconciliation.
- Added deterministic idempotency, duplicate suppression, bounded polling,
  cancellation outcomes and no-blind-resubmit handling for unknown outcomes.
- Added a deterministic test adapter and local tests covering queue/poll,
  restart reconciliation, invalid media, idempotency and cancellation.
- Local proof: 337 Vitest files passed, 3,551 tests passed, 6 skipped; source
  and hosted-MCP typechecks, build and package smoke passed.
- Remaining: concrete provider SDK/credentials/live execution, Studio history
  and artifact UX, hosted exact-head evidence for this tranche, client/provider/
  production validation and release gates.
- Status: `IMPLEMENTED_LOCAL_VERIFIED_ASYNC_PROVIDER_OPTIONAL`.
- No merge, release, tag, npm publish, deploy, auto-merge, force-push or PR
  ready-state change performed.

## 2026-09-27 — FuryImage Studio controls

- Added a provider-optional FuryImage form with `Provider / AUTO`, model,
  aspect ratio, resolution and quality controls.
- Added bounded advanced controls for negative prompt, seed, guidance, steps,
  style and input strength; preview output contains digests only.
- Provider/model choices are derived from registered adapter capability
  observations. With no image adapter, the UI states `No image provider
  configured` and remains preview-only.
- Local proof: focused API/Media Studio tests passed, full suite `337` files /
  `3,552` tests passed with `6` skipped, source and hosted-MCP typechecks,
  build, package smoke and Chromium/Firefox/WebKit Browser QA passed.
- Remaining: live provider SDK/credentials, billable execution, Studio history
  and artifact UX, human visual/screen-reader review and hosted exact-head
  validation for this follow-up.
- Status: `PARTIAL_PREVIEW_ONLY_LOCAL_VERIFIED_PROVIDER_OPTIONAL`.

## 2026-09-27 — Media read-only gallery projection

- Added `GET /api/studio/media/jobs.json` as a read-only projection of the
  existing durable media job engine; no second storage system and no submit
  or provider mutation path were introduced.
- Gallery metadata exposes status, prompt digest, provider/model, output MIME,
  latency, date and provenance artifact IDs. Dimensions, seed and cost remain
  `UNKNOWN` when the durable job contract has no observed value.
- Without a configured job engine, API and UI report `NOT_CONFIGURED` instead
  of presenting a fabricated empty success state.
- Local proof: focused gallery/API tests, full suite `337` files / `3,553`
  tests passed with `6` skipped, source and hosted-MCP typechecks, build,
  package smoke and Chromium/Firefox/WebKit Browser QA passed.
- Remaining: live provider execution, gallery mutation/actions, download or
  export authority, human visual/screen-reader review and hosted exact-head
  validation for this follow-up.
- Status: `PARTIAL_READ_ONLY_LOCAL_VERIFIED_PROVIDER_OPTIONAL`.

## 2026-09-27 — Media Studio preview surface

- Added provider-neutral FuryImage, FuryVideo and FuryAudio Studio surfaces
  with bounded operation/MIME controls and a digest-only preview route.
- Preview authority is explicit: no provider invocation, credentials, billable
  generation or execution permit is created by the Studio surface.
- Browser QA now covers valid/invalid media previews, raw-prompt non-leakage,
  responsive overflow and all three engines: Chromium, Firefox and WebKit
  passed locally. A screenshot was inspected; no human screen-reader sign-off
  is inferred.
- Remaining: concrete provider SDK/credentials/live execution, Studio history
  and artifact UX, hosted exact-head evidence for this tranche,
  production/client release gates.
- Status: `PARTIAL_PREVIEW_ONLY_LOCAL_VERIFIED_PROVIDER_OPTIONAL`.
- No merge, release, tag, npm publish, deploy, auto-merge, force-push or PR
  ready-state change performed.

## 2026-09-27 — FuryVideo Studio controls

- Added a capability-driven FuryVideo form with `Provider / AUTO`, model,
  reference, duration, FPS, aspect ratio and resolution controls.
- Video controls use the existing governed media preview boundary and the same
  async job engine contract; no second queue or provider execution path was
  introduced. Preview output remains digest-only and does not expose the raw
  prompt or reference.
- Local proof: focused API/Media Studio tests `30` passed, full suite `337`
  files / `3,554` tests passed with `6` skipped, source and hosted-MCP
  typechecks, build, package smoke and Chromium/Firefox/WebKit Browser QA
  passed.
- Remaining: live video provider SDK/credentials, billable generation,
  storyboard/timeline, Helios integration, queue recovery, human
  visual/screen-reader review and hosted exact-head validation for this
  follow-up.
- Status: `PARTIAL_PREVIEW_ONLY_LOCAL_VERIFIED_PROVIDER_OPTIONAL`.
- No merge, release, tag, npm publish, deploy, auto-merge, force-push or PR
  ready-state change performed.

## 2026-09-27 — FuryVideo storyboard/timeline foundation

- Added a bounded Project → Scene → Shot → Asset contract with prompt/title
  digests, duration, transitions and audio asset references.
- Added explicit `REFERENCE_ONLY` generation-job and output-artifact links;
  `POST /api/studio/media/timeline/preview` validates and returns a digest-only
  plan without creating jobs, artifacts, provider calls or execution authority.
- Local proof: focused storyboard/API tests `27` passed, full suite `338`
  files / `3,557` tests passed with `6` skipped, source and hosted-MCP
  typechecks, build, package smoke and Chromium/Firefox/WebKit Browser QA
  passed.
- Remaining: dedicated timeline editor/rendering/playback, live provider
  execution, queue recovery, artifact mutation/download authority, human
  visual/screen-reader review and hosted exact-head validation for this
  follow-up.
- Status: `PARTIAL_PREVIEW_ONLY_LOCAL_VERIFIED_PROVIDER_OPTIONAL`.
- No merge, release, tag, npm publish, deploy, auto-merge, force-push or PR
  ready-state change performed.

## 2026-09-27 — FuryAudio / Voice Studio preview controls

- Added capability-driven FuryAudio controls for `Provider / AUTO`, model,
  voice, language and bounded duration on the existing Media Studio preview
  route.
- Preview explicitly does not call a provider, capture a microphone or
  authorize speaker playback. Existing STT/TTS, realtime voice and device
  capture contracts remain separate permission/permit boundaries.
- Local proof: focused Media Studio/API tests `32` passed, full suite `338`
  files / `3,558` tests passed with `6` skipped, source and hosted-MCP
  typechecks, build, package smoke and Chromium/Firefox/WebKit Browser QA
  passed.
- Remaining: live provider execution, client microphone/device permission UX,
  real streaming/VAD/interruption validation, recovery, human
  visual/screen-reader review and hosted exact-head validation for this
  follow-up.
- Status: `PARTIAL_AUDIO_PREVIEW_ONLY_LOCAL_VERIFIED_PROVIDER_OPTIONAL`.
- No merge, release, tag, npm publish, deploy, auto-merge, force-push or PR
  ready-state change performed.

## 2026-09-27 — FuryObservability / Cost evidence contract

- Added `src/fury-observability.ts` as one bounded, evidence-only registry for
  request/provider/tool/MCP/media-job events. It links trace parents without
  retaining prompts, responses, credentials or provider payloads.
- Latency is derived only from observed start/finish timestamps. Cost states
  remain explicit as `KNOWN`, `ESTIMATED`, `UNKNOWN` and `NOT_APPLICABLE`; only
  `KNOWN` values aggregate inside the same explicit `costBasis`. Missing,
  estimated, unknown and incomparable evidence remain visible and are never
  coerced to zero.
- Request, daily, monthly and workspace budget views are fail-closed:
  `EXCEEDED_KNOWN_COST` is reported when known evidence exceeds the limit;
  otherwise incomplete evidence yields `UNKNOWN_INCOMPLETE_EVIDENCE`.
- Added the read-only `GET /api/studio/observability.json` projection and a
  Studio Observability / Cost view. With no injected registry it reports
  `NOT_CONFIGURED`, not fabricated empty telemetry. The route does not execute
  providers, mutate jobs or authorize actions.
- Local proof: focused observability/API tests `32/32` passed; source
  typecheck and `git diff --check` passed. Full suite: `339` files,
  `3,565` passed, `6` skipped. Source and hosted-MCP typechecks, build,
  installed package smoke and Chromium/Firefox/WebKit Browser QA passed on
  this exact local candidate.
- Remaining: live provider/tool/MCP telemetry adapters, provider billing
  reconciliation, self-healing diagnostics, human visual/screen-reader review,
  hosted exact-head validation and production/client gates.
- Status: `PARTIAL_OBSERVABILITY_COST_LOCAL_CONTRACT_VERIFIED`.
- No merge, release, tag, npm publish, deploy, auto-merge, force-push or PR
  ready-state change performed.

## 2026-09-27 — FuryMemory Time Machine

- Reused the existing encrypted `RecoveryStore` through Memory VNext; no
  second memory store or browser-only persistence was introduced.
- Added bounded Memory VNext `history()` and explicit `restore()` operations.
  Restore reads an existing immutable checkpoint and appends a new governed
  version. Forgotten records, current checkpoints, revoked sources and
  expired TTL checkpoints are rejected.
- Added digest-only timeline/checkpoints, tamper-checked deterministic
  snapshot diff, metadata-only export and scope → memory → source
  cross-project graph projection in `src/fury-memory-time-machine.ts`.
- Studio adds read-only Time Machine, metadata export, diff route, explicit
  restore confirmation and governed archive/delete action plans. `pin` is
  visibly `PLAN_ONLY` because no canonical persisted pin authority exists.
- Local proof: focused Memory VNext / Time Machine / Studio API contracts
  `35/35`; full Vitest `340` files / `3,568` passed / `6` skipped; source and
  hosted-MCP typechecks; build; installed package smoke; Chromium/Firefox/
  WebKit Browser QA.
- Remaining: persistent pin schema, cross-process/hosted authorization,
  recall/false-memory evaluation, migration coverage, human client review,
  hosted exact-head validation and production/client gates.
- Status: `PARTIAL_MEMORY_TIME_MACHINE_LOCAL_CONTRACT_VERIFIED`.
- No merge, release, tag, npm publish, deploy, auto-merge, force-push or PR
  ready-state change performed.

## 2026-09-27 — FuryMarketplace control plane

- Reconciled Marketplace against the continuation roadmap: catalog, source
  hash, detached signature, license, trust, compatibility, permissions,
  approval and lifecycle plan contracts are now represented in the existing
  `src/fury-marketplace.ts` authority.
- Manifest signing and verification recompute the metadata digest. Forged
  capability or permission metadata with a stale declared digest is rejected.
- Added bounded metadata-only catalog and supplied-byte source verification.
  DOWNLOAD / VERIFY / INSTALL / UPDATE / ROLLBACK / UNINSTALL remain plans;
  no network fetch, filesystem mutation or package execution is introduced.
- Studio adds a read-only Marketplace route/view. Empty catalog is explicit
  when no signed catalog is injected; no availability is fabricated.
- Local proof: Marketplace/Studio focused `31/31`; full Vitest `340` files /
  `3,569` passed / `6` skipped; source and hosted-MCP typechecks, build,
  installed package smoke and Chromium/Firefox/WebKit Browser QA passed.
- Status: `PARTIAL_MARKETPLACE_CONTROL_PLANE_LOCAL_CONTRACT_VERIFIED`.
- Remaining: persistent catalog, real downloader, isolated installer,
  compatibility host matrix, rollback executor, human review and hosted
  exact-head evidence.
- No merge, release, tag, npm publish, deploy, auto-merge, force-push or PR
  ready-state change performed.

## 2026-09-28 — FuryGraph explicit refresh receipt

- Extended the existing Graphify lifecycle planner with a deterministic,
  metadata-only refresh plan and success/failure receipt. The plan requires
  `confirm: true`; the execution boundary revalidates the absolute root and
  command, uses `shell: false`, and enforces a timeout of at most one hour.
- Added Studio `POST /api/studio/graph/lifecycle` and
  `POST /api/studio/graph/refresh` routes. The refresh route rejects absent
  approval and preserves a bounded failure receipt in its 502 response; no
  route performs automatic post-merge, post-checkout or background refresh.
- Hardened the lifecycle route against `null` JSON bodies and kept native
  fallback explicit when Graphify is unavailable.
- Focused local proof: Graphify/Studio API `38/38`; full Vitest `340` files /
  `3,570` passed / `6` skipped; source and hosted-MCP typechecks; build
  version smoke `0.16.0`; installed package smoke including Gateway, MCP,
  Phase 6/7/8, benchmark-claim, provider-attempt and governed-provider
  checks; Gateway smoke tarball SHA-256
  `6fed695656ebbc31ea5503da9c2fc536dc2608d2d986684495b353167a4738fa`;
  Chromium/Firefox/WebKit Browser QA.
- Status: `PARTIAL_GRAPHIFY_LIFECYCLE_LOCAL_CONTRACT_VERIFIED`.
- Remaining: automatic approval-bearing integration hook, host-specific
  Graphify installation/runtime proof, hosted exact-head validation, and
  human/client/production gates.
- No merge, release, tag, npm publish, deploy, auto-merge, force-push or PR
  ready-state change performed.

## 2026-09-28 — FuryPipe Provider SDK authoring foundation

- Added public `furypipe/fury-provider-sdk` metadata-only authoring contracts
  for providers and models. The contract requires explicit `yes` / `no` /
  `unknown` modality and capability values and carries only power controls the
  provider declares.
- `compileFuryProviderSdkManifest()` produces a deterministic SHA-256 digest;
  registration, network, filesystem and execution authority remain false.
  Existing Provider Fabric, Transport, Health and Retry/Fallback modules remain
  the only runtime authorities; no provider call or credential read was added.
- Remaining: host-approved runtime adapter registration/isolation, Studio
  power-control UX backed by real evidence, and live provider/resilience proof.
- Local proof: focused Provider SDK `2/2`; full Vitest `341` files / `3,572`
  passed / `6` skipped; source and hosted-MCP typechecks; build version smoke
  `0.16.0`; installed package smoke including the new public export, Gateway,
  MCP, Phase 6/7/8, benchmark-claim, provider-attempt and governed-provider
  checks; Gateway smoke tarball SHA-256
  `807b6d74f750fb9c33be057bcfc33212ff838a44831a78d931b770ccf9a64916`;
  Chromium/Firefox/WebKit Browser QA.
- Status: `PARTIAL_PROVIDER_SDK_FOUNDATION_LOCAL_CONTRACT_VERIFIED`.
- No merge, release, tag, npm publish, deploy, auto-merge, force-push or PR
  ready-state change performed.

## 2026-09-28 — FuryPipe Agent SDK contract foundation

- Added public `furypipe/fury-agent-sdk` metadata-only contracts for the
  master agent contract fields: role, goal, inputs, context, skills, tools,
  permissions, budget and output schema.
- Added deterministic dependency-DAG compilation, lexical topological order,
  parallel groups and explicit message channels. A channel without a matching
  declared dependency is rejected, preventing implicit scheduling edges.
- The SDK has no callback registration, module loading, credential access,
  network/filesystem operation or execution authority. Existing Agent Runtime,
  FuryIR and Mission Control remain authoritative.
- Machine inventory and gap analysis now record the locally verified Agent
  contract state; Model Hub stale reconciliation is also recorded.
- Local proof: focused Agent SDK `3/3`; full Vitest `342` files / `3,575`
  passed / `6` skipped; source and hosted-MCP typechecks; inventory JSON parse;
  build version smoke `0.16.0`; packed export smoke; Gateway installed-package
  smoke with tarball SHA-256
  `c8a24d707a21166172753e5419c04109d0c0dd4d492b802556741e0f8e6deb2a`;
  Phase 6/7/8 ACP, benchmark-claim, provider-attempt and governed-provider
  package smokes; Chromium/Firefox/WebKit Studio Browser QA.
- Hosted exact-head evidence, distributed worker behavior, live provider/MCP
  execution and human/client/production gates remain unproven.
- No merge, release, tag, npm publish, deploy, auto-merge, force-push or PR
  ready-state change performed.
