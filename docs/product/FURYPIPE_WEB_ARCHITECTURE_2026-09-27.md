# FuryPipe Web — Architecture Foundation (W0)

**Date:** 2026-09-27  
**Track:** `vnext-furypipe-web-foundation`  
**Stacked base:** PR #233 head `fa73f39ea28e9da8384600ef7a842d310dec6ba6` at track creation  
**Status:** W0 foundation — no deployment, no release, no production DNS claim

## 1. Product split

FuryPipe Web is two related surfaces with different trust models:

1. **Public website** — product, docs, downloads, changelog, FuryAI roadmap, creator/about, and future commercial pages.
2. **FuryPipe Web App** — authenticated/authorized access to FuryPipe shared services from a browser.

The public website is not a runtime authority surface. The Web App is a client of governed FuryPipe services; it is not a second implementation of FuryPipe.

## 2. Core architecture invariant

```text
FuryPipe Core / Shared Services
            |
    Governed service boundary
            |
   +--------+--------+--------+
   |        |        |        |
 Studio   Web App    CLI     API/headless
```

Business logic, permissions, provider routing, MCP execution, browser execution, code execution, media execution, memory mutation, artifacts, budgets and receipts remain server/runtime responsibilities.

**The browser never becomes the authority owner.**

## 3. Browser trust boundary

The Web App MUST NOT receive or persist:

- provider API keys;
- MCP secrets;
- raw authorization headers;
- unrestricted shell authority;
- unrestricted filesystem authority;
- raw process permits;
- ambient runtime credentials;
- privileged local bridge secrets in readable client storage.

A Web request can ask a FuryPipe service to plan or perform work. The existing runtime still performs all capability checks, policy checks, approvals, one-shot permit issuance, execution and evidence generation.

A browser-side access plan is therefore evidence only:

```text
executionAuthorized = false
browserReceivesRuntimeAuthority = false
browserReceivesProviderSecrets = false
```

## 4. Initial connection modes

### 4.1 local-bridge

Goal: use `app.furypipe.com`-style UX or a local Web surface to control a FuryPipe runtime installed on the same machine.

W0 rules:

- loopback origin only;
- HTTP is acceptable only on loopback; HTTPS remains valid;
- non-loopback cleartext is rejected;
- server session is mandatory for Web App service requests;
- no provider secret is returned to the browser;
- privileged runtime actions still require FuryPipe-side governance.

Future W5 work must define pairing, origin pinning, CSRF defense, short-lived session credentials, replay protection, device identity and revocation.

### 4.2 remote-gateway

Goal: securely reach a FuryPipe runtime through a remote gateway.

W0 rules:

- HTTPS is mandatory;
- WSS is mandatory for realtime/streaming transports;
- server session is mandatory;
- browser client receives no provider/runtime secret authority;
- user/runtime identity and remote-device authorization must be separate from provider credentials.

Future W5/W6 work must define authenticated tunnel semantics, remote device enrollment, session expiry, revocation, rate limits, audit receipts and recovery.

## 5. Scope model

The first browser-facing scope vocabulary is intentionally narrow:

- `studio:read`
- `chat:send`
- `artifacts:read`
- `artifacts:write`
- `memory:read`
- `code:plan`
- `browser:plan`
- `media:plan`
- `workflow:read`
- `diagnostics:read`

These scopes describe which **service requests** a Web session may submit. They do not grant direct shell, provider, MCP, filesystem or execution authority.

There is deliberately no `shell:direct`, `provider-secret`, `filesystem:direct` or equivalent browser scope.

## 6. Action classes

- `read` — read-only query.
- `stream` — read/stream lifecycle.
- `write` — requests a state change through a governed service.
- `execute` — requests a privileged action plan/execution path.

W0 planner marks `write` and `execute` as requiring operator approval at the Web boundary. Downstream FuryPipe policy may impose stronger requirements; this planner cannot weaken them.

## 7. Origin policy

### local-bridge

Allowed hosts:

- `localhost`
- `127.0.0.1`
- `::1`

Protocols:

- `http:`
- `https:`

### remote-gateway

Protocol:

- `https:` only

Invalid origins, unsupported scopes and missing server sessions fail closed.

## 8. Branding

FuryPipe Web inherits the FuryPipe identity already present on the stacked base:

- brand: FuryPipe;
- creator identity: LégendeUrbaine where appropriate;
- dark-first charcoal/graphite surfaces;
- FuryPipe orange accent;
- accessible light mode;
- centralized monogram/wordmark assets.

The Web track must reuse centralized brand primitives rather than create a divergent logo system.

## 9. Public website target

Planned routes:

```text
/
 /product
 /furyaI
 /developers
 /docs
 /download
 /changelog
 /about
```

Route names are product planning only; no DNS or deployment is claimed by W0.

The public site should remain largely static/cacheable and must not need runtime credentials.

## 10. Web App target

Planned workspace surfaces:

```text
Chat
Code
Research
Image
Video
Audio / Voice
Artifacts
Memory
Agents
Workflows
Skills
MCP
Marketplace
Models
Observability
Settings
```

A surface is exposed only when the underlying shared FuryPipe capability exists and is evidence-backed. No fake controls.

## 11. Remote/local UX principle

The user should be able to see the connection state clearly:

- Local;
- Remote;
- Offline;
- Reconnecting;
- Degraded;
- Unauthorized.

The UI must never silently switch from local to remote provider execution or from one authority domain to another.

## 12. PWA direction

PWA is planned, not implemented by W0.

Future requirements:

- installable shell;
- responsive desktop/tablet/mobile layouts;
- offline static shell where useful;
- no caching of secrets;
- explicit cache rules for user content;
- safe update/rollback semantics;
- background behavior constrained by browser platform policies.

## 13. Streaming

Future Web App transport should support bounded streaming for:

- chat tokens/events;
- agent progress;
- workflow status;
- media job state;
- browser/code task evidence.

Transport details must preserve cancellation, backpressure, reconnect semantics and replay protection.

## 14. Security requirements before remote execution

Remote privileged execution is NOT production-ready until the track has evidence for:

- authentication;
- authorization;
- device/session binding;
- CSRF protections;
- origin validation;
- replay protection;
- WebSocket origin/auth validation;
- short-lived credentials;
- rate limiting;
- audit receipts;
- cancellation;
- recovery/restart;
- secret redaction;
- session revocation;
- browser storage policy.

## 15. Shared-service rule

New Web code should prefer adapters around shared services.

Prohibited architecture pattern:

```text
Studio permission system A
Web permission system B
CLI permission system C
```

Required direction:

```text
shared FuryPipe authority/runtime
             |
        thin adapters
```

## 16. Phases

### W0 — Architecture and trust boundary

- product split;
- topology;
- browser authority invariants;
- initial access-plan contract;
- tests;
- draft stacked PR.

### W1 — Public website foundation

- static product shell;
- official branding;
- accessible responsive navigation;
- product/features/docs/download/about route structure;
- metadata/SEO foundation;
- no runtime secrets.

### W2 — Shared Web API adapter

- reuse Studio/shared services;
- bounded API contracts;
- session/auth abstraction;
- streaming contract;
- error and receipt model.

### W3 — Web Studio

- Chat first;
- adaptive navigation;
- Artifacts;
- Memory;
- capability-aware surfaces;
- no browser-owned provider authority.

### W4 — PWA and responsive hardening

- installability;
- cache policy;
- mobile/tablet;
- offline shell;
- cross-browser QA.

### W5 — Local bridge and remote gateway

- pairing;
- device enrollment;
- tunnel/session security;
- origin/CSRF/replay defenses;
- revocation;
- reconnect/recovery.

### W6 — Account and sync

- optional account model;
- projects/preferences sync;
- explicit data boundaries;
- export/delete;
- privacy controls.

### W7 — Security and reliability hardening

- threat model;
- adversarial tests;
- recovery;
- limits;
- observability;
- accessibility;
- performance.

### W8 — Production readiness

- clean-room;
- hosted/browser matrices;
- human UX gate;
- staging evidence;
- production checklist.

Deployment remains outside this track unless explicitly authorized.

## 17. W0 definition of done

W0 is complete only when:

- architecture document exists;
- browser trust boundary is represented in code;
- tests cover fail-closed origin/session/scope behavior;
- Web plan never grants execution authority;
- branch remains separate from PR #233;
- draft PR is opened;
- CI evidence is inspected on the exact Web-track head.

## 18. Non-goals for W0

W0 does not:

- deploy a website;
- choose a production domain;
- add account providers;
- add a new provider/runtime authority system;
- add arbitrary shell access;
- expose local files directly to browser JavaScript;
- add a frontend framework without evidence it is the correct integration choice;
- merge PR #233;
- merge the Web PR;
- release/tag/publish/deploy FuryPipe.

## 19. Next implementation decision

After W0 exact-head evidence, W1/W2 should evaluate the smallest frontend delivery strategy that can reuse current Studio brand and service contracts without keeping the current monolithic page architecture forever.

The decision must compare at least:

- extending the current zero-framework Studio shell;
- extracting a shared browser client package;
- adopting a component framework/build layer.

The winning choice must be based on bundle/runtime complexity, accessibility, testing, reuse, security boundaries and migration cost—not fashion.
