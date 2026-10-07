import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Self-hosted IBM Plex subset used by the FORGE 03 product surfaces.
 *
 * The files are vendored from @fontsource/ibm-plex-sans and
 * @fontsource/ibm-plex-mono 5.3.0 (OFL-1.1). Data URLs keep the generated
 * local-first HTML deterministic: no CDN, network request or font path is
 * needed after the package is installed.
 */
// Source modules and the emitted `dist/studio` module resolve two levels up.
// The bundled Node/MCP entry lives directly in `dist`, so its package assets
// resolve one level up. Keep both layouts explicit for dev, bundled and
// installed-package execution.
const FONT_ROOTS = [
  new URL('../../assets/fonts/ibm-plex/', import.meta.url),
  new URL('../assets/fonts/ibm-plex/', import.meta.url),
];

function fontData(file: string): string {
  let lastError: unknown;
  for (const root of FONT_ROOTS) {
    try {
      return readFileSync(fileURLToPath(new URL(file, root))).toString('base64');
    } catch (error) {
      lastError = error;
    }
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`IBM Plex local font asset missing: ${file} (${detail})`);
}

function fontFace(family: string, weight: number, file: string): string {
  return `@font-face{font-family:${JSON.stringify(family)};font-style:normal;font-display:swap;font-weight:${weight};src:url(data:font/woff2;base64,${fontData(file)}) format("woff2")}`;
}

export const IBM_PLEX_FONT_FACE_CSS = [
  fontFace('IBM Plex Sans', 400, 'ibm-plex-sans-latin-400-normal.woff2'),
  fontFace('IBM Plex Sans', 600, 'ibm-plex-sans-latin-600-normal.woff2'),
  fontFace('IBM Plex Mono', 400, 'ibm-plex-mono-latin-400-normal.woff2'),
  fontFace('IBM Plex Mono', 600, 'ibm-plex-mono-latin-600-normal.woff2'),
].join('');

export const IBM_PLEX_FONT_SOURCE = Object.freeze({
  provider: '@fontsource',
  version: '5.3.0',
  license: 'OFL-1.1',
  subset: 'latin',
  delivery: 'local-data-url',
});
