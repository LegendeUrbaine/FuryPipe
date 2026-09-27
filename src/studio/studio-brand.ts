/**
 * FuryPipe Studio brand primitives.
 *
 * The supplied 2026 reference material is a brand board, not a clean asset
 * package. Keep the usable UI marks in one source so sidebar, responsive
 * topbar, empty state and favicon cannot drift apart. The SVG is deliberately
 * flat at small sizes; glow belongs to the surrounding UI, not the mark.
 */

export type FuryPipeBrandTone = 'accent' | 'light' | 'dark' | 'white';

export const FURYPIPE_BRAND_COLORS = Object.freeze({
  charcoal: '#050506',
  graphite: '#15151a',
  orange: '#ff6a1a',
  orangeHot: '#ff8a3d',
  white: '#f4f1ec',
  ink: '#1a1714',
});

export const FURYPIPE_BRAND_SOURCE = Object.freeze({
  creator: 'LégendeUrbaine',
  wordmark: 'FuryPipe',
  tagline: 'BUILD · AUTOMATE · CREATE · BEYOND',
  reference: 'Image ChatGPT 27 sept. 2026, 15_27_59-1.png',
  sourceStatus: 'REFERENCE_DERIVED',
});

// Three tapered horizontal strokes joined by the characteristic forward
// diagonal. Keep this path geometry identical across all UI sizes and tones.
const MONOGRAM_PATH = '<path d="M12 79 23 29c2-9 8-14 18-14h45L75 29H46c-4 0-7 3-8 7L27 79H12Zm22-40h39L62 52H31l3-13Zm-5 18h36L54 70H26l3-13Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"/>';

function safeClassName(value: string): string {
  const classes = value.split(/\s+/u).filter((part) => /^[A-Za-z_][A-Za-z0-9_-]*$/u.test(part));
  return classes.length > 0 ? classes.join(' ') : 'brand-mark';
}

export function renderFuryPipeMonogramSvg(options: {
  readonly className?: string;
  readonly tone?: FuryPipeBrandTone;
  readonly label?: string;
} = {}): string {
  const className = safeClassName(options.className ?? 'brand-mark');
  const tone = options.tone ?? 'accent';
  const accessibility = options.label
    ? `role="img" aria-label="${options.label.replace(/[&<>"']/gu, (value) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[value]!)}"`
    : 'aria-hidden="true"';
  return `<svg class="${className}" data-brand="furypipe-monogram" data-tone="${tone}" viewBox="0 0 100 100" ${accessibility} focusable="false">${MONOGRAM_PATH}</svg>`;
}

export function renderFuryPipeWordmarkHtml(className = 'wordmark'): string {
  return `<span class="${safeClassName(className)}" data-brand="furypipe-wordmark" aria-label="FuryPipe"><span class="wordmark-fury">Fury</span><b class="wordmark-pipe">Pipe</b></span>`;
}

export const FURYPIPE_FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="${FURYPIPE_BRAND_COLORS.charcoal}"/><g transform="translate(2.2 2.2) scale(.276)">${MONOGRAM_PATH.replaceAll('currentColor', FURYPIPE_BRAND_COLORS.orange)}</g></svg>`;
