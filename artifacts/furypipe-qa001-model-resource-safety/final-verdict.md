# FuryPipe — QA-001 Local Model Resource Safety

## État

- Correction locale validée; source commit `c34d4748be961513f59e2a0ff4a8b93c036eb100`.
- Typecheck, lint, suite complète, build, package smoke, reproducibilité, clean-room et QA inter-navigateurs passent.
- CodeQL: zéro alerte ouverte au moment de la requête.
- Matrice navigateur liée au commit exact: Dashboard 117/117; Web Studio 120/120; Chromium, Firefox, WebKit.
- Ollama / modèle requis `qwen3.5:latest` absent ou non joignable: exécution réelle NOT_EXECUTED; aucun téléchargement ni fixture substitut.
- Screen reader humain: MANUAL_REQUIRED.

## Contrat préservé

Sélection locale uniquement; estimation FITS conservatrice; confirmation explicite; revalidation immédiate; aucune autorité d’exécution implicite; aucun appel cloud.
`FURYPIPE_MODELS` reste réservé à son périmètre existant Visual Engine.

## Publication / fusion

PR #254 est ouvert sur `v5-codex-review-clean`; workflows exact-head en attente. Fusion non exécutée tant que les contrôles requis du HEAD courant n’ont pas tous réussi.
NPM publish, version/tag, release, déploiement et VNEXT-04: NON EXÉCUTÉS.
