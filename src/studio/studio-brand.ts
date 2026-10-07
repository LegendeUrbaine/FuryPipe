/**
 * FuryPipe Studio FORGE 03 brand primitives.
 *
 * The owner-approved brand board is a raster reference, not a product asset
 * bundle. The Forge wordmark is therefore reconstructed as editable polygonal
 * SVG paths. No generic font replaces the custom FuryPipe letterforms.
 */

export type FuryPipeBrandTone = 'accent' | 'light' | 'dark' | 'white';

export const FURYPIPE_BRAND_COLORS = Object.freeze({
  orangeFury: '#FF6A00',
  graphite: '#2A2A2A',
  deepBlack: '#0B0D10',
  offWhite: '#F5F4F0',
  coolGray: '#E5E7EB',
  white: '#FFFFFF',
  black: '#000000',
  successGreen: '#22C55E',
  electricBlue: '#3B82F6',
});

export const FURYPIPE_BRAND_SOURCE = Object.freeze({
  creator: 'LégendeUrbaine',
  wordmark: 'FuryPipe',
  tagline: 'BUILD · AUTOMATE · CREATE · BEYOND.',
  reference: 'Guide de marque FuryPipe _ identité tech et design.png',
  referenceSha256: '02F0B99B4C821CAC4CCA5F581E18F77AAD804B319209DC0A5C6FC7B7FF78C868',
  concept: 'FORGE 03',
  sourceStatus: 'OWNER_APPROVED_REFERENCE_RECONSTRUCTED',
});

/** The two-tone Forge F is shared by Studio, favicon and generated assets. */
export const FURYPIPE_FORGE_SYMBOL_PATHS = [
  '<path class="forge-symbol-orange" fill="#FF6A00" d="M48 18H230L190 62H10Z"/>',
  '<path class="forge-symbol-body" fill="currentColor" d="M26 64H92L54 101H26Z"/>',
  '<path class="forge-symbol-body" fill="currentColor" d="M26 126L58 97H184L153 131H91L80 142V173L53 201L26 224Z"/>',
].join('');

/**
 * Custom polygon letterforms traced from the owner-approved FORGE 03 board.
 * Coordinates intentionally stay in the board's compact 900x230 composition;
 * the SVG remains editable paths and never embeds the reference raster.
 */
export const FURYPIPE_FORGE_WORDMARK_PATHS = [
  '<path fill="#FF6A00" d="M73 24H241L205 60H36Z"/>',
  '<path fill="currentColor" d="M53 64H112L78 98L53 120Z"/>',
  '<path fill="currentColor" d="M53 126L82 97H184L153 131H91L80 142V173L53 201Z"/>',
  '<path fill="currentColor" d="M176 89H212V143L222 153H256L267 143V89H293V158L274 177H204L176 158Z"/>',
  '<path fill="currentColor" d="M304 111L326 89H372V121H340V177H304Z"/>',
  '<path fill="currentColor" fill-rule="evenodd" d="M381 89H488V158L425 217H383L433 168L408 164L381 144ZM411 89H457V128L443 144H433L411 128Z"/>',
  '<path fill="#FF6A00" fill-rule="evenodd" d="M477 33H608L633 64V96L605 124H530V176L498 206V68ZM501 64H579L590 76V88L578 100H545L530 116V96L501 68Z"/>',
  '<path fill="currentColor" d="M624 89H643V177H609V104Z"/>',
  '<path fill="currentColor" fill-rule="evenodd" d="M659 89H729L745 105V160L721 177H683V213H653V108ZM683 111H715V148H691V160H683Z"/>',
  '<path fill="currentColor" fill-rule="evenodd" d="M767 89H832L850 107V144H782V148L792 152H850V177H775L754 156V108ZM782 112H820V128H790V136H782Z"/>',
].join('');

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
  return `<svg class="${className}" data-brand="furypipe-forge-symbol" data-tone="${tone}" viewBox="0 0 256 256" ${accessibility} focusable="false">${FURYPIPE_FORGE_SYMBOL_PATHS}</svg>`;
}

export function renderFuryPipeWordmarkHtml(className = 'wordmark'): string {
  return `<span class="${safeClassName(className)}" data-brand="furypipe-forge-wordmark" role="img" aria-label="FuryPipe"><svg class="wordmark-svg" viewBox="0 0 900 230" aria-hidden="true" focusable="false">${FURYPIPE_FORGE_WORDMARK_PATHS}</svg></span>`;
}

export const FURYPIPE_FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="FuryPipe"><rect width="64" height="64" rx="12" fill="${FURYPIPE_BRAND_COLORS.deepBlack}"/><g transform="translate(7 7) scale(.195)" color="${FURYPIPE_BRAND_COLORS.offWhite}">${FURYPIPE_FORGE_SYMBOL_PATHS.replaceAll('currentColor', FURYPIPE_BRAND_COLORS.offWhite)}</g></svg>`;
