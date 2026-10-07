# FuryPipe — Marketplace Control-Plane Evidence

Status: `PARTIAL / LOCAL CONTRACT VERIFIED`

Repository: `Mistermode45/FuryPipe`

PR: `#233` — `OPEN + DRAFT + NOT MERGED`

## Implemented boundary

Marketplace metadata now follows one signed, non-executing control-plane
boundary:

```text
manifest metadata
→ recomputed SHA-256 metadata digest
→ detached Ed25519 signature verification
→ bounded metadata-only catalog
→ supplied-byte source hash verification
→ license / trust / compatibility / permissions projection
→ approval-only DOWNLOAD / VERIFY / INSTALL / UPDATE / ROLLBACK / UNINSTALL plan
→ staged verification requirement
```

Implemented in `src/fury-marketplace.ts`:

- compatibility selectors are bounded and included in the signed manifest
  payload;
- signing and verification recompute the manifest digest from the metadata,
  so changing capability type, permissions, source or compatibility invalidates
  the signature instead of preserving a stale declared digest;
- the catalog is bounded, deterministic and metadata-only;
- source verification hashes bytes already supplied by the caller and returns
  only digest/trust/license/permission evidence; it performs no download;
- operation plans require explicit operator approval and, for install/update/
  rollback, a successful matching source-verification receipt;
- uninstall is represented as a plan and does not mutate the filesystem.

Studio adds `GET /api/studio/marketplace.json` and a read-only Marketplace
view. With no injected signed catalog it reports `EMPTY`; it never fetches,
writes, installs or executes a marketplace package.

## Safety boundary

Every catalog snapshot, source-verification receipt and operation plan carries
explicit `networkAuthorized: false`, `filesystemAuthorized: false` and
`executionAuthorized: false` markers. The source URL is metadata only. A valid
signature does not grant network, filesystem, subprocess, credential or
provider authority.

The route and UI do not expose private signing keys, raw package bytes or
unverified execution claims. An altered manifest with an unchanged declared
digest is rejected before signature acceptance.

## Local verification

- Marketplace contract tests: `5/5` passed.
- Studio API route/HTML assertions passed with the focused Studio suite.
- Source TypeScript typecheck passed after the control-plane patch.
- Full Vitest suite: `340` files passed; `3,569` passed, `6` skipped,
  `3,575` total.
- Source and hosted-MCP TypeScript typechecks passed.
- Build: `node scripts/build.mjs` passed; version smoke remained `0.16.0`.
- Installed package smoke: `node scripts/package-smoke.mjs` passed on the real
  `furypipe-0.16.0.tgz`, including `furypipe/fury-marketplace` and
  `furypipe/fury-memory-time-machine` exports.
- Browser QA: Chromium, Firefox and WebKit passed. The Marketplace route
  rendered the explicit empty-catalog state and `PLAN ONLY` authority summary
  without execution claims.
- `git diff --check`: passed before final documentation/commit review.

## Evidence limits

This proves deterministic local metadata/signature/hash contracts, the
approval-only operation boundary, installed package export and local Studio
rendering for this candidate. It does not prove a network
download, persistent remote catalog, sandboxed filesystem installer, package
execution, rollback mutation, compatibility against every host, human
visual/screen-reader sign-off, hosted exact-head CI, production data or
deployment.

No merge, release, tag, npm publish, deploy, auto-merge, force-push or PR
ready-state change was performed.
