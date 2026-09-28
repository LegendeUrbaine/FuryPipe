# FuryPipe Local Design System 2026

Status: visual and interaction contract for the staged Local AI interface.

## Direction

FuryPipe Local is a calm dark editorial tool. It is professional, local-first and precise. It is not a gaming HUD, cyberpunk dashboard, admin card grid or permanent capability catalogue.

Orange `#ff6a1a` is the brand accent. It signals focus, route, active state and approval. It is not a background wash applied to every component.

## Tokens

The implementation keeps the existing nonce-scoped CSS token model:

```css
--b0: #050506;
--b1: #0a0a0c;
--b2: #0f0f12;
--b3: #15151a;
--ink: #f4f1ec;
--ink-2: #c3bdb4;
--muted: #8b857c;
--o-core: #ff6a1a;
--o-hot: #ff8a3d;
```

Use semantic aliases for component states:

- success: `--ok`;
- warning / unverified: `--warn`;
- failure / blocked: `--bad`;
- quiet borders: `--line`, `--line-2`;
- focus: `--o-hot` with a visible two-pixel outline.

Spacing uses a small scale rather than one-off offsets. Dense technical tables may use compact spacing; Chat, Projects and Settings use the comfortable default.

## Typography

- display headings use the configured display stack;
- body copy uses the configured system sans stack;
- runtime IDs, hashes, paths, model IDs and receipts use the configured monospace stack;
- headings are short and sentence-like;
- helper text explains state and boundary, not implementation trivia;
- French and English must fit the same responsive regions without clipped controls.

## Layout

The shell has one permanent side rail and one main surface. Chat owns the main flow. An optional contextual panel may occupy the right side only when the current task needs it.

Avoid card soup:

- use a card when a boundary, state or action group needs containment;
- prefer borderless message flow for conversation;
- group related controls with whitespace before adding a border;
- do not make every link, stat and sentence a separate card.

Target layouts are checked at 320, 390, 768, 1024, 1280, 1366, 1440, 1920 and 2560 CSS pixels. No horizontal page overflow is acceptable at the tested widths.

## Core components

### Chat empty state

One clear invitation, a short local-first explanation and the minimal composer. If no local AI is ready, show one compact configuration prompt. Do not show a permanent provider setup catalogue.

### Composer

The default control order is `+`, message field, `Fury Auto`, send. Additional context lives behind `+`. The composer does not expose reasoning effort as a daily control.

### Fury Auto picker

The picker exposes real observed candidates and preserves the difference between reachable, detected, configured, verified and unavailable. It never says “ready” from static metadata alone.

### Project view

Projects show the current project, discussions and links to existing sources and artifacts. A new discussion action returns to Chat. The view does not invent counts when an API is unavailable.

### Contextual panel

Panels have a named region, close control, concise state copy and explicit links to the underlying governed view. A panel can be unavailable or preview-only. It must not imply a hidden terminal or hidden authority.

### Command palette

The palette is a keyboard-first listbox/dialog. It has a bounded result set, a visible empty state and Escape restoration to the invoking control.

## Motion

Motion is progressive enhancement:

- Chat can morph from empty hero to conversation with a restrained transition;
- streaming must not jump the viewport when the user has scrolled away;
- reduced-motion removes decorative transforms and transitions;
- no animation is required to understand a state or approval.

## Accessibility

- semantic headings and named regions;
- keyboard access to Chat, Projects, Search, Settings, `+`, Fury Auto, send and close controls;
- visible focus that is not hidden beneath fixed UI;
- focus moves to a new view heading after in-app navigation and returns to the invoking control after a dismissed popover;
- target sizes meet the WCAG 2.2 target-size intent where applicable;
- dialogs and menus trap or restore focus according to their actual interaction model;
- icon-only controls have names;
- live status uses `role=status` or `aria-live` only where the message is useful;
- automated AccessLint is a locator, not a human accessibility certification.

## States

Every async surface has explicit loading, empty, unavailable, error, blocked, preview-only and success copy where the underlying route can produce those states. Unknown cost, unknown fit, unavailable provider and not-verified runtime stay unknown.

## Security presentation

The UI preserves strict CSP and same-origin behavior. Static icon markup is compile-time controlled. Runtime text is inserted through text nodes. No `innerHTML` path is added for model output, artifacts, file content, provider output, MCP content or web content.

Approval copy describes the action, capability, scope and consequence. It never hides a network, secret, publish or destructive boundary behind “Continue”.
