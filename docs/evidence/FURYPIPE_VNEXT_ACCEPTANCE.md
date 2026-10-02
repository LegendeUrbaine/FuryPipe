# FuryPipe VNext acceptance

## VNEXT-01 — état de preuve

### Critère principal

> Un projet réel peut contenir une conversation, une tâche gouvernée et un artifact vérifié sans changer d’interface déconnectée.

### Preuve automatisable

1. démarrer avec un workspace vide ;
2. créer une conversation via `/api/studio/workspace/conversation` ;
3. planifier une tâche via `/api/studio/workspace/task/plan` ;
4. vérifier `task.status=PLANNED` et `execution=NOT_EXECUTED` ;
5. confirmer via `/api/studio/workspace/task/confirm` ;
6. créer l’artifact via `/api/studio/workspace/artifact/commit` avec `confirm:true` ;
7. relire `/api/studio/workspace.json` et `/api/studio/artifacts/get` ;
8. vérifier IDs, `task.status=SUCCEEDED`, `verification=VERIFIED_CONTENT_SHA256` et égalité des SHA-256 ;
9. reconstruire le repository avec les mêmes répertoires et relire le snapshot après redémarrage logique.

### Refus obligatoires

- plan sans objectif : `400` ;
- confirmation absente : `400` ;
- artifact avant confirmation : `409` ;
- contenu supérieur à 4 MiB : `413` ;
- digest persisted différent : aucun lien workspace ;
- runtime absent : dispatch `BLOCKED`/`NO_DISPATCH`, jamais `PLANNED` par invention.

### Niveaux

| Gate | Niveau | Ce qui est prouvé | Ce qui ne l’est pas |
|---|---|---|---|
| Typecheck/build | statique | code compilable | runtime utilisateur |
| tests workspace/API | intégration locale | contrats route/store et reprise | client réel |
| browser desktop/tablet/mobile | browser | DOM, interactions et responsive observés | goût visuel final |
| AccessLint | accessibility | violations détectées sur DOM testé | conformité globale de toutes les routes |
| human visual | humain | lisibilité/branding/hiérarchie | automatisation seule |
| agent Mission Control | runtime | seulement si run réel avec receipts | simple plan workspace |

## VNEXT-01 done when

- `src/fury-workspace.ts` persiste/valide les snapshots RecoveryStore ;
- les routes Studio sont testées en succès et refus ;
- la page Workspace propose le parcours principal sans exposer d’abord la complexité ;
- typecheck, build et suite pertinente passent ;
- browser desktop/tablet/mobile est observé ;
- les limites `NOT_EXECUTED`, `BLOCKED`, `VALIDATION_CLIENT_REQUISE` restent affichées lorsque pertinentes.

## Évidence à joindre à une future PR

- exact commit et dirty state ;
- commandes et résultats bruts ;
- résumé des tests XML si disponible ;
- hash du package seulement après tarball installé/smoke ;
- captures ou traces browser avec dimensions ;
- résultat AccessLint ;
- acceptation humaine séparée de l’automatisation.
