import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('assets/branding/forge');
const COLORS = Object.freeze({
  orange: '#FF6A00',
  graphite: '#2A2A2A',
  deepBlack: '#0B0D10',
  offWhite: '#F5F4F0',
  coolGray: '#E5E7EB',
  black: '#000000',
  white: '#FFFFFF',
});

const SYMBOL_PATHS = [
  '<path d="M48 18H230L190 62H10Z"/>',
  '<path d="M26 64H92L54 101H26Z"/>',
  '<path d="M26 126L58 97H184L153 131H91L80 142V173L53 201L26 224Z"/>',
].join('');

const WORDMARK_PATHS = ({ orange, foreground }) => [
  `<path fill="${orange}" d="M73 24H241L205 60H36Z"/>`,
  `<path fill="${foreground}" d="M53 64H112L78 98L53 120Z"/>`,
  `<path fill="${foreground}" d="M53 126L82 97H184L153 131H91L80 142V173L53 201Z"/>`,
  `<path fill="${foreground}" d="M176 89H212V143L222 153H256L267 143V89H293V158L274 177H204L176 158Z"/>`,
  `<path fill="${foreground}" d="M304 111L326 89H372V121H340V177H304Z"/>`,
  `<path fill="${foreground}" fill-rule="evenodd" d="M381 89H488V158L425 217H383L433 168L408 164L381 144ZM411 89H457V128L443 144H433L411 128Z"/>`,
  `<path fill="${orange}" fill-rule="evenodd" d="M477 33H608L633 64V96L605 124H530V176L498 206V68ZM501 64H579L590 76V88L578 100H545L530 116V96L501 68Z"/>`,
  `<path fill="${foreground}" d="M624 89H643V177H609V104Z"/>`,
  `<path fill="${foreground}" fill-rule="evenodd" d="M659 89H729L745 105V160L721 177H683V213H653V108ZM683 111H715V148H691V160H683Z"/>`,
  `<path fill="${foreground}" fill-rule="evenodd" d="M767 89H832L850 107V144H782V148L792 152H850V177H775L754 156V108ZM782 112H820V128H790V136H782Z"/>`,
].join('');

function svg(body, viewBox, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-labelledby="title"><title id="title">${label}</title>${body}</svg>\n`;
}

function wordmark({ foreground, background = null, label }) {
  const backgroundNode = background ? `<rect width="900" height="300" fill="${background}"/>` : '';
  const tagline = [
    `<text x="120" y="276" fill="${foreground}" font-family="IBM Plex Sans, Arial, sans-serif" font-size="16" letter-spacing="8">BUILD · AUTOMATE · CREATE · </text>`,
    `<text x="681" y="276" fill="${COLORS.orange}" font-family="IBM Plex Sans, Arial, sans-serif" font-size="16" letter-spacing="8">BEYOND.</text>`,
  ].join('');
  return svg(`${backgroundNode}${WORDMARK_PATHS({ orange: COLORS.orange, foreground })}${tagline}`, '0 0 900 300', label);
}

function monochrome({ foreground, background, label }) {
  return svg(`<rect width="900" height="230" fill="${background}"/><g>${WORDMARK_PATHS({ orange: foreground, foreground })}</g>`, '0 0 900 230', label);
}

function symbol({ foreground, background = null, rounded = false, label, viewBox = '0 0 256 256' }) {
  const backgroundNode = background ? `<rect width="256" height="256" rx="${rounded ? 48 : 0}" fill="${background}"/>` : '';
  const paths = SYMBOL_PATHS
    .replace('<path d="M48 18H230L190 62H10Z"/>', `<path fill="${COLORS.orange}" d="M48 18H230L190 62H10Z"/>`)
    .replaceAll('<path d="', `<path fill="${foreground}" d="`);
  return svg(`${backgroundNode}${paths}`, viewBox, label);
}

mkdirSync(path.join(ROOT, 'master'), { recursive: true });
mkdirSync(path.join(ROOT, 'variants'), { recursive: true });

writeFileSync(path.join(ROOT, 'master', 'furypipe-forge-symbol.svg'), symbol({ foreground: COLORS.offWhite, label: 'FuryPipe FORGE 03 symbol' }));
writeFileSync(path.join(ROOT, 'master', 'furypipe-forge-wordmark.svg'), svg(WORDMARK_PATHS({ orange: COLORS.orange, foreground: COLORS.offWhite }), '0 0 900 230', 'FuryPipe FORGE 03 wordmark'));
writeFileSync(path.join(ROOT, 'variants', 'furypipe-logo-dark.svg'), wordmark({ foreground: COLORS.offWhite, background: COLORS.deepBlack, label: 'FuryPipe FORGE 03 dark logo' }));
writeFileSync(path.join(ROOT, 'variants', 'furypipe-logo-light.svg'), wordmark({ foreground: COLORS.deepBlack, background: COLORS.offWhite, label: 'FuryPipe FORGE 03 light logo' }));
writeFileSync(path.join(ROOT, 'variants', 'furypipe-logo-transparent.svg'), svg(WORDMARK_PATHS({ orange: COLORS.orange, foreground: COLORS.offWhite }), '0 0 900 230', 'FuryPipe FORGE 03 transparent wordmark'));
writeFileSync(path.join(ROOT, 'variants', 'furypipe-logo-monochrome-dark.svg'), monochrome({ foreground: COLORS.offWhite, background: COLORS.deepBlack, label: 'FuryPipe FORGE 03 white monochrome wordmark' }));
writeFileSync(path.join(ROOT, 'variants', 'furypipe-logo-monochrome-light.svg'), monochrome({ foreground: COLORS.deepBlack, background: COLORS.offWhite, label: 'FuryPipe FORGE 03 black monochrome wordmark' }));
writeFileSync(path.join(ROOT, 'variants', 'furypipe-symbol-white.svg'), symbol({ foreground: COLORS.offWhite, label: 'FuryPipe FORGE 03 white symbol' }));
writeFileSync(path.join(ROOT, 'variants', 'furypipe-symbol-black.svg'), symbol({ foreground: COLORS.black, label: 'FuryPipe FORGE 03 black symbol' }));
writeFileSync(path.join(ROOT, 'variants', 'furypipe-favicon.svg'), symbol({ foreground: COLORS.offWhite, background: COLORS.deepBlack, rounded: true, label: 'FuryPipe FORGE 03 favicon', viewBox: '0 0 256 256' }));
writeFileSync(path.join(ROOT, 'variants', 'furypipe-app-icon.svg'), symbol({ foreground: COLORS.offWhite, background: COLORS.deepBlack, rounded: true, label: 'FuryPipe FORGE 03 app icon', viewBox: '0 0 256 256' }));

console.log(`Generated FORGE 03 SVG assets in ${ROOT}`);
