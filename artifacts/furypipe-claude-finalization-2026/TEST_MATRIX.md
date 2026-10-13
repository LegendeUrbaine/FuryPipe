# TEST MATRIX

| Question | Commande | HEAD | Résultat |
|----------|----------|------|----------|
| QA-001 — gates du dépôt | eslint, `pnpm typecheck` | eb9c5f1 | PASS |
| QA-001 — tsc strict isolé | tsc isolé | eb9c5f1 | PARTIAL : 9 erreurs préexistantes (16 auparavant) |
| Le Gateway démarre-t-il, authentifie-t-il, se reconnecte-t-il ? | `validation:gateway` | 95c1336 | PASS. Réserve : `invalidOriginDenied` (nommé `staleOriginDenied` par le script à ce HEAD) prouve seulement le rejet d'une origine invalide sur le premier daemon. Le refus de l'ancien endpoint après redémarrage n'est pas testé à ce HEAD (NOT_EXECUTED) ; #270 l'ajoute. |
| Le vrai CLI `gateway start` est-il opérationnel ? | `gateway start --json` | 95c1336 | PASS : ready, loopback, bootstrap one-time, executionAuthority=false |
| Le paquet installé démarre-t-il le Gateway et inspecte-t-il un MCP ? | `validation:gateway-installed-package` | 95c1336 | PASS. Réserve : le script à ce HEAD écrivait `cleanShutdown: true` sans vérifier le code de sortie (SIGKILL possible) → enregistré NOT_VERIFIED ; #270 ajoute la vérification. En revanche, `validation:gateway-mcp-runtime` vérifie bien l'arrêt réel. |
| FuryPipe exécute-t-il réellement un outil MCP ? | `validation:gateway-mcp-runtime` | 29a7cb1 | PASS : DISCOVERED / CONNECTED / AUTHORIZED / EXECUTED / VERIFIED |
| La mémoire survit-elle à un vrai redémarrage ? | `validation:memory-restart` | 437d1bd | PASS 8/8 |
| MCP direct, contrats | vitest (7 fichiers) | 95c1336 | 51/51 PASS |
| Mission Control, contrats | vitest fury-run / mission-control / integrator / harness-runner | 95c1336 | 18/18 PASS |
| Fury Trace : bundle altéré refusé ? | vitest fury-run + studio-api + mission-control | d390937 | 39/39 PASS ; FAIL avant le fix |
| Studio : contraste du choix de setup | Chromium, styles calculés + pixel de fond | 7481566 | Avant : ~1.05:1 (FAIL). Après, sur fond #292A2B : titre 13.07:1, sous-titre 5.66:1, icône 6.12:1 → PASS WCAG AA (texte ≥ 4.5, non-texte ≥ 3) |
| Studio : couverture FR | Chromium en-US vs fr-FR, 13 vues | 1dcbf28 | 93 → 9 chaînes visibles en anglais (corrigées par 88 entrées FR ajoutées) |
| Responsive | Chromium 1440 / 768 / 390 | 7481566, 1dcbf28 | aucun débordement horizontal, 0 erreur console |
| Non-régression globale | `pnpm test` | d793c75, c48d65b | 3679/3679 et 3678/3678 PASS |
| CI exact-head #264 (1er push) | GitHub Actions | d793c75 | 44/44 vertes (3 OS) |
| CI exact-head sur les HEAD actuels (#264–#269) | GitHub Actions | voir CURRENT_STATE | PENDING au moment de la rédaction |

## Non exécuté

| Scénario | Statut | Raison |
|----------|--------|--------|
| Run Mission Control live | BLOCKED | Il faut un harness agent (claude-code / codex) et un runtime local. Ce conteneur n'a pas d'Ollama, et `claude` y passerait par une API payante (interdit). |
| Fury Trace issue d'un run réel | NOT_EXECUTED | Dépend du run Mission Control live |
| QA-001 live | PARTIAL | NOT_EXECUTED sur la machine du propriétaire (refus mémoire fail-closed attendu) |
| WebChat : appel d'outil piloté par un fournisseur | NOT_EXECUTED | Nécessite un fournisseur cloud payant |
| QA navigateur du dépôt en local | NOT_EXECUTED | Version de Chromium Playwright incompatible (pas de téléchargement) ; couvert par la CI |
| Lecteur d'écran | MANUAL_REQUIRED | — |
| Human Visual Gate | PENDING | Validation par le propriétaire |
