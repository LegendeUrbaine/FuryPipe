# FuryPipe Local — information architecture 2026

**Périmètre:** Studio local servi par `node .\bin\cli.js start` sur PR #233.

**Hors périmètre:** FuryPipe Web PR #237, SaaS, Cloudflare, DNS, comptes
distants, déploiement et production Web.

## Carte du shell

```text
FuryPipe Local
├─ Local workspace · Loopback · governed
├─ New chat
├─ Search / commands (Ctrl K)
├─ Workspace
│  ├─ Chat
│  ├─ Work
│  ├─ Code
│  ├─ Agents
│  └─ Autopilot
├─ Explore workspace
│  ├─ Explore: Models, Media, Knowledge, Web, Memory
│  ├─ Operate: Artifacts, Automations, Observability, Mission Control
│  ├─ Connect: Connections, Runtimes, Skills, MCP, Extensions, Integrations, Marketplace
│  └─ System: Support
├─ Recent conversations
└─ Simple / Settings
```

`Settings` reste une destination globale dans le footer pour éviter de la
confondre avec une capacité de travail. La carte de navigation est définie
dans `src/studio/studio-navigation.ts`; les handlers existants ciblent les
IDs et `data-view` sans dépendre de la présentation.

## Taxonomie des surfaces

| Zone | Routes | Question utilisateur |
|---|---|---|
| Workspace | `chat`, `cowork`, `code`, `agents`, `autopilot` | Que suis-je en train de faire ? |
| Explore | `models`, `media`, `knowledge`, `web`, `memory` | Quelles capacités et quelles sources sont disponibles ? |
| Operate | `artifacts`, `automations`, `observability`, `mission` | Comment inspecter, prouver ou piloter le travail ? |
| Connect | `connections`, `runtimes`, `skills`, `mcp`, `extensions`, `integrations`, `marketplace` | Avec quels runtimes et composants travailler ? |
| System | `support`, `settings`, `control-plane` | Comment configurer ou comprendre le système ? |

La route `control-plane` reste une surface technique séparée sous Settings ›
Advanced. Elle n’est pas injectée dans le shell Studio pour éviter deux
dashboards concurrents.

## Divulgation progressive

| Mode | Visible dans la navigation | Intention |
|---|---|---|
| Simple | Chat, Models, Connections, Support | demander et connecter sans bruit opérationnel |
| Power | Simple + Work, Autopilot, Media, Knowledge, Web, Memory, Skills, MCP, Extensions, Marketplace, Artifacts | explorer les capacités gouvernées |
| Engineer | Power + Code, Agents, Automations, Observability, Runtimes, Integrations | construire et diagnostiquer |
| Expert | Engineer + Mission Control | voir les workers, receipts et replay |

Le mode filtre la présentation. Il ne modifie ni permissions, ni API, ni
autorité d’exécution. Le changement est persistant par navigateur et
réversible.

## Navigation et focus

- `Ctrl K` ouvre la palette avec les routes visibles dans le mode courant,
  les changements de mode et les conversations récentes;
- le lien skip arrive avant le shell;
- une navigation interne donne le focus au `h1` de la vue;
- le drawer mobile ferme après navigation;
- `Escape` ferme le drawer et les popovers;
- `data-view` reste l’identifiant stable des surfaces runtime.

## Responsive

- desktop: sidebar persistante, réglable au clavier et à la souris;
- tablette: sidebar toujours cohérente, contenu réduit;
- mobile: sidebar en drawer, header compact, composer et suggestions empilés;
- aucune vue ne doit introduire de débordement horizontal inattendu.

## Règles de contenu

1. Un titre de vue dit ce que l’utilisateur peut faire, pas une promesse
   marketing.
2. Un statut distingue `available`, `detected`, `configured`, `unknown` et
   `not configured`.
3. Les surfaces preview-only nomment explicitement leur absence d’exécution.
4. Une action externe doit rester dans sa frontière gouvernée et afficher son
   état réel.
5. Le texte visible suit le dictionnaire FR/EN existant; les identifiants,
   noms de modèles et états techniques restent stables.

## Critères de fermeture UX

La refonte shell est techniquement prête quand:

- toutes les routes actuelles restent atteignables;
- le mode filtre les groupes sans laisser de catégorie vide;
- les IDs de runtime et le streaming Chat restent fonctionnels;
- le HTML n’introduit ni handler inline, ni origine distante, ni secret;
- les captures 1440, 1024, 768 et 390px restent lisibles;
- Chromium, Firefox, WebKit et l’audit accessibilité passent;
- le verdict humain visuel est repassé de `REWORK_REQUIRED` à `ACCEPTED`.

