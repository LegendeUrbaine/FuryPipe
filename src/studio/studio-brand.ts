/**
 * FuryPipe Studio FLUX brand primitives.
 *
 * The owner-approved FLUX board is a direction board, not an export bundle.
 * These small, flat primitives are the runtime source of truth. Exported SVG
 * assets live under assets/branding/flux and use the same ribbon geometry.
 */

export type FuryPipeBrandTone = 'accent' | 'light' | 'dark' | 'white';

export const FURYPIPE_BRAND_COLORS = Object.freeze({
  fluxOrange: '#FF7A1A',
  charcoal: '#0B0B0F',
  graphite: '#1A1A1F',
  slate: '#2E2E36',
  steel: '#9CA3AF',
  white: '#FFFFFF',
  electricBlue: '#3B82F6',
  successGreen: '#22C55E',
});

export const FURYPIPE_BRAND_SOURCE = Object.freeze({
  creator: 'LégendeUrbaine',
  wordmark: 'FuryPipe',
  tagline: 'ORCHESTRATE. CREATE. SHIP.',
  reference: 'codex-clipboard-b0965a62-5a35-4629-9f9d-63b8669ba9c3.png',
  concept: 'FLUX',
  sourceStatus: 'OWNER_APPROVED_REFERENCE_DERIVED',
});

// Continuous asymmetric ribbon. One filled outline keeps terminals, weight and
// negative space stable at favicon size without borrowing the retired F mark.
const FLUX_RIBBON_PATH = '<path d="M64 302C106 302 123 228 163 171c29-41 61-64 100-64 45 0 69 25 94 64 26 40 50 75 91 75 32 0 57-18 76-52l45 27c-31 56-72 84-123 84-77 0-111-51-143-99-20-31-34-43-60-43-23 0-40 16-60 45-36 52-64 150-142 150-33 0-61-15-85-42l43-39c12 12 25 18 39 18Z" fill="currentColor"/>';

function safeClassName(value: string): string {
  const classes = value.split(/\s+/u).filter((part) => /^[A-Za-z_][A-Za-z0-9_-]*$/u.test(part));
  return classes.length > 0 ? classes.join(' ') : 'brand-mark';
}

function escapeAttribute(value: string): string {
  return value.replace(/[&<>"']/gu, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

export function renderFuryPipeMonogramSvg(options: {
  readonly className?: string;
  readonly tone?: FuryPipeBrandTone;
  readonly label?: string;
} = {}): string {
  const className = safeClassName(options.className ?? 'brand-mark');
  const tone = options.tone ?? 'accent';
  const accessibility = options.label
    ? `role="img" aria-label="${escapeAttribute(options.label)}"`
    : 'aria-hidden="true"';
  return `<svg class="${className}" data-brand="furypipe-flux-symbol" data-tone="${tone}" viewBox="0 0 512 420" ${accessibility} focusable="false">${FLUX_RIBBON_PATH}</svg>`;
}

export function renderFuryPipeWordmarkHtml(className = 'wordmark'): string {
  return `<span class="${safeClassName(className)}" data-brand="furypipe-flux-wordmark" aria-label="FuryPipe"><span class="wordmark-fury">Fury</span><b class="wordmark-pipe">Pipe</b></span>`;
}

export const FURYPIPE_FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="FuryPipe"><rect width="64" height="64" rx="14" fill="${FURYPIPE_BRAND_COLORS.charcoal}"/><g transform="translate(4 9) scale(.1)">${FLUX_RIBBON_PATH.replace('currentColor', FURYPIPE_BRAND_COLORS.fluxOrange)}</g></svg>`;
