# FuryPipe — AI harness market benchmark 2026

**Date d’observation :** 2026-10-02
**Périmètre :** interfaces AI locales/self-hosted, harnesses, agents de code, orchestration, artefacts, graphes et observabilité.
**Statut des affirmations :** `DOCUMENTÉ` = annoncé dans la source primaire ; `INDÉPENDAMMENT TESTÉ` = reproduit par FuryPipe dans ce dépôt ; `EXPÉRIMENTAL` = annoncé comme bêta/preview ou dépendant d’une intégration non validée ici ; `PROPOSÉ` = décision FuryPipe, pas capacité concurrente observée.

## Résultat court

Le marché sépare encore les forces :

- interface/chat et modèle local : Open WebUI, LibreChat ;
- agent de code et contrôle de conversations : OpenHands, OpenCode, Codex ;
- orchestration durable : LangGraph, OpenAI Agents SDK ;
- workflow visuel et intégrations : n8n, ComfyUI ;
- traces/evals : Langfuse ;
- automatisation navigateur : Browser Use, Playwright MCP ;
- extensibilité expérimentale : DeepSeek Harness, écosystème `dsh-plugin` ;
- workspace orienté résultat : OpenDesign, Archify.

FuryPipe ne doit pas copier leurs backends. Sa position défendable est un workspace local unifié qui relie conversation, tâche gouvernée, contexte, artifact durable, provenance et preuve, en réutilisant `FuryDispatcher`, `FuryIR`, `FuryArtifacts`, `RecoveryStore`, `FuryGraph` et le Studio déjà présents.

## Règles de lecture

Les dépôts externes n’ont pas été clonés ni exécutés pendant ce benchmark. Les claims ci-dessous viennent de leurs README/pages GitHub officielles et de l’API GitHub pour le dernier commit observé. Une licence affichée sur GitHub n’est pas une autorisation de copier du code sans revue des fichiers `LICENSE`, notices, dépendances et provenance du commit ciblé.

`État du dépôt` donne un instantané, pas une garantie de stabilité. Les versions et branches évoluent.

## Comparatif primaire

| Projet | Surface observée | Ce que la source documente | Licence affichée | Dernier commit observé | Lecture FuryPipe |
|---|---|---|---|---|---|
| [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) | Harness extensible | Architecture “everything-is-a-plugin”, Cordis, topic `dsh-plugin` ; README dit `Developer preview` et annonce des breaking changes | MIT + third-party notices | `639ed015397290b3745d163aafe02ffee4aa3f84e` · 2026-09-29 | Étudier les frontières de plugins ; ne pas adopter le runtime sans audit sécurité/licences. `EXPÉRIMENTAL` côté source. |
| [OpenDesign](https://github.com/nexu-io/open-design) | Workspace collaboratif design | Brief → prototype → feedback → raffinement ; README annonce fichiers/export et support DSH avec streaming structuré, découverte modèle, cancellation, resume | Apache-2.0 | `53231d40b778d88eba23f35547bf99485d3ae9fc` · 2026-09-30 | Inspiration pour “même projet, même artifact, même boucle feedback”. Support DSH `DOCUMENTÉ`, non testé par FuryPipe. |
| [Archify](https://github.com/tt-a1i/archify) | Artifact HTML d’architecture | JSON IR typé, validation atomique, last-good preview, repair receipt, interactions véridiques et evidence source épinglée à des fichiers/lignes Git | MIT | `d5a1333d7447c866a765adac7d4d062f2f02e4d2` · 2026-09-30 | Inspiration directe pour artifacts vérifiés, digest, last-good et provenance ; pas de copie de code. |
| [DSH plugin topic](https://github.com/topics/dsh-plugin) | Découverte communautaire | Le topic agrège des plugins tiers et montre des projets hôtes/client ; c’est une source de découverte, pas une preuve de confiance | Variable | Page observée 2026-10-02 | FuryPipe doit afficher licence, commit, hash, permissions et provenance avant toute installation. |
| [OpenHands](https://github.com/OpenHands/OpenHands) | Agent Canvas / contrôle développeur | Conversations, backends locaux/distants/cloud, automatisations, intégrations, ACP ; le README avertit que l’exécution sans sandbox donne accès au filesystem | MIT | `8b0be7d5181db68be05261dbeafb580f7a5a4140` · 2026-10-02 | Bon modèle de backend interchangeable et d’automatisation ; FuryPipe garde son propre système de permissions et d’isolated worktrees. |
| [Open WebUI](https://github.com/open-webui/open-webui) | Interface self-hosted multi-modèle | Ollama + API compatibles OpenAI, offline, intégrations fichier, OpenTelemetry, sessions Redis/WebSocket ; licence avec historique et exigences de branding | Licence Open WebUI + licences historiques | `8bd8b4fac5e059578ac0c74b3c18d11139f88b7d` · 2026-09-21 | Référence UX chat/local, mais pas source de vérité pour tâches/artifacts FuryPipe. Revue de licence obligatoire. |
| [LangGraph](https://github.com/langchain-ai/langgraph) | Orchestration bas niveau | Agents stateful long-running, durable execution, human-in-the-loop, mémoire et debug/metrics LangSmith | MIT | `3af263175f3170662440a16517f828e4f4d426f3` · 2026-10-02 | Compare avec FuryIR + RecoveryStore + gates ; le besoin FuryPipe est de rendre ces états visibles et bornés dans Studio. |
| [Browser Use](https://github.com/browser-use/browser-use) | Agent/browser local ou cloud | Trois voies : cloud hébergé, CLI, librairie Python ; browser local/cloud, profils/enregistrements/policies annoncés côté cloud | MIT | `ebafaa11571dcb1a928a2b971d2f5d5eb15f3c29` · 2026-10-02 | Une capacité future doit rester derrière `NETWORK`, provenance, confirmation et preuve navigateur. Aucun package tiers exécuté. |
| [ComfyUI](https://github.com/Comfy-Org/ComfyUI) | Graph/node media local | Graph visuel, workflows JSON, API locale, queue async, re-exécution partielle, custom nodes, offline optionnel | GPL-3.0 | `2472a20bd291451acc303917059ab14dfc380478` · 2026-10-02 | Référence media graph et artifacts ; licence GPL et custom nodes empêchent toute intégration opportuniste. |
| [Langfuse](https://github.com/langfuse/langfuse) | Observabilité/evals LLM | Traces, développement collaboratif, monitoring, évaluation, debug, self-hosting, intégrations nombreuses | Voir licence du dépôt | `712dd47f1b428658da0b96475bb3a4d4d0af5fed` · 2026-10-02 | Confirme la valeur d’un panneau trace/evidence ; FuryPipe ne doit pas prétendre à un coût mesuré sans télémétrie réelle. |
| [Playwright MCP](https://github.com/microsoft/playwright-mcp) | Browser MCP | Snapshot accessibility structuré, actions déterministes ; le README dit explicitement que le serveur n’est pas une security boundary | Apache-2.0 | `f183dad4a52965583e3cc1d59b88cdc279e2e57d` · 2026-09-28 | Bonne base de QA structurée, jamais une frontière de confiance ; conserver allowlist/origins et human gate. |
| [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) | Framework multi-agent | Agents, outils/MCP, handoffs, guardrails, human-in-the-loop, sessions, tracing ; SDK Python | MIT | `81f0ccf20c6e24063b9da36fa37f2bdb6a43d8d3` · 2026-10-02 | Compare les concepts, pas une nouvelle dépendance : FuryPipe possède déjà capabilities, receipts et dispatcher. |
| [n8n](https://github.com/n8n-io/n8n) | Workflow visuel/automation | Canvas, code JS/Python, human approvals, observability, 1 500+ intégrations annoncées | Sustainable Use + Enterprise License | `944afe5c889f130ac07c1831dd88fa7c7103a5c1` · 2026-10-02 | Référence pour workflows, mais incompatible avec le contrat de provenance si on importe des nodes sans audit. |
| [LibreChat](https://github.com/LibreChat-AI/LibreChat) | Chat multi-provider + agents | Agents/MCP/Skills, artifacts, switching, auth, workspaces attachés annoncés `highly experimental`, controls Ask/Allow/Deny | MIT selon page GitHub | `f10b1d91f1eee3a2c82d5247bf620351486b7c1b` · 2026-10-01 | Confirme la demande “chat + workspace + permissions”. FuryPipe doit conserver son modèle local-first et ses preuves. |
| [OpenCode](https://github.com/anomalyco/opencode) | Coding agent terminal/desktop | Agents `build` full-access et `plan` read-only, permission bash explicite en plan ; desktop annoncé beta | MIT | `c42ae0d56b6f86f8df39d451d6d2cfe6414b3928` · 2026-10-02 | Référence pour progressive disclosure plan/build ; ne pas confondre mode UI et autorité runtime. |
| [Codex](https://github.com/openai/codex) | Coding agent terminal | Agent local terminal ; dépôt Rust/Bazel ; licence Apache-2.0 | Apache-2.0 | `44dd77b71e88c78295736bffd3dc3b684c13be6d` · 2026-10-02 | Confirme la place d’un backend coding local, sans remplacer FuryDispatcher ni ses contrats. |

## Matrice capacité → décision FuryPipe

| Capacité | Existant FuryPipe | Décision VNext |
|---|---|---|
| Chat local persistant | `StudioChats`, route Studio Chat | Conserver ; rattacher à un workspace par ID. |
| Tâche planifiée | `FuryPlanner`, `FuryIR`, `FuryDispatcher` | Exposer plan, digest, dispatch et raisons dans le workspace. |
| Autorité | capabilities, gates, Mission Control, receipts | Aucun raccourci UI ; `confirm:true` reste obligatoire pour une écriture. |
| Artifact | `FuryArtifactRepository`, SHA-256, versions, RecoveryStore | Créer puis relire l’artifact ; lier seulement après digest vérifié. |
| Contexte/graph/mémoire | `FuryGraph`, context fabric, memory/time-machine | Progressive disclosure après VNEXT-01 ; pas de deuxième système d’état. |
| Browser/QA | Browser runtime et checks PR déjà présents | Proof séparée : accessibility/automation ne remplace pas l’acceptance humaine. |
| Marketplace/plugins | Skills/MCP/Marketplace existants | Reuse des hubs ; provenance/licence/hash/permissions obligatoires. |

## Findings priorisés

### P0 — Source de vérité projet

Un workspace doit être un index durable, pas une deuxième base métier. VNext-01 utilise le `RecoveryStore` existant pour publier des snapshots immuables versionnés. Les chats et artifacts restent propriétaires de leurs stores actuels ; le workspace ne garde que les liens et les preuves minimales.

### P0 — Séparer plan, confirmation, exécution

Les concurrents mélangent souvent expérience de chat, agent et outil. FuryPipe affiche trois états distincts : `PLANNED`, `CONFIRMED`, `SUCCEEDED`. VNEXT-01 marque `execution: NOT_EXECUTED` pendant la planification et `execution: ARTIFACT_COMMIT` seulement après une écriture d’artifact explicitement confirmée et relue.

### P1 — Last-good et provenance

Archify met en avant IR typé, validation atomique et last-good preview. FuryPipe doit appliquer le même principe aux futures Capability Composer/Artifact Workspace : un rendu invalide ne doit jamais remplacer le dernier état vérifié ; chaque artifact doit garder digest, type, version et source.

### P1 — Plugins et packages

Le topic `dsh-plugin`, les custom nodes ComfyUI et les nodes n8n prouvent l’attrait de l’écosystème, pas sa sûreté. VNext ne lance pas de package tiers arbitraire. Toute reprise future exige : commit exact, licence, dépendances, surface réseau, permissions, hash, tests et rollback.

### P2 — UX progressive

OpenHands, LibreChat, Open WebUI et OpenCode montrent des surfaces puissantes. FuryPipe garde un écran simple centré sur le projet, avec détails agents/tools/permissions/memory/graph/evaluation/logs/provenance dans des panneaux avancés. Le branding noir/orange FuryPipe reste invariant.

## Limites de cette étude

- Aucun dépôt externe n’a été exécuté ni installé.
- Les nombres d’étoiles, forks et versions visibles sur GitHub sont des observations du 2026-10-02, pas des mesures qualité.
- Les capacités annoncées par README restent `DOCUMENTÉ` tant que FuryPipe ne les a pas reproduites sur un commit exact.
- Les benchmarks de fournisseurs/concurrents ne sont pas comparables sans protocole identique ; aucun classement de performance n’est déduit ici.
