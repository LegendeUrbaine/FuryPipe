# FuryPipe — Memory Time Machine Evidence

Status: `PARTIAL / LOCAL CONTRACT VERIFIED`

Repository: `Mistermode45/FuryPipe`

PR: `#233` — `OPEN + DRAFT + NOT MERGED`

## Implemented boundary

The Time Machine reuses the existing encrypted `RecoveryStore` through
`Memory VNext`. It does not create a second durable memory authority.

```text
Memory VNext records/revisions
→ governed history()
→ digest-only timeline/checkpoints
→ deterministic snapshot ID + SHA-256
→ metadata-only diff/export
→ cross-project scope/memory/source graph projection
→ explicit restore confirmation
→ new append-only governed revision
```

Implemented files:

- `src/memory-vnext.ts`
  - public bounded `history()` projection;
  - explicit `restore()` governance operation;
  - restore reads the selected immutable content handle and writes a new
    content object plus record revision;
  - forgotten records, current checkpoints, revoked sources and expired TTL
    checkpoints fail closed;
  - authorization operations are explicit: `history` and `restore`.
- `src/fury-memory-time-machine.ts`
  - timeline across requested scopes;
  - deterministic snapshots and tamper-checked snapshot diff;
  - digest-only provenance, source, state and retention metadata;
  - metadata-only export excludes raw memory text;
  - cross-project graph joins scope → memory → source metadata only;
  - archive maps to governed disable, delete maps to governed forget;
  - pin remains `PLAN_ONLY` because Memory VNext has no canonical persisted
    pin field and the Time Machine does not invent one.
- `src/studio/studio-api.ts` / `src/studio/studio-page.ts`
  - read-only checkpoint route;
  - metadata export and snapshot diff routes;
  - restore route requires `confirm: true`;
  - Studio timeline, provenance and restore controls;
  - UI never renders snapshot text because the projection does not carry it.

## Safety boundary

Snapshots, diffs and exports carry memory IDs, versions, SHA-256 digests,
scope digests, source digests, evidence classes, states, retention metadata,
timestamps and governance markers. They do not carry raw memory text,
credentials, provider payloads or hidden authority.

Restore is not an overwrite and not a resurrection of a forgotten record. It
appends a new version after explicit confirmation and reuses the existing
Memory VNext authorization boundary. `pin` is visibly unsupported as a
persistent mutation rather than being stored in browser or parallel state.

## Local verification

- Focused Memory VNext / Time Machine / Studio API contracts: `35/35` passed.
- Full Vitest suite: `340` files passed; `3,568` passed, `6` skipped,
  `3,574` total.
- Source TypeScript typecheck: passed.
- Hosted-MCP TypeScript typecheck: passed.
- Build: `node scripts/build.mjs` passed; version smoke remained `0.16.0`.
- Installed package smoke: `node scripts/package-smoke.mjs` passed, including
  `furypipe/fury-memory-time-machine` from the packed tarball.
- Browser QA: Chromium, Firefox and WebKit passed. The real-browser path
  created memory, rendered checkpoints, prepared metadata-only export and
  checked raw-text non-leakage.
- `git diff --check`: passed before final documentation/commit review.

## Evidence limits

This proves the local Recovery-backed contract, API behavior, package export
and browser-rendered Studio projection. It does not prove cross-process
hosted storage, multi-operator authorization, durable pin persistence, raw
content export, recall quality, false-memory rate, migration compatibility,
human visual/screen-reader sign-off, hosted exact-head CI, production data or
deployment.

No merge, release, tag, npm publish, deploy, auto-merge, force-push or PR
ready-state change was performed.
