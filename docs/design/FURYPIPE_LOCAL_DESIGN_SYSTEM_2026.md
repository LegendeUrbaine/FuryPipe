# FuryPipe Local — design system 2026

**Statut:** implémenté localement sur PR #233, validation visuelle humaine
encore requise.

**Source d’implémentation:** `src/studio/studio-page.ts`,
`src/studio/studio-brand.ts` et `src/studio/studio-navigation.ts`.

Ce document décrit le langage visuel du Studio local. Il ne décrit ni le
produit Web, ni le Gateway hébergé, ni une autorité de déploiement.

## Intention

FuryPipe Local doit ressembler à un poste de travail d’IA gouverné, pas à un
dashboard de métriques. Une demande commence dans Chat; le contexte, le
routage, les outils et les preuves restent accessibles depuis le même shell.

Principes retenus:

1. **Un seul espace de travail.** La barre latérale porte les surfaces; le
   header porte le contexte; la zone principale porte l’action courante.
2. **Profondeur progressive.** Simple expose Chat, Models et Connections;
   Power ajoute les surfaces de connaissance et de capacité; Engineer ajoute
   les surfaces de construction; Expert ajoute Mission Control.
3. **Hiérarchie avant décoration.** Le noir structure, l’orange indique
   l’action, le focus et le routage. Les halos restent secondaires.
4. **Vérité locale.** Aucun contrôle visuel ne crée une capacité runtime. Les
   surfaces existantes restent reliées à leurs routes et à leurs API réelles.
5. **Marque FuryPipe FORGE 03 stable.** Le monogramme et le wordmark
   proviennent des primitives centralisées et de la planche propriétaire
   `Guide de marque FuryPipe _ identité tech et design.png`.

## Palette et tokens

Les tokens vivent dans le CSS nonce de `studio-page.ts`. Les surfaces sont
empilées pour séparer la page, la barre latérale, les cartes et les contrôles.

| Token | Valeur par défaut | Usage |
|---|---|---|
| `--b0` à `--b5` | `#0B0D10`, `#121519`, `#2A2A2A` et dérivés | page, shell, cartes, lignes, hover, pressed |
| `--ink` / `--ink-2` | `#F5F4F0` / `#E5E7EB` | texte principal et secondaire |
| `--muted` / `--faint` | `#9CA3AF` / `#6B7280` en sombre; `#68717D` / `#8E969F` en clair | aide lisible / décoration non essentielle |
| `--o-core` | `#FF6A00` | action principale et signal Fury |
| `--o-hot` | `#FF6A00` en sombre; `#A84200` en clair | focus, icône active, texte accentué |
| `--ok` / `--warn` / `--bad` | vert / ambre / rouge | états, jamais décoration |
| rayons | `8 / 12 / 16 / 22px` | puces, contrôles, cartes, composer |
| mouvement | `cubic-bezier(.16,1,.3,1)` | entrée, ouverture, feedback léger |

Le rendu n'utilise aucune ressource distante. Les sous-ensembles IBM Plex
Sans/Mono sont vendus sous `assets/fonts/ibm-plex/` et embarqués localement;
les fallbacks système gardent le package lisible si un hôte bloque les fontes.

## Shell

### Barre latérale

Ordre fixe:

1. identité FuryPipe;
2. badge **Local workspace** avec frontière `Loopback · governed`;
3. **New chat**;
4. recherche et commandes `Ctrl K`;
5. navigation primaire **Workspace**;
6. navigation secondaire regroupée sous **Explore workspace**;
7. conversations récentes;
8. mode progressif et paramètres.

En sidebar ouverte, l'identité est le wordmark complet seul. En sidebar
repliée, seul le symbole FORGE reste visible. Le F du master n'est jamais
supprimé; il n'est simplement pas préfixé une seconde fois dans le shell.

La navigation secondaire est structurée en **Explore**, **Operate**,
**Connect** et **System**. Elle ne disperse plus les routes dans une liste
`More` non ordonnée. Le fichier `studio-navigation.ts` est la source de vérité
des labels, routes et niveaux de divulgation.

### Header

Le header affiche toujours `FURYPIPE LOCAL`, le titre de la vue courante et
`GOVERNED WORKSPACE`. En Chat, la pilule de confidentialité apparaît seulement
après qu’un routage réel existe.

### Chat vide

La page d’accueil contient, dans le même axe:

- signal `LOCAL-FIRST WORKSPACE`;
- marque FuryPipe;
- promesse courte;
- garanties **Private by default**, **Explicit routing**, **Visible control**;
- setup runtime si nécessaire;
- FuryComposer;
- suggestions d’intention.

Le composer reste le point d’entrée fonctionnel: ses IDs, son formulaire, ses
routes et son flux de streaming sont conservés.

## Composants et états

- **Navigation:** actif, hover, focus, masqué par niveau, sidebar réduite,
  drawer mobile.
- **Composer:** vide, focus, fichiers attachés, routage, streaming, stop,
  erreur. Les contrôles sans autorité backend restent absents ou désactivés.
- **Carte:** repos, hover souris, focus interne, statut `ok/warn/bad`.
- **Popover/palette:** clavier `ArrowUp/ArrowDown/Home/End`, `Escape`, retour
  du focus au déclencheur.
- **Préférences:** thème sombre par défaut, thème système, densité et
  réduction de mouvement persistés dans le stockage local Studio.

## Accessibilité

- lien skip premier arrêt clavier;
- HTML sémantique (`nav`, `main`, `section`, `h1`, `form`, `button`);
- labels et noms accessibles conservés sur les actions icon-only;
- état actif exposé par `aria-current`;
- menu de mode en `menuitemradio`;
- palette en `combobox/listbox/option`;
- focus visible orange de 2px;
- `prefers-reduced-motion` et préférence Studio `Reduced` neutralisent les
  animations;
- drawer mobile fermé par scrim ou `Escape`.

La conformité complète avec un lecteur d’écran réel reste une validation
humaine, pas une déduction à partir du HTML.

## Choix de stack

### Stack retenue

- TypeScript strict côté serveur;
- HTML rendu par le serveur local;
- vanilla JavaScript navigateur avec DOM natif;
- CSS tokens et SVG inline compile-time;
- Playwright pour la preuve navigateur.

### Évaluation 2026

Vite `8.3.0` est déjà une dépendance de développement du dépôt, mais il ne
constitue pas le renderer Studio. React, Tailwind, Motion et Radix ne sont pas
des dépendances actuelles. Les sources officielles confirment que Vite est un
outil de build/dev, que Motion cible React et que Radix fournit des primitives
React accessibles mais non stylées. Les ajouter ici imposerait un second
renderer, une nouvelle CSP, une nouvelle chaîne de package et une migration
de chaque handler existant sans réduire un risque mesuré.

Décision: conserver le renderer local actuel et investir dans son shell, ses
tokens, son IA et ses preuves. Une migration React/Vite pourra être proposée
dans un ADR séparé après une frontière d’assets autonome, sans mélanger ce
travail avec le runtime local.

## Garde visuelle

Les captures automatisées sont une preuve de rendu machine. Elles ne ferment
pas le verdict humain déjà déclaré `REWORK_REQUIRED`. Le prochain passage
humain doit vérifier: cohérence des groupes, densité du shell, lisibilité du
composer, drawer mobile, contraste et parcours clavier.
