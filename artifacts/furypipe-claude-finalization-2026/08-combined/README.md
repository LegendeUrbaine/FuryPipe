# Validation combinée — sorties brutes

Fusion locale jetable : base `95c1336`, puis `--no-ff` dans l'ordre #264 → #265 → #266 → #267 → #268 → #270 → #271 → #269.

| PR | tête fusionnée |
| --- | --- |
| #264 | 6b2f44b |
| #265 | f912193 |
| #266 | 059a7e2 |
| #267 | 7481566 |
| #268 | 647d15b |
| #270 | 0584f42 |
| #271 | 3f8bd97 |
| #269 | 972962f |

- Commit de fusion : `0cacc654753fd107921ac7bd3db6fad6b1b9fda7` (dépend de l'horodatage local)
- Arbre : `167a2439a9bc46d782a4eabc9a405587aabfb4fd` (reproductible avec les mêmes têtes)
- `pnpm run lint`, `pnpm run typecheck`, `pnpm run build` : PASS
- `pnpm test` : 365 fichiers, 3681/3681
- Smokes lancés avec `FURYPIPE_SOURCE_COMMIT=0cacc654753fd107921ac7bd3db6fad6b1b9fda7`, sortie JSON copiée telle quelle :
  - `gateway.json` (`validation:gateway`)
  - `gateway-mcp-runtime.json` (`validation:gateway-mcp-runtime`)
  - `memory-restart.json` (`validation:memory-restart`)
  - `gateway-installed-package.json` (`validation:gateway-installed-package`)

Les fichiers de `05-gateway`, `06-memory` et `07-mcp-runtime` restent les preuves par PR, liées à leur propre commit.
