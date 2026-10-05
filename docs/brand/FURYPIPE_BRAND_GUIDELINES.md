# FuryPipe FORGE 03 — guide de marque

Statut : `OWNER_APPROVED_REFERENCE_RECONSTRUCTED`

État actif : `CURRENT BRAND = FORGE 03`.
La direction précédente reste `PREVIOUS BRAND = FLUX` uniquement pour la
provenance historique. Les anciennes captures, commits et validations ne sont
pas réécrits.

La référence visuelle propriétaire est `Guide de marque FuryPipe _ identité
tech et design.png`. SHA-256 vérifié :
`02F0B99B4C821CAC4CCA5F581E18F77AAD804B319209DC0A5C6FC7B7FF78C868`.

La planche est une référence de direction visuelle, pas un paquet de fichiers
sources. Les masters ci-dessous sont donc une reconstruction vectorielle
éditable des formes visibles. Les détails que la rasterisation ne permet pas
de déterminer ne sont pas présentés comme une reproduction mathématiquement
identique.

## Identité validée

- Produit : `FuryPipe`.
- Direction : `FORGE 03`.
- Signature : monogramme F angulaire, couronne orange séparée, wordmark
  polygonal compact, F et P orange.
- Palette officielle : `#FF6A00`, `#2A2A2A`, `#0B0D10`, `#F5F4F0`, `#E5E7EB`.
- Signature conservée : `BUILD · AUTOMATE · CREATE · BEYOND.`
- Textes secondaires, interface et code : `IBM Plex Sans` / `IBM Plex Mono`.
  Les sous-ensembles latins sont vendus localement sous `assets/fonts/ibm-plex/`
  depuis `@fontsource` 5.3.0, sous licence OFL-1.1, puis embarqués en data URL
  dans les pages locales. Les fallbacks système restent une protection de
  dernier recours, pas la preuve de la typographie principale.

Le wordmark principal n'utilise pas une police générique : les lettres sont
des `<path>` SVG. Les textes de signature dans les variantes composées restent
du texte secondaire et déclarent IBM Plex Sans.

## Palette

| Token | Valeur | Rôle |
| --- | --- | --- |
| Fury Orange | `#FF6A00` | couronne, F/P de marque, action primaire |
| Graphite | `#2A2A2A` | surface secondaire et structure |
| Deep Black | `#0B0D10` | fond sombre et contraste |
| Off White | `#F5F4F0` | wordmark et texte principal sur fond sombre |
| Cool Gray | `#E5E7EB` | texte secondaire, neutralité et lisibilité |

Les états fonctionnels gardent leurs propres sémantiques : succès, avertissement,
erreur et information ne sont pas remplacés par l'orange de marque.

## Sources et génération

- Masters : `assets/branding/forge/master/`.
- Variantes SVG : `assets/branding/forge/variants/`.
- PNG, ICO et petites tailles : `assets/branding/forge/icons/`.
- Primitive Studio : `src/studio/studio-brand.ts`.
- Génération SVG : `node scripts/generate-forge-svg-assets.mjs`.
- Génération raster/ICO : `node scripts/generate-forge-assets.mjs`.
- Validation : `node scripts/validate-forge-assets.mjs`.
- Fonts locales : `assets/fonts/ibm-plex/`, licence `assets/fonts/OFL-1.1-IBM-Plex.txt`.
- Preuve d'inventaire : `docs/brand/FURYPIPE_BRAND_INVENTORY.md`.

Les SVG maîtres sont plats : pas d'image embarquée, pas de `foreignObject`,
pas de gradient, filtre, chrome, bevel ou effet 3D. Les PNG transparents ont
une vraie couche alpha; `favicon.ico` contient les tailles 16, 32 et 48 px.

À 16–64 px, utiliser le monogramme seul. À 256 px et plus, utiliser l'icône
app ou le wordmark selon l'espace disponible. Respecter une zone libre au
moins égale à l'épaisseur de la barre orange autour du signe.

## Intégration et preuve

Studio, dashboard, Gateway WebChat et setup CLI réutilisent les primitives ou
les tokens FORGE 03. Le hook d'intégration produit reste
`data-brand="furypipe"`.

### Règles de lockup produit

- Sidebar desktop ouverte : wordmark FuryPipe complet seul; aucun monogramme
  séparé devant lui.
- Sidebar desktop repliée : symbole FORGE seul.
- Header mobile : symbole seul lorsque la largeur ne permet pas le wordmark.
- Favicon et icône application : symbole seul.
- README et présentations de marque : lockup/wordmark complet.

La composition ne retire jamais le F stylisé du master. Elle évite seulement
de l'afficher deux fois dans une même barre.

Les validators et la QA navigateur prouvent uniquement les chemins exécutés.
La validation de cette reconstruction contre la planche reste aussi une
porte visuelle propriétaire distincte; aucune capture automatisée ne remplace
ce verdict humain.

## Provenance FLUX

Les références FLUX conservées sont historiques : `assets/branding/flux/`,
`scripts/generate-flux-assets.mjs` et `scripts/validate-flux-assets.mjs`.
Elles servent à relire les anciennes preuves et ne sont plus appelées par le
branding actif. Les occurrences de « flux » dans les contrats de streaming,
OAuth ou autres domaines fonctionnels ne sont pas des références de marque et
restent inchangées.
