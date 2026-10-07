# FuryPipe — journal d’exécution

> [!NOTE]
> **Historical engineering worklog.** Statements such as “no merge/publish/release” are accurate only for the dated checkpoint where they appear. FuryPipe `v0.13.2` is now publicly released; current status lives in [README.md](README.md) and [docs/RELEASE_SECURITY.md](docs/RELEASE_SECURITY.md).


## 2026-09-11 — M0 checkpoint initial

- Workspace de départ : `C:\Users\loicd\Desktop\FuryPipe-Build` non Git, starter pack conservé.
- Dépôt cible cloné localement dans `FuryPipe` depuis `https://github.com/Mistermode45/FuryPipe.git` ; dépôt distant initialement vide.
- `origin` : `https://github.com/Mistermode45/FuryPipe.git`.
- `upstream` : `https://github.com/teamchong/pxpipe.git`.
- Branche locale : `main`, basée sur upstream `8ba82b713a1e823bc1c09b7a68e47f63caa7b426`.
- Environnement : Windows 11 x64, PowerShell 7.6.5, Git 2.54.0, Node.js 26.8.2, npm 11.14.1, pnpm 12.3.4 ; Docker absent.
- Baseline : installation frozen, typecheck et 1 217 tests upstream verts ; build upstream reproduit un défaut de chemin Windows.
- Correctif minimal dans `scripts/build.mjs` : résolution `fileURLToPath(pathToFileURL(...))` ; build, smoke test, typecheck et 1 236 tests verts après patch.
- M3 livré localement par tranches : `src/core/exact-guard.ts`, `src/core/recovery-store.ts`, exports package, puis receipts opt-in ; le store est SHA-256/raw bytes pour cette tranche. BLAKE3/zstd restent explicitement non implémentés.
- Audit production : `pnpm audit --prod --audit-level high` vert ; licences détectées via `pnpm licenses list --json`.
- Identité CLI locale : package `furypipe@0.13.2`, bins `furypipe` et alias legacy `pxpipe`; `doctor --json` détecte Node/npm/pnpm, outils et limites sans lire les secrets.
- CI `ci.yml` et workflow de release alignés sur Node `26.8.2`; publication npm toujours non exécutée.
- Context IR, Instruction Ledger et cache planner ajoutés dans `src/core`; MCP stdio local ajouté dans `src/mcp.ts` avec `furypipe-mcp`, handshake réel et 6 tests de contrat.
- Policy Engine ajouté dans `src/core/policy-engine.ts` : contraintes dures et décision `raw`/`native-cache`/`guarded-lossy`, sans mutation du proxy.
- Receipts opt-in ajoutés dans `src/core/receipt.ts` et `transformAnthropicMessages` : hashes SHA-256 des octets original/transformé, spans ExactGuard hashés, stratégie, handles et effets cache ; plaintext non conservé. Trois tests dédiés verts.
- Après receipts : suite complète 85 fichiers / 1 239 tests verte, typecheck vert, build Node + MCP vert ; export public vérifié et `npm pack --dry-run` vert avec 141 entrées. Le pack signale seulement trois clés `.npmrc` spécifiques à pnpm que npm ne connaît pas.
- Mise à jour complète des dépendances avec `pnpm update --latest` : `gpt-tokenizer 4.0.0`, `vitest 5.0.0`, `vite 8.3.0`, `wrangler 4.131.0`, `@cloudflare/workers-types 5.20260911.1`, `@napi-rs/canvas 1.0.9`, `@types/node 26.5.1`, `tsx 4.23.13` et lockfile synchronisé. `pnpm outdated --format json` est désormais vide.
- Validation après mise à jour : `pnpm install --frozen-lockfile`, 85 fichiers / 1 240 tests, typecheck, build, audit production, doctor et pack dry-run verts. Vitest 5 signale seulement une observation de performance sur ses isolates ; aucun échec.
- Receipts OpenAI ajoutés dans les wrappers Chat Completions et Responses via `TransformInfo.receipt`, sans modifier la sortie par défaut. Les tests receipts couvrent désormais Anthropic, les deux protocoles OpenAI et l'entrée UTF-8 invalide.
- Validation après ce branchement : suite complète 85 fichiers / 1 241 tests, typecheck et build Node + MCP verts ; aucune publication ni connexion provider réelle.
- M5 ajouté : `src/core/content-classifier.ts` classe JSON/code/log/tool output/Markdown, signale ExactGuard et retourne `allow`/`guarded`/`deny` sans plaintext.
- M6 ajouté : `src/core/source-retrieval.ts` indexe des handles et recherche littéralement avec offsets sans texte retourné ; `src/core/document-compiler.ts` découpe UTF-8 et construit un IR metadata-only.
- Validation M5/M6 : suite complète 88 fichiers / 1 249 tests, typecheck et build verts ; 8 tests ciblés classifier/retrieval/compiler, audit et package final à remesurer.
- Mesure finale M5/M6 : `npm pack --dry-run` = 147 entrées (4 064 314 octets compressés / 16 459 325 décompressés) ; inventaire licences actualisé (MIT 57, Apache-2.0 7, MIT OR Apache-2.0 4, ISC 3, MPL-2.0 2, autres déclarées dans les notices).
- Limite : CI macOS/Linux, Docker, publication et tests avec credentials/provider réels non exécutés.

## 2026-09-11 — M0/M2/M3/M4/M8 checkpoint V5 production hardening

- GitHub cible vérifié par `git ls-remote` ; le HEAD distant correspond exactement à `26a9be93a765576ce338ed5b8d02bbff9f3f76fe`.
- Remotes et sources amont vérifiés : pxpipe `8ba82b7…`, ECC `c9148d0…`, Matt Pocock skills `3cca18b…`.
- Branche locale créée sans écrasement : `v5-production-hardening`, commit de départ `26a9be93…`.
- M2 : IDs Context IR rendus uniques pour les chunks répétitifs ; compiler grapheme-safe, ranges UTF-8 et CRLF ; ledger avec scope/supersedes/historique.
- M3 : ExactGuard devient un gate réel de `transformRequest` lorsqu’il est configuré ; détection protégée = pass-through natif et diagnostic sans plaintext.
- M4 : Recovery Store ajouté : quotas optionnels objet/namespace, sérialisation des writes, TTL `expiresAt` et GC vérifiable.
- M8 : MCP stdio étendu à `index_text`, `index_bytes`, `fetch_text`, `fetch_bytes`, `fetch_bytes_base64`, `fetch_range`, `fetch_lines`, `verify_handle`, `manifest`, `delete_handle` ; `fetch_exact` reste un alias base64 exact.
- Tests ciblés : 5 fichiers, 26 tests verts ; typecheck vert.

## 2026-09-11 — Continuation autorisée : CI et runtime Node

- Accès GitHub vérifié avec le compte authentifié `Mistermode45`; droits `repo` et `workflow` présents, aucun secret affiché.
- Push autorisé exécuté vers `origin/v5-production-hardening`; le SHA distant est `d03db733406efb003cb70007bab48b6623f9a892`.
- La branche par défaut réelle du dépôt est `v5-codex-review-clean`, pas `main`. Une PR draft de vérification a été créée contre cette branche : aucune fusion effectuée.
- Première CI distante : Ubuntu Node 20.19.0 et 26.8.2, macOS Node 20.19.0 et 26.8.2, Windows Node 26.8.2 verts ; Windows Node 20.19.0 a échoué avec `ENOTEMPTY` au nettoyage d'un répertoire temporaire dans `tests/node-security.test.ts`.
- Correction minimale : `fs.rmSync` utilise désormais des retries bornés pour absorber la fermeture différée des handles NTFS ; le fichier ciblé passe localement, 4 tests.
- La CI passe à Node 22.23.2, 24.21.0 et 26.8.2 sur Ubuntu 24.04, Windows 2025 et macOS 14. Node 24 devient le baseline de production ; Node 20 est retiré de la matrice et du champ `engines`.
- Le workflow release est aligné sur Node 24.21.0 sans déclencher de publication.
- `scripts/package-smoke.mjs` ajouté : le gate fabrique et installe le tarball réel, vérifie la version CLI, `doctor --json` et le handshake MCP. Smoke local PASS.
- Gates locales après ces changements : typecheck PASS, build PASS, test sécurité ciblé PASS, package smoke PASS. L'invocation Windows du smoke est désormais sans warning `DEP0190`.
- CI V5 intermédiaire : Windows Node 22.23.2 et 24.21.0 ont passé le package smoke ; les six jobs Unix ont révélé que le shim `.bin/furypipe-mcp` ne produisait aucune réponse. Le point d'entrée `bin/mcp.js` est maintenant explicite et le smoke invoque le fichier package installé avec l'exécutable Node, sans shell.
- Le run PR du commit `303bf78` a ensuite isolé une course de nettoyage Windows Node 22 (`exit` avant `close`) dans `tests/node-security.test.ts`; l'attente est passée à `close` et le retry NTFS est borné à 30 tentatives. Trois exécutions locales successives du test sécurité passent.
- Limites : HTTP/OAuth MCP, OpenClaw, provider live, CI distante, chiffrement, backup/restore, SQLite et release restent non livrés.

## 2026-09-11 — MCP conformance boundary

- Spécification MCP officielle courante consultée : JSON-RPC 2.0, IDs de requête chaîne/entier non nul, notifications sans réponse, auth distincte pour HTTP et stdio.
- Dispatcher corrigé pour refuser les IDs absents, null ou non entiers sur les requêtes ; notifications restent sans réponse.
- ExactGuard custom rules bornées à 64 règles, patterns de 512 caractères et texte de 4 MiB maximum ; aucune valeur protégée n’est copiée dans le diagnostic.
- Tests ajoutés : frontière MCP et limites ExactGuard ; typecheck vert.

## 2026-09-11 — final local gate for current checkpoint

- Branche contrôlée : `v5-production-hardening` ; commit avant ce journal : `41e466481369d3bd047ae616c19bae96da11e389`.
- Suite complète : `88` fichiers de test et `1 257` tests verts ; durée observée 13,43 s.
- TypeScript : `pnpm run typecheck` vert.
- Build : `pnpm run build` vert ; `dist/node.js` et `dist/mcp.js` générés ; smoke CLI `0.13.2`.
- Audit : `pnpm audit --prod --audit-level high` = `No known vulnerabilities found`.
- MCP réel local : handshake stdio `2025-11-25` avec `furypipe-recovery 0.13.2`.
- Package dry-run : `furypipe@0.13.2`, 147 fichiers, 4 068 733 octets compressés, 16 481 278 octets décompressés.
- Licences installées : MIT 57, Apache-2.0 7, MIT OR Apache-2.0 4, ISC 3, MPL-2.0 2, Apache-2.0 AND LGPL-3.0-or-later 1, CC0-1.0 1, BSD-3-Clause 1.
- SHA-256 artefacts : `dist/node.js` = `0BD02C9AF461585EF59BC783EB1D02F1E0C5B0128E0551E3788E4A16F238256B` ; `dist/mcp.js` = `E22F6F097A32BB903E627E3A3942298DDE3D343FFF87A4CF4F57D33E18340DB4`.
- Limites finales : aucun run CI distant, provider réel, client visuel, HTTP/OAuth MCP, OpenClaw, Docker, Linux/macOS, chiffrement ou ACL Windows ; aucun push, merge, npm publish ou deploy.

## 2026-09-11 — Recovery backup/restore

- Recovery Store complété par backup versionné local et restore sans écrasement ; les fichiers identiques sont idempotents et les conflits de contenu sont refusés.
- Test de round-trip backup/suppression/restore vert ; suite ciblée Recovery : 7 tests verts ; typecheck vert.
- La limite « backup/restore » de l’entrée précédente est remplacée par la limite « chiffrement/ACL/SQLite/orphan GC ».

## 2026-09-11 — final gate after recovery checkpoint

- Commit contrôlé : `a50921cd302da957f2fd22e2a97ecbcc91b9a382`.
- Suite complète post-backup/restore : `88` fichiers, `1 258` tests verts, durée observée 13,13 s.
- Typecheck, build, audit production et `git diff --check` verts.
- Package dry-run : `furypipe@0.13.2`, 147 fichiers, 4 069 975 octets compressés, 16 488 778 octets décompressés.
- SHA-256 : `dist/node.js` = `0BD02C9AF461585EF59BC783EB1D02F1E0C5B0128E0551E3788E4A16F238256B` ; `dist/mcp.js` = `1897586E405CE221B7C27767338E84BFAD9525CAD16ECE464F5327DF997DC0B1`.
- État Git : arbre propre sur `v5-production-hardening` ; aucun push, merge, publication ou déploiement.

## 2026-09-11 — ExactGuard automatique et Recovery multi-namespace

- ExactGuard est désormais appliqué automatiquement par `transformRequest` en mode `balanced` par défaut ; `safe`, `coding-safe` et `safetyMode: false` sont explicites et testés.
- Le préflight protège les valeurs critiques sans stocker leur plaintext dans la télémétrie ; les blocs `tool_result` protégés restent natifs tandis que les autres zones peuvent encore être transformées.
- La ligne de facturation `x-anthropic-billing-header` reste traitée comme métadonnée de transport et n’empêche pas son extraction ; un `exactGuard` explicite conserve toujours la requête complète.
- Le paging de fixture lockfile utilise désormais l’opt-out documenté, car ses checksums synthétiques sont volontairement hors périmètre de fidélité de ce test.
- Recovery ajoute `maxGlobalBytes` partagé entre namespaces et sérialise les mutations par racine réelle, y compris entre instances créées séparément.
- Chaque nouvel objet reçoit maintenant un manifeste atomique ; `gc()` supprime aussi les objets sans manifeste, sans toucher les manifestes invalides ou valides non expirés.
- Tests locaux après ces changements : suite ciblée ExactGuard/Recovery/render/billing/paging verte ; suite complète 88 fichiers / 1 262 tests ; typecheck vert.
- Revue MCP officielle effectuée sur la spec `2026-07-28` et le SDK TypeScript `@modelcontextprotocol/server`/`client`/`core` `2.0.0`. La cible moderne est stateless, self-describing, sans handshake obligatoire, avec `server/discover`, `_meta` par requête, headers de routage et cache hints ; le serveur local reste legacy stdio jusqu’à migration et conformance réelles.

## 2026-09-11 — MCP SDK dual-era

- `@modelcontextprotocol/server@2.0.0` est câblé dans `src/mcp-modern.ts` ; il fournit le registre officiel `McpServer`, `createMcpHandler` et `serveStdio`.
- La logique de Recovery est partagée par `executeMcpTool()` entre le dispatcher legacy déjà couvert et les callbacks SDK ; aucun second algorithme métier n’a été introduit.
- `tests/mcp-modern.test.ts` prouve `server/discover`, `tools/list`, index/fetch exact et rejet d’une enveloppe moderne absente. `scripts/package-smoke.mjs` prouve le handshake legacy depuis le tarball installé avec les paramètres MCP requis.
- `pnpm test` post-adaptateur : 89 fichiers / 1 264 tests verts ; typecheck, build et package smoke verts.
- Limites maintenues : aucun listener HTTP ou OAuth de production, aucune validation client/provider hébergée, aucune certification MCP externe.
- CI distante du commit `9dade8d` : runs push `34634021388` et PR `34634025667`, chacun `9/9` vert sur Ubuntu/Windows/macOS et Node 22/24/26.

## 2026-09-11 — M5 Context Fabric runtime

- `src/core/context-fabric.ts` relie le body Anthropic réel à une analyse partagée : parsing, classification des surfaces textuelles, Context IR, Instruction Ledger, contrat de cache et Policy Engine.
- Le chemin de production reste `transformRequest` ; l’analyse est consultative et ne réécrit pas la conversation. La sortie enregistre la stratégie observée (`raw`, `native-cache` ou `guarded-lossy`), les tailles d’octets et la vérification IR/ledger.
- `TransformInfo.contextFabric` ne contient que des compteurs, classes, décisions et identifiants opaques ; les textes sources, ledger et IR complets restent hors du diagnostic.
- `tests/context-fabric-runtime.test.ts` couvre le flux réel, le chemin ExactGuard raw et l’absence de plaintext dans l’analyse.
- Validation : 90 fichiers / 1 266 tests verts ; typecheck et build verts ; le package exporte aussi `./context-fabric`.
- CI docs-only du commit `df46a07` : push `34634492559` et PR `34634496448`, chacun `9/9` vert sur Ubuntu/Windows/macOS et Node 22/24/26.
- Limite : les coûts policy restent estimés ; l’externalize/recovery, les adapters provider, le listener HTTP/OAuth, la conformance externe et la validation hébergée restent ouverts.

## 2026-09-11 — ExactGuard externalize avec Recovery

- `transformRequest` accepte désormais une stratégie explicitement opt-in via `exactGuard: { representationPolicy: 'externalize' }` et `recoveryStore`.
- Les spans sémantiques sont écrits dans Recovery, vérifiés par hash puis relus ; la requête provider-shaped porte un marqueur `[furypipe-externalized:<handle>]` et l’action ExactGuard expose les handles sans plaintext.
- Les champs d’identité de protocole protégés (`id`, `tool_use_id`, `request_id`, `message_id`, `session_id`, `thread_id`) bloquent l’externalisation et forcent le natif afin de préserver la corrélation provider.
- Le wrapper public renvoie `reason: 'externalized'`, `applied: true` et un receipt `strategy: 'externalize'` lorsque `emitReceipt` est demandé. `redact` n’est pas activé.
- E2E ajouté dans `tests/exact-recovery-e2e.test.ts` : externalisation + récupération exacte + receipt, et échec fermé sur champ structurel.
- CI distante du checkpoint M5 `9832ce0` : runs push `34636151930` et PR `34636158894`, chacun `9/9` vert sur Ubuntu/Windows/macOS et Node 22/24/26.

## 2026-09-11 — M6 policy fabric raccordé

- `src/core/policy-fabric.ts` évalue séparément les stratégies `raw`, `native-cache`, `guarded-lossy`, `retrieval` et `hybrid` sans additionner des coûts de chemins mutuellement exclusifs.
- L’analyse expose un état provider borné avec santé `unknown` par défaut, circuit breaker, fallback explicite, canary, rollback sûr et régression qualité ; aucun état live n’est fabriqué.
- Le résultat est appelé depuis `src/core/context-fabric.ts` et reste consultatif : le proxy mature ne change pas de route et aucun provider n’est contacté.
- `tests/policy-fabric.test.ts` couvre l’évaluation des cinq stratégies et le blocage par circuit ouvert.

## 2026-09-11 — M7 provider/model fabric

- `src/core/provider-fabric.ts` ajoute une registry locale pour Anthropic,
  OpenAI-compatible et Google/Gemini autour du routeur historique inchangé.
- La résolution distingue route explicite, inférence par famille modèle,
  protocole par défaut et fallback de provider inconnu ; les aliases
  vendor-qualified restent visibles comme métadonnées.
- Les capacités cache sont bornées par provider : contrat local Anthropic connu,
  OpenAI/Google `unknown`; disponibilité reste `unknown` faute de health probe.
- Les prix absolus utilisent explicitement `COST_UNKNOWN`; aucun ratio de profil
  n’est converti en prix USD et aucune absence n’est comptée comme zéro.
- Le résultat est raccordé à `ContextFabricAnalysis.providerFabric` dans le vrai
  `transformRequest` sans changer la route ni appeler un provider.
- M7 reste `PARTIAL` : adapters provider, probes live, fallback/canary hébergés
  et contrats cache OpenAI/Google nécessitent encore une implémentation et une
  validation réelles.

## 2026-09-11 — M9 OpenClaw adapter/config discovery

- `src/openclaw.ts` ajoute une découverte read-only des chemins OpenClaw
  actuels (`OPENCLAW_CONFIG_PATH`, home/state/profile/workspace) et lit le
  fichier JSON5 sans retourner sa structure ni ses valeurs.
- Le doctor dérive uniquement des métadonnées bornées : validité, fichier
  régulier/symlink, workspace, nombre d’agents, bind/auth et chemins de champs
  sensibles ; les secrets restent absents de toute sortie.
- Les fixtures couvrent JSON5 avec commentaires/trailing comma, surcharge de
  chemin, config absente et config invalide. Aucun binaire ou gateway OpenClaw
  réel n’a été lancé : statut conservé `OPENCLAW_NOT_TESTED`.

## 2026-09-11 — M11 Agent Fabric FuryPipe-native

- `src/agent-fabric.ts` formalise un plan metadata-only en cinq étapes
  (`research`, `plan`, `implement`, `review`, `verify`) avec preuves requises,
  gates et permission read/scoped-write.
- Le registre documente les décisions de concepts ECC/Matt/local (`ADAPT`,
  `WRAP`, `REFERENCE_ONLY`, `REJECT`) avec référence, licence/provenance,
  sécurité et maintenance ; aucun code externe n’est copié.
- Le plan est read-only par défaut, n’active l’écriture qu’avec un opt-in
  explicite, désactive le réseau, ne demande jamais de secrets et ne conserve
  qu’un digest de l’objectif.
- M11 reste `PARTIAL` : aucun harness multi-agent, handoff interprocessus,
  mémoire de prompts ou exécution de skills n’est déclaré livré.
- L’ajout du parser JSON5 OpenClaw a été revu dans l’inventaire de licences :
  `json5@2.2.3` MIT ; le comptage courant est MIT 61, sans changement de
  licence restrictive non documenté.

## 2026-09-11 — M10 correction CI Windows process discovery

- Le run PR `34640686829` du commit documentaire précédent a révélé une
  expiration à 60 s dans `tests/restart.test.ts` sur Windows/Node 26, pendant
  la commande PowerShell `Get-CimInstance Win32_Process`.
- `scripts/restart.mjs` borne désormais chaque appel PowerShell à 5 s et
  utilise `Get-Process -Name node` comme repli limité aux PID/noms ; la
  correspondance d’un proxy par ligne de commande reste réservée au résultat
  WMI riche, et le contrôle de port empêche un démarrage concurrent non
  identifié.
- Le parsing de la forme de repli est couvert ; test ciblé `23/23`, suite
  complète `95 fichiers / 1 282 tests`, typecheck, build, audit et package
  smoke passent en local.
- Le commit `14593fd02338a148bec5bc06d38a25c6ae483892` est poussé ; CI push
  `34641522151` et CI PR draft `34641526734` sont chacun `9/9` verts sur
  Ubuntu/Windows/macOS et Node 22/24/26.

## 2026-09-11 — M8 HTTP boundary sécurisée

- `src/mcp-modern.ts` expose `createProductionMcpHandler()` autour du handler
  SDK dual-era existant. La façade exige un allowlist Host, valide Origin,
  méthode, `Content-Type`, `Accept`, `Content-Length`/taille réelle et un
  message JSON-RPC unique avant dispatch ; elle borne le délai, propage
  l’annulation, ajoute CORS contrôlé et désactive le cache des POST.
- Un endpoint non authentifié doit déclarer explicitement le mode loopback ;
  toute allowlist Host ou Origin non loopback est refusée sans Bearer. Quand un
  verifier est fourni, `requireBearerAuth` officiel vérifie token, expiration
  et scopes ; `oauthMetadata` active uniquement les documents de découverte
  configurés par l’hôte.
- `tests/mcp-http.test.ts` : 12/12 tests ciblés verts, incluant rejets Host,
  Origin, méthode, médias, taille, JSON-RPC/routage, annulation, Bearer,
  découverte OAuth et fallback legacy 2025. Le package smoke vérifie aussi
  l’export installé `furypipe/mcp-modern`.
- Après la tranche : suite complète `96 fichiers / 1 289 tests` verte ;
  `pnpm run typecheck`, `pnpm run build`, `pnpm run audit` et
  `pnpm run package:smoke` passent. Le tarball réel est
  `furypipe-0.13.2.tgz` ; aucun publish n’a été effectué.
- M8 reste `PARTIAL` : aucun Authorization Server, verifier OAuth hébergé,
  listener HTTP intégré au binaire proxy ou test conformance multi-client n’a
  été inventé. Le transport fetch-native est utilisable par l’application
  hôte, mais son montage réseau reste une étape distincte.

## 2026-09-11 — M8 HTTP et tracks parallèles vérifiés à distance

- Le commit courant `c4f0d16c5033ac59ca84c8d562c9e68e638ad62d` est aligné
  localement et sur `origin/v5-production-hardening`.
- CI push `34646766437` et CI PR `34646770940` : `9/9` jobs verts sur
  Ubuntu 24.04, Windows 2025 et macOS 14 avec Node 22.23.2, 24.21.0 et
  26.8.2 ; le package smoke est inclus.
- Gates push et PR du commit courant vertes : CodeQL `34646766357`,
  Supply Chain `34646766430`, Secret Scan `34646766565` et benchmark contract
  `34646766411`, avec leurs équivalents PR `34646770940`, `34646770825` et
  `34646770793` lorsque distincts.
- La fusion non destructive du commit parallèle `138f125d45f648c6ba4406b4ce48e13377d4619c`
  a conservé la tranche M8 et intégré les fichiers de sécurité, benchmarks,
  i18n et web-studio de l’autre track ; aucun de ses fichiers réservés n’a été
  modifié dans la tranche M8.
- Suite locale combinée après fusion : `97` fichiers / `1 295` tests verts ;
  `pnpm run typecheck`, `pnpm run build`, `pnpm run audit` et
  `pnpm run package:smoke` verts. Le tarball contrôlé reste
  `furypipe-0.13.2.tgz` et n’a pas été publié.
- M8 reste `PARTIAL` malgré la CI verte : le handler fetch-native est prouvé
  et exporté, mais le listener réseau intégré, l’Authorization Server,
  le verifier OAuth hébergé, la conformance multi-client et le test réseau
  externe restent non livrés.

## 2026-09-11 — M8 listener Node réel

- `src/mcp-http-node.ts` adapte le handler HTTP sécurisé à un listener
  `node:http` réel, avec route exacte, flux de requête Web, signal d’abandon
  client, écriture de réponse backpressurée, annulation du body de réponse et
  fermeture idempotente du serveur et du handler SDK.
- Le nouveau binaire `furypipe-mcp-http` est opt-in, écoute par défaut sur
  `127.0.0.1:47822/mcp` et refuse tout démarrage sans
  `FURYPIPE_MCP_HTTP_ALLOW_UNAUTH_LOOPBACK=1`. Il n’offre pas de faux bearer
  statique et refuse donc implicitement le bind non loopback en mode CLI.
- `tests/mcp-http-node.test.ts` exécute une vraie requête HTTP locale via le
  listener (liste des outils moderne), vérifie l’isolation du chemin ainsi
  que le rejet de méthode et refuse un bind non loopback sans auth ; `3/3`
  tests sont verts.
- Le package smoke vérifie désormais aussi l’export installé
  `furypipe/mcp-http-node`. Le package contient le binaire
  `furypipe-mcp-http` dans son champ `bin` ; aucune publication n’a été faite.
- Après la tranche : suite locale `98` fichiers / `1 299` tests verts,
  typecheck, build, audit et package smoke verts.
- M8 reste `PARTIAL` : le listener Node loopback est réellement raccordé,
  mais l’Authorization Server, le verifier OAuth hébergé, la conformance
  multi-client et le test réseau externe ne sont pas déclarés livrés.

## 2026-09-11 — M4 Recovery Store chiffré et récupérable

- `src/core/recovery-store.ts` conserve le CAS SHA-256 et ajoute un stockage
  optionnel AES-256-GCM par objet. Le key-ring est fourni par l’application
  hôte (`activeKeyId` + clés de 32 octets) ; aucun secret n’est écrit dans les
  manifests, les logs ou les receipts.
- Les manifests portent le format de stockage et le `keyId`. Les anciennes
  clés peuvent rester lisibles pendant une rotation, puis `rekey()` écrit une
  nouvelle variante chiffrée et déplace la référence du manifest ; `gc()`
  supprime ensuite les variantes chiffrées non référencées.
- Les objets et manifests sont publiés sans écrasement après écriture et
  synchronisation du fichier temporaire. Une publication par hard-link évite
  qu’un writer remplace un objet immuable existant. Les remplacements de
  manifest conservent une sauvegarde récupérable au prochain accès.
- Une configuration chiffrée refuse par défaut la lecture, la sauvegarde ou la
  restauration d’un objet plaintext legacy. La migration doit être explicite
  via `rekey()` ; les variantes sans manifest ne peuvent pas être écrasées.
- Backup/restore vérifient désormais les compteurs, octets, digests et
  ciphertexts déchiffrables ; les résultats distinguent `BACKUP_EXISTS` de
  `RESTORE_VERIFIED`. Les permissions POSIX `0700`/`0600` sont tentées ; les
  ACL Windows restent gérées par l’hôte et ne sont pas déclarées prouvées.
- `tests/recovery-store.test.ts` couvre 14 tests : CAS, isolation, quotas,
  GC, backup/restore, orphan variant, chiffrement au repos, rotation/rekey,
  clé absente, ciphertext altéré, legacy fail-closed et reprise de manifest
  après interruption simulée.
- Preuves locales de la tranche : suite complète `100 fichiers / 1 318 tests`,
  `pnpm run typecheck`, `pnpm run build`, `pnpm audit --prod
  --audit-level high` et `pnpm run package:smoke` verts. Le tarball contrôlé
  est `furypipe-0.13.2.tgz`; aucun publish n’a été effectué.
- Statut M4 : `PARTIAL`. Les tests couvrent une interruption simulée dans le
  même système de fichiers, pas un kill réel du processus, plusieurs writers
  indépendants, une corruption de filesystem ou un contrôle ACL Windows.

## 2026-09-11 — M12 FuryPrompt Compiler

- `src/fury-prompt.ts` ajoute un compilateur structuré FuryPipe-native pour
  `Intent`, `Role`, `Objective`, `Context`, `Inputs`, `Constraints`, `Task`,
  `Plan`, `Tools`, `Skills`, `MCP`, `Subagents`, `Output Contract`,
  `Acceptance Criteria` et `Verification`.
- Les niveaux `TRIVIAL`, `STANDARD`, `ENGINEERING`, `RESEARCH`, `MULTI_AGENT`
  et `SECURITY_CRITICAL` ont un choix explicite ou une inférence bornée. Un
  prompt trivial reste compact ; le niveau security-critical n’est jamais
  déduit d’un mot présent dans le contenu et demande un signal de l’appelant.
- Le rendu est ordonné par une liste canonique, les valeurs restent présentes
  dans la sortie, et les tailles sont bornées avant rendu. Chaque compilation
  expose taille UTF-8, digests SHA-256, sections rendues, explication et
  manifest ExactGuard `safe` par défaut ; les valeurs protégées ne sont pas
  copiées dans le manifest.
- L’export `furypipe/fury-prompt` et l’export racine sont atteignables. Le
  package smoke vérifie l’export installé. Le module n’exécute aucun outil,
  skill, MCP ou agent ; ses `integrationHints` restent metadata-only.
- `tests/fury-prompt.test.ts` couvre 5 tests : compacité, quinze sections et
  ordre, déterminisme/valeurs exactes/manifest, signal critique et limites.
- Preuves locales M12 : suite complète, `pnpm run typecheck`, `pnpm run build`,
  `pnpm run audit` et `pnpm run package:smoke` passent ; le test ciblé
  FuryPrompt est inclus dans la suite. Le tarball réel reste
  `furypipe-0.13.2.tgz` et n’a pas été publié.
- Statut M12 : `PARTIAL` selon la règle de non-promotion des modules isolés ;
  le compilateur public est réel et testé, mais le wiring automatique à
  `transformRequest` et l’exécution par Agent Harness restent à construire.

## 2026-09-11 — M11 Agent Runtime exécutable

- `src/agent-runtime.ts` complète le plan metadata-only par un harness local
  qui exécute réellement les callbacks `research`, `plan`, `implement`,
  `review` et `verify` dans l’ordre. Une étape manquante, une preuve invalide,
  un échec ou un dépassement de budget bloque le run.
- Le contexte d’étape expose l’objectif uniquement à l’exécuteur courant et
  n’offre ni shell, ni réseau, ni secret. La permission reste `read` par
  défaut ; `scoped-write` exige `allowWrites` et des chemins bornés, y compris
  pour un skill ou un subagent.
- Les skills ont une health check et leur consommation de contexte est ajoutée
  automatiquement au budget de l’étape. Les subagents sont des callbacks
  enregistrés par l’hôte, non des objets décoratifs ; leurs résultats sont
  validés et comptés. Les serveurs MCP utilisent une allowlist de méthodes et
  les déclarations réseau sont refusées par la policy `disabled`.
- Le runtime fournit un store mémoire éphémère metadata-only et des snapshots
  de handoff sans objectif plaintext. La reprise vérifie digest, ordre et
  budget avant de continuer.
- `tests/agent-runtime.test.ts` couvre 5 tests exécutables : ordre/skills/
  subagent/MCP, permissions read/scoped-write, budget/preuves, handoff/resume
  et refus MCP/skill. Le résultat complet comptait 101 fichiers et 1 323 tests
  avant cette tranche ; les gates finales M11 seront rejouées après le patch.
- Statut M11 : `PARTIAL`. Le kernel local est réel et testé, mais aucun modèle
  réel, worker interprocessus, handoff distribué ou stockage Recovery durable
  de mémoire n’est déclaré livré.

## 2026-09-11 — M13 Learning and Knowledge

- `src/learning.ts` ajoute un parcours humain borné : diagnostic, roadmap avec prérequis, théorie, pratique, exercices, projet, quiz, explain-back, graphe de maîtrise et reviews espacées.
- `recordHumanLearningAttempt()` met à jour la maîtrise depuis des scores validés et recalcule le chemin recommandé et la prochaine révision.
- Le cycle agent exécute réellement `Plan -> Execute -> Verify -> Reflect -> Extract lesson -> Validate -> Store -> Reuse` via callbacks fournis par l’hôte.
- La mémoire agent exige une validation avant stockage et ne conserve que des métadonnées, digests et handle de contenu opaque. Aucun prompt brut, secret, réseau, RAG ou fine-tuning n’est implicite.
- Six tests ciblés M13 et l’export package smoke couvrent cette tranche. Statut : `PARTIAL`, les intégrations durables/modèle hébergé restent ouvertes.

## 2026-09-12 — Synchronisation M13 à M19 et intégration Control Room

- Le commit distant `dbb2fbe3cd9d5db4de7b27abcfef0ef67cba11c0` a été récupéré par fast-forward sans écraser de travail local. Il intègre la PR #10 de ChatGPT (`v5-chatgpt-control-room`), déjà fusionnée, avec le kernel `src/control-room/index.ts`, ses 8 tests et `docs/CONTROL_ROOM_V5.md`. Les fichiers réservés au Control Room ne sont pas modifiés dans cette tranche.
- M13 reste `PARTIAL` : le stockage actuel est validé et metadata-only, mais la persistance Recovery durable, le graphe de connaissances/RAG, le modèle/provider réel, la validation hébergée et le multi-instance restent ouverts.
- M14 est `PARTIAL / KERNEL_IMPLEMENTED_NOT_WIRED` : le kernel local est présent et testé ; Figma, Playwright, génération de site, WCAG, OWASP, SEO, Web Vitals et déploiement externe ne sont pas exécutés.
- M16 est `PARTIAL / TESTED_REMOTE` sur le dernier commit validé `60005514` : CodeQL, Gitleaks, supply-chain/SPDX, licence compliance et audit de dépendances ont fourni des preuves distantes ; la revue selon graphe, l’attestation de release, la release candidate et npm restent ouvertes. Les contrôles du commit `dbb2fbe` sont encore en cours au moment de cette synchronisation.
- M17 devient `PARTIAL / HARNESS_IMPLEMENTED_BENCHMARK_NON_EXECUTED` : les contrats/harness existent, mais aucun benchmark provider réel n’a été lancé et aucun gain de performance n’est revendiqué.
- M18 i18n devient `RUNTIME_KERNEL_IMPLEMENTED_NOT_SURFACE_WIRED` : le kernel locale/fallback/direction/parité existe ; les surfaces CLI, dashboard et browser restent non câblées.
- M19 reste `BLOCKED` : aucun merge de release/default branch, npm publish, tag ou déploiement n’est autorisé sans approbation explicite.

## 2026-09-12 — M4 Recovery : verrou inter-processus

- `src/core/recovery-store.ts` ajoute un verrou exclusif `.recovery.lock` à la racine du store. Les namespaces partageant une même racine sont ainsi sérialisés par un verrou commun, en complément de la chaîne mémoire existante.
- Le verrou est borné à 30 secondes d’attente, récupère un fichier abandonné après 60 secondes d’inactivité et renouvelle son `mtime` toutes les 10 secondes pendant une opération. La libération vérifie le token de propriétaire afin de ne pas supprimer le verrou d’un autre processus après reprise.
- Les opérations publiques `put`, `get`, `verify`, `manifest`, `delete`, `gc`, `backup`, `restore` et `rekey` passent par cette frontière ; l’initialisation et la libération nettoient également les échecs connus.
- `tests/fixtures/recovery-worker.ts` et `tests/recovery-store.test.ts` exécutent des processus Node distincts pour la course de quota globale, `put/get/delete/backup/restore/rekey` et la reprise d’un verrou horodaté comme abandonné. Résultat ciblé : 14 tests verts.
- Limites honnêtes : le test ne force pas encore un kill au milieu de chaque phase d’écriture ; les ACL Windows réelles restent gérées par l’hôte et SQLite n’est pas introduit.

## 2026-09-12 — M12 FuryPrompt runtime wiring

- `TransformOptions.furyPrompt` est une option explicite : `transformRequest` compile la structure une fois avant ExactGuard et Context Fabric, l’ajoute comme bloc `system`, puis conserve les champs provider existants. Sans cette option, le chemin historique ne compile rien ; `TRIVIAL` reste compact et sans wrapper.
- Une compilation invalide retourne le body original avec `furyprompt_error`. Le diagnostic Transform ne conserve que niveau, tailles, digests et ordre des sections. ExactGuard reçoit la requête augmentée, et une décision `preserve_native` conserve cette requête explicite plutôt que de perdre silencieusement l’augmentation.
- `createAgentFabricPlan` expose uniquement le niveau, la taille et le digest. `runAgent` compile une fois, expose le texte compilé aux callbacks via `context.prompt` et lie le digest au snapshot ; une reprise avec un prompt différent est rejetée.
- Les tests M12 couvrent le compilateur historique plus 4 scénarios de wiring Transform, et Agent Fabric/Runtime couvrent le routage metadata-only, le callback réel et l’invalidation de snapshot. Validation ciblée : 20 tests verts ; typecheck vert.
- Statut M12 : `PARTIAL`. Le wiring local est réel, mais aucun modèle/provider réel, exécution multi-agent, conformance hébergée ou outil implicite n’est déclaré.

## 2026-09-12 — M11 Recovery-backed agent handoff

- Objectif : fermer la lacune de persistance mémoire et prouver une reprise après changement de processus sans écrire l’objectif, le prompt ou les preuves textuelles.
- Fichiers : `src/core/recovery-store.ts`, `src/agent-runtime.ts`, `src/core/index.ts`, `tests/recovery-store.test.ts`, `tests/agent-runtime.test.ts`, `tests/fixtures/recovery-worker.ts`, `docs/AGENT_FABRIC.md`, `docs/PXPIPE_GAP_ANALYSIS.md`, `TASKS.md`.
- Implémentation : listing Recovery borné et filtrable par metadata ; `createRecoveryAgentMemoryStore()` avec enveloppe versionnée, validation fail-closed et payload metadata-only ; fixture enfant qui reprend `runAgent()` avec le snapshot parent.
- Vérification ciblée : `pnpm exec vitest run tests/recovery-store.test.ts tests/agent-runtime.test.ts` — 2 fichiers, 23 tests verts ; `pnpm run typecheck` — vert.
- Limites : processus enfant réel validé, mais aucun kill injecté dans chaque phase d’écriture, aucun orchestrateur distribué ni modèle/provider réel ; M11 reste `PARTIAL`.
- Prochaine action : rejouer la suite complète, build, audit, package smoke puis synchroniser/inspecter CI avant de continuer vers M13.

## 2026-09-12 — M13 Recovery-backed learning lessons

- Objectif : rendre le stockage des leçons validées réouvrable après redémarrage sans persister le texte de tâche ni le contenu d’une leçon.
- Fichiers : `src/learning.ts`, `src/core/index.ts`, `tests/learning.test.ts`, `docs/LEARNING_KNOWLEDGE.md`, `TASKS.md`.
- Implémentation : `createRecoveryAgentLearningStore()` stocke des enveloppes immuables metadata-only ; les réutilisations publient une nouvelle révision et la lecture sélectionne la révision la plus haute par `lessonId`.
- Vérification : test ciblé de réouverture et de `reuseCount` — 7 tests verts ; suite complète — 105 fichiers / 1 363 tests verts ; typecheck, build, audit et package smoke verts.
- Limites : la durabilité locale est visée et la concurrence inter-processus est sérialisée par Recovery, mais le read-modify-write de `reuseCount` entre plusieurs instances reste non transactionnel ; RAG, fine-tuning, modèle/provider et hébergement restent hors preuve.

## 2026-09-12 — M18 CLI i18n wiring

- `doctor` consomme maintenant les catalogues i18n existants pour ses libellés humains et accepte `--locale=<BCP-47>` ; la sortie JSON, les statuts techniques, chemins, versions, URL et identifiants restent inchangés.
- Le test renderer FR et la parité des catalogues couvrent cette surface. Le dashboard, MCP et l’auto-détection de locale OS ne sont pas déclarés câblés.
- Vérification : 3 fichiers i18n/doctor — 16 tests verts ; `pnpm exec tsx src/node.ts doctor --locale=fr` produit la sortie française ; suite complète — 105 fichiers / 1 364 tests verts ; typecheck, build, audit et package smoke verts.
- Documentation corrigée : `docs/I18N.md` et `docs/I18N_RUNTIME.md` distinguent désormais le câblage CLI `doctor` prouvé des surfaces dashboard/browser/MCP encore non câblées.


## 2026-09-12 — Synchronisation finale des preuves `ff6448f`

- GitHub a été revérifié sur le HEAD `ff6448f454097c644d230dfb1770376735a759a4` de la PR #2.
- CI push `34657046569` et CI PR `34657049423` sont vertes sur Ubuntu 24.04, macOS 14 et Windows 2025 avec Node 22.23.2, 24.21.0 et 26.8.2.
- CodeQL `34657046529`, Supply Chain `34657046526`, License Compliance `34657046524`, Secret Scan push/PR `34657046560`/`34657049448` et Benchmark Contract push/PR `34657046540`/`34657049387` sont verts. Dependency Review reste skipped selon le réglage du repository.
- `TASKS.md` a été remis à jour pour supprimer les anciens états « CI à vérifier », l’ancienne référence M16 `60005514`, l’ancien état M18 sans CLI et l’ancien M19 sans évaluateur.
- M4/M11/M12/M13 restent `PARTIAL` malgré la CI distante : leurs limites externes/hébergées et/ou transactionnelles restent explicitement ouvertes.
- M15 reste `PARTIAL` : kernel, API/fragment dashboard et release-readiness sont présents, mais l’alimentation runtime exhaustive du Control Room n’est pas encore prouvée.
- M17 reste `PARTIAL / HARNESS_IMPLEMENTED_BENCHMARK_NON_EXECUTED` : aucun benchmark fournisseur réel n’autorise de claim de performance.
- M18 est désormais décrit comme partiellement câblé : `doctor --locale=fr` est prouvé, dashboard/browser/MCP/auto-détection OS/RTL visuel restent ouverts.
- M19 reste `BLOCKED` même si son évaluateur fail-closed est testé : aucun RC, merge de branche par défaut, tag, publication npm ou déploiement n’est autorisé/exécuté.


## 2026-09-12 — M4 Recovery : reprise après crash process réel

- Cause racine fermée : un arrêt brutal pouvait laisser les fichiers temporaires atomiques `.<uuid>.tmp` sous `objects/` ou `manifests/`. Ils n'étaient ni publiés ni comptés comme objets valides, mais pouvaient s'accumuler après des crashes répétés.
- `createRecoveryStore()` nettoie désormais uniquement les résidus correspondant strictement au format UUID généré par FuryPipe, sous le verrou racine inter-processus, lors de la réouverture du store. Les symlinks et fichiers arbitraires ne sont pas suivis/supprimés.
- La fixture enfant crée un état de crash réaliste (résidu fsync + verrou racine), termine par `SIGKILL`, puis le test vieillit le verrou abandonné et vérifie qu'une nouvelle opération Recovery récupère le store, supprime le résidu et reste lisible.
- M4 reste `PARTIAL` : ce test ne couvre pas encore un kill injecté à chacune des phases internes de publication/rename, les ACL Windows réelles restent host-managed et aucune décision SQLite n'est inventée.
- Tranche PR #15 ; CI/CodeQL/security/license/benchmark distants à vérifier avant merge.


## 2026-09-12 — M7 Provider Runtime health + cost oracle

- `src/core/provider-runtime.ts` ajoute un store runtime explicite pour les observations de santé et les catalogues de prix approuvés par l'hôte.
- Les preuves health ont une fenêtre `observedAt/expiresAt`; une preuve périmée redevient automatiquement `unknown` au lieu de rester verte.
- `runtime.registry(now)` produit un `ProviderRegistry` dérivé, avec uniquement les preuves fraîches. `transformRequest({ providerRegistry })` transmet cette disponibilité au Context Fabric et à la Policy Fabric.
- Une observation `unavailable` devient une contrainte policy `provider unavailable`; sans observation, le comportement reste inconnu/non fabriqué.
- Le cost oracle exige un prix exact provider/modèle et tous les tarifs nécessaires aux tokens utilisés. Les alias non enregistrés et les usages cache sans tarif cache renvoient `COST_UNKNOWN`.
- L'inspection runtime reste metadata-only et n'expose pas les montants du catalogue.
- Aucun provider réel, credential, endpoint payant ou health probe externe n'est exécuté par cette tranche ; M7 reste `PARTIAL`.


## 2026-09-12 — M6 cache / retrieval / hybrid runtime

- Ajout de `src/core/policy-runtime.ts` avec un cache local exact borné par entrée, volume total, nombre d'entrées et TTL.
- Les clés de cache sont SHA-256 sur provider + modèle exact + payload byte-exact ; les buffers sont copiés pour éviter les mutations après `put/get`.
- `executeRecoveryRetrieval()` exécute réellement la recherche sur `RecoveryIndex` mais retourne uniquement handles/offsets/lignes et digest de requête, jamais le plaintext recherché.
- `executePolicyHybrid()` n'appelle le transformeur fourni par l'hôte qu'après une retrieval non vide ; sans preuve retrieval, le payload reste inchangé.
- `PolicyFabricRequest.runtimeCapabilities` rend l'éligibilité retrieval/hybrid explicite et fail-visible.
- Cette tranche ne simule pas le prompt-cache natif d'un provider et ne revendique aucun canary hébergé.


## 2026-09-12 — M15 Control Room live Node evidence

- Ajout de `src/control-room/runtime.ts` : collecteur metadata-only alimenté par les `ProxyEvent` réels.
- Le Node host active ce provider uniquement avec `FURYPIPE_SOURCE_COMMIT=<40-char SHA>`; un SHA absent/invalide laisse Control Room en `NOT_AVAILABLE` au lieu de rattacher des preuves au mauvais build.
- Quand le provider est actif, le transform active `emitReceipt` et le collecteur compte receipts, receipts vérifiés, spans ExactGuard et handles Recovery sans conserver le corps de requête ni `imageSourceText`.
- Les sous-systèmes non observés par ce processus restent `NOT_AVAILABLE`; des overrides hôte explicites existent pour les runtimes séparés.
- L'état de chiffrement Recovery gagne la valeur honnête `unknown` lorsque le collecteur ne possède pas la configuration du store.
- M15 reste `PARTIAL` : Agent/Learning/MCP/security doivent encore alimenter leurs preuves depuis leurs propres runtimes et la validation hébergée n'est pas exécutée.


## 2026-09-12 — M13 Knowledge metadata graph / retrieval

- Ajout de `src/knowledge.ts` et de l'export package `furypipe/knowledge`.
- Les leçons validées peuvent être enregistrées avec des termes explicites fournis par l'hôte ; les termes sont normalisés puis stockés uniquement en SHA-256 domain-separated.
- La recherche renvoie lesson/task digests, memory class, reuse count et `contentHandle` opaque ; ni les termes d'index ni le contenu de leçon ne sont retournés.
- Le graphe accepte uniquement des relations explicites `depends_on/supports/contradicts/related_to`; la preuve de relation est hashée et les dangling/self edges sont refusés.
- Décision backend : metadata index adopté ; SQLite FTS différé tant que le contenu reste opaque ; embeddings/vector DB rejetés pour le baseline faute de provider/modèle validé.
- M13 reste `PARTIAL` : pas de semantic RAG, pas de persistance durable du graphe, pas de validation hébergée et pas de transaction multi-instance.


## 2026-09-12 — M9 OpenClaw HTTP gateway probe

- Vérification de la documentation OpenClaw courante avant implémentation : `/healthz` = liveness, `/startupz` = startup/admission, `/readyz` = deep readiness ; ces probes HTTP sont non authentifiés.
- Ajout de `probeOpenClawGateway()` dans `src/openclaw.ts`.
- Le probe valide le JSON documenté afin de ne pas accepter un HTTP 200 du catch-all Control UI comme preuve de santé.
- Loopback est la politique par défaut ; une origine distante nécessite `allowRemote: true`, les credentials URL/path/query/fragment sont refusés et le timeout est borné.
- Aucun `/v1/chat/completions`, session, tool invoke ou appel modèle n'est exécuté.
- Tests dédiés : healthy, startup/readiness 503, invalid contract/catch-all, unreachable sans fuite d'erreur, remote deny/opt-in, IPv6 loopback et timeout.
- Le vrai Gateway OpenClaw de l'environnement cible n'est pas accessible depuis cette CI : M9 reste `PARTIAL` et la validation externe reste `OPENCLAW_NOT_TESTED/BLOCKED_EXTERNAL_ENV`.


## 2026-09-12 — M13 durable long-term memory

- Ajout de `src/long-term-memory.ts`, basé sur Recovery et séparé de la Working memory.
- Classes durables : Episodic, Semantic, Procedural, Project, User, Skills.
- Scopes : global/workspace/project/user/agent ; les IDs bruts de scope ne sont jamais persistés.
- Consolidation explicite `ADD / UPDATE / DELETE / NOOP` ; chaque écriture produit une révision Recovery immuable.
- `DELETE` écrit une tombstone audit-preserving ; `purge()` supprime physiquement toutes les révisions d'une mémoire.
- Les termes de retrieval, sources et raisons sont persistés uniquement sous forme SHA-256 domain-separated.
- Recall borné avec temporalité `validFrom/validTo/expiresAt`, importance, confiance, recency et filtres de classe/scope.
- Les collisions de plus haute révision restent fail-closed au lieu d'élire silencieusement un gagnant.
- `promoteValidatedLessonToLongTermMemory()` relie Learning à la mémoire durable ; Working memory est refusée sans reclassification.
- Aucun embedding, vector DB, provider ou extraction LLM implicite n'est ajouté au baseline.


## 2026-09-12 — Track B registre écosystème MCP

- Baseline repris depuis `v5-production-hardening` au SHA `423bef619c4306557838142008a858db65b4eea1`; branche de travail `v5-codex-mcp-registry`.
- `MCP_REGISTRY.md` étendu à 19 fiches uniques : protocole, Registry, runtime FuryPipe et candidats externes, dont Figma, 21st, Perplexity et WordPress requis par le master.
- Chaque fiche documente source/version/licence, transport/auth, outils/scope, filesystem/réseau, coût, health/dernier test, risque/décision et politique d’approbation. Les serveurs externes restent `NOT_CONNECTED`; aucun compte, secret ou appel facturable n’a été utilisé.
- Références officielles MCP, fournisseurs et dépôts épinglés; le rapport MCP précédent reste explicitement associé à son SHA `48aaec7`, et ne certifie pas les changements MCP postérieurs.
- Vérification structurelle : 19/19 IDs uniques et champs obligatoires présents; `git diff --check` sans erreur.
- Environnement local : Node `26.8.2`, npm `11.14.1`, pnpm projet `10.21.0`.
- `pnpm install --frozen-lockfile` : PASS, lockfile inchangé.
- `pnpm run typecheck` : PASS.
- `pnpm test` : PASS, 122 fichiers et 1 516 tests.
- `pnpm run audit` : PASS, aucune vulnérabilité connue détectée dans les dépendances de production.
- `pnpm run build` : PASS; modules/declarations, `dist/node.js`, `dist/mcp.js` et version `0.13.2` vérifiés.
- `pnpm run package:smoke` : PASS sur le tarball local `furypipe-0.13.2.tgz`; aucune publication effectuée.
- M8 demeure `PARTIAL` : OAuth/Authorization Server hébergé, vérification d’audience réelle, conformance multi-client, health checks et permissions de vrais tenants non exécutés.


## 2026-09-13 — Governed Provider Request Executor

- GitHub cible `Mistermode45/FuryPipe` et les droits d’accès ont été vérifiés. La branche `v5-production-hardening` a été synchronisée au SHA `d6b1944404e23c5a76a36b4b8ef6def6d8386d53`, qui contient les pistes fusionnées #103/#104/#105. Nouvelle branche dédiée : `v5-codex-governed-provider-executor`.
- Provenance process-local `WeakSet` ajoutée au résultat Context Runtime ; shallow copy, JSON round-trip et faux objet sont refusés par la préparation d’enveloppe.
- Enveloppe immuable issue du prompt final de ce Context Runtime, compilé par `compileFuryPrompt()`. SHA-256 domain-separated lie provider, modèle, workload, protocole et texte exact.
- Gate réutilise `ProviderRuntimeState.selectFallback()` avec le seul candidat exact, exige health fraîche/available, modèle exact supporté et famille compatible, puis une policy host explicite default-deny. Permit `WeakMap`, process-local, lié à la requête, à usage unique, durée explicite max 60 s et plafonnée par l’expiration health.
- Registry borné à 32 transports, identifiants canoniques exacts; pas d’alias/fuzzy match. L’exécuteur consomme synchroniquement le permit avant le callback, invoque au plus un transport, sans retry/fallback. Les credentials restent dans le transport hôte.
- Résultats de transport strictement validés; statuts réseau/acceptation restent unknown si absents, sinon `transport-reported`; réponses `Uint8Array` copiées et limitées à 1 MiB; usage partiel préservé; coût `COST_UNKNOWN` si tokens incomplets/prix exact absent/calcul non fini.
- Aucun SDK ou appel réseau réel; tests uniquement locaux/fakes. Aucun changement package/public export, workflow CI ou fichier receipt réservé.
- Échecs transitoires initiaux du typecheck/tests ciblés durant le placement de la provenance corrigés; nouveau typecheck et ciblés passent.
- Environnement mesuré : Node `26.8.2`, pnpm projet `10.21.0`.
- `pnpm install --frozen-lockfile` : PASS, lockfile inchangé.
- `pnpm run audit` : PASS, aucune vulnérabilité de production connue.
- `pnpm run typecheck` : PASS.
- Tests ciblés : PASS, 5 fichiers / 90 tests.
- `pnpm test` : PASS, 151 fichiers / 1 813 tests.
- `pnpm run build` : PASS; modules/declarations, `dist/node.js`, `dist/mcp.js`, version `0.13.2`.
- `pnpm run package:smoke` : PASS pour package smoke, benchmark-claim smoke et provider-attempt smoke sur le tarball local.
- `git diff --check` : PASS. Aucune publication, release, tag, merge ou déploiement effectué.
- Draft PR #106 ouverte vers `v5-production-hardening` : https://github.com/Mistermode45/FuryPipe/pull/106. Head vérifié `dcf22da274abb67eb5a8c9c147d8fff3d87b23d1`; PR `OPEN`, `DRAFT`, non fusionnée.
- CI GitHub lue après achèvement : 20 contrôles `PASS`, dont la matrice complète 9/9 (Ubuntu/macOS/Windows × Node 22.23.2/24.21.0/26.8.2), CodeQL/analyse, audit figé, SBOM, provenance, pinning actions, contrat, Gitleaks et rapports OS. `GitHub dependency review` et `Attest packed npm artifact` sont `SKIPPED` par leurs conditions; ils ne sont pas présentés comme réussis.
- Aucun merge, release, tag, déploiement ou publish; aucun provider réel, transport réseau ou credential appelé.


## 2026-09-13 — Production Provider Transports

- GitHub access confirmed for `Mistermode45/FuryPipe`. Created dedicated branch `v5-codex-production-provider-transports` from the production-hardening integration line. That line advanced to `bc92bef794df25b2a7c5418464a7fee0e4c695f8` while this work was in progress; merged its tip normally into the feature branch (no rebase/force-push).
- Added native-fetch, fixed-endpoint OpenAI Responses, Anthropic Messages, and Google Gemini Interactions adapters. Request bodies preserve the exact approved prompt/model and avoid provider SDKs; host supplies credentials and fetch implementation.
- Shared HTTP runtime bounds response bodies at 1 MiB while streaming, enforces per-call timeout/cancellation, rejects redirects, reports only documented request IDs, bounds retry-after metadata, redacts credential echoes, and never retries/falls back automatically. Non-2xx payloads remain discarded from governed output.
- Extended the governed executor with optional abort-signal context and strictly validated HTTP status/retry delay metadata. Source barrel exists, but package export wiring remains deferred; no package manifest or lockfile edit is part of this feature diff.
- Added provider-specific fake-fetch tests and executor integration tests covering exact endpoints/request payloads, auth and credential secrecy, usage/cache/finish-reason normalization, request IDs, retry metadata, HTTP errors, malformed/empty responses, cancellation/timeouts, limits and network failures. No live provider call, real credential, paid request, production deploy, publish, release or tag was used.
- Verified official provider documentation for endpoint/version, authentication, request/response fields, usage metadata, request IDs and retry guidance; details and links are in `docs/PRODUCTION_PROVIDER_TRANSPORTS.md` (reviewed 2026-09-13).
- `pnpm install --frozen-lockfile`: PASS, lockfile unchanged; `pnpm run audit`: PASS, no known production dependency vulnerabilities; `pnpm run typecheck`: PASS.
- Focused tests: PASS, 6 files / 81 tests. Full `pnpm test`: PASS, 157 files / 1,873 tests. `pnpm run build`: PASS, library/declarations, `dist/node.js`, `dist/mcp.js`, version smoke 0.13.2. `pnpm run package:smoke`: PASS for package, benchmark-claim, provider-attempt and governed-provider tarball smoke. `git diff --check`: PASS.
- Branch changes contain the 16 implementation/docs/test files listed in the baseline; reserved receipt source/test/docs, package manifest, lockfile and governed-provider smoke script are not changed by this feature diff.
- Draft PR #111 opened against `v5-production-hardening`: https://github.com/Mistermode45/FuryPipe/pull/111. Verified `OPEN`, `DRAFT`, not merged; base SHA `bc92bef794df25b2a7c5418464a7fee0e4c695f8`; head SHA `5e09fd436b750530319ea242b6d0c1ffac0b6d55` at first CI completion.
- GitHub CI first pass: 20 controls `PASS`, including the 9/9 matrix across Ubuntu 24.04, macOS 14, Windows 2025 × Node 22.23.2, 24.21.0, 26.8.2; CodeQL, frozen audit, SBOM, provenance input, action pinning, contract, secret scan and license reports passed. GitHub Dependency Review and packed npm artifact attestation were `SKIPPED` by repository workflow conditions, not counted as passes. A documentation-only follow-up updates this evidence; its final-head CI is rechecked separately.
- Stop boundary: do not merge this PR, merge the default/release branch, publish npm, tag, release or deploy production without explicit approval.

## 2026-09-21 — FuryPipe VNext Phase 6 Browser + Coding Runtime — local gate

- Source of truth revalidated before editing : repository `Mistermode45/FuryPipe`, PR #216 OPEN/DRAFT, GitHub head `a8ac42103c96b28305d213c9db02edf37c9aa221`, base `vnext-phase4-channels-notifications`. Le descendant local Phase 5 `3beec507992f4cb698c2ceda4190dca9a2e6c6a5` a été conservé hors de la branche Phase 6.
- Branche active : `vnext-phase6-browser-coding-runtime`, worktree isolé, parent exact `a8ac42103c96b28305d213c9db02edf37c9aa221` avant changement.
- Architecture/documentation : `docs/FURYPIPE_VNEXT_PHASE6_BROWSER_CODING_RUNTIME_2026.md` fixe les frontières Gateway/Kernel/RecoveryStore existantes, les états unknown, les quotas et la non-autorité des observations.
- Browser : lifecycle session/page, permits process-local one-shot liés au principal/session/page/action/cible/policy/TTL, validation SSRF et DNS mixte, revalidation des redirects/final URLs, observation data-only, upload/download gouvernés, hash exact de fichier, redaction et `outcome-unknown` après timeout/cancel.
- Coding : repository capability process-local, worktree provider injecté avec base SHA exact, sandbox read/write séparée et chemins bornés, process shell-free allowlisté, quotas/TTL/output/env, patch exact-base/exact-file/text-only/atomic-per-file fail-closed, CodeGraph V1 incrémental borné et relations package/workspace, coordinator de vérification sans promotion automatique de `exit 0`.
- Fichiers ajoutés : `src/browser-runtime.ts`, `src/coding-runtime.ts`, `src/patch-engine.ts`, `src/codegraph.ts`, `src/phase6-verification.ts`, `src/phase6.ts`, tests ciblés, documentation et `scripts/phase6-package-smoke.mjs`. `package.json` expose les six surfaces publiques Phase 6 et la documentation packagée.
- `pnpm install --frozen-lockfile` : PASS, lockfile inchangé.
- Tests ciblés Phase 6 : PASS, 4 fichiers / 18 tests.
- `pnpm test` : PASS, 247 fichiers / 2 835 tests.
- `pnpm run typecheck` : PASS, TypeScript principal et hosted MCP.
- `pnpm run build` : PASS, bibliothèque/déclarations, `dist/node.js`, `dist/mcp.js`, version smoke `0.15.0`.
- `node scripts/phase6-package-smoke.mjs` : PASS, tarball installé dans un répertoire temporaire et six exports publics Phase 6 importés depuis le package installé.
- `pnpm run package:smoke` : PASS, package smoke, Phase 6 package smoke, benchmark-claim, provider-attempt et governed-provider smoke ; sorties 0.
- `pnpm run audit` : PASS, aucune vulnérabilité connue dans les dépendances de production.
- `git diff --check` : PASS après documentation et packaging local.
- Limites : aucun navigateur réel/Playwright, DNS pinning hébergé, junction/reparse point multi-OS, provider Git réel, Gateway hébergé ou CI GitHub n’est encore prouvé sur ce HEAD ; aucun merge, release, tag, publish npm, deploy ou force push effectué.
- Phase 7 : NOT_STARTED par invariant de fermeture ; elle reste interdite tant que les gates hébergés Phase 6 sur l’exact HEAD ne sont pas verts.

## 2026-09-21 — FuryPipe VNext Phase 6 — exact-head closure

- Source de vérité finale : PR #217 OPEN/DRAFT vers `vnext-phase5-automations-webhooks`, base exacte `672a57a83c33990eb2be71f656929a1ed7ed5ae5`, head exact `2a67a417a6ebeed2885c35284f7537c1519eea86`. Aucun merge, release, tag, publication npm, déploiement ou force push n’a été exécuté.
- Correctif de portabilité découvert par la CI : `validatedUploadPath()` canonicalise maintenant chaque racine d’upload par `realpath` avant le contrôle de containment. Le test de chemin de téléchargement compare aussi une relation de chemins canonique et multi-plateforme. Commits : `82465ec1` puis `2a67a417`.
- Gates locales finales après correction : `pnpm install --frozen-lockfile` PASS ; `pnpm test` PASS, 249 fichiers / 2 865 tests ; `pnpm run typecheck` PASS principal + hosted MCP ; `pnpm run build` PASS, version smoke `0.15.0` ; `pnpm run audit` PASS, aucune vulnérabilité production connue ; `pnpm run package:smoke` PASS pour package, Phase 6, benchmark-claim, provider-attempt et governed-provider ; `git diff --check` PASS.
- CI hébergée sur le HEAD exact : matrice 9/9 PASS (Ubuntu 24.04, macOS 14, Windows 2025 × Node 22.23.2, 24.21.0, 26.8.2), Secret Scan PASS, Benchmark Contract PASS, RC Preparation Evidence PASS, Dashboard Browser QA PASS, Web Studio Browser QA PASS et Cross-Browser QA PASS.
- Cross-Browser QA exact-head : le premier attempt a exposé un timeout runner au `page.goto()` du sous-harness WebChat outils après 117/117 + 120/120 cross-engine ; la reproduction locale `pnpm run browser:webchat:qa` a passé 15/15, puis le rerun hébergé ciblé a passé 117/117 et 15/15. Ce rerun est une preuve du même SHA, pas une modification du code.
- Limites restantes : la preuve hébergée couvre les harnesses browser et la CI, pas un provider OAuth réel, un Git provider réel, un host DNS/redirect réel, une junction/reparse multi-OS, un crash/restart de production ou un déploiement. Ces frontières restent `RUNTIME_VALIDATION_REQUIRED`.
- Phase 6 est fermée au niveau des gates demandées. Phase 7 Memory VNext peut maintenant commencer sur un track séparé empilé sur ce HEAD validé ; aucun code Phase 7 n’est encore présent dans ce track.

## 2026-09-21 — FuryPipe VNext Phase 7 — Gates 7.0 à 7.7 locales

- Source de vérité revalidée : Phase 6 PR #217 est `OPEN + DRAFT`, base Phase 5 `672a57a83c33990eb2be71f656929a1ed7ed5ae5`, head final vérifié `51839182066a4520fed29cf396856495d8400fc3`, tous les contrôles exact-head verts avant le fork.
- Track isolé créé depuis ce SHA : `vnext-phase7-memory-vnext`. Aucun fichier de l’automation/webhook Phase 5 n’a été modifié.
- `src/memory-vnext.ts` consomme le `RecoveryStore` fourni par l’hôte et réutilise `optimizeContext()`. Il ne crée ni deuxième RecoveryStore, ni Gateway, ni policy engine.
- Gate 7.0/7.1 : schémas stricts et états explicites `candidate / accepted / active / disabled / forgotten`; provenance `sourceKind/sourceIdDigest`, timestamps, evidence class, acceptance, retention, scope et visibility.
- Gate 7.2 : `putBounded()` impose les quotas de records/révisions ; le contenu est immuable ; `requestForget()` publie la tombstone avant le nettoyage local et bloque la résurrection après restart.
- Gate 7.3/7.4 : recherche par scopes exacts, source revocation, TTL, score déterministe et injection sélective via le Context Optimizer avec provenance et budget UTF-8 final.
- Gate 7.5/7.6/7.7 : authorizer host-owned default-deny ; source externe et inférence modèle nécessitent une confirmation utilisateur ; secret refusé ; receipts d’oubli local-only ; statut `observability-only` sans autorité.
- Tests ciblés : PASS, `tests/memory-vnext.test.ts`, 6 tests ; cas external prompt injection, accepted/active/relevant/injected, scope isolation, source revoke, restart/tombstone, TTL/budget, unknown fields/accessors/sparse arrays/secret/default-deny.
- `pnpm install --frozen-lockfile` : PASS, lockfile inchangé.
- `pnpm test` : PASS, 250 fichiers / 2 871 tests.
- `pnpm run typecheck` : PASS, TypeScript principal + hosted MCP.
- `pnpm run build` : PASS, dist bibliothèque/déclarations + Node/MCP, version `0.15.0`.
- `pnpm run audit` : PASS, aucune vulnérabilité production connue.
- `pnpm run package:smoke` : PASS, package smoke complet incluant `scripts/phase7-package-smoke.mjs`; export `furypipe/memory-vnext` et documentation chargés depuis le tarball installé.
- `git diff --check` : PASS. La preuve CI exact-head reste à obtenir après push ; aucun résultat hébergé n’est déduit des tests locaux.
- Limites : les copies dans une source externe, backups hors namespace ou systèmes non contrôlés ne sont pas supprimées ; aucun provider/OAuth/LLM réel, embedding, vector DB, déploiement ou runtime production n’est exécuté.

## 2026-09-21 — FuryPipe VNext Phase 7 — exact-head implementation closure

- Draft PR #218 ouverte vers `vnext-phase6-browser-coding-runtime`, base exacte `51839182066a4520fed29cf396856495d8400fc3`, head implementation exact `0fd246b9b5afe5de90dccb0556a4c7470eeab807`, PR `OPEN + DRAFT`, merge state `CLEAN`.
- CI exact head implementation : 15/15 contrôles `PASS` ; matrice 9/9 Ubuntu 24.04, macOS 14 et Windows 2025 × Node 22.23.2, 24.21.0 et 26.8.2 ; `gitleaks`, `contract`, `prepare`, deux Chromium et `browser-engines` PASS.
- Cross-Browser QA exact head : PASS sur Dashboard, Web Studio et Gateway WebChat ; aucune modification de code n’a été faite pour obtenir ce résultat.
- La documentation et cette clôture sont ensuite mises à jour dans un commit séparé ; ce nouveau HEAD doit repasser la même matrice avant d’être présenté comme le HEAD final validé.

## 2026-09-24 — FuryPipe VNext Phase 10 Gate 10.2 — local completion slice

- Source de vérité : `Mistermode45/FuryPipe`, parent PR #223 `OPEN + DRAFT`, base exacte Phase 9 `c3c3f5370c10ee414e685b9f422cd4fd8a022e55`, parent Phase 10 `4de5c3e75df4de720cb330dadda86515042e79c6`. Travail isolé dans `FuryPipe-Final-Completion`, PR #224 `OPEN + DRAFT`, base exacte `4de5c3e75df4de720cb330dadda86515042e79c6`, head livré `80cceadab1d60f5ce1130bae7f24aaac8dbd6dcc`, sans modification du worktree principal.
- Cause racine : le contrat `src/beta-readiness.ts` existait mais restait orphelin ; ni `doctor`, ni le startup Node, ni la gouvernance de configuration ne le consommaient.
- Correction minimale : `src/beta-config.ts` pour observation bornée/migration explicite/rollback réconciliable ; `src/beta-readiness-runtime.ts` pour la projection configuration/runtime/Gateway/provider sans probe réseau ni valeur secrète ; raccordement `doctor --json` et preflight startup ; commandes `config migrate-beta` / `rollback-beta` ; documentation et package smoke.
- Sécurité : configuration invalide, future, surdimensionnée, non-fichier ou symlink refusée ; migration idempotente, atomique par fichier temporaire + `fsync` + rename, préserve les clés étrangères ; rollback retire uniquement le marqueur FuryPipe inchangé ; aucune valeur de credential dans snapshot, digest, logs ou smoke.
- Tests ciblés : PASS, beta config + readiness runtime + doctor, 3 fichiers / 21 tests ; Node startup gate, `tests/node-security.test.ts`, 14 tests PASS.
- `pnpm install --frozen-lockfile` : PASS sur le parent exact avant slice, lockfile inchangé.
- `pnpm run typecheck` : PASS, TypeScript principal + hosted MCP.
- `pnpm test` : PASS, 280 fichiers / 3 208 tests.
- `pnpm run build` : PASS, dist bibliothèque/déclarations + `dist/node.js` + `dist/mcp.js`, version smoke `0.15.0`.
- `pnpm run package:smoke` : PASS, package + Phase 6 + Phase 7 + Phase 8 ACP + benchmark-claim + provider-attempt + governed-provider ; migration/rollback installés depuis tarball et setup data préservée.
- `pnpm run audit` : PASS, aucune vulnérabilité production connue ; `gitleaks` local indisponible ; `git diff --check` PASS.
- Preuve hébergée exact-head : PR #224 `80cceadab1d60f5ce1130bae7f24aaac8dbd6dcc`, base `4de5c3e75df4de720cb330dadda86515042e79c6`, merge state `CLEAN`, 7 workflows PASS, CI 9/9 PASS sur Ubuntu 24.04/macOS 14/Windows 2025 et Node 22.23.2/24.21.0/26.8.2 ; Benchmark Contract `35993617851`, Secret Scan `35993617547`, RC Preparation `35993617553`, Dashboard Browser QA `35993617584`, Web Studio Browser QA `35993617772`, Cross-Browser QA `35993617660`, CI `35993617806`.
- Limites : aucune validation client/browser fraîche sur ce diff local ; aucun provider réel, credential, migration de production, crash/restart hébergé, merge, release, tag, npm publish, deploy ou force push.

## 2026-09-25 — FuryPipe 0.16.0 RC — Gateway installé, identité du paquet, gel RC

- Source de vérité : PR #226 `OPEN + DRAFT`, base `eed62617c8778a73038bfeb93a0bacdb6f8e9e08`; reprise depuis `598dc65f48980840d1e7dedbadd6fb727a7fce00` (31/31 checks verts).
- Correctif Gateway `6ac1e629…` revérifié : `dist/node.js` et `dist/mcp.js` ne contiennent plus aucune garde `__require`; les frontières `@modelcontextprotocol/client` et `ws` sont externes et déclarées en dépendances de production. Preuve négative : rebuild avec `external: []` → le Gateway installé échoue avant ready avec `Dynamic require of "events" is not supported`.
- Lacune fermée (`b689873`) : le smoke installé ne traversait pas le chemin qui avait crashé. Il démarre désormais le Gateway du CLI bundlé avec une config MCP stricte, s’authentifie par code bootstrap + cookie loopback, envoie `tools.source.inspect.stdio` sur le WebSocket et vérifie l’inventaire d’un vrai enfant MCP stdio puis sa fermeture. Exécuté sur 3 OS × Node 22/24/26.
- Dashboard Browser QA rouge sur `b689873` : Chrome 153 ubuntu-24.04 encore en démarrage à 14 s, budget CDP 15 s. Budget aligné sur le harness Web Studio (30 s), toutes assertions conservées. Local 39/39, hébergé PASS.
- Divergence de digest (`7d26a8…` Windows vs `b6a651…` Linux) : cause racine prouvée. (1) `text=auto` → checkout Windows CRLF → 73 docs, 3 licences, LICENSE, package.json et 3 modules dist avec gabarits HTML/JS embarqués en CRLF; (2) `bin/cli.js` en 100755 → 755 sur Linux/macOS, 644 sur Windows (recalcul du manifeste Linux avec 644 = digest Windows exact). Métadonnées tar déjà normalisées par npm.
- Correctifs : `.gitattributes` `eol=lf`; `bin/cli.js` en 644 (npm rend les bins exécutables à l’installation, vérifié); `scripts/package-reproducibility.mjs` (fail-closed sur octet CR ou mode ≠ 644, content digest + digest tarball, mode `--tarball` pour le post-publish) exécuté sur les 9 jobs CI.
- Preuve `f41aa957…` : 9/9 jobs CI + RC Preparation → même SHA-256 `99feb17fc8747e9b5de8a5cf23f58536a5a348d66242bfb62690703a7bbdf08a` (5 404 064 octets), même content digest `30108a5f…`, 614 fichiers, npm 10.9.8/11.19.0/11.19.1.
- Audit : marqueurs TODO/FIXME/HACK/XXX = 0 dans src/bin/scripts/bench/.github; occurrences placeholder/stub = UI ou vocabulaire métier (classe E). Toute importation nue du dist est une dépendance de production. Défaut corrigé : classe de caractères de contrôle écrite en octets bruts (NUL) dans `src/gateway-automation-definition-node.ts` → échappements `\u`, test de régression (NUL, TAB, LF, US, DEL).
- Revue sécurité du diff de branche faite directement (sans sous-agents) : aucun constat haut/moyen.
- Local (Linux, Node 22.22.2) : audit, typecheck, 3 223 tests, build, package:smoke, upgrade-rollback 0.15.0↔0.16.0, recovery, gateway, clean-room, local-contracts, accessibility (Chromium local mappé), FuryBench (3 rounds appariés, seuil p95 ≤ ×1,25, 0 régression) PASS. WebChat QA local : Firefox/WebKit absents du conteneur → preuve hébergée Cross-Browser QA.
- Registre npm : `latest` = 0.15.0; 0.16.0 non publié.
- Non exécuté : merge, tag, GitHub Release, npm publish, deploy, restart/rollback production, provider payant, credential externe.

## 2026-10-02 — FuryPipe Ultimate Complete Product Finalization — clôture locale et exact-head

- Source de vérité : dépôt canonique `LegendeUrbaine/FuryPipe`, PR #238 `OPEN + DRAFT`, base `codex/furypipe-final-completion` (`ebaa8e41fd2a5820fbd33fbfc04aecf8dbb4ca57`), code head vérifié `100d3fff5e53b79cf03632f929fbc2c98c73c553`, worktree isolé et propre.
- Local Windows 11 x64 : Node `26.8.2`; pnpm projet `10.21.0` utilisé via son exécutable direct, car le shim global `pnpm` est défectueux ; npm local observé `12.0.2` (écart documenté avec la référence projet `11.14.1`).
- `pnpm install --frozen-lockfile` : PASS ; lockfile inchangé. `pnpm test` : PASS, 357 fichiers de test, 3 628 réussis, 6 ignorés, 3 634 total. `pnpm run typecheck` : PASS. `pnpm run lint` : PASS avec `--max-warnings 0`. `pnpm run build` : PASS, dist Node/MCP + déclarations, version `0.16.0`. `pnpm audit --prod --audit-level high` : PASS, aucune vulnérabilité connue.
- `pnpm run package:smoke` : PASS. `scripts/gateway-installed-package-smoke.mjs` : PASS sur le paquet installé ; Gateway ready/alive/loopback/arrêt propre, MCP stdio installé, inventaire et fermeture contrôlés, 0 erreur de dynamic require. Le timeout de l’installation npm est borné à 300 s uniquement pour ce sous-processus Windows/Node 26 ; les autres commandes restent à 120 s.
- `pnpm run start` : PASS en lancement réel du script package ; HTTP 200 observé sur `/`, `/studio`, `/control-plane`, `/api/studio/models.json`, `/api/studio/local.json`, `/api/studio/skills.json`, `/api/studio/mcp.json` et `/api/studio/video/doctor.json`, puis arrêt propre.
- Browser QA : `pnpm run browser:qa` PASS Dashboard `117/117` et Web Studio `120/120` sur Chromium/Firefox/WebKit, langues en/fr/ar-XB et responsive ; `browser:studio:qa` PASS 3 moteurs ; `browser:webchat:qa` PASS `15/15` ; `browser:host:qa` PASS `12/12`. Les checks externes provider/OAuth/hosted MCP/OpenClaw/Figma ne sont pas exécutés par ces suites.
- Preuve hébergée exact-head `100d3fff` : checks visibles PR #238 PASS, incluant matrice CI Linux/macOS/Windows × Node 22/24/26, clean-room, tarball upgrade/rollback, browser engines, Chromium, contracts, gitleaks, SBOM/audit et préparation. Windows `package:smoke` PASS sur Node 22 (`14m42s`), 24 (`12m45s`) et 26 (`11m21s`), ce qui couvre la cause racine du timeout local précédent.
- Correctifs clôturés : digest FuryEval fondé sur l’identité/les attentes stables du dataset et comparabilité refusée en cas de digest différent ; catalogue runtime visible dans le Model Hub/Autopilot Studio ; script package `start` présent ; fixtures vidéo Windows sans privilège de symlink ; statut M0 de la documentation MCP rendu explicitement historique.
- Limites non promues : PR encore Draft sans approbation ; aucun merge/release/tag/npm publish/deploy ; aucune provenance signée/attestation candidate ; aucun provider/OAuth/hosted MCP/OpenClaw/Figma réel ; aucune validation visuelle humaine, lecteur d’écran humain ou client externe ; les intégrations Gateway/provider, Graphify UI, historique FuryEval, reconcile automation et index média restent partielles selon leur preuve respective.

## 2026-10-02 — FuryPipe Final Product Integration & Release Closure — intégrations locales vérifiées

- Périmètre et provenance : travail exécuté dans le worktree isolé `C:\Users\loicd\.codex\worktrees\furypipe-production-finalization\FuryPipe`, branche `codex/furypipe-production-finalization-2026`, HEAD local `191f29c2010d5fce77095525576ec61186e8f135` (`docs: record finalization evidence`) avec modifications non commitées listées par `git status`. PR #238 distante a été vérifiée auparavant `OPEN + DRAFT` sur le code head `100d3fff5e53b79cf03632f929fbc2c98c73c553`; ce slice local n’a pas été poussé et sa CI distante n’est donc pas revendiquée.
- P0 Provider/Gateway/WebSocket : `src/fury-kernel-model-bridge.ts`, `src/gateway-local-model-runtime-node.ts` et `src/gateway-websocket-host-node.ts` raccordent le cycle gouverné planner → context → request envelope → execution gate → stream transport, avec un seul appel, événements bornés, annulation, erreurs terminales et statut ambigu sans retry/fallback automatique. `src/gateway-webchat-node.ts` projette les deltas dans un message assistant borné ; les événements de présentation restent `executionAuthority=false`.
- P0 persistance Kernel/WebChat : `src/fury-kernel.ts` persiste les conversations localement par snapshot atomique, réouvre les tours terminaux et transforme un tour accepté interrompu par redémarrage en `recovered-process-restart`, sans replay ni credential/permit. `startFuryGatewayLocalRuntime()` fournit un chemin local par défaut sous `.furypipe/gateway` et accepte `FURYPIPE_WEBCHAT_STATE_FILE`.
- P0 workflow gouverné : le chemin WebChat existant d’approbation → exécution → résultat vérifié a été conservé et exercé par le browser QA avec les transports de test bornés ; les observations browser ne sont pas promues en autorité d’exécution.
- P0 outcome-unknown : `src/gateway-automation-run-ledger-node.ts` ajoute une réconciliation durable après redémarrage, exige une preuve SHA-256 et une confirmation opérateur, consomme l’identité existante sans replay et refuse une seconde réconciliation. Ce contrat est testé dans `tests/fury-gateway-automation-run-ledger.test.ts`.
- P1 Graphify UI : les routes lifecycle/refresh existantes sont reliées à `src/studio/studio-page.ts` avec plan explicite, confirmation et rafraîchissement ; aucune seconde implémentation Graphify n’a été créée.
- P1 FuryEval : `src/fury-eval-history.ts` ajoute l’historique borné RecoveryStore, `get` exact par métadonnées, liste durable et comparaison fail-closed ; `src/studio/studio-api.ts` et `src/studio/studio-page.ts` exposent run/persist/history/compare avec `executionAuthorized=false`. Le test couvre le redémarrage du repository.
- P1 médias : `src/media-generation-job-engine.ts` inspecte le stockage et le pointeur artifact/provenance, lit seulement après vérification digest/taille/référence, distingue `VERIFIED`/`MISSING`/`CORRUPT`, et produit un plan de nettoyage sans suppression. `src/studio/studio-api.ts` expose inspect/cleanup-plan/preview/export ; la lecture revalide maintenant aussi le pointeur artifact avant de renvoyer les octets.
- Installation/runtime local : Node `26.8.2`, pnpm projet `10.21.0` via l’exécutable direct ; npm observé `12.0.2` alors que la référence documentaire est `11.14.1`. `pnpm install --frozen-lockfile` PASS, lockfile inchangé.
- Vérification finale après le dernier patch : `pnpm test` PASS, `358` fichiers, `3 632` tests réussis, `6` ignorés (`3 638` total) ; `pnpm run typecheck` PASS principal + hosted MCP ; `pnpm run lint` PASS avec `--max-warnings 0` ; `pnpm run build` PASS, dist bibliothèque/déclarations + Node/MCP, version `0.16.0` ; `pnpm audit --prod --audit-level high` PASS, aucune vulnérabilité connue.
- Tests ciblés après le dernier patch : `tests/media-generation-job-engine.test.ts` + `tests/studio-api.test.ts` PASS, `2` fichiers / `34` tests. Le test média couvre inspection vérifiée, provenance, lecture, redémarrage, sortie manquante, plan de réparation et refus de lecture non vérifiée.
- Browser QA final : `pnpm run browser:studio:qa` PASS sur Chromium, Firefox et WebKit ; `pnpm run browser:webchat:qa` PASS `15/15` cas réels (desktop/mobile, trois moteurs, modèle, outils avec approbation/résultat vérifié, mémoire et resynchronisation), sans erreur console/page dans le rapport WebChat.
- Paquet installé final : `pnpm run package:smoke` PASS pour le tarball `furypipe-0.16.0.tgz`, avec assertions d’import installées pour `fury-eval-history` et `media-generation-job-engine`, Gateway installé/loopback/arrêt propre, MCP stdio et phases 6–8/provider smoke ; digest tarball local `bb201ebec42b1eb047d6348186c71d45b24a4b903be7c8d552bb4b1c02df1f8d` sur Windows Node `26.8.2`.
- Revue finale : `git diff --check` PASS ; aucun changement de lockfile, aucun commit, push, merge, tag, release, npm publish, déploiement ou appel API payant.
- Limites non promues : aucun provider payant/OAuth réel, hosted MCP/OpenClaw/Figma, client externe, lecteur d’écran humain, validation visuelle humaine ou runtime de production. Le browser QA utilise un transport de test et prouve le câblage local, pas l’acceptation d’un fournisseur externe.
- Limite de réconciliation : la réconciliation durable ajoutée concerne le ledger d’automations ; les timeouts/overflow `outcome-unknown` des runtimes `browser-runtime.ts` et `coding-runtime.ts` restent process-local et sans replay automatique. Le nettoyage média reste un plan non destructif ; aucune référence immutable n’est supprimée.

## 2026-10-02 — FuryPipe Final Product Integration — durable effects, Studio primary UX et preuve locale finale

- Périmètre : reprise dans le worktree isolé `C:\Users\loicd\.codex\worktrees\furypipe-production-finalization\FuryPipe`, branche `codex/furypipe-production-finalization-2026`, code produit livré dans `8f5a7bcd2b7378d45e79116612adaf1fad9fb13f` issu du parent local `191f29c2010d5fce77095525576ec61186e8f135`; les commits suivants sont documentaires uniquement et ne modifient pas les sources produit.
- Ledger externe durable : `src/fury-external-effect-ledger.ts` stocke uniquement des identités/digests bornés dans `RecoveryStore`, marque `automaticReplayAllowed=false` et `executionAuthority=false`, bloque la réexécution d’un effet `outcome-unknown` après redémarrage et exige une preuve SHA-256 + confirmation opérateur pour la réconciliation. `browser-runtime.ts` et `coding-runtime.ts` l’utilisent lorsqu’un `RecoveryStore` est injecté ; sans store, le comportement process-local historique est conservé.
- Studio/média : `/api/studio/media/generate` est une frontière d’injection vers un runtime réel ; elle exige `confirm=true`, renvoie `NOT_CONFIGURED` en l’absence de provider, ne crée aucun provider fictif et projette `executionAuthority=false`. L’UI distingue preview local borné et soumission réelle configurée, avec confirmation explicite et état visible.
- Studio primaire : l’expérience principale explique le chat local loopback, les permissions séparées des agents/Skills/MCP/Gateway et le WebChat Gateway comme surface avancée de diagnostic ; aucune alternance opaque entre backends n’est déclarée.
- Résumé documentaire réel : `scripts/document-summary-e2e.ts` appelle uniquement un endpoint local explicitement configuré, vérifie une réponse non triviale contre le document fixe et ne promeut pas un fixture déterministe. Exécution locale : `NOT_CONFIGURED` car `FURYPIPE_DOCUMENT_SUMMARY_BASE_URL` et `FURYPIPE_DOCUMENT_SUMMARY_MODEL` ne sont pas définis.
- Continuité agent/MCP : le test `tests/agent-runtime.test.ts` couvre deux appels MCP séquentiels où le résultat de `lookup` devient l’entrée de `expand` ; les exécutions de capabilities sont vérifiées dans l’ordre.
- `pnpm install --frozen-lockfile` : PASS avec pnpm projet `10.21.0`, lockfile inchangé.
- `pnpm test` : PASS, `359` fichiers, `3 637` tests réussis, `6` ignorés, `3 643` total.
- `pnpm run typecheck` : PASS TypeScript principal + hosted MCP ; `pnpm run lint` : PASS avec `--max-warnings 0`; `pnpm run build` : PASS, dist bibliothèque/déclarations + Node/MCP, version `0.16.0`.
- `pnpm audit --prod --audit-level high` : PASS, aucune vulnérabilité connue.
- Browser QA local : `pnpm run browser:studio:qa` PASS sur Chromium/Firefox/WebKit ; `pnpm run browser:webchat:qa` PASS `15/15` ; `pnpm run browser:host:qa` PASS `12/12` ; `pnpm run browser:qa` PASS avec `FURYPIPE_SOURCE_COMMIT=8f5a7bcd2b7378d45e79116612adaf1fad9fb13f`, Dashboard `117/117` et Web Studio `120/120` sur Chromium/Firefox/WebKit. Un premier lancement avec une chaîne de 40 caractères qui n’était pas le SHA Git réel n’a pas été retenu comme preuve ; le second lancement a utilisé le SHA vérifié par `git rev-parse HEAD`.
- Paquet installé : `pnpm run package:smoke` PASS, tarball `furypipe-0.16.0.tgz`, Gateway loopback/arrêt propre, MCP stdio, phases package et exports ; SHA-256 tarball local `4038f2d166b4c09efa08aba55faaadff17e8479cfb7942854cb377f7e7ae3058`.
- PR exact-head : [LegendeUrbaine/FuryPipe#238](https://github.com/LegendeUrbaine/FuryPipe/pull/238), `OPEN + DRAFT`, base `ebaa8e41fd2a5820fbd33fbfc04aecf8dbb4ca57`. Le code produit `8f5a7bcd2b7378d45e79116612adaf1fad9fb13f` a obtenu `31 SUCCESS` après rerun ciblé du timeout Firefox Linux ; les deux commits de journalisation qui suivent ne modifient pas les sources produit et ont eux aussi été vérifiés par une matrice complète `31 SUCCESS` au head courant. Gates incluses : CI Linux/macOS/Windows × Node 22/24/26, Cross-Browser, Web Studio, Dashboard, tarball, contracts, recovery, clean-room, gitleaks, SBOM/audit et prepare.
- `git diff --check` : PASS. Les artefacts de captures/rapports générés par les QA, non suivis et non nécessaires au produit, ont été retirés avant staging.
- Limites : aucun provider/OAuth/hosted MCP/OpenClaw/Figma réel, aucune validation client externe/humaine/production ; aucune publication npm, release, merge ou déploiement ; aucun claim de benchmark `500x`.

## 2026-10-02 — FuryPipe Final Real-World Acceptance & Release Closure — preuve locale réelle et décision de release

- Périmètre : la source produit et les commits précédents restent inchangés ; cette entrée documente un slice d’acceptation local réel. Le code head vérifié avant ce journal était `f51e4422cccc8d46f8d41884f7bcffb1aac2f9b1` dans le worktree isolé `codex/furypipe-production-finalization-2026`. Aucun provider payant, secret, endpoint distant ou publication n’a été utilisé.
- Ollama local : service installé `0.32.15` découvert à `C:\Users\loicd\AppData\Local\Programs\Ollama\ollama.exe`, initialement arrêté puis démarré temporairement sur `127.0.0.1:11434`. Inventaire réel sans téléchargement : `qwen3.5:latest` (`6488c96fa5fa`, 9.7B, Q4_K_M, 6.6 GB) et `qwen3-coder:30b` (`06c1097efce0`, 30.5B, Q4_K_M, 18 GB). `discoverFuryLocalBackends()` les classe `MAY_BE_SLOW`, jamais `FITS`; la détection matériel observe Windows x64, 16 CPU et une NVIDIA GeForce RTX 5070 Laptop GPU avec environ 8.5 GB exposés. Le service temporaire a été arrêté après les essais et `:11434` est redevenu inaccessible.
- Résumé Markdown réel : un fichier Markdown temporaire mode `600` a été lu par le chemin natif Ollama `/api/chat` avec `qwen3.5:latest`, `think:false`, budget borné. Réponse observée `PASS`, provider `ollama`, runtime `Ollama 0.32.15 native /api/chat`, timing `3 092 ms` (total `3 101 ms`), phrase unique contenant et vérifiant Atlas, `14:17`, Nora et le journal signé. Fixture `251` octets, SHA-256 `3722ac6461d40cd24704687db541205809ffda08962675e03cea668020b5483e`. La conversation a été sauvegardée puis rouverte par une nouvelle instance `createStudioChats`; provenance assistant `ollama/qwen3.5:latest`, localité `local`, erreurs `[]`, `executionAuthority:false`.
- Studio installé / chat réel : `createStudioApi.handle('chat')` a traversé la route SSE réelle avec `qwen3-coder:30b` via `/v1/chat/completions`; HTTP `200`, `text/event-stream`, provider `ollama`, localité `local`, runtime OpenAI-compatible, timing `29 823 ms`, réponse factuelle en une phrase, persistance `saved=true`, réouverture `2` messages, modèle enregistré et `executionAuthority:false`. Le smoke `scripts/clean-room-package-smoke.mjs` a également validé le paquet installé en environnement isolé : setup, doctor, migration, task plan, start/readiness/stop, restart, rollback de config, uninstall/reinstall, dashboard loopback, persistance après restart et diagnostics.
- Parcours agent réel : un modèle Ollama a produit le jeton d’action borné `ACTION=CHAIN_LOOKUP`; le runtime a exécuté `request → intent → découverte MCP → skill → planning → inférence Ollama → host authority gate → lookup → expand → continuation → vérification finale → mémoire RecoveryStore`. La découverte a trouvé une source locale MCP non secrète; `lookup` a fourni l’identité consommée par `expand`; trois exécutions de capability ont été observées; cinq records de phases ont été rouverts après restart. L’artefact temporaire a été écrit puis vérifié par SHA-256 `9835f404a3d9d3c71eef7b1346cc2c804fbe73777d99b13bb209e1c94351`; `executionAuthority:false`; aucun prompt ou texte de modèle n’a été persisté dans la preuve publique.
- Résilience réelle : `scripts/recovery-resilience-smoke.mjs` `PASS` (kill subprocess, intégrité durable, automation `outcome-unknown`, replay automatique refusé, réveil borné, déduplication avec `exactRunCount=1`, interruptions de migration et invariant `old-valid-or-new-valid`; `directoryFsync=NOT_CLAIMED`, `15 502 ms`). `scripts/gateway-restart-smoke.mjs` `PASS` (start/auth/connect/disconnect/restart/reconnect, stale origin refusé, `executionAuthority:false`, OpenClaw externe `NOT_EXECUTED`). Tests ciblés Kernel/RecoveryStore/external-effect : `4` fichiers / `47` tests `PASS`; tests médias : `11` fichiers / `130` tests `PASS`. Ces preuves couvrent annulation, reprise, resynchronisation, IDs dupliqués, writes interrompus et refus de replay; elles ne certifient pas un crash de production hébergé.
- Paquet installé : `scripts/package-smoke.mjs` `PASS`, puis `scripts/clean-room-package-smoke.mjs` `PASS` pour `furypipe@0.16.0`; tarball SHA-256 `4038f2d166b4c09efa08aba55faaadff17e8479cfb7942854cb377f7e7ae3058`. Cette preuve est locale, installée et isolée; elle ne vaut pas publication npm.
- Média / P1 : le câblage de l’hôte normal (`src/node.ts`) instancie `createStudioApi({ projectRoot })` sans `mediaAdapters`, `mediaExecution` ni `mediaJobEngine`. Inspection réelle : `/media` et `/media-preview` retournent respectivement `NOT_CONFIGURED` et `PREVIEW_ONLY_REQUIRES_RUNTIME_AUTHORITY`; `/media-generate` confirmé retourne `409 NOT_CONFIGURED`. Aucun provider média fictif n’a été ajouté. Images, vidéo et audio restent `CORE_AVAILABLE_PROVIDER_OPTIONAL`; exécution réelle `NOT_CONFIGURED`.
- Décision de release : `LOCAL_FIRST_PACKAGE_READY`; la publication publique reste `BLOCKED`. Le lot local inclut le chat Ollama réel, la persistance, l’agent/MCP, les scénarios de crash/restart et le paquet installé. Le lot externe reste séparé : review/approbation et merge PR, provenance/attestation signée, ownership/metadata npm, provider/OAuth/hosted MCP/OpenClaw/Figma, validation client/humaine et wiring média réel.
- Limites conservées : PR #238 reste `OPEN + DRAFT`; aucun merge, tag, GitHub Release, npm publish, deploy ou appel API payant. Browser/coding gardent leur limite `outcome-unknown` process-local quand aucun RecoveryStore n’est injecté; `directoryFsync` n’est pas revendiqué; les données de production et les copies externes ne sont pas supprimées. Les modifications concurrentes non attribuées (`scripts/validation-command.mjs`, `tests/validation-command.test.ts`, `corepack.cmd`, `artifacts/browser-playwright-host-qa/report.json`) sont restées hors périmètre et hors commit.

## 2026-10-02 — FuryPipe local gates — exact-head Windows resolver et rollback

- Le HEAD concurrent `6f250b6acbf511d99e19b2637adb167a83af381e` a été préservé. Le changement local ciblé corrige uniquement `scripts/validation-command.mjs` et son test : sous Windows, `corepack.cmd` doit être lancé avec `shell:true`, car Node renvoie `EINVAL` avec `shell:false`. Aucun chemin runtime/provider n’est modifié.
- Preuve locale après le patch : `npm test` PASS (`359` fichiers, `3 638` PASS, `6` ignorés, `3 644` total), `npm run typecheck` PASS, `npm run lint` PASS avec `--max-warnings 0`, `npm run build` PASS.
- `npm run package:smoke` PASS ; tarball `furypipe-0.16.0.tgz`, SHA-256 `4038f2d166b4c09efa08aba55faaadff17e8479cfb7942854cb377f7e7ae3058`. `validation:clean-room` PASS. `validation:package-reproducibility` PASS, content digest `e65b7d409dff3ed98bb48645887323b0d052903ab4cc8087834a6a921a24b4dd`.
- `validation:upgrade-rollback` PASS sur le HEAD exact `6f250b6a` : upgrade `0.15.0 → 0.16.0`, migration/rollback config, rollback binaire, restart et conservation des données utilisateur ; rollback production `NOT_CLAIMED`.
- FuryBench : un premier run a signalé une régression p95 process-boundary Windows (`REGRESSION`), puis le rerun identique à 3 rounds a produit `PASS` sans modification runtime entre les deux runs. Le premier résultat reste observé comme instabilité de mesure ; il n’est pas supprimé ni présenté comme PASS.
- Supply chain/audit : SBOM CycloneDX `1.6`, `305` composants, `356` edges, `UNSIGNED`; audit prod pnpm direct `No known vulnerabilities found`. `validation:document-summary` reste `NOT_CONFIGURED` sans modèle/base URL explicitement configuré.
- Référence DeepSeek Harness lue en lecture seule : logiciel developer-preview non audité, architecture plugin/append-only session/guarded tool pipeline ; aucune copie de code ni nouvelle architecture ajoutée à FuryPipe.
- Limites : browser local et CI hébergée restent des preuves liées à leur SHA respectif ; provider/OAuth/hosted MCP/OpenClaw/Figma, humain/client, provenance signée, merge, publication et déploiement restent externes/non exécutés. Voir [`docs/evidence/FURYPIPE_LOCAL_GATES_2026-10-02.md`](docs/evidence/FURYPIPE_LOCAL_GATES_2026-10-02.md).
