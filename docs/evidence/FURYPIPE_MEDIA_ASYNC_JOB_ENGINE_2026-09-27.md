# FuryPipe — Media Async Job Engine Evidence

Status: `DONE CORE / PROVIDER-OPTIONAL / LOCAL-VERIFIED`

Repository: `Mistermode45/FuryPipe`

PR: `#233` — `OPEN + DRAFT + NOT MERGED`

Implementation base: exact tracked branding checkpoint
`8f182c7cde702271bef735bdf91cde6a2f06c822`.
This async tranche is locally verified on top of that checkpoint. Hosted
exact-head validation is tracked separately after its own commit and push;
this document does not promote local proof to hosted proof.

## Implemented boundary

The async layer extends the common provider-neutral media runtime without
creating a second persistence system:

```text
process-local Request/Plan/Permit/ExecutionSession
→ deterministic idempotency seed
→ RecoveryStore bounded job record
→ SUBMITTED / QUEUED / RUNNING
→ bounded poll / reconcile / cancel
→ SUCCEEDED / FAILED / CANCELLED / UNKNOWN
→ governed media ingestion
→ RecoveryStore immutable output reference
→ FuryArtifact recovery:// reference
→ safe job receipt
```

Implemented files:

- `src/media-generation-runtime.ts`
  - async adapter contract: `submit`, `poll`, `cancel`, `fetchResult`,
    `reconcile`;
  - explicit capabilities and lifecycle validation;
  - process-local execution session that keeps prompt and input bytes out of
    durable records;
  - bounded adapter result normalization reused by sync and async paths.
- `src/media-generation-job-engine.ts`
  - atomic `RecoveryStore.putBounded` creation;
  - revision-guarded `RecoveryStore.compactBounded` updates;
  - deterministic idempotency and duplicate suppression;
  - restart reconciliation without blind resubmission;
  - bounded polling with cancellation and timeout states;
  - content-addressed output persistence, governed ingestion and Artifact
    references;
  - safe failure classifications and hashed provider identities.
- `src/media-generation-deterministic-adapter.ts`
  - deterministic test adapter only;
  - queue, running, success, provider failure, cancellation and accepted-but-
    response-unknown scenarios;
  - shared in-memory provider state for restart tests.
- `tests/media-generation-job-engine.test.ts`
  - async queue/poll/finalization;
  - durable record secrecy boundary;
  - idempotency duplicate suppression;
  - unknown submit outcome and fresh-engine recovery;
  - invalid media fail-closed behavior;
  - local/provider-unknown cancellation.

## Studio preview boundary

`src/media-studio.ts` defines bounded FuryImage, FuryVideo and FuryAudio
surfaces. FuryImage additionally exposes capability-driven Provider/AUTO, Model,
aspect ratio, resolution, quality and bounded advanced controls. FuryVideo
exposes capability-driven Provider/AUTO, Model, Reference, duration, FPS, aspect
ratio and resolution controls. `GET
/api/studio/media.json` projects capability observations only;
`POST /api/studio/media/preview` returns digest-only preview evidence. Neither
route invokes a provider, reads credentials, creates a billable job or grants
execution authority. Studio renders these surfaces and a read-only job-history
gallery projection in `src/studio/studio-page.ts`; provider capability
observations remain explicitly unvalidated.

`src/fury-video-timeline.ts` adds a bounded Project → Scene → Shot → Asset
contract with digest-only prompts/titles, duration, transitions, audio asset
references and explicit `REFERENCE_ONLY` generation-job/output-artifact
references. `POST /api/studio/media/timeline/preview` validates and projects
that plan without creating jobs, artifacts or provider authority.

FuryAudio now accepts capability-driven Provider/AUTO, Model, Voice, Language
and bounded Duration controls through the same preview route. The Studio copy
states that microphone capture requires explicit consent; the audio preview
does not invoke providers, capture devices or authorize speaker playback.

`src/fury-observability.ts` now provides the shared evidence-only observability
and cost contract used by the Studio projection. It links request/provider/tool/
MCP/media-job spans, derives latency only from observed timestamps, and keeps
`KNOWN`, `ESTIMATED`, `UNKNOWN`, `NOT_APPLICABLE` and not-recorded cost states
explicit. Only known costs aggregate by comparable `costBasis`. Request, daily,
monthly and workspace budgets become
`UNKNOWN_INCOMPLETE_EVIDENCE` when the evidence cannot prove completeness;
there is no zero-cost fallback. `GET /api/studio/observability.json` is
read-only and returns `NOT_CONFIGURED` without an injected registry.

Browser QA was extended in `scripts/studio-browser-qa.ts` and passed locally on
Chromium, Firefox and WebKit. It covered media navigation, all three surfaces,
the Observability / Cost view, valid image/video/audio previews, timeline
preview, invalid operation rejection, raw-prompt non-leakage and the
responsive no-overflow matrix.
Automated browser rendering is not a human visual/screen-reader sign-off.

The first WebKit attempt exposed a harness timing false negative on the
existing 404 assertion (`visible` was checked before route rendering). The
harness now waits for the heading, and a controlled WebKit rerun passed.

Package exports added:

- `furypipe/media-generation-job-engine`
- `furypipe/media-generation-deterministic-adapter`
- `furypipe/media-studio`
- `furypipe/fury-video-timeline`
- `furypipe/fury-observability`

## Durable safety boundary

Job manifests contain only bounded metadata: job identity, family, operation,
profile/bundle identity, request/plan/idempotency digests, bounded input
digests and sizes, timestamps, attempt/revision/status, trusted progress,
provider-job digest, output references, failure classification digests,
cancellation outcome and receipt handles.

They do not contain API keys, auth headers, provider secrets, raw prompts, raw
media bytes or raw provider job identities. Raw prompt/input bytes stay behind
the process-local execution session and are cleared after dispatch. A provider
submission failure after dispatch is recorded as `UNKNOWN`; it is never
automatically resubmitted. `UNKNOWN` requires explicit reconciliation proof.

## Local verification

- Focused observability/API contracts: `32/32` tests passed.
- Full Vitest suite: `339/339` files passed; `3,565` passed, `6` skipped,
  `3,571` total.
- TypeScript source typecheck: passed.
- Hosted-MCP TypeScript typecheck: passed.
- Build: `node scripts/build.mjs` passed.
- Installed package smoke: `node scripts/package-smoke.mjs` passed and
  produced `furypipe-0.16.0.tgz`.
- `git diff --check`: passed for the current candidate changes.

## Evidence limits

This proves the local runtime contract, deterministic adapter behavior,
RecoveryStore restart semantics and browser-rendered preview-only Studio
surfaces. It does not prove a concrete external provider API, provider
credentials, billable network traffic, provider-side idempotency
implementation, live generation, hosted exact-head CI for this tranche,
human screen-reader/visual sign-off, production deployment or
package release.

No merge, release, tag, npm publish, deploy, auto-merge, force-push or PR
ready-state change was performed.
