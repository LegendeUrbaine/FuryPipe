# FuryPipe Web — W5 to W8 engineering boundary

**Date:** 2026-09-28
**Track:** `vnext-furypipe-web-foundation`
**Status:** `ENGINEERING_FOUNDATIONS_RECONCILED` / `NO_DEPLOYMENT`

This record closes only the engineering work that can be demonstrated from the
current repository. It does not claim a hosted Web App, a Cloudflare account,
DNS, OAuth, account storage, a remote listener, or production readiness.

## Invariant

```text
Browser Web App
  -> bounded Web API adapter
  -> existing Studio / Gateway authority
  -> governed execution systems
```

The browser remains an untrusted client. It receives neither provider secrets
nor runtime authority. A Web API adapter is not a second permission, session,
provider, MCP, artifact, memory, workflow, or execution system.

## W5 — Local bridge and remote gateway

### Implemented local transport foundation

| Requirement | Current implementation | Status |
| --- | --- | --- |
| Narrow Web access vocabulary | `src/web/web-access-boundary.ts`, `src/web/web-api.ts` | `IMPLEMENTED` |
| Browser secret/runtime exclusion | access plan fields and response/header redaction | `IMPLEMENTED` |
| Loopback-first Gateway transport | `src/gateway-transport-node.ts` | `IMPLEMENTED` |
| Exact browser Origin allowlist | Gateway transport and WebSocket host | `IMPLEMENTED` |
| Session/process-local evidence, TTL and revocation | `src/gateway-session-node.ts` | `IMPLEMENTED` |
| Replay, payload, JSON-depth and in-flight bounds | `src/gateway-transport-node.ts` | `IMPLEMENTED` |
| Rate limit and per-principal connection bounds | `src/gateway-transport-node.ts` | `IMPLEMENTED` |
| Real loopback WebSocket host and safe close behavior | `src/gateway-websocket-host-node.ts` | `IMPLEMENTED` |
| Device pairing/session binding | Gateway pairing and session modules | `IMPLEMENTED` |
| Command admission without execution authority | Gateway command and transport admission | `IMPLEMENTED` |

The default Gateway WebSocket host binds loopback only. Its transport receipt
and command-admission output carry `executionAuthority=false`; an accepted
frame is neither an execution permit nor a successful external effect.

### Deliberate remote boundary

`remote-gateway` in `src/web/web-access-boundary.ts` requires HTTPS and grants
no browser authority. The current real WebSocket host intentionally rejects a
remote bind. There is no configured WSS listener, hosted identity service,
CSRF/session-cookie implementation, durable remote-session store, or
Cloudflare tunnel/relay in this track.

Therefore:

```text
LOCAL_BRIDGE_TRANSPORT_KERNEL = IMPLEMENTED
REMOTE_GATEWAY_HOST = NOT_IMPLEMENTED
REMOTE_GATEWAY_LIVE_READINESS = NOT_PROVEN
```

Remote work may begin only with an approved host design that binds HTTPS/WSS,
authentication, authorization, CSRF, exact Origin validation, short-lived
credentials, device binding, replay defense, rate limits, revocation, audit
receipts, cancellation, recovery, redaction, storage limits, session expiry
and concurrent-session rules to one server-side authority.

## W6 — Accounts and sync

`src/fury-account-connect.ts` launches supported providers' official local
sign-in flows only. `src/fury-account-status.ts` reads bounded status output
from official CLI status commands and never reads browser cookies, OAuth
stores, keychains, or token files. These are provider-account helpers, not a
FuryPipe hosted account system.

`docs/architecture/FURYPIPE_HOSTED_CLOUD_ARCHITECTURE.md` specifies the
required future model: immutable internal account IDs, identity proof for
linking, short-lived rotating sessions, explicit local-device pairing,
capability grants, revocation, and tenant authorization for every object.

```text
ACCOUNT_AND_SYNC_ARCHITECTURE = READY
HOSTED_ACCOUNT_BACKEND = NOT_PROVISIONED
OAUTH_LIVE = CREDENTIALS_REQUIRED
PROJECT_PREFERENCE_SYNC = NOT_IMPLEMENTED
```

No browser-local placeholder is promoted to a server account, and no sync
state is fabricated. A hosted implementation must separately define conflict
resolution, export/delete, recovery, retention, encryption, and tenant scope.

## W7 — Web security and reliability

The existing test suites cover the local boundaries listed below. Their
results are local or CI-contract evidence, not a claim that any deployment is
secure.

| Threat / failure | Current boundary | Evidence family | State |
| --- | --- | --- | --- |
| Origin confusion / local exposure | loopback host checks, exact Origin checks | `tests/node-security.test.ts`, Web/Gateway tests | `PASS_WITH_LIMITS` |
| CSRF-like cross-origin mutation | same-origin POST guard and server session contract | Node and Web API tests | `PASS_WITH_LIMITS` |
| XSS / unsafe framing | nonce CSP, `base-uri`, `frame-ancestors`, no inline handlers | Studio and Node security tests | `PASS_WITH_LIMITS` |
| PWA worker/manifest loading | `manifest-src 'self'`, `worker-src 'self'` | Studio tests and cross-engine QA | `PASS_WITH_LIMITS` |
| Unsafe offline caching | worker caches only the static offline shell; `/api/` is excluded | `src/studio/studio-pwa.ts` tests | `PASS_WITH_LIMITS` |
| Secret/header leakage | explicit request/response header allowlists and redaction | `tests/web-api.test.ts` | `PASS_WITH_LIMITS` |
| Replay/resource exhaustion | sequence, bounded JSON, rate and backpressure controls | Gateway transport tests | `PASS_WITH_LIMITS` |
| SSRF/path escape | existing Studio Web/code/knowledge boundaries | focused Studio/security tests | `PASS_WITH_LIMITS` |
| Session expiry/revocation | Gateway session coordinator revalidation | Gateway session/transport tests | `PASS_WITH_LIMITS` |

Required non-local gates remain:

```text
HUMAN_SCREEN_READER_REVIEW
HOSTED_PENETRATION_TEST
HOSTED_SESSION_AND_CSRF_TEST
DNS_AND_TLS_CONFIGURATION_REVIEW
REMOTE_WSS_AUTHENTICATION_TEST
PRODUCTION_INCIDENT_EXERCISE
```

## W8 — Cloudflare and production preparation

The repository already contains a Cloudflare Worker proxy profile in
`src/worker.ts` and `wrangler.toml`. It is an existing provider-proxy runtime;
it is not a FuryPipe Studio/Web-App deployment configuration. It must not be
relabelled as one.

The future production topology remains:

```text
GitHub PR + exact-head CI
  -> Cloudflare Workers (future Web/API hosting)
  -> Cloudflare DNS/TLS (future domain layer)
```

Conceptual names such as `furypipe.fr`, `app.furypipe.fr`,
`api.furypipe.fr`, `gateway.furypipe.fr`, `docs.furypipe.fr`, and
`status.furypipe.fr` are not asserted as configured or reserved.

### Pre-deployment runbook

1. Create isolated preview and production Worker environments; never reuse a
   preview secret in production.
2. Configure DNS and TLS in the owning Cloudflare account; verify each exact
   hostname, redirect, certificate and HSTS policy from the deployed edge.
3. Keep provider and application secrets in Worker/secret-store bindings,
   never in `wrangler.toml`, browser code, URLs, logs, artifacts, or CI output.
4. Deploy a static/public site separately from authenticated API and Gateway
   surfaces. Set explicit CSP, CORS, cache, cookie and rate-limit policies per
   host.
5. Bind health/readiness, structured redacted observability, alert routing,
   retention, backup/recovery and incident ownership before public traffic.
6. Exercise a preview rollback using immutable deployment identifiers before
   any production deployment. Production rollback remains a human-authorized
   action.
7. Collect exact deployed-version evidence, real browser/device results and
   human accessibility review before claiming readiness.

`docs/RELEASE_READINESS.md` remains authoritative for release evidence. Its
technical evaluator can return `READY_FOR_RELEASE_DECISION`; it does not
authorize merge, tag, publication, or deployment.

```text
CLOUDFLARE_CONFIGURATION = NOT_APPLIED
DNS_TLS = NOT_CONFIGURED_BY_THIS_TRACK
PREVIEW_DEPLOYMENT = NOT_EXECUTED
PRODUCTION_DEPLOYMENT = NOT_EXECUTED
LIVE_CERTIFICATION = BLOCKED_BY_EXTERNAL_GATES
```

## Validation boundary for this record

Before this document is used as track evidence, validate its exact commit with
the repository typecheck, focused/full tests, build, package smoke, and the
required exact-head GitHub workflow matrix. Those gates verify the source and
CI contracts only; they do not upgrade any live gate above.
