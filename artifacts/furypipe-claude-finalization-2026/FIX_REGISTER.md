# FIX REGISTER

| Fix | Issue | PR | Test rouge → vert | Revue bots |
|-----|-------|----|-------------------|------------|
| Code de refus exact pour une proposition consommée | FIN-001 | #264 | `fury-gateway-tool-bridge-adapter.test.ts` | 8 fils traités (29a7cb1) |
| Smoke MCP runtime E2E + CI | — | #264 | `validation:gateway-mcp-runtime` | idem |
| Smoke mémoire multi-processus + CI | FIN-005 | #265 | `validation:memory-restart` | 6 fils traités (437d1bd) |
| Digest, format et verdict du bundle liés à la trace | FIN-002 | #266 | `fury-run.test.ts` | 5 fils traités (d390937) |
| Contraste du choix de setup | FIN-003 | #267 | mesure Chromium | aucun commentaire |
| Couverture FR (dictionnaire, puis ~45 libellés trouvés au recompte complet) | FIN-004 | #268 | `studio-i18n-coverage.test.ts` + recompte Chromium en-US/fr-FR (c83573a → 1643ce9) | fils traités (dont données utilisateur exclues de la traduction, 1643ce9) |
| Compteurs dynamiques traduits | FIN-006 | #268 | QA navigateur du dépôt : compteurs FR puis EN (c83573a) | 1 fil traité |
| « Espace de travail » en casse normale | FIN-007 | #268 | test i18n + Chromium fr-FR (badf05a) | aucun commentaire |
| Typage strict du script QA-001, résultat live validé avant preuve | FIN-008 | #271 | tsc strict isolé 9 → 0 (d0d3607, 3f8bd97) | 1 fil traité (3f8bd97) |
| Smokes Gateway : arrêt propre vérifié, ancien endpoint refusé, preuve liée au commit | — | #270 | `validation:gateway`, `validation:gateway-installed-package` (0584f42) | fils traités |
