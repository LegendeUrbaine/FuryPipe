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
| #268 | claude/studio-fr-coverage | c83573a | Studio : 88 entrées FR ajoutées au dictionnaire (chaînes visibles en anglais : 93 → 9 sur 13 vues, mesuré avant le fix des compteurs), compteurs dynamiques traduits, « Espace de travail » en casse normale + test |
| #269 | claude/fervent-wozniak-ctw4nt | HEAD de la PR sur GitHub (un commit ne peut pas citer son propre hash) ; dernière CI verte : cb01165 | ce dossier de finalisation |
| #270 | claude/gateway-smokes-evidence | 0584f42 | smokes Gateway : arrêt propre vérifié, ancien endpoint refusé (`ECONNREFUSED`) après redémarrage, preuve liée à son commit (`sourceCommit`) |

Les commits après la preuve ne font que durcir les assertions des smokes (revues bots). Les PR sont indépendantes, toutes basées sur `95c1336`. Le seul fichier partagé est
`.github/workflows/furypipe-recovery-restart.yml` (#264 et #265), modifié à deux endroits non adjacents.
