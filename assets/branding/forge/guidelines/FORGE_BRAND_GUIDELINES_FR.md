# FORGE 03 — guide opératoire

Référence propriétaire : `Guide de marque FuryPipe _ identité tech et
design.png`.

Palette : `#FF6A00` Fury Orange, `#2A2A2A` Graphite, `#0B0D10` Deep Black,
`#F5F4F0` Off White et `#E5E7EB` Cool Gray.

Le monogramme et le wordmark sont des chemins SVG éditables. Aucune image
raster ne doit être embarquée dans un SVG de production. Les textes
secondaires utilisent IBM Plex Sans; les identifiants et données techniques
utilisent IBM Plex Mono. Les sous-ensembles locaux sont vendus sous
`assets/fonts/ibm-plex/` depuis `@fontsource` 5.3.0, licence OFL-1.1; le fallback
système est seulement la protection de dernier recours.

Signature obligatoire : `BUILD · AUTOMATE · CREATE · BEYOND.`

Génération et vérification depuis la racine du dépôt :

```text
node scripts/generate-forge-svg-assets.mjs
node scripts/generate-forge-assets.mjs
node scripts/validate-forge-assets.mjs
```

La preuve de migration active/historique est tenue dans
`docs/brand/FURYPIPE_BRAND_INVENTORY.md`.

Ne pas ajouter de nouveau logo, de dégradé, de glow ou d'effet 3D au master.
Les petites tailles utilisent le symbole seul. La comparaison finale avec la
planche reste une validation visuelle humaine.
