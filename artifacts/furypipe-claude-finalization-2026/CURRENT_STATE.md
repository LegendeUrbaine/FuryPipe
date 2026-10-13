# CURRENT STATE — FuryPipe finalization (Claude Code, 2026-10-13)

```text
SOURCE        : LegendeUrbaine/FuryPipe
BASE HEAD     : 95c13364208a55c1543eaddb0940faa08c416c3d (v5-codex-review-clean, après PR #263)
ENV           : conteneur cloud Linux, Node 22.22.0, pnpm 10.21.0
                pas d'Ollama, pas de GPU → aucun test modèle (décision propriétaire : modèles OK)
NPM           : furypipe@0.16.1 INCHANGÉ — aucun publish, aucun tag, aucune release
VNEXT-04      : NOT STARTED
```

## Recovery

- Les modifications QA-001 locales (machine Windows) étaient déjà poussées sur la branche
  `claude/qa001-live-script-gate-evidence`, PR #263 → revue, CI 43/43, fusionnée (`95c1336`).
- Ce conteneur ne contient aucun changement local du propriétaire. Rien n'a été écrasé.
- Le changement de la variable `OLLAMA_MODELS` sur la machine du propriétaire (mission précédente) est
  documenté, mais il n'a été ni modifié ni testé ici.

## PR ouvertes (mode A : le propriétaire fusionne)

| PR | Branche | HEAD | Sujet |
|----|---------|------|-------|
| #264 | claude/gateway-mcp-runtime-e2e | 6b2f44b (preuve : 29a7cb1) | fix code d'erreur tool proposal consommé + smoke MCP runtime E2E via Gateway réel + CI |
| #265 | claude/memory-restart-smoke | f912193 (preuve : 437d1bd) | smoke mémoire chiffrée multi-processus (restart / forget / mauvaise clé) + CI |
| #266 | claude/fury-trace-bundle-digest | 059a7e2 | Fury Trace : vérif digest bundle, format, verdict scellé |
| #267 | claude/studio-setup-choice-contrast | 7481566 | Studio : contraste bouton « Install Ollama » |
| #268 | claude/studio-fr-coverage | 647d15b | Studio : couverture FR (dictionnaire, compteurs dynamiques, « Espace de travail », libellés Workspace/Code/Skills restants après recompte complet), données utilisateur (titres, objectifs, IDs de modèle) exclues de la traduction + tests |
| #269 | claude/fervent-wozniak-ctw4nt | HEAD de la PR sur GitHub (un commit ne peut pas citer son propre hash) ; dernière CI verte : cb01165 | ce dossier de finalisation |
| #271 | claude/qa001-strict-types | 3f8bd97 | QA-001 : tsc strict isolé 9 → 0, résultat live validé avant écriture de la preuve |
| #270 | claude/gateway-smokes-evidence | 0584f42 | smokes Gateway : arrêt propre vérifié, ancien endpoint refusé (`ECONNREFUSED`) après redémarrage, preuve liée à son commit (`sourceCommit`) |

Les commits après la preuve ne font que durcir les assertions des smokes (revues bots). Les PR sont toutes basées sur `95c1336`. Fichiers partagés : `.github/workflows/furypipe-recovery-restart.yml` (#264 et #265, deux endroits non adjacents) et `src/studio/studio-page.ts` (#267 : CSS du choix de setup ; #268 : dictionnaire FR, textes dynamiques, exclusions de données utilisateur).

Validation combinée (branche locale jetable `95c1336` + fusions `--no-ff` dans l'ordre #264 → #265 → #266 → #267 → #268 → #270 → #271 → #269, têtes 6b2f44b, f912193, 059a7e2, 7481566, 647d15b, 0584f42, 3f8bd97, 972962f) : commit de fusion obtenu `0cacc654753fd107921ac7bd3db6fad6b1b9fda7`, arbre `167a2439a9bc46d782a4eabc9a405587aabfb4fd` (le SHA du commit dépend de l'horodatage local ; l'arbre est reproductible avec les mêmes têtes). Aucun conflit ; lint, typecheck et build PASS ; `pnpm test` 365 fichiers, 3681/3681 ; `validation:gateway`, `validation:gateway-mcp-runtime`, `validation:memory-restart`, `validation:gateway-installed-package` PASS, lancés avec `FURYPIPE_SOURCE_COMMIT=0cacc65…` : les preuves JSON des quatre smokes portent ce `sourceCommit`. Correctif de contraste (#267) et entrées FR (#268) tous deux présents dans `studio-page.ts`. Ce dossier (#269) ne change que de la documentation après 972962f. Toute nouvelle tête de code invalide cette mesure.
