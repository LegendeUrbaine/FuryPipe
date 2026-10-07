# FuryPipe FORGE 03 — owner approval closure

## Record

| Field | Value |
| --- | --- |
| Date | `2026-10-06` |
| Owner | Mathis / LégendeUrbaine |
| Product | `FuryPipe` |
| Current brand | `FORGE 03` |
| Previous brand | `FLUX` — historical evidence only |
| Owner visual gate | `PASS` |
| Engineering gate | `PASS` |
| Exact-head hosted CI at reviewed implementation | `PASS` |
| Reviewed implementation | `c850f505a608b35f58fcb893d7e55b3f52a61f39` |
| Source status | `OWNER_APPROVED_REFERENCE_RECONSTRUCTED` |
| Reference | Owner-provided FuryPipe FORGE 03 brand board |
| Pixel-perfect claim | Not claimed |
| Original vector source claim | Not claimed |

The owner completed the final human visual review and approved FORGE 03 as the
current FuryPipe visual identity. The production assets are an editable vector
reconstruction of the owner-provided raster reference. This record does not
claim access to an original vector source or mathematical pixel equality.

## Accepted visual implementation

The owner accepted the following implementation surfaces:

- FORGE standalone symbol and FuryPipe FORGE wordmark;
- owner-board visual direction and official `#FF6A00` palette;
- desktop sidebar lockup with the complete wordmark and no duplicated F;
- collapsed sidebar and mobile compact lockup;
- Studio dark and light themes;
- application icon, favicon and 16–256 px small-size variants;
- local IBM Plex Sans and IBM Plex Mono typography;
- Mission Control and Fury Trace desktop/mobile presentation;
- Capability Composer branding without changing its runtime behavior;
- README / GitHub presentation;
- reference raster versus reconstructed production vector evidence.

## Brand contract

```text
PRODUCT              = FuryPipe
CURRENT BRAND        = FORGE 03
PREVIOUS BRAND       = FLUX / HISTORICAL ONLY
PRIMARY ORANGE       = #FF6A00
GRAPHITE             = #2A2A2A
DEEP BLACK           = #0B0D10
OFF WHITE            = #F5F4F0
COOL GRAY            = #E5E7EB
PRIMARY UI FONT      = IBM Plex Sans
TECHNICAL CODE FONT  = IBM Plex Mono
SLOGAN               = BUILD · AUTOMATE · CREATE · BEYOND.
```

FLUX assets, screenshots, QA evidence, commits and historical acceptance
records remain preserved for provenance. Semantic uses of `flux` that do not
refer to the former visual brand are unchanged.

## VNEXT-03 boundary

VNEXT-03 Capability Composer remains closed for this slice and is not reopened
by this branding acceptance record. The accepted behavior remains:

```text
ENGINEERING             = PASS
VISUAL_OWNER_GATE       = PASS
NOT_CONFIGURED          = PRESERVED
READY_FOR_CONFIRMATION  = PRESERVED
COMPLETED               = PRESERVED
FURYPROOF               = ACCEPT
SCREEN_READER           = MANUAL_REQUIRED
```

The reviewed live evidence used the real local Ollama path with
`qwen3.5:latest`, explicit confirmation, `executionAuthority=false`,
`cloudCalls=0`, two receipts and durable persistence. No runtime behavior,
model confirmation semantics or authority boundary is changed by this record.

## Git and release boundaries

The accepted stacked dependency remains:

```text
PR #238 → PR #247 → PR #248 → PR #249
```

PR #249 remains based on
`codex/furypipe-vnext-03-capability-composer` at
`497dd7447efc0a589780e49b416bacffd9d357e0`.

```text
MERGE        = NOT EXECUTED
DEPLOY       = NOT EXECUTED
NPM_PUBLISH  = NOT EXECUTED
VNEXT-04     = NOT STARTED
```

The owner approval closes the FORGE 03 visual acceptance tranche. It does not
authorize a merge, deployment, npm publication or the start of VNEXT-04.
