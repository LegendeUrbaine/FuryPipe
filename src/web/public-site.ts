import { createHash } from 'node:crypto';

import {
  FURYPIPE_BRAND_COLORS,
  FURYPIPE_BRAND_SOURCE,
  FURYPIPE_FAVICON_SVG,
  renderFuryPipeMonogramSvg,
  renderFuryPipeWordmarkHtml,
} from '../studio/studio-brand.js';

export const FURYPIPE_PUBLIC_SITE_FORMAT = 'furypipe-public-site-page/v1' as const;
export const FURYPIPE_PUBLIC_SITE_LOCALES = Object.freeze(['fr', 'en'] as const);
export const FURYPIPE_PUBLIC_SITE_ROUTES = Object.freeze([
  '/',
  '/product',
  '/furyai',
  '/developers',
  '/docs',
  '/download',
  '/changelog',
  '/about',
] as const);

export type FuryPipePublicSiteLocale = typeof FURYPIPE_PUBLIC_SITE_LOCALES[number];
export type FuryPipePublicSiteRoute = typeof FURYPIPE_PUBLIC_SITE_ROUTES[number];

export interface FuryPipePublicSiteRenderInput {
  readonly baseUrl: string;
  readonly path: FuryPipePublicSiteRoute;
  readonly locale: FuryPipePublicSiteLocale;
}

export interface FuryPipePublicSitePageArtifact {
  readonly format: typeof FURYPIPE_PUBLIC_SITE_FORMAT;
  readonly path: FuryPipePublicSiteRoute;
  readonly locale: FuryPipePublicSiteLocale;
  readonly canonicalUrl: string;
  readonly title: string;
  readonly description: string;
  readonly html: string;
  readonly sha256: string;
  readonly externalScripts: readonly string[];
  readonly deploymentClaim: 'NOT_DEPLOYED';
}

interface PageCopy {
  readonly title: string;
  readonly description: string;
  readonly eyebrow: string;
  readonly heading: string;
  readonly summary: string;
  readonly cards: readonly { readonly title: string; readonly body: string }[];
}

const FR: Record<FuryPipePublicSiteRoute, PageCopy> = {
  '/': {
    title: 'FuryPipe — Build · Automate · Create · Beyond',
    description: 'FuryPipe réunit modèles, agents, skills, MCP, mémoire, code, navigateur et médias dans une plateforme IA gouvernée.',
    eyebrow: 'PLATEFORME IA · LOCAL + CLOUD · GOUVERNÉE',
    heading: 'Construire, automatiser et créer sans fragmenter votre stack IA.',
    summary: 'FuryPipe orchestre les capacités IA derrière des services partagés, des permissions explicites et des preuves vérifiables.',
    cards: [
      { title: 'Autopilot', body: 'Sélection automatique des capacités, skills, instructions et outils pertinents selon la requête.' },
      { title: 'Studio', body: 'Chat, code, recherche, médias, mémoire, agents, workflows et artifacts dans un espace cohérent.' },
      { title: 'Gouvernance', body: 'Permissions minimales, approvals, receipts, budgets et exécution séparée de l’intelligence du modèle.' },
    ],
  },
  '/product': {
    title: 'Produit — FuryPipe',
    description: 'Découvrez l’architecture produit FuryPipe : modèles, agents, skills, MCP, mémoire, code, navigateur, médias et workflows.',
    eyebrow: 'PRODUIT',
    heading: 'Une seule couche d’orchestration pour toutes les capacités FuryPipe.',
    summary: 'Le Studio, la CLI, l’API et le Web doivent réutiliser les mêmes services au lieu de dupliquer les systèmes d’autorité.',
    cards: [
      { title: 'Models & Providers', body: 'Routage gouverné, santé, capabilities, budgets et profils de modèles sans faux contrôles.' },
      { title: 'Agents & Workflows', body: 'Planification, rôles spécialisés, DAG, approvals humains, limites de coût et reprise contrôlée.' },
      { title: 'Code, Browser & Media', body: 'Runtimes spécialisés avec permissions, isolation, artifacts et provenance.' },
    ],
  },
  '/furyai': {
    title: 'FuryAI — Roadmap FuryPipe',
    description: 'FuryAI est la roadmap first-party de FuryPipe pour une intelligence locale, privée, agentique et spécialisée.',
    eyebrow: 'ROADMAP · NON ENCORE LIVRÉ',
    heading: 'FuryAI : l’intelligence first-party prévue pour FuryPipe.',
    summary: 'La vision FuryAI est local-first, privée, hautement steerable et spécialisée dans le code, les agents, les outils, la mémoire et l’automatisation.',
    cards: [
      { title: 'Local-first', body: 'Objectif : fonctionnement local et offline avec backends adaptés au matériel quand les modèles seront disponibles.' },
      { title: 'FuryEval', body: 'Chaque évolution devra être mesurée sur des benchmarks reproductibles, pas uniquement annoncée.' },
      { title: 'Authority split', body: 'Le modèle raisonne ; FuryPipe conserve l’autorité sur les actions réelles, les secrets et les permissions.' },
    ],
  },
  '/developers': {
    title: 'Développeurs — FuryPipe',
    description: 'FuryPipe expose des surfaces CLI, API, headless, MCP, providers, skills et SDK autour d’un cœur partagé et gouverné.',
    eyebrow: 'DEVELOPERS',
    heading: 'Construire sur FuryPipe sans contourner ses garde-fous.',
    summary: 'Les intégrations doivent passer par les contrats partagés de FuryPipe : capabilities, policy, approvals, receipts et limites.',
    cards: [
      { title: 'CLI & Headless', body: 'Interfaces destinées à l’automatisation et aux pipelines, sans recréer un runtime parallèle.' },
      { title: 'MCP & Skills', body: 'Extensions déclaratives, permissions visibles, validation et isolation des capacités externes.' },
      { title: 'Provider SDK', body: 'Contrats pour capabilities, santé, mapping, streaming, coûts et médias derrière le runtime gouverné.' },
    ],
  },
  '/docs': {
    title: 'Documentation — FuryPipe',
    description: 'Documentation FuryPipe sur l’architecture, la sécurité, les runtimes, les providers, MCP, agents, workflows et interfaces.',
    eyebrow: 'DOCUMENTATION',
    heading: 'Une documentation liée aux preuves et aux contrats réels.',
    summary: 'Le portail Web de documentation sera construit à partir des documents versionnés du dépôt, sans réécrire une seconde source de vérité.',
    cards: [
      { title: 'Architecture', body: 'Contrats de composants, frontières d’autorité et flux de données.' },
      { title: 'Security', body: 'Trust model, permissions, secrets, replay, SSRF, path safety et audits.' },
      { title: 'Evidence', body: 'Résultats de tests, exact-head CI, limites connues et gates humains.' },
    ],
  },
  '/download': {
    title: 'Téléchargement — FuryPipe',
    description: 'Les téléchargements FuryPipe seront publiés uniquement depuis des releases vérifiées avec intégrité et provenance.',
    eyebrow: 'DOWNLOAD',
    heading: 'Des builds distribués uniquement quand les gates de release sont satisfaits.',
    summary: 'Cette page ne prétend pas qu’un nouvel installer ou une release Web est déjà disponible. Les futurs téléchargements devront être signés, vérifiables et liés à un commit exact.',
    cards: [
      { title: 'Integrity', body: 'Hash, provenance, version et source commit vérifiables.' },
      { title: 'Rollback', body: 'Les mises à jour devront prévoir une voie de retour sûre.' },
      { title: 'No silent deploy', body: 'Un build prêt ne signifie jamais qu’il a été déployé automatiquement.' },
    ],
  },
  '/changelog': {
    title: 'Changelog — FuryPipe',
    description: 'Suivez les évolutions FuryPipe à partir des changements versionnés, des preuves CI et des limites explicitement documentées.',
    eyebrow: 'CHANGELOG',
    heading: 'Des changements reliés à des commits et à leurs preuves.',
    summary: 'Le site public affichera les changements depuis la source versionnée du projet, sans inventer de statut de release ou de production.',
    cards: [
      { title: 'Exact head', body: 'Les validations importantes restent liées au SHA exact testé.' },
      { title: 'Evidence-first', body: 'Les claims techniques doivent être soutenus par des tests ou marqués comme limites.' },
      { title: 'Release-aware', body: 'Développement, release et production restent des états distincts.' },
    ],
  },
  '/about': {
    title: 'À propos — FuryPipe',
    description: 'FuryPipe est un projet créé par LégendeUrbaine pour unifier orchestration IA, agents, outils, mémoire, code et médias.',
    eyebrow: 'ABOUT',
    heading: 'FuryPipe est construit pour transformer des modèles IA en systèmes de travail gouvernés.',
    summary: 'Créé par LégendeUrbaine, FuryPipe privilégie l’architecture partagée, la preuve, la sécurité et la capacité à fonctionner localement ou avec des providers externes.',
    cards: [
      { title: 'Créateur', body: 'LégendeUrbaine.' },
      { title: 'Identité', body: FURYPIPE_BRAND_SOURCE.tagline },
      { title: 'Principe', body: 'L’intelligence propose et raisonne ; le runtime FuryPipe contrôle ce qui peut réellement s’exécuter.' },
    ],
  },
};

const EN: Record<FuryPipePublicSiteRoute, PageCopy> = {
  '/': {
    title: 'FuryPipe — Build · Automate · Create · Beyond',
    description: 'FuryPipe unifies models, agents, skills, MCP, memory, code, browser and media behind a governed AI platform.',
    eyebrow: 'AI PLATFORM · LOCAL + CLOUD · GOVERNED',
    heading: 'Build, automate and create without fragmenting your AI stack.',
    summary: 'FuryPipe orchestrates AI capabilities behind shared services, explicit permissions and verifiable evidence.',
    cards: [
      { title: 'Autopilot', body: 'Automatically selects relevant capabilities, skills, instructions and tools for each request.' },
      { title: 'Studio', body: 'Chat, code, research, media, memory, agents, workflows and artifacts in one coherent workspace.' },
      { title: 'Governance', body: 'Least privilege, approvals, receipts, budgets and execution separated from model intelligence.' },
    ],
  },
  '/product': {
    title: 'Product — FuryPipe',
    description: 'Explore FuryPipe architecture across models, agents, skills, MCP, memory, code, browser, media and workflows.',
    eyebrow: 'PRODUCT',
    heading: 'One orchestration layer for FuryPipe capabilities.',
    summary: 'Studio, CLI, API and Web should reuse the same services instead of duplicating authority systems.',
    cards: [
      { title: 'Models & Providers', body: 'Governed routing, health, capabilities, budgets and model profiles without fake controls.' },
      { title: 'Agents & Workflows', body: 'Planning, specialist roles, DAGs, human approvals, cost limits and controlled recovery.' },
      { title: 'Code, Browser & Media', body: 'Specialized runtimes with permissions, isolation, artifacts and provenance.' },
    ],
  },
  '/furyai': {
    title: 'FuryAI — FuryPipe roadmap',
    description: 'FuryAI is the first-party FuryPipe roadmap for local, private, agentic and specialized intelligence.',
    eyebrow: 'ROADMAP · NOT SHIPPED YET',
    heading: 'FuryAI: planned first-party intelligence for FuryPipe.',
    summary: 'The FuryAI vision is local-first, private, highly steerable and specialized in code, agents, tools, memory and automation.',
    cards: [
      { title: 'Local-first', body: 'Goal: local and offline operation with hardware-aware runtimes when FuryAI models become available.' },
      { title: 'FuryEval', body: 'Every improvement must be measured with reproducible evaluations instead of marketing claims alone.' },
      { title: 'Authority split', body: 'The model reasons; FuryPipe keeps authority over real actions, secrets and permissions.' },
    ],
  },
  '/developers': {
    title: 'Developers — FuryPipe',
    description: 'FuryPipe exposes CLI, API, headless, MCP, provider, skill and SDK surfaces around one governed shared core.',
    eyebrow: 'DEVELOPERS',
    heading: 'Build on FuryPipe without bypassing its safeguards.',
    summary: 'Integrations should use shared FuryPipe contracts for capabilities, policy, approvals, receipts and limits.',
    cards: [
      { title: 'CLI & Headless', body: 'Automation surfaces designed to reuse shared runtime contracts instead of creating parallel authority.' },
      { title: 'MCP & Skills', body: 'Declarative extensions with visible permissions, validation and isolation.' },
      { title: 'Provider SDK', body: 'Contracts for capabilities, health, mapping, streaming, cost and media behind governed execution.' },
    ],
  },
  '/docs': {
    title: 'Documentation — FuryPipe',
    description: 'FuryPipe documentation covering architecture, security, runtimes, providers, MCP, agents, workflows and interfaces.',
    eyebrow: 'DOCUMENTATION',
    heading: 'Documentation connected to real contracts and evidence.',
    summary: 'The Web documentation portal will derive from versioned repository documents rather than creating a second source of truth.',
    cards: [
      { title: 'Architecture', body: 'Component contracts, authority boundaries and data flows.' },
      { title: 'Security', body: 'Trust model, permissions, secrets, replay, SSRF, path safety and audits.' },
      { title: 'Evidence', body: 'Test results, exact-head CI, known limits and human gates.' },
    ],
  },
  '/download': {
    title: 'Download — FuryPipe',
    description: 'FuryPipe downloads will be published only from verified releases with integrity and provenance evidence.',
    eyebrow: 'DOWNLOAD',
    heading: 'Distribute builds only after release gates are satisfied.',
    summary: 'This page does not claim that a new installer or Web release already exists. Future downloads must be verifiable and tied to an exact source commit.',
    cards: [
      { title: 'Integrity', body: 'Verifiable hash, provenance, version and source commit.' },
      { title: 'Rollback', body: 'Updates should provide a safe return path.' },
      { title: 'No silent deploy', body: 'A ready build never means automatic production deployment.' },
    ],
  },
  '/changelog': {
    title: 'Changelog — FuryPipe',
    description: 'Track FuryPipe changes through versioned source, CI evidence and explicitly documented limitations.',
    eyebrow: 'CHANGELOG',
    heading: 'Changes connected to commits and evidence.',
    summary: 'The public site will surface changes from the versioned project source without inventing release or production status.',
    cards: [
      { title: 'Exact head', body: 'Important validations remain bound to the exact SHA that was tested.' },
      { title: 'Evidence-first', body: 'Technical claims require tests or must remain explicitly limited.' },
      { title: 'Release-aware', body: 'Development, release and production remain separate states.' },
    ],
  },
  '/about': {
    title: 'About — FuryPipe',
    description: 'FuryPipe is a project created by LégendeUrbaine to unify AI orchestration, agents, tools, memory, code and media.',
    eyebrow: 'ABOUT',
    heading: 'FuryPipe turns AI models into governed work systems.',
    summary: 'Created by LégendeUrbaine, FuryPipe prioritizes shared architecture, evidence, security and local or provider-backed operation.',
    cards: [
      { title: 'Creator', body: 'LégendeUrbaine.' },
      { title: 'Identity', body: FURYPIPE_BRAND_SOURCE.tagline },
      { title: 'Principle', body: 'Intelligence proposes and reasons; the FuryPipe runtime controls what can actually execute.' },
    ],
  },
};

const NAV: Record<FuryPipePublicSiteLocale, readonly { readonly path: FuryPipePublicSiteRoute; readonly label: string }[]> = {
  fr: [
    { path: '/product', label: 'Produit' },
    { path: '/furyai', label: 'FuryAI' },
    { path: '/developers', label: 'Développeurs' },
    { path: '/docs', label: 'Docs' },
    { path: '/download', label: 'Télécharger' },
    { path: '/about', label: 'À propos' },
  ],
  en: [
    { path: '/product', label: 'Product' },
    { path: '/furyai', label: 'FuryAI' },
    { path: '/developers', label: 'Developers' },
    { path: '/docs', label: 'Docs' },
    { path: '/download', label: 'Download' },
    { path: '/about', label: 'About' },
  ],
};

const PUBLIC_SITE_CSS = [
  ':root{color-scheme:dark;--bg:', FURYPIPE_BRAND_COLORS.charcoal, ';--panel:', FURYPIPE_BRAND_COLORS.graphite,
  ';--text:', FURYPIPE_BRAND_COLORS.white, ';--muted:#aaa6a0;--orange:', FURYPIPE_BRAND_COLORS.orange,
  ';--orange-hot:', FURYPIPE_BRAND_COLORS.orangeHot, ';--line:#2a292e}',
  '*{box-sizing:border-box}html{background:var(--bg);scroll-behavior:smooth}',
  'body{margin:0;background:radial-gradient(circle at 80% -10%,rgba(255,106,26,.16),transparent 34rem),var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.55}',
  'a{color:inherit}.skip{position:absolute;left:-9999px;top:0}.skip:focus{left:1rem;top:1rem;z-index:20;background:var(--orange);color:#120b06;padding:.7rem 1rem;border-radius:.6rem;font-weight:800}',
  '.shell{width:min(1180px,calc(100% - 2rem));margin:0 auto}.top{position:sticky;top:0;z-index:10;background:rgba(5,5,6,.82);backdrop-filter:blur(16px);border-bottom:1px solid rgba(255,255,255,.07)}',
  '.top-inner{min-height:72px;display:flex;align-items:center;gap:1rem;justify-content:space-between}.brand{display:flex;align-items:center;gap:.65rem;text-decoration:none;font-size:1.15rem}.brand-mark{width:34px;height:34px;color:var(--orange)}',
  '.wordmark-fury{font-weight:700}.wordmark-pipe{color:var(--orange)}nav{display:flex;gap:.35rem;flex-wrap:wrap;justify-content:flex-end}nav a{padding:.5rem .7rem;border-radius:.55rem;text-decoration:none;color:var(--muted);font-size:.92rem}nav a:hover,nav a[aria-current="page"]{background:#1c1b20;color:var(--text)}',
  '.hero{padding:7rem 0 3.5rem}.eyebrow{font-size:.78rem;font-weight:800;letter-spacing:.16em;color:var(--orange);margin-bottom:1rem}.hero h1{font-size:clamp(2.7rem,7vw,6rem);line-height:.96;letter-spacing:-.055em;max-width:980px;margin:0 0 1.4rem}',
  '.summary{font-size:clamp(1.05rem,2vw,1.35rem);max-width:780px;color:#c7c3bd}.actions{display:flex;gap:.75rem;flex-wrap:wrap;margin-top:2rem}.button{display:inline-flex;text-decoration:none;padding:.78rem 1rem;border-radius:.72rem;border:1px solid var(--line);font-weight:750}.button.primary{background:var(--orange);border-color:var(--orange);color:#120b06}.button.secondary{background:#111115}',
  '.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem;padding:1rem 0 6rem}.card{min-height:190px;padding:1.35rem;border:1px solid var(--line);border-radius:1rem;background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.012))}.card h2{font-size:1.05rem;margin:.1rem 0 .8rem}.card p{margin:0;color:var(--muted)}',
  '.status{display:inline-flex;align-items:center;gap:.5rem;border:1px solid #34271f;background:#17100c;color:#f2b083;border-radius:999px;padding:.42rem .7rem;font-size:.78rem;font-weight:700;margin-top:1.3rem}.dot{width:.48rem;height:.48rem;border-radius:50%;background:var(--orange)}',
  'footer{border-top:1px solid var(--line);padding:1.5rem 0 3rem;color:#8e8a85;font-size:.9rem}.footer-inner{display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap}',
  '@media(max-width:780px){.top-inner{align-items:flex-start;flex-direction:column;padding:1rem 0}nav{justify-content:flex-start}.hero{padding-top:4.5rem}.grid{grid-template-columns:1fr}.hero h1{font-size:clamp(2.5rem,13vw,4.2rem)}}',
].join('');

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeBaseUrl(value: string): URL {
  let base: URL;
  try {
    base = new URL(value);
  } catch {
    throw new Error('public site baseUrl must be a valid HTTPS origin');
  }

  if (
    base.protocol !== 'https:'
    || base.username !== ''
    || base.password !== ''
    || base.search !== ''
    || base.hash !== ''
    || base.pathname !== '/'
  ) {
    throw new Error('public site baseUrl must be a credential-free HTTPS origin');
  }

  return base;
}

function assertRoute(path: string): asserts path is FuryPipePublicSiteRoute {
  if (!(FURYPIPE_PUBLIC_SITE_ROUTES as readonly string[]).includes(path)) {
    throw new Error('unsupported FuryPipe public site route');
  }
}

function assertLocale(locale: string): asserts locale is FuryPipePublicSiteLocale {
  if (!(FURYPIPE_PUBLIC_SITE_LOCALES as readonly string[]).includes(locale)) {
    throw new Error('unsupported FuryPipe public site locale');
  }
}

function routeHref(path: FuryPipePublicSiteRoute, locale: FuryPipePublicSiteLocale): string {
  return path + (path.includes('?') ? '&' : '?') + 'lang=' + locale;
}

export function renderFuryPipePublicSitePage(
  input: FuryPipePublicSiteRenderInput,
): FuryPipePublicSitePageArtifact {
  assertRoute(input.path);
  assertLocale(input.locale);

  const base = normalizeBaseUrl(input.baseUrl);
  const copy = (input.locale === 'fr' ? FR : EN)[input.path];
  const canonical = new URL(input.path, base);
  const nav = NAV[input.locale]
    .map((item) => {
      const current = item.path === input.path ? ' aria-current="page"' : '';
      return '<a href="' + escapeHtml(routeHref(item.path, input.locale)) + '"' + current + '>' + escapeHtml(item.label) + '</a>';
    })
    .join('');

  const monogram = renderFuryPipeMonogramSvg({ className: 'brand-mark', tone: 'accent', label: 'FuryPipe' });
  const wordmark = renderFuryPipeWordmarkHtml('wordmark');
  const favicon = 'data:image/svg+xml,' + encodeURIComponent(FURYPIPE_FAVICON_SVG);
  const cards = copy.cards
    .map((card) => '<article class="card"><h2>' + escapeHtml(card.title) + '</h2><p>' + escapeHtml(card.body) + '</p></article>')
    .join('');

  const docsLabel = input.locale === 'fr' ? 'Voir la documentation' : 'View documentation';
  const productLabel = input.locale === 'fr' ? 'Découvrir le produit' : 'Explore the product';
  const statusLabel = input.locale === 'fr' ? 'FuryPipe Web · préparation · non déployé' : 'FuryPipe Web · preparation · not deployed';
  const creatorLabel = input.locale === 'fr' ? 'Créé par' : 'Created by';

  const html = [
    '<!doctype html>',
    '<html lang="' + input.locale + '">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta name="theme-color" content="' + FURYPIPE_BRAND_COLORS.charcoal + '">',
    '<title>' + escapeHtml(copy.title) + '</title>',
    '<meta name="description" content="' + escapeHtml(copy.description) + '">',
    '<meta property="og:type" content="website">',
    '<meta property="og:title" content="' + escapeHtml(copy.title) + '">',
    '<meta property="og:description" content="' + escapeHtml(copy.description) + '">',
    '<link rel="canonical" href="' + escapeHtml(canonical.toString()) + '">',
    '<link rel="icon" type="image/svg+xml" href="' + escapeHtml(favicon) + '">',
    '<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;; img-src &#39;self&#39; data:; font-src &#39;none&#39;; connect-src &#39;none&#39;; media-src &#39;none&#39;; object-src &#39;none&#39;; frame-src &#39;none&#39;; base-uri &#39;none&#39;; form-action &#39;none&#39;">',
    '<style>' + PUBLIC_SITE_CSS + '</style>',
    '</head>',
    '<body data-brand="furypipe" data-surface="public-site" data-deployment="not-deployed">',
    '<a class="skip" href="#content">' + (input.locale === 'fr' ? 'Aller au contenu' : 'Skip to content') + '</a>',
    '<header class="top"><div class="shell top-inner">',
    '<a class="brand" href="' + escapeHtml(routeHref('/', input.locale)) + '">' + monogram + wordmark + '</a>',
    '<nav aria-label="' + (input.locale === 'fr' ? 'Navigation principale' : 'Primary navigation') + '">' + nav + '</nav>',
    '</div></header>',
    '<main id="content" class="shell">',
    '<section class="hero">',
    '<div class="eyebrow">' + escapeHtml(copy.eyebrow) + '</div>',
    '<h1>' + escapeHtml(copy.heading) + '</h1>',
    '<p class="summary">' + escapeHtml(copy.summary) + '</p>',
    '<div class="actions"><a class="button primary" href="' + escapeHtml(routeHref('/product', input.locale)) + '">' + escapeHtml(productLabel) + '</a><a class="button secondary" href="' + escapeHtml(routeHref('/docs', input.locale)) + '">' + escapeHtml(docsLabel) + '</a></div>',
    '<div class="status"><span class="dot" aria-hidden="true"></span>' + escapeHtml(statusLabel) + '</div>',
    '</section>',
    '<section class="grid" aria-label="' + (input.locale === 'fr' ? 'Points clés' : 'Key points') + '">' + cards + '</section>',
    '</main>',
    '<footer><div class="shell footer-inner"><span>' + escapeHtml(FURYPIPE_BRAND_SOURCE.tagline) + '</span><span>' + escapeHtml(creatorLabel) + ' <strong>' + escapeHtml(FURYPIPE_BRAND_SOURCE.creator) + '</strong></span></div></footer>',
    '</body>',
    '</html>',
    '',
  ].join('\n');

  return Object.freeze({
    format: FURYPIPE_PUBLIC_SITE_FORMAT,
    path: input.path,
    locale: input.locale,
    canonicalUrl: canonical.toString(),
    title: copy.title,
    description: copy.description,
    html,
    sha256: createHash('sha256').update(html, 'utf8').digest('hex'),
    externalScripts: Object.freeze([]),
    deploymentClaim: 'NOT_DEPLOYED',
  });
}
