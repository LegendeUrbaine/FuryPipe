# FuryPipe Production Finalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the current FuryPipe candidate by repairing reproducible validation defects, adding a real lint gate, and producing exact-HEAD evidence for the existing Studio/media/package workflows.

**Architecture:** Preserve the existing local-first modular monolith and current Video Studio/rendering pipeline. Make validation scripts fail closed and clean up all resources, add lint as a non-formatting static gate over maintained source, then verify the packed artifact and existing media workflow without adding new product surfaces.

**Tech Stack:** Node.js ESM, TypeScript 7, pnpm 10.21.0, Vitest 5, Playwright 1.63, FFmpeg/FFprobe, ESLint flat config.

**Spec:** `docs/product/FURYPIPE_ULTIMATE_MASTER_CONTINUATION_PROMPT_2026-09-26.md` plus the owner mandate supplied in the current conversation.

## Global Constraints

- Do not add Public APIs, APIs.guru, FuryConnect, or unrelated speculative features.
- Preserve existing verified work; do not reset or discard uncommitted changes.
- `DONE`/`PASS` requires fresh evidence on the exact final HEAD; missing provider/browser credentials are `BLOCKED_EXTERNAL`, never fabricated success.
- Existing local-first Studio and Video Studio remain in scope; use the current renderer and artifact/provenance contracts.
- No secrets in code, logs, browser responses, commits, or artifacts.
- Do not merge, release, tag, publish, or deploy until mandatory gates pass on the exact tested commit.
- Public FuryPipe documentation must not introduce legacy product branding; historical audit provenance remains explicitly internal when retained.

## Review Focus

- Missing Playwright binaries: the validation command must fail quickly with an actionable error and must close its HTTP server.
- Browser launch failure before page creation: cleanup must not dereference an uninitialized browser/page.
- Lint scope drift: generated `dist`, artifacts, fixtures, and evaluation data must not make the maintained-source lint gate noisy or non-reproducible.
- Packaged installation: the lint/config changes must not alter the existing packed exports, CLI, headless, MCP, or media contracts.
- External provider absence: deterministic renderer validation must remain distinct from live image/audio/video provider validation.

### Task 1: Harden accessibility validation lifecycle

**Files:**
- Modify: `scripts/accessibility-automation.mjs`
- Test: `tests/accessibility-automation.test.ts`

**Interfaces:**
- Consumes: the existing `pnpm run validation:accessibility` command and Playwright browser resolution.
- Produces: a bounded non-zero failure when the browser executable is unavailable, with `startDashboard()` always closed before process exit.

- [ ] **Step 1: Write the failing subprocess regression test** asserting that an isolated `PLAYWRIGHT_BROWSERS_PATH` with no Chromium exits non-zero within a bounded timeout and leaves no validation report.
- [ ] **Step 2: Run the targeted test and observe the expected timeout/leaked-server failure on the current implementation.**
- [ ] **Step 3: Move browser/page creation inside the guarded lifecycle and make cleanup conditional and unconditional for dashboard/browser/page resources; keep the existing error contract intact.**
- [ ] **Step 4: Run the targeted regression test and the accessibility command; compare exit code, stderr, and cleanup evidence.**
- [ ] **Step 5: Run the full Vitest suite and commit the lifecycle fix.**

### Task 2: Add a maintained-source lint gate

**Files:**
- Create: `eslint.config.mjs`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Test: `tests/lint-contract.test.ts`

**Interfaces:**
- Consumes: `src/**/*.ts`, `scripts/**/*.{ts,mjs}`, and the existing TypeScript/Node runtime conventions.
- Produces: `pnpm lint` with zero errors and zero warnings, excluding generated/build/evaluation output while checking maintained source and tests.

- [ ] **Step 1: Write the failing contract test** asserting the `lint` script exists and the configured command targets maintained source rather than `dist` or `artifacts`.
- [ ] **Step 2: Run the targeted test and observe failure because no `lint` script/config exists.**
- [ ] **Step 3: Add pinned ESLint flat-config dependencies and a minimal non-formatting ruleset compatible with the current TypeScript codebase; add the `lint` package script.**
- [ ] **Step 4: Run `pnpm lint`, fix only genuine maintained-source violations, and preserve behavior.**
- [ ] **Step 5: Run the lint contract, typecheck, full tests, and build; commit the lint gate.**

### Task 3: Validate existing Studio, CLI, headless, and media contracts

**Files:**
- Modify only files required by a reproduced defect in the existing runtime.
- Test: existing focused tests plus exact-head evidence under `artifacts/`.
- Documentation: `docs/product/FURYPIPE_GAP_MATRIX_2026-10-01.md` and a final acceptance report.

**Interfaces:**
- Consumes: existing Studio APIs, FuryVideo timeline/render/QC, `furypipe headless`, `furypipe video`, FFmpeg/FFprobe, and deterministic media fixtures.
- Produces: evidence-backed status for image/audio/video/provider boundaries; no live provider is marked PASS without credentials and an actual response.

- [ ] **Step 1: Run packaged CLI/headless smoke tests and existing Studio browser scripts where the environment supports them.**
- [ ] **Step 2: Execute the FuryCraft promotional render with the existing local renderer and inspect FFprobe metadata, QC, provenance, preview, and export artifacts.**
- [ ] **Step 3: Run focused regression tests for Studio/media/provider error handling; fix any reproducible defect with RED→GREEN TDD.**
- [ ] **Step 4: Update the gap matrix and final acceptance evidence with exact command output and precise external limitations.**

### Task 4: Exact-HEAD release-readiness and delivery decision

**Files:**
- Modify: release/acceptance documentation only as needed to reflect fresh evidence.
- Create: final acceptance report in `artifacts/` or the repository's existing evidence location.

**Interfaces:**
- Consumes: final Git status, exact commit SHA, local gates, GitHub Actions results, package tarball checksum, and existing PR topology.
- Produces: a truthful `READY` or `NOT_READY` decision; push/PR/release operations only after every mandatory gate is verified.

- [ ] **Step 1: Re-run clean install, lint, typecheck, tests, build, package smoke, CLI/headless smoke, security checks, and media QA on one exact HEAD.**
- [ ] **Step 2: Push only the verified branch state and inspect exact-SHA CI; never substitute an older green run.**
- [ ] **Step 3: Reconcile draft PRs and merge/release/deploy only if all mandatory gates and external prerequisites are actually green.**
- [ ] **Step 4: Record exact commit, artifacts, checksums, commands, remaining blockers, and Windows launch procedure.**

---

## Self-review

- Spec coverage: execution stability, lint, packaging, CLI/headless, Studio, media, evidence, security boundaries, and exact-head delivery are covered; postponed features are explicitly excluded.
- Step scan: every implementation task starts with a failing or contract test before production changes; validation-only tasks use existing commands and evidence artifacts.
- Type consistency: Task 1 produces the existing validation command behavior; Task 4 consumes the final evidence only after Tasks 1–3.
- Review focus: all five failure modes are tied to a task-level test or exact command.
- Proportion: this plan fixes current production gates and does not reproduce the full product vision as new work.
