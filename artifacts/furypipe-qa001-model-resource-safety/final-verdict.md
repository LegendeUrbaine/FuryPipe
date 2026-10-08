# FuryPipe — QA-001 Local Model Resource Safety

## État

- Correction de code: `6918dc3fb03bc3e406dcf23478092e4a05d21a29`.
- Head du PR au moment du relevé: `d376f55bd4b71b3878eefc86723dd6be9698d933` (commit preuves/docs seulement).
- Full Vitest exécuté sur `d376f55`: 364 fichiers, 3 671 pass, 6 skip, 0 échec.
- Typecheck, hosted MCP typecheck, lint strict et build: PASS local; exact-head CI du PR: PASS.
- Package smoke, reproductibilité et clean-room: PASS local sur code commit `6918dc3`; gates exact-head du PR aussi PASS.
- QA navigateur frais source-lié à `6918dc3`: Dashboard 117/117, Web Studio 120/120; Chromium 153.0.8010.12, Firefox 155.0, WebKit 26.6.
- Exact-head CI de `d376f55`: PASS sur matrices Windows/macOS/Linux, sécurité, dépendances, contrats, provenance, navigateurs et comparaison FuryBench. Attestation npm: SKIPPED car aucune publication.
- CodeQL: 0 alerte ouverte.
- Ollama / modèle requis `qwen3.5:latest` absent ou non joignable: test live NOT_EXECUTED; aucun téléchargement ni fixture substitut.
- Screen reader humain: MANUAL_REQUIRED.

## Contrat préservé

Sélection locale uniquement; estimation FITS conservatrice; confirmation explicite; revalidation immédiate; aucune autorité d’exécution implicite; aucun appel cloud.
`FURYPIPE_MODELS` reste réservé à son périmètre existant Visual Engine.

## Publication / fusion

PR #254 est ouvert sur `v5-codex-review-clean`; au moment de ce relevé, HEAD `d376f55` est mergeable et tous les checks requis sont verts. Fusion non exécutée dans cet artefact.
NPM publish, version/tag, release, déploiement et VNEXT-04: NON EXÉCUTÉS.
