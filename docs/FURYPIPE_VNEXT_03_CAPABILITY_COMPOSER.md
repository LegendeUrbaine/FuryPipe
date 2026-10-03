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

Automated browser and accessibility checks do not equal owner visual approval.
The VNext-03 Composer card remains `HUMAN_VISUAL_GATE=MANUAL_REQUIRED` until
the owner reviews the Simple/Expert Studio presentation. Screen-reader
validation remains a separate manual gate.

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
and runs the functional path in Chromium, Firefox and WebKit. Its 17 screenshots
and JSON evidence remain local under
`artifacts/studio-capability-composer-browser-qa-final/`; fixture tests remain
separate from live Ollama evidence. The first slice still has no genuine
multi-tool MCP execution or external mutation authority.
