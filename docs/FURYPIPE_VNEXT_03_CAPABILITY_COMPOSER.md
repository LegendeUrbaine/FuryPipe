# FuryPipe VNext-03 — Capability Composer

## Scope

VNext-03 adds a deterministic `Fury Capability Composer` route above the
existing Capability Autopilot, FuryIR, FuryDispatcher, local Model Fabric,
FuryProof and FuryEval boundaries. It does not introduce a second dispatcher,
MCP registry, Skill Hub or agent runtime.

The route is:

```text
request
  -> intent analysis
  -> capability discovery
  -> compatibility
  -> authority contract
  -> FuryIR
  -> existing FuryDispatcher
  -> confirmation
  -> existing local OpenAI-compatible chat boundary
  -> signed MODEL_RECEIPT + INTEGRATION_RECEIPT
  -> FuryJudge / FuryProof bundle
  -> durable RecoveryStore provenance
```

The first slice is local-only. The Composer admits only reachable local
backends exposing `openai-chat`; it does not use cloud model catalogs, paid
providers, MCP tool invocation or file mutation.

## Authority boundary

Every plan and UI projection carries `executionAuthorized: false`. A plan is
not executable until the operator explicitly confirms it. The execution route
accepts only a persisted plan whose SHA-256 digest verifies, whose state is
`READY_FOR_CONFIRMATION`, and whose selected model is a reachable loopback
OpenAI-compatible local model.

The local runtime request is bounded to one non-streaming completion. Response
bytes and output characters are bounded. No authorization header or cloud
provider credential is added by the Composer.

## Existing systems reused

- Capability Autopilot: index projection, deterministic selection, Skill
  instruction activation, MCP advisory projection and prompt compilation.
- FuryIR: capability decisions, task DAG, budget and human gate validation.
- FuryDispatcher: local-only runtime assignment and compatibility decision.
- FuryLocal Fabric / Model Fabric: reachable local model observation and
  loopback endpoint validation.
- FuryProof: host-signed model/provenance receipts, judgement and bundle.
- RecoveryStore: immutable plan and execution persistence.
- FuryEval: deterministic routing, skill, instruction, provider and agent
  contract metrics for each composed plan.

## Required behavior matrix

| Requirement | Evidence boundary |
| --- | --- |
| A. Local inference | `executeFuryCapabilityComposerLocal` calls the existing local OpenAI-compatible boundary and issues a signed model receipt. |
| B. Skill composition | Autopilot-selected Skill instructions are in the compiled route; activation remains instruction-only. |
| C. MCP composition | MCP candidates are surfaced as advisory metadata; no MCP call is invented or executed by this slice. |
| D. Multi-capability | The persisted route retains selected/blocked capabilities, instructions, skills, MCP, IR, dispatch and evaluation. |
| E. Missing provider | No reachable local model produces `NOT_CONFIGURED`; no fallback cloud call occurs. |
| F. Permission denial | Missing `confirm: true`, blocked dispatch and invalid plan state fail closed. |
| G. Explainability | Stages, reasons, digests, authority state and FuryEval metrics are returned to Studio. |
| H. Persistence | RecoveryStore retains plan and execution records; plan digest is reverified before execution. |

## Acceptance boundary

The owner supplied the final VNext-03 visual acceptance directive for the
Composer presentation. The automated browser packet below is supporting
evidence, not a replacement for that owner decision. Screen-reader validation
remains a separate manual gate.

The visible Composer state matrix is deliberately explicit:

```text
before execution:
  PLAN       / Ready for confirmation
  EXECUTION  / Not started
  FURYPROOF  / Not started

after execution:
  INITIAL PLAN / Ready for confirmation
  EXECUTION    / Completed
  FURYPROOF    / ACCEPT (or the actual returned FuryJudge verdict)
```

The initial plan value is retained after execution. A non-accepted FuryJudge
result is rendered as the returned verdict and is not rewritten as success.

## Reproducible acceptance commands

The live acceptance harness requires an already-installed local Ollama model;
it never downloads one and records `NOT_EXECUTED` when the endpoint or model is
unavailable. For the approved local `qwen3.5:latest` boundary, the execution
request sends a bounded `max_tokens` value and disables Ollama reasoning output
through the OpenAI-compatible `reasoning_effort: "none"` control so the final
answer remains a bounded `content` value.

```text
npm run validation:composer:live
npm run browser:studio:composer:qa
```

The dedicated browser harness captures the Composer state matrix in Chromium
and runs the functional path in Chromium, Firefox and WebKit. The final packet
contains 22 dedicated screenshots covering Simple/Expert disclosure, route
summary before execution, compact stages, grouped capabilities, confirmation
unchecked/checked/pending, genuine Ollama output, structured FuryProof
receipts, raw evidence disclosure, a genuine `NOT_CONFIGURED` runtime card
with no execute/confirm controls, dark/light desktop and 390px mobile
route/confirmation/result/state views. The final four-file owner packet is:

```text
artifacts/vnext03-final-exact-head/furypipe-vnext-03-final-corrections-evidence.zip
```

Its four intended files are the genuine `NOT_CONFIGURED` card, the pre-
execution state matrix, the completed execution state matrix and the mobile
completed execution state matrix. JSON evidence remains local under the same
artifact directory; fixture tests remain separate from live Ollama evidence.
The browser card renders the API's top-level persistence handle as structured
evidence, while raw execution JSON stays inside Expert disclosure. The first
slice still has no genuine multi-tool MCP execution or external mutation
authority.
