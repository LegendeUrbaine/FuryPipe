# FuryPipe Web — W2 Shared Web API

Date: 2026-09-28

Status: IMPLEMENTED / HOSTED CI PENDING

## Purpose

W2 introduces a thin Web API facade that reuses the existing FuryPipe Studio services instead of creating a second authority system.

The browser never receives provider credentials, ambient runtime authority, unrestricted filesystem access, shell access, or direct MCP/provider execution rights.

## Public contract

Prefix:

`/api/web/v1/*`

Implementation:

- `src/web/web-api.ts`
- package export: `furypipe/web-api`

The adapter delegates only allowlisted operations to the existing `createStudioApi(...).handle(...)` boundary.

## Trust rules

Every Web API request must satisfy all of the following:

1. A server-resolved FuryPipe Web session exists.
2. Request `Origin` exactly matches the canonical session origin.
3. The server session grants the route's required scope.
4. `planFuryPipeWebAccess(...)` accepts the mode/origin/scope/action class.
5. Write-class actions require trusted server-side operator approval.
6. POST payloads are `application/json` and bounded to 256 KiB.
7. Browser `Authorization`, `Cookie`, provider headers and other ambient headers are not forwarded into Studio.
8. Shared Studio responses are returned with a reduced safe response-header set and `cache-control: no-store`.
9. No W2 route has action class `execute`.

A browser-provided body or header is never considered operator approval or proof that a server session exists.

## Allowlisted W2 routes

| Web route | Studio route | Scope | Class |
| --- | --- | --- | --- |
| `GET /api/web/v1/models` | `models` | `studio:read` | read |
| `GET /api/web/v1/support` | `support` | `diagnostics:read` | read |
| `GET /api/web/v1/artifacts` | `artifacts` | `artifacts:read` | read |
| `POST /api/web/v1/artifacts/search` | `artifact-search` | `artifacts:read` | read |
| `POST /api/web/v1/artifacts/create` | `artifact-create` | `artifacts:write` | write + approval |
| `GET /api/web/v1/memory` | `memory` | `memory:read` | read |
| `POST /api/web/v1/memory/search` | `memory-search` | `memory:read` | read |
| `GET /api/web/v1/media` | `media` | `media:plan` | read |
| `POST /api/web/v1/media/preview` | `media-preview` | `media:plan` | read |
| `POST /api/web/v1/media/timeline/preview` | `media-timeline-preview` | `media:plan` | read |
| `GET /api/web/v1/observability` | `observability` | `diagnostics:read` | read |
| `POST /api/web/v1/code/edit/plan` | `code-edit-plan` | `code:plan` | read/plan |
| `POST /api/web/v1/code/script/plan` | `code-script-plan` | `code:plan` | read/plan |
| `POST /api/web/v1/workflows/preview` | `flow-preview` | `workflow:read` | read/plan |
| `POST /api/web/v1/workflows/automation-preview` | `flow-automation-preview` | `workflow:read` | read/plan |
| `POST /api/web/v1/chat` | `chat` | `chat:send` | stream |

## Deliberately not exposed in W2

The following remain unavailable from the Web API until a later governed phase provides an explicit safe contract:

- direct provider execution or provider secret access;
- direct MCP add/probe/execute;
- shell or arbitrary process execution;
- unrestricted filesystem access;
- code edit apply / script run;
- runtime installation;
- account login launch;
- browser execution;
- plugin installation or arbitrary plugin execution;
- workflow execution;
- memory writes;
- remote-gateway session creation.

`browser:plan` remains reserved. W2 does not invent a browser planner route merely to claim coverage.

## Session ownership

`FuryPipeWebServerSession` is a server-side object. It must be resolved by the future Local Bridge / Remote Gateway host. The browser cannot self-assert it.

W2 intentionally does not mount remote authentication, cookies, OAuth, WebSocket authentication, device pairing or production CORS. Those belong to the later Local Bridge / Remote Gateway and security phases.

## Evidence

Dedicated tests:

- `tests/web-api.test.ts`
- `tests/web-access-boundary.test.ts`

The tests verify:

- allowlist-only dispatch;
- same-origin enforcement;
- session requirement;
- scope denial;
- remote HTTPS enforcement;
- trusted operator approval for writes;
- JSON-only POST requests;
- 256 KiB body limit;
- ambient auth/cookie stripping;
- response header stripping;
- no direct execute-class route;
- no direct MCP/shell/provider Web route.

## Non-claims

W2 does not claim:

- production deployment;
- production DNS;
- production authentication;
- remote gateway readiness;
- provider credential validation;
- third-party OAuth validation;
- browser execution from the Web App;
- staging validation.

PR #237 must remain OPEN + DRAFT until the broader Web track is explicitly authorized for promotion.
