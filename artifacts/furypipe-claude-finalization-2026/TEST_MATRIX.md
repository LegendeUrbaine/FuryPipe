# TEST MATRIX

| Question | Commande | HEAD | Résultat |
|----------|----------|------|----------|
| QA-001 — gates du dépôt | eslint, `pnpm typecheck` | eb9c5f1 | PASS |
| QA-001 — tsc strict isolé | tsc isolé | eb9c5f1 → d0d3607 (#271) | PARTIAL à eb9c5f1 (9 erreurs, 16 auparavant) ; 0 erreur à d0d3607 |
| Le Gateway démarre-t-il, authentifie-t-il, se reconnecte-t-il ? | `validation:gateway` (script de #270) | 0584f42 | PASS : origine invalide refusée sur les deux daemons, ancien endpoint refusé après redémarrage (`ECONNREFUSED`). JSON `05-gateway/gateway-restart.json` = sortie brute de ce script ; son champ `sourceCommit` donne le SHA complet. À 95c1336, le script ne vérifiait que l'origine invalide sur le premier daemon (champ alors nommé `staleOriginDenied`). |
| Le vrai CLI `gateway start` est-il opérationnel ? | `gateway start --json` | 95c1336 | PASS : ready, loopback, bootstrap one-time, executionAuthority=false |
| Le paquet installé démarre-t-il le Gateway et inspecte-t-il un MCP ? | `validation:gateway-installed-package` (script de #270) | 0584f42 | PASS : les deux arrêts du Gateway vérifiés (code 0, aucun signal, pas d'arrêt forcé). JSON `05-gateway/gateway-installed-package.json` = sortie brute de ce script ; son champ `sourceCommit` donne le SHA complet. À 95c1336, le script écrivait `cleanShutdown: true` sans vérifier l'arrêt. |
| FuryPipe exécute-t-il réellement un outil MCP ? | `validation:gateway-mcp-runtime` | 29a7cb1 | PASS : DISCOVERED / CONNECTED / AUTHORIZED / EXECUTED / VERIFIED |
| La mémoire survit-elle à un vrai redémarrage ? | `validation:memory-restart` | 437d1bd | PASS 8/8 |
| MCP direct, contrats | vitest (7 fichiers) | 95c1336 | 51/51 PASS |
| Mission Control, contrats | vitest fury-run / mission-control / integrator / harness-runner | 95c1336 | 18/18 PASS |
| Fury Trace : bundle altéré refusé ? | vitest fury-run + studio-api + mission-control | d390937 | 39/39 PASS ; FAIL avant le fix |
| Studio : contraste du choix de setup | Chromium, styles calculés + pixel de fond | 7481566 | Avant : ~1.05:1 (FAIL). Après, sur fond #292A2B : titre 13.07:1, sous-titre 5.66:1, icône 6.12:1 → PASS WCAG AA (texte ≥ 4.5, non-texte ≥ 3) |
| Studio : couverture FR | Chromium en-US vs fr-FR, 13 vues | 1dcbf28 | 93 → 9 chaînes visibles en anglais (corrigées par 88 entrées FR ajoutées). Mesure faite avant le fix des compteurs (badf05a) : 3 des 9 restantes étaient ces compteurs. Recompte complet (navigation + vue entière, en-US vs fr-FR) : ~45 libellés anglais restants à c83573a, traduits à c56a014. Re-mesuré à 1643ce9 (après correctif) : 62 chaînes identiques hors noms de fichiers, toutes noms de produits, termes techniques gardés, mots identiques en français ou données matérielles, sauf « Select a file. » (texte d'attente du lecteur de fichier, zone <pre> exclue). Aucun débordement ni erreur console à 1440/768/390. |
| Responsive | Chromium 1440 / 768 / 390 | 7481566, 1dcbf28 | aucun débordement horizontal, 0 erreur console |
| Non-régression globale | `pnpm test` | d793c75, c48d65b | 3679/3679 et 3678/3678 PASS |
| CI exact-head #264 (1er push) | GitHub Actions | d793c75 | 44/44 vertes (3 OS) |
| CI exact-head — PR vertes | GitHub Actions | voir CURRENT_STATE | PASS : #264 (6b2f44b), #265 (f912193, une relance du job d'export Security CI après timeout de file), #266 (059a7e2), #267 (7481566), #270 (0584f42) |
| CI exact-head — PR en attente | GitHub Actions | voir CURRENT_STATE | PENDING au moment de la rédaction : #268 (1643ce9 ; dernière verte c83573a), #271 (3f8bd97 ; d0d3607 vert). #269 : la CI de son HEAD exact se lit sur GitHub (ce dossier ne peut pas certifier le commit qui le contient) |
| Studio FR : compteurs + casse « Espace de travail » | vitest + Chromium fr-FR | badf05a | PASS : nav et titre « Espace de travail », en-tête de section en majuscules via CSS |

## Non exécuté

| Scénario | Statut | Raison |
|----------|--------|--------|
| Run Mission Control live | BLOCKED | Il faut un harness agent (claude-code / codex) et un runtime local. Ce conteneur n'a pas d'Ollama, et `claude` y passerait par une API payante (interdit). |
| Fury Trace issue d'un run réel | NOT_EXECUTED | Dépend du run Mission Control live |
| QA-001 live | NOT_EXECUTED | pas exécuté sur la machine du propriétaire (refus mémoire fail-closed attendu) |
| WebChat : appel d'outil piloté par un fournisseur | NOT_EXECUTED | Nécessite un fournisseur cloud payant |
| QA navigateur du dépôt en local | NOT_EXECUTED | Version de Chromium Playwright incompatible (pas de téléchargement) ; couvert par la CI |
| Lecteur d'écran | MANUAL_REQUIRED | — |
| Human Visual Gate | PENDING | Validation par le propriétaire |
