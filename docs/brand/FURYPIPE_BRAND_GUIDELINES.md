# FuryPipe FLUX brand guidelines

Status: `IMPLEMENTED_LOCAL / OWNER_APPROVED_REFERENCE_DERIVED`

Owner selected FLUX board supplied on 2026-10-03. Board is direction, not
source-asset bundle. FuryPipe reconstructs original flat SVG master. It never
crops presentation image for product assets.

## Identity

- Product: `FuryPipe`.
- Concept: `FLUX`.
- Meaning: flow, intelligence, continuity and governed execution.
- Tagline: `Orchestrate. Create. Ship.`
- Symbol: asymmetric continuous orange ribbon. Not retired angular F, bolt,
  flame, pipe or generic infinity mark.
- Wordmark: `Fury` in contextual text color; `Pipe` in Flux Orange.
- Display: Inter Tight with Inter and system fallbacks.
- UI body: Inter with system fallbacks.

## Tokens

| Token | Value | Role |
| --- | --- | --- |
| Flux Orange | `#FF7A1A` | brand mark and primary action |
| Charcoal | `#0B0B0F` | main dark field |
| Graphite | `#1A1A1F` | surface |
| Slate | `#2E2E36` | elevated surface |
| Steel | `#9CA3AF` | muted text |
| White | `#FFFFFF` | primary text |
| Electric Blue | `#3B82F6` | contextual information |
| Success Green | `#22C55E` | successful state |

Orange is brand/action color. Never replace error, warning, information or
success semantics with orange.

## Assets

`assets/branding/flux/master/` holds vector masters. `variants/` holds dark,
light, monochrome and favicon SVG variants. `icons/` holds generated PNG and a
real multi-image ICO. Run `node scripts/generate-flux-assets.mjs` after an
intentional geometry change. Generator uses locked dev dependency
`@napi-rs/canvas`; it adds no runtime dependency.

Use symbol-only variants at 16, 24, 32, 48 and 64 px. Use horizontal wordmark
only when room exists. Keep clear space at least one ribbon terminal-width. Do
not add gradient, chrome, bevel, neon, shadow or 3D treatment to mark.

## Studio and accessibility

- Studio embeds source geometry through `src/studio/studio-brand.ts`.
- Favicon is inline and same-origin, so CSP needs no external exception.
- Sidebar, responsive topbar, workspace/chat and support share
  `data-brand="furypipe"` integration hook.
- SVGs expose title or accessible label when identity conveys meaning; UI
  duplicates use `aria-hidden`.
- Test contrast, keyboard focus, responsive layout, PNG alpha and ICO structure
  before release.

Automation proves only tested boundaries. Human visual approval and publication
remain separate owner gates.
