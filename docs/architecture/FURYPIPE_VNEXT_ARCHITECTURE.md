# FuryPipe VNext architecture

## Décision

VNext n’ajoute pas un backend incompatible. Il compose les briques locales déjà présentes :

```text
Studio UI
  └─ Studio API /api/studio/workspace/*
       ├─ StudioChats                 conversation durable
       ├─ FuryPlanner → FuryIR        plan déterministe + digest
       ├─ FuryDispatcher              binding, mode, coût, local/cloud, autorité
       ├─ FuryArtifactRepository      versions, content SHA-256, RecoveryStore
       └─ FuryWorkspaceRepository     snapshot d’index, RecoveryStore
```

Le workspace ne devient pas propriétaire des messages, du contenu d’artifact ou des credentials. Il garde un manifeste minimal : `conversationIds`, tâches gouvernées et `artifactIds`.

## VNEXT-01 — workspace manifeste

Format : `furypipe-workspace/v1`. Un snapshot contient :

- `workspaceId`, `projectId`, titre et timestamps ISO normalisés ;
- une `revision` monotone ;
- IDs de conversations ;
- tâches avec objectif borné, fichiers planifiés, digest FuryIR, résumé dispatch, statut et état d’exécution ;
- IDs d’artifacts liés.

Chaque mutation publie un objet content-addressed dans le namespace RecoveryStore `workspace`. La lecture choisit la plus haute révision. Les données sont bornées et validées avant publication. Aucun secret, token ou contenu de chat n’est copié dans le manifeste.

## Cycle tâche/artifact

```text
conversation créée
  → ID attaché au workspace
  → FuryPlanner produit FuryIR + digest
  → FuryDispatcher produit PLANNED / BLOCKED / NO_DISPATCH
  → task PLANNED persistée
  → confirm:true
  → task CONFIRMED persistée
  → artifact repository écrit une version
  → artifact relu et contentSha256 comparé
  → lien workspace + task SUCCEEDED
```

`SUCCEEDED` signifie ici **artifact commit vérifié**. Il ne signifie pas qu’un agent a exécuté la tâche. Une exécution d’agent complète reste la responsabilité de la route Mission Control existante et de ses propres receipts/gates.

## Frontières d’autorité

- `GET /api/studio/workspace.json` : lecture du manifeste ; aucune autorité d’exécution.
- `POST /workspace/conversation` : création explicite d’une conversation locale et liaison de son ID.
- `POST /workspace/task/plan` : planification seulement ; découverte de runtime autorisée, aucun agent lancé.
- `POST /workspace/task/confirm` : confirmation opérateur ; aucun agent lancé.
- `POST /workspace/artifact/commit` : écriture explicitement confirmée dans le repository d’artifacts ; le contenu est relu et son digest vérifié avant liaison.

Le workspace n’appelle pas de package tiers, ne lit pas de credentials d’autres outils, ne lance pas de cloud call implicite et ne transforme pas une observation en autorité.

## Concurrence et reprise

Les écritures d’un repository sont sérialisées dans le processus. RecoveryStore protège la publication sous verrou et le manifeste de révision empêche deux snapshots du même numéro. Une reprise après redémarrage relit le dernier snapshot validé. Les stores source restent indépendants : une éventuelle panne entre artifact écrit et lien workspace laisse un artifact durable mais non lié ; elle doit être affichée comme état à réconcilier, jamais masquée comme succès.

## Progressive disclosure UI

Surface par défaut :

- projet courant ;
- conversation liée ;
- tâche et statut ;
- artifact et digest ;
- prochaine action unique.

Surface avancée :

- plan FuryIR/dispatch ;
- capabilities et gates ;
- agents/runtimes ;
- mémoire/graph ;
- traces, évaluations et provenance.

Le Studio existant reste la shell. Aucun deuxième routeur, aucun deuxième système de plugins, aucun nouveau backend de session.

## Suite architecturale

1. VNEXT-01 : manifeste workspace et artifact commit vérifié.
2. VNEXT-02 : Trace UI branchée aux receipts réels, sans nouveau store opaque.
3. VNEXT-03 : Capability Composer compilé vers FuryIR/Dispatcher.
4. VNEXT-04 : Context OS basé sur context fabric, graph et memory existants.
5. VNEXT-05 : Artifact Workspace last-good, versioning et provenance enrichie.
6. VNEXT-06 : Arena/Time Machine au-dessus des mêmes receipts et snapshots.
