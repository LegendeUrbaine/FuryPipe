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

## VNEXT-02 — état de preuve

### Critère principal

> Un run réellement terminé expose un graphe d’exécution inspectable dont chaque événement provient du replay hash-chain et dont chaque preuve provient du proof bundle scellé.

### Preuve automatisable

1. exécuter `runFuryTask` avec un executor de test réel au niveau du runtime FuryPipe, des worktrees Git et du ledger ;
2. vérifier `FuryRunResult.replayHead` avec `verifyFuryReplay` ;
3. construire `buildFuryRunTrace` depuis ce résultat terminé ;
4. vérifier `status=READY`, `replayIntegrity.status=PASS`, des nœuds `event`, des receipts liés et `executionAuthority=false` ;
5. vérifier que la route `/api/studio/runs/trace.json?runId=...` restitue la même projection pour le run Studio terminé ;
6. altérer un événement du replay et vérifier `status=INVALID`, sans promotion en trace valide ;
7. vérifier qu’un run sans résultat final reste `NOT_READY` et ne fabrique aucun nœud.

### Niveaux

| Gate | Niveau | Ce qui est prouvé | Ce qui ne l’est pas |
|---|---|---|---|
| `fury-trace` + `fury-run` | intégration locale | graphe issu d’un run FuryPipe réel de test, hash-chain, liens bundle/receipts | fournisseur externe réel |
| Studio API | intégration locale | route bornée, lecture seule, 404/400, autorité d’exécution fausse | run hébergé |
| Mission Control UI | browser | état `NOT_READY`, action d’inspection et rendu source-backed | validation visuelle humaine |
| AccessLint | accessibility | DOM de Mission Control sans violation échantillonnée | conformité globale |

## VNEXT-02 done when

- `src/fury-trace.ts` refuse absence de résultat, format incohérent et replay corrompu ;
- le graphe lie run, replay, événements, workers, receipts, FuryJudge et bundle sans nouveau store opaque ;
- la route et le parcours UI sont testés ;
- un run de test réel produit une trace `READY` avec head vérifié ;
- `NOT_READY`, `INVALID`, `executionAuthority=false` et le verdict FuryJudge restent distincts ;
- validation client humaine reste séparée de la preuve automatisée.

## Évidence à joindre à une future PR

- exact commit et dirty state ;
- commandes et résultats bruts ;
- résumé des tests XML si disponible ;
- hash du package seulement après tarball installé/smoke ;
- captures ou traces browser avec dimensions ;
- résultat AccessLint ;
- acceptation humaine séparée de l’automatisation.
