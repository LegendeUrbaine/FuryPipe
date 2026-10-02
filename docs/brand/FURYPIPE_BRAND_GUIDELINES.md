# FuryPipe brand guidelines

Status: `IMPLEMENTED_LOCAL / REFERENCE_DERIVED`

The canonical source for this integration is the user-selected
`Image ChatGPT 27 sept. 2026, 15_27_59-1.png`, supplied on 2026-09-27. It
shows the official visual direction and variants, but it is a composite
presentation board, not a clean individual production asset. Studio therefore
keeps one small inline SVG source in
`src/studio/studio-brand.ts`; it does not crop a presentation board or claim a
pixel-exact export that was not supplied.

## Identity

- Product name: `FuryPipe`
- Creator: `LégendeUrbaine`
- Tagline: `BUILD · AUTOMATE · CREATE · BEYOND`
- Monogram: the forward-flowing `F` mark from the supplied references
- Wordmark: `Fury` in the light/white text role and `Pipe` in FuryPipe orange
- Main mood: near-black / graphite surfaces with restrained orange accents

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| Charcoal | `#050506` | primary dark background and favicon field |
| Graphite | `#15151a` | elevated surface |
| FuryPipe orange | `#ff6a1a` | primary mark/accent |
| Hot orange | `#ff8a3d` | emphasis and focus-adjacent accent |
| Light ink | `#f4f1ec` | dark-surface wordmark and text |
| Dark ink | `#1a1714` | light-mode text role |

## Implemented Studio surfaces

| Surface | Variant | Rule |
| --- | --- | --- |
| Sidebar | orange monogram + FuryPipe wordmark | primary desktop identity |
| Responsive topbar | compact orange monogram + wordmark | visible when the drawer hides the sidebar or it is collapsed |
| New-chat empty state | larger flat orange monogram with restrained glow | no orbital replacement mark; glow belongs to the shell |
| Browser favicon | F monogram on charcoal | no wordmark at 16/32 px |
| Light/system mode | accent monogram + dark/light wordmark tokens | no dark raster baked into the UI |

The same `data-brand="furypipe"` and `data-brand="furypipe-monogram"` hooks
make the integration auditable without relying on visual guesses.

## Usage rules

- Use the monogram alone for favicon, app-icon-sized surfaces and compact UI.
- Use the horizontal lockup when there is enough width for the wordmark.
- Keep the wordmark spelling and `Fury`/`Pipe` color split intact.
- Prefer the flat SVG at small sizes; do not bake a heavy glow into the mark.
- Keep the existing accessible error color separate from the brand orange.
- Preserve visible focus rings and test dark, light/system, high-DPI and narrow
  viewport states before calling the visual integration complete.
- Do not replace the supplied F concept with a generic ring, bolt, cube or
  unrelated “AI” symbol.

## Open asset gate

The supplied boards do not prove clean 1024, 512, 256, 128, 64, 32 and 16 px
PNG/WebP exports, nor a production-ready transparent/monochrome marketing
package. Those remain `ASSET_SOURCE_REQUIRED` for desktop packaging, social
previews and external documentation. Do not generate or publish those exports
from the composite boards without an approved clean source asset.

Current evidence is local/static plus real-browser QA of the Studio shell.
Human visual approval, screen-reader sign-off and production packaging are
separate gates. Nothing is merged, released, tagged, published or deployed by
this branding change.
