# FuryPipe VNEXT-03 — Final Acceptance Record

## Scope

This record closes the two remaining Composer presentation gaps requested by
the owner:

1. the no-local-model path is visibly `NOT_CONFIGURED`, explains that local
   execution is unavailable, and exposes no execute or confirmation control;
2. the Composer keeps the immutable initial plan separate from execution and
   FuryProof outcome, including the actual non-accepted verdict when one is
   returned.

The existing FLUX identity, local-only authority boundary, provider path,
FuryIR, FuryDispatcher, FuryProof and RecoveryStore contracts remain intact.
No VNEXT-04 work is included.

## Evidence matrix

| Gate | Result | Evidence boundary |
| --- | --- | --- |
| NOT_CONFIGURED | PASS | Real empty-runtime browser server; visible runtime card; no execute/confirm controls; screenshot targeted to the runtime card |
| Initial plan state | PASS | `PLAN / Ready for confirmation`, `EXECUTION / Not started`, `FURYPROOF / Not started` |
| Completed plan state | PASS | `INITIAL PLAN / Ready for confirmation`, `EXECUTION / Completed`, `FURYPROOF / ACCEPT` |
| Mobile state | PASS | Chromium 390px responsive state matrix; no horizontal overflow or clipped Composer controls/fields |
| Non-accepted outcome presentation | PASS | UI binds execution state and FuryProof field to returned execution/judgement values; no unconditional success label |
| Browser engines | PASS | Chromium, Firefox and WebKit functional Composer path |
| Accessibility automation | PASS | DOM, landmarks, labels, ARIA and keyboard checks; screen-reader review remains manual |

## Commands and results

```text
npm test                                      PASS — 362 files, 3648 passed, 6 skipped
npm run typecheck                             PASS
npm run lint                                  PASS
npm run build                                 PASS
npm run package:smoke                         PASS
npm run validation:accessibility              PASS
npm run validation:composer:live              PASS — qwen3.5:latest via Ollama loopback
npm run browser:studio:composer:qa            PASS — Chromium / Firefox / WebKit
git diff --check                              PASS
```

The live Composer boundary used the installed local model
`qwen3.5:latest` with digest
`6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`. The
request required explicit confirmation, completed through the real local
OpenAI-compatible boundary, produced `FURYPROOF=ACCEPT`, and persisted the
result. No model download, cloud call or execution authority grant occurred.

The latest package smoke tarball was `furypipe-0.16.0.tgz` with SHA-256
`a6d753196cb44a338f6bcea6784994dfdd26c35a12fa3d9444a5a497abfc7cef`.

## Final evidence packet

The final exact-head browser run writes JSON evidence and screenshots under:

```text
artifacts/vnext03-final-exact-head/
```

The owner packet contains only these four screenshots:

```text
15-composer-not-configured.png
03-composer-generated-route-summary.png
21-composer-final-execution-state.png
22-composer-mobile-final-execution-state-390.png
```

The final commit SHA and hosted check status are reported from PR #248 after
the branch push. This file intentionally does not replace the Git/PR source
of truth with a hand-maintained SHA.

## Scope protections

- PR #238 and PR #247 are untouched.
- No merge, release, tag, deployment or package publication was performed.
- No branding redesign or new logo was introduced.
- VNEXT-04 was not started.
