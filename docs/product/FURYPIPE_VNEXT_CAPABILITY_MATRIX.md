# FuryPipe VNext capability matrix

## Légende

- `EXISTE` : chemin présent avant VNext-01.
- `VNEXT-01` : livré dans le slice courant.
- `SUIVANT` : dépendance planifiée, non revendiquée comme livrée.
- `GATE` : preuve externe ou humaine obligatoire.

| Capability | Surface utilisateur | Source de vérité | Statut | Preuve attendue |
|---|---|---|---|---|
| Conversation locale | Chat Studio | `StudioChats` | `VNEXT-01` | conversation persistée + ID lié |
| Projet/workspace | Workspace | `FuryWorkspaceRepository` + RecoveryStore | `VNEXT-01` | snapshot `furypipe-workspace/v1` relu après restart |
| Task plan | Task card | `FuryPlanner` / `FuryIR` | `VNEXT-01` | digest IR, fichiers bornés, dispatch résumé |
| Runtime routing | Advanced task details | `FuryDispatcher` | `VNEXT-01` | `PLANNED`, `BLOCKED` ou `NO_DISPATCH` sans exécution implicite |
| Confirmation | Action card | Studio API gate | `VNEXT-01` | refus sans `confirm:true`, état `CONFIRMED` |
| Artifact commit | Artifact card | `FuryArtifactRepository` | `VNEXT-01` | relire artifact, SHA-256 identique, liaison persistée |
| Agent run | Mission Control | `runFuryTask` / ledger / worktrees | `EXISTE` | receipts, judge, runtime/serveur selon tâche |
| Trace | Observability | registry/receipts existants | `SUIVANT` | trace réellement observée, aucun coût inventé |
| Capability Composer | Composer avancé | FuryIR + Dispatcher | `SUIVANT` | compilation + rejection tests |
| Context OS | Context panel | context fabric, graph, memory | `SUIVANT` | provenance et budget de contexte |
| Artifact Workspace | Canvas/versioning | Artifact Repository | `SUIVANT` | last-good + repair receipt + source |
| Arena / Time Machine | Compare/replay | receipts + snapshots | `SUIVANT` | replay déterministe et limites explicites |
| Plugins/marketplace | Explore avancé | Skills/MCP/Marketplace | `EXISTE` | licence, hash, permissions, provenance, approval |
| Browser QA | QA interne | browser runtime/Playwright | `GATE` | desktop/tablet/mobile + accessibility + human visual |

## Contrats non négociables

1. Une tâche planifiée n’est pas une tâche exécutée.
2. Un artifact présent sur disque n’est pas un artifact lié : liaison après vérification.
3. Un digest prouve l’intégrité du contenu observé, pas la qualité sémantique.
4. `BLOCKED` reste visible ; l’UI ne convertit pas l’absence de runtime en succès.
5. Les capacités cloud restent explicites et soumises au budget/consentement.
6. Un benchmark externe documente une source ; il ne prouve pas FuryPipe.
