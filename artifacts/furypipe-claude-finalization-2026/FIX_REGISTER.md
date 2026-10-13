# FIX REGISTER

| Fix | Issue | PR | Test rouge → vert | Revue bots |
|-----|-------|----|-------------------|------------|
| Code de refus exact pour une proposition consommée | FIN-001 | #264 | `fury-gateway-tool-bridge-adapter.test.ts` | 8 fils traités (29a7cb1) |
| Smoke MCP runtime E2E + CI | — | #264 | `validation:gateway-mcp-runtime` | idem |
| Smoke mémoire multi-processus + CI | FIN-005 | #265 | `validation:memory-restart` | 6 fils traités (437d1bd) |
| Digest, format et verdict du bundle liés à la trace | FIN-002 | #266 | `fury-run.test.ts` | 5 fils traités (d390937) |
| Contraste du choix de setup | FIN-003 | #267 | mesure Chromium | aucun commentaire |
| Couverture FR (88 entrées de dictionnaire ; 93 → 9 chaînes visibles, mesuré avant le fix des compteurs) | FIN-004 | #268 | `studio-i18n-coverage.test.ts` | aucun commentaire |
