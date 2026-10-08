# FuryPipe — QA-001 Local Model Resource Safety

## État

- Correction locale validée; production-source commit `6918dc3fb03bc3e406dcf23478092e4a05d21a29`.
- Typecheck, lint, suite complète (3 671 pass, 6 skip), build, package smoke, reproductibilité, clean-room et QA inter-navigateurs passent.
- Exact-head GitHub CI, matrices Windows/macOS/Linux, sécurité, dépendances, contrats, provenance et comparaison FuryBench: PASS sur le commit de source.
- CodeQL: 0 alerte ouverte.
- Matrice navigateur liée au commit exact: Dashboard 117/117; Web Studio 120/120; Chromium 153.0.8010.12, Firefox 155.0, WebKit 26.6.
- Ollama / modèle requis `qwen3.5:latest` absent ou non joignable: exécution réelle NOT_EXECUTED; aucun téléchargement ni fixture substitut.
- Screen reader humain: MANUAL_REQUIRED.

## Contrat préservé

Sélection locale uniquement; estimation FITS conservatrice; confirmation explicite; revalidation immédiate; aucune autorité d’exécution implicite; aucun appel cloud.
`FURYPIPE_MODELS` reste réservé à son périmètre existant Visual Engine.

## Publication / fusion

PR #254 est ouvert sur `v5-codex-review-clean`. Les checks du HEAD de source passent. Le commit de mise à jour des preuves doit lui-même passer ses checks exact-head avant fusion; fusion non exécutée à ce stade.
NPM publish, version/tag, release, déploiement et VNEXT-04: NON EXÉCUTÉS.
