# ADR-2026-09-28 — stratégie du renderer FuryPipe Local

## Statut

Accepté pour la refonte shell de PR #233. Réévaluation possible dans un ADR
ultérieur; aucun remplacement React n’est introduit par cette tâche.

## Contexte

Le Studio Local est une page rendue par le serveur Node avec CSP nonce,
JavaScript navigateur inline nonce, CSS inline nonce, SVG compile-time et des
handlers déjà couverts par une QA Playwright multi-moteur. Le package publié
est un CLI local; le renderer doit rester disponible sans CDN et sans étape de
déploiement Web.

Le dépôt possède Vite `8.3.0` en dépendance de développement, mais aucun
React, Tailwind, Motion ou Radix. Le shell actuel est vanilla et ses
identifiants DOM sont utilisés par `scripts/studio-browser-qa.ts` et par les
tests de page.

## Options examinées

### A — migration immédiate React + Vite + Radix + Motion + Tailwind

Avantages: composants déclaratifs, primitives d’accessibilité disponibles,
outillage frontend familier.

Coûts: quatre nouvelles familles de dépendances, nouvelle frontière d’assets,
réécriture de la CSP et du rendu serveur, migration de tous les flux runtime,
risque de divergence entre le package installé et les sources, et aucune
preuve que cela corrige le verdict visuel humain.

### B — conserver le renderer vanilla et refondre le shell

Avantages: package et CSP inchangés, IDs/runtime préservés, diff réversible,
QA existante immédiatement exploitable, zéro origine distante et aucune
dépendance de rendu ajoutée.

Coûts: composants moins abstraits; les patterns clavier et focus doivent être
maintenus explicitement; la page reste une ressource serveur monolithique tant
qu’une extraction ultérieure n’est pas justifiée.

## Décision

Retenir B pour PR #233. Extraire la carte d’information architecture dans
`studio-navigation.ts`, appliquer le langage visuel au shell existant, puis
prouver la stabilité par typecheck, tests ciblés, QA navigateur, accessibilité
et package smoke.

Une migration React n’est acceptable que si une future tranche:

1. isole les assets dans une frontière de build clairement packagée;
2. conserve loopback, CSP, absence de CDN et les mêmes API;
3. porte les tests de navigation, sécurité et responsive;
4. apporte une mesure de maintenabilité ou de qualité observable;
5. reçoit une revue et un ADR séparés.

## Conséquences

- le renderer reste sans dépendance frontend nouvelle;
- `vite` n’est pas installé ou mis à jour pour cette tâche;
- les animations restent CSS/DOM et respectent la réduction de mouvement;
- Radix et Motion restent des options futures, pas une preuve de qualité
  automatique;
- la validation humaine visuelle reste obligatoire.

## Preuves de choix

- source locale: `package.json`, `pnpm-lock.yaml`, `src/node.ts`,
  `src/studio/studio-page.ts`, `scripts/studio-browser-qa.ts`;
- source Vite: <https://vite.dev/guide/>;
- source React: <https://react.dev/blog>;
- source Motion: <https://motion.dev/docs/react>;
- source Radix: <https://www.radix-ui.com/primitives/docs/overview/introduction>;
- source Tailwind: <https://tailwindcss.com/docs/upgrade-guide>.

