# FuryPipe Local AI Information Architecture 2026

Status: staged implementation contract for FuryPipe Local.

## Product model

The interface starts with user intent, not with a catalogue of capabilities.

The default mental model is:

1. state what needs to happen;
2. let Fury Auto choose from real available, detected and configured models;
3. add project context only when it helps;
4. reveal a contextual workspace when the task needs code, research, media, artifacts or agent activity;
5. keep meaningful writes, destructive actions, external actions and secrets behind explicit approval.

Fury Auto is a presentation and selection layer. It does not grant execution authority and does not replace the existing FuryPipe model, provider, runtime or policy registries.

## Daily shell

The permanent sidebar contains only:

- Chat;
- Projects;
- Recent conversations;
- Search / command palette;
- Settings.

New chat remains an action in the shell. Technical surfaces are not deleted; they are reachable through contextual workspaces, `Ctrl+K`, `@`, `/`, context menus and Settings.

The removed daily categories are not user modes and are not silently reintroduced under another name. Media, Autopilot, Work, Code, Agents, Automations, Knowledge, Web, Memory, Models, Connections, Control Center, Runtimes, Observability, Marketplace, Skills, MCP, Extensions, Artifacts and Integrations are contextual or settings surfaces.

## Chat

Chat is the home surface. The empty state is short and calm. When no real local AI is ready, it shows one compact configuration path to Settings → AI & models; it does not present a permanent setup card with competing provider choices.

The default composer contains:

- `+` for attachments and contextual additions;
- `Fury Auto`;
- send.

Web sources, indexed knowledge, voice input and contextual workspaces appear from `+` only when supported. Reasoning effort is `AUTO` by default and is configured outside the composer.

Streaming preserves scroll position when the reader is already near the bottom. Assistant output is mostly borderless. User messages use a quiet surface. Code blocks expose language metadata and copy. Attachments expose compact provenance chips.

## Projects

Projects are the local container for:

- current working directory / repository context;
- discussions;
- files and indexed sources;
- artifacts;
- memory scope;
- governed runs;
- automations and decisions when those stores exist.

The Projects view is intentionally simple. It reads the existing chat and artifact stores. It does not create another persistence authority or duplicate project identity.

## Fury Auto

The Fury Auto picker is compact in Chat. Opening it shows only real candidates returned by the existing local discovery and model registry paths:

- Fury Auto;
- reachable local models;
- fit and provider metadata already observed by FuryPipe;
- a governed connection path when cloud models are configured.

“Detected” is not “authenticated”, and “configured” is not “live verified”. The UI must preserve those distinctions.

## Command palette

`Ctrl+K` is the technical discovery surface. It can open Projects, models, connections, contextual workspaces, developer evidence and Settings. Search results must use the existing route IDs and must not imply that opening a view grants authority.

Power users can also use `@`, `/`, context menus and Settings → Developer. There is no Expert Mode, Advanced Mode or replacement mode.

## Settings

Settings categories:

- General;
- Appearance;
- AI & models;
- Memory;
- Privacy;
- Tools & extensions;
- Developer;
- About.

Models, Connections and local runtimes share AI & models. Developer evidence includes Code, Observability, Mission Control and the existing Control Plane. The daily shell remains unchanged when these settings are used.

## Contextual workspaces

Contextual workspaces are optional right-side panels or focused routes:

| Trigger | Surface | Boundary |
| --- | --- | --- |
| coding request | Code | files, diff, checks and governed edits; no arbitrary terminal |
| source-heavy question | Research | Web and indexed knowledge; provenance and network policy remain visible |
| output creation | Artifact / Media | versioned outputs and preview receipts; no fake provider execution |
| active governed run | Agent activity | real run state, approvals and receipts only |
| MCP capability need | MCP App panel | explicit tool identity, origin and approval policy |

No panel claims completion merely because its shell exists. Empty, unavailable, blocked and preview-only states are explicit.

## Approval UX

- safe reads and local presentation may be automatic when already permitted;
- meaningful writes require an explicit plan or approval according to the existing policy;
- destructive actions, external actions, secret use, publishing and network-sensitive operations require explicit confirmation;
- cancellation remains a denial, not an implicit approval.

## Internationalisation

The product has complete English and French copy for the new shell, empty Chat state, Projects, Settings categories and contextual entry points. Technical identifiers and existing runtime labels remain in their project language where required.

## Migration contract

The staged migration is:

- **UI-0 Recon:** freeze the actual routes, stores, CSP, model authority and visual baseline.
- **UI-1 Shell:** reduce daily navigation to Chat, Projects, Recent, Search and Settings.
- **UI-2 Chat:** remove modes, visible effort and permanent quick-action cards; preserve real chat and route activity.
- **UI-3 Projects:** expose the current project container using existing stores.
- **UI-4 Settings:** move AI, tools and developer discovery into explicit categories.
- **UI-5 Context:** add optional Code, Research, Artifact, Media and Agent panels.
- **UI-6 Model UX:** make Fury Auto reflect real model evidence without duplicating registries.
- **UI-7 Safety and accessibility:** verify CSP, approvals, keyboard, focus, reduced motion and target sizing.
- **UI-8 QA:** run Chromium, Firefox, WebKit, responsive, i18n, static a11y and visual captures.
- **UI-9 Handoff:** update research, IA, design-system and architecture documents; record exact-head evidence.
- **UI-10 Retirement:** remove unreachable old navigation code only after route and browser evidence proves no dependency remains.

This implementation is not a release, merge, deployment or production certification.
