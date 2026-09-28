# ADR: FuryPipe Local Frontend Direction 2026

- Status: Accepted for staged migration
- Date: 2026-09-28
- Scope: FuryPipe Local / Studio UI only
- Does not authorize: merge, release, tag, publish, deploy or production rollout

## Context

FuryPipe already has a server-rendered TypeScript/DOM Studio shell, a nonce-scoped CSP, a loopback-only Node entrypoint, real Studio API routes, project-scoped chat persistence and deterministic cross-browser QA. The product brief asks for a simpler Chat-first interface while preserving governed capabilities.

The frontend must not create a second source of truth for:

- project identity;
- model or provider discovery;
- local runtime detection;
- connection state;
- memory;
- artifacts;
- MCP trust or tools;
- approvals, policy or execution authority.

## Decision

Keep the current server-rendered TypeScript/DOM boundary through UI-0 to UI-5. Refactor the information architecture and interaction surface in small slices. Do not add React, Vite, Tailwind, assistant-ui or an AI SDK in this patch.

If a component migration is approved after UI-0 evidence, use Option A as the target:

- React 19.3;
- Vite 8;
- Tailwind 4.3 used through semantic design tokens;
- Base UI or equivalent unstyled primitives for menus, dialogs, popovers and listboxes;
- shadcn-style composition only where it does not add a second authority.

Assistant UI remains an optional adapter for the conversation surface. It may own presentation primitives after an explicit adapter contract, but it may not replace the FuryPipe API, Fury Auto route authority, Autopilot policy, project stores, approval gates or local runtime.

## Why this decision

The existing shell already proves useful boundaries that a big-bang rewrite would risk losing: nonce CSP, same-origin API use, local route receipts, server-owned data, progressive disclosure and a working browser QA harness. The product goal is an information-architecture correction first. A new frontend build graph is not required to remove the mode selector, reduce daily navigation, add Projects or introduce contextual panels.

Option B is not rejected as a library. It is deferred until its runtime adapter and security boundary are written and tested. Adopting it now would create a high risk of duplicating chat state and incorrectly presenting library runtime concepts as FuryPipe authority.

## Consequences

Positive:

- smallest reversible change;
- no new production dependency or build boundary;
- existing API and stores remain authoritative;
- browser QA can exercise the real generated page immediately;
- migration can retire old markup only after route evidence.

Costs:

- the current page remains a large server-rendered template during the transition;
- some legacy technical route markup stays reachable through contextual paths;
- visual component reuse is less explicit until a later component slice;
- UI-10 must remove unreachable old code after the dependency audit.

## Security and authority invariants

1. Local Studio remains loopback-only at the server boundary.
2. CSP remains nonce-scoped with no new unsafe script or style source.
3. Runtime data is inserted as text or DOM nodes; model, file, artifact, web and MCP content is not trusted HTML.
4. UI visibility never grants capability authority.
5. Meaningful writes, destructive actions, external actions, secret use and publishing preserve explicit approvals.
6. Model, provider, runtime, project and artifact registries remain single-source backend authorities.

## Migration checkpoints

The product migration follows the UI-0 through UI-10 contract in `docs/product/FURYPIPE_LOCAL_AI_INFORMATION_ARCHITECTURE_2026.md`. Each checkpoint requires:

- focused tests;
- relevant browser QA;
- responsive and i18n evidence;
- accessibility scan plus human keyboard review;
- exact branch HEAD and dirty-state evidence;
- a clear list of unperformed runtime, client, provider and production gates.

## Reconsideration triggers

Revisit this ADR only when one of these is proven:

- the existing shell cannot meet a required interaction or accessibility contract without unsafe complexity;
- component-level visual regression cost exceeds the migration cost;
- a real owner and test contract exists for a new frontend build;
  - the adapter contract prevents duplicate authority and preserves the local security boundary.
