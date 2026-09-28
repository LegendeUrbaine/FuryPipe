# FuryPipe Local AI UX Research 2026

Status: working design evidence for the staged local interface rebuild.

Checked: 2026-09-28.

## Scope

This document covers the local, loopback-first FuryPipe Studio interface. It does not redefine the FuryPipe API, provider registry, runtime registry, policy engine, model authority, MCP authority, or approval model.

The product question is narrow:

> How can a user state intent once, start with a calm chat, and reach the right project context or governed capability without learning a permanent technical navigation tree?

The interface must remain honest about the execution boundary. A visual affordance is not proof that a provider, runtime, tool, MCP App, agent, media provider, or external action is available.

## Research method

The research combined:

- the existing FuryPipe Studio source, routes, stores, CSP and browser QA harness;
- the current information-architecture constraints in the product brief;
- primary documentation for the candidate frontend and accessibility building blocks;
- real Chromium, Firefox and WebKit browser QA against the generated Studio page;
- a live AccessLint scan of the local page.

This is product and architecture research, not a claim that the full frontend migration is complete.

## Evidence from primary sources

| Area | Evidence | UX consequence |
| --- | --- | --- |
| React | [React 19.3 release notes](https://react.dev/blog/2026/09/09/react-19-3) and [official versions](https://react.dev/versions) document the current React line. | If React is introduced, pin the exact version and keep the migration incremental. Do not replace the backend runtime with a frontend framework. |
| Vite | [Vite 8 announcement](https://vite.dev/blog/announcing-vite8), [supported releases](https://vite.dev/releases) and [migration guide](https://vite.dev/guide/migration) document the current build line and migration boundary. | Vite is a build choice, not a reason to create a second server, API, provider registry or model authority. |
| Tailwind | Tailwind's [official release blog](https://tailwindcss.com/blog) documents the v4.3 line. | Utility CSS can support tokens, but the design system remains semantic and token-driven; utility names must not become the product model. |
| Assistant UI | [ThreadRuntime](https://www.assistant-ui.com/docs/api-reference/runtimes/thread-runtime), [primitives](https://www.assistant-ui.com/docs/primitives), [Composer](https://www.assistant-ui.com/docs/primitives/composer) and [Thread](https://www.assistant-ui.com/docs/primitives/thread) describe composable chat primitives. | Assistant UI is a possible chat-surface accelerator, not a replacement for FuryPipe's local runtime, route explanation, policy gates or project stores. |
| Base UI | [Base UI](https://base-ui.com/) and its [accessibility guidance](https://base-ui.com/react/overview/accessibility) document unstyled accessible primitives. | Use primitives only where they reduce interaction risk. Keep styling, copy, focus policy and approval semantics owned by FuryPipe. |
| MCP Apps | The [MCP Apps announcement](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) and [API overview](https://apps.extensions.modelcontextprotocol.io/api/documents/overview.html) describe interactive tool-linked UI. | MCP Apps are contextual extensions. They must not become permanent top-level navigation or silently gain tool authority. |
| Accessibility | [W3C's WCAG 2.2 changes](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/) cover target size, focus visibility and related requirements. | Automated rules locate mechanical defects; keyboard, focus visibility, zoom, reduced motion and human task completion remain required checks. |

## Candidate decisions

### Option A: React 19.3 + Vite 8 + Tailwind 4.3 + Base UI/shadcn-style primitives

Strengths:

- explicit component boundaries for Chat, Projects, Settings and contextual panels;
- mature composition model for keyboard interactions and local state;
- easy visual regression targeting at component boundaries;
- Base UI can reduce bespoke menu, dialog and listbox defects.

Risks:

- a big-bang replacement would discard a working server-rendered CSP boundary;
- a new build graph can drift from the existing Node entrypoint and API;
- a second model/provider registry could appear if components own data rather than reading the existing API;
- React does not make a tool, provider or external action safe by itself.

### Option B: assistant-ui + Base UI/shadcn primitives

Strengths:

- faster access to thread, composer and message primitives;
- useful if a future chat view needs rich thread branching and runtime adapters;
- composable primitives can preserve the contextual workspace model.

Risks:

- the existing FuryPipe chat protocol, Fury Auto route explanation, Autopilot activity, attachment provenance and local-only boundary still need adapters;
- adopting a runtime abstraction without an explicit authority map can duplicate the backend runtime;
- the library does not decide when a write, network request, MCP action or publish requires approval.

## Decision

For UI-0 through the first migration slices, keep the existing server-rendered TypeScript/DOM shell and its nonce CSP. It already owns the local HTML boundary, calls the real FuryPipe API, and has a cross-browser QA harness. The current patch applies the new information architecture without introducing a parallel frontend authority.

Option A is the target component architecture only if UI-0 evidence justifies a component migration. If that migration starts, Base UI-style primitives are preferred for menus, dialogs, popovers, listboxes and focus handling. Assistant UI may be evaluated for the conversation surface after the FuryPipe adapter contract is written; it is not approved as a backend replacement.

The decision is therefore:

> staged existing shell now; Option A as a controlled future component target; assistant-ui optional at the chat boundary; FuryPipe API and registries remain authoritative.

## Rejected shortcuts

- No separate AI SDK is introduced in place of the FuryPipe backend.
- No fake model, provider, runtime, MCP App, agent activity or media result is added to make a screen look complete.
- No permanent technical sidebar is retained merely because its endpoint exists.
- No visible user modes are used to gate capability discovery.
- No arbitrary shell terminal is placed in the interface.

## Verification boundary

The browser QA harness proves generated DOM, navigation, chat request construction, local route activity, responsive overflow and i18n for its deterministic fixtures. It does not prove a production provider, a real external account, a real MCP App UI, hosted deployment, a physical client, or a production model quality target.

AccessLint was run against the live loopback page at 2026-09-28. The final scan reported zero automated violations for the scanned page. That is a mechanical result, not a complete WCAG or screen-reader certification.
