# FuryPipe Web W4 — local Studio PWA boundary

## Status

`LOCAL_PWA_SHELL_IMPLEMENTED`

This is engineering preparation for the loopback FuryPipe Studio. It does not
claim a hosted Web application, a configured domain, or a production deployment.

## What exists

- `/studio.webmanifest` identifies the installable FuryPipe Studio shell and
  uses the official local FuryPipe SVG mark.
- `/studio-service-worker.js` owns a navigation-only offline fallback.
- `/studio-offline` is the only CacheStorage payload. It contains no workspace
  or user data.
- The Studio document advertises the manifest, supports safe-area layouts, and
  registers the local service worker when the browser supports it.

## Cache and authority policy

The service worker deliberately does not cache:

- `/api/**` responses;
- the Studio document;
- chats, sessions, artifacts, memories, models, credentials, or provider data.

It handles only same-origin `GET` navigation failures and returns the static
offline shell. It does not proxy, replay, mutate, or grant runtime authority.

All PWA paths remain inside the existing loopback-only Studio host. The
manifest, icon, worker, and offline shell return `Cache-Control: no-store` from
the server; the worker explicitly stores only the offline shell in CacheStorage.

## Validation

- `pnpm run typecheck`
- focused Studio API and Node-host tests
- full test suite
- package build and installed-package smoke
- real Chromium Studio QA

## Not proven

- Firefox/WebKit behavior outside their exact-head CI workflow;
- user installation on a specific device/browser;
- offline behavior after a browser-specific service-worker lifecycle event;
- Cloudflare, DNS, TLS, remote gateway, or production deployment.
