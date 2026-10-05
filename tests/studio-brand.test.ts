import { describe, expect, it } from 'vitest';

import {
  FURYPIPE_BRAND_COLORS,
  FURYPIPE_BRAND_SOURCE,
  FURYPIPE_FAVICON_SVG,
  renderFuryPipeMonogramSvg,
  renderFuryPipeWordmarkHtml,
} from '../src/studio/studio-brand.js';
import { IBM_PLEX_FONT_FACE_CSS, IBM_PLEX_FONT_SOURCE } from '../src/studio/ibm-plex-fonts.js';
import { renderStudioHtml } from '../src/studio/studio-page.js';

describe('FuryPipe Studio brand', () => {
  it('keeps the owner-approved FORGE 03 identity centralized and flat at UI size', () => {
    const mark = renderFuryPipeMonogramSvg({ className: 'mark brand-mark', tone: 'accent' });
    const wordmark = renderFuryPipeWordmarkHtml();

    expect(FURYPIPE_BRAND_SOURCE.creator).toBe('LégendeUrbaine');
    expect(FURYPIPE_BRAND_SOURCE.reference).toBe('Guide de marque FuryPipe _ identité tech et design.png');
    expect(FURYPIPE_BRAND_SOURCE.referenceSha256).toBe('02F0B99B4C821CAC4CCA5F581E18F77AAD804B319209DC0A5C6FC7B7FF78C868');
    expect(FURYPIPE_BRAND_SOURCE.concept).toBe('FORGE 03');
    expect(FURYPIPE_BRAND_SOURCE.sourceStatus).toBe('OWNER_APPROVED_REFERENCE_RECONSTRUCTED');
    expect(mark).toContain('data-brand="furypipe-forge-symbol"');
    expect(mark).toContain('fill="currentColor"');
    expect(mark).toContain('viewBox="0 0 256 256"');
    expect(wordmark).toContain('data-brand="furypipe-forge-wordmark"');
    expect(wordmark).toContain('<path');
    expect(wordmark).not.toContain('<text');
    expect(FURYPIPE_BRAND_COLORS.orangeFury).toBe('#FF6A00');
  });

  it('provides a standalone favicon variant without external requests', () => {
    expect(FURYPIPE_FAVICON_SVG).toContain('<svg');
    expect(FURYPIPE_FAVICON_SVG).toContain(FURYPIPE_BRAND_COLORS.deepBlack);
    expect(FURYPIPE_FAVICON_SVG).toContain(FURYPIPE_BRAND_COLORS.orangeFury);
    expect(FURYPIPE_FAVICON_SVG).not.toContain('currentColor');
  });

  it('embeds the licensed IBM Plex subsets locally for offline browser rendering', () => {
    expect(IBM_PLEX_FONT_SOURCE).toMatchObject({ provider: '@fontsource', version: '5.3.0', license: 'OFL-1.1', delivery: 'local-data-url' });
    expect(IBM_PLEX_FONT_FACE_CSS).toContain('font-family:"IBM Plex Sans"');
    expect(IBM_PLEX_FONT_FACE_CSS).toContain('font-family:"IBM Plex Mono"');
    expect(IBM_PLEX_FONT_FACE_CSS).toContain('data:font/woff2;base64,');
  });

  it('integrates the same mark into Studio shell and favicon', () => {
    const page = renderStudioHtml().html;

    expect(page).toContain('data-brand="furypipe"');
    expect(page).toContain('class="brand-expanded"');
    expect(page).toContain('class="brand-collapsed"');
    expect(page).toContain('class="mark brand-mark collapsed-brand-mark"');
    expect(page).toMatch(/class="brand"[^>]*><span class="brand-expanded"><span class="wordmark"/u);
    expect(page).toContain('class="top-brand-mark brand-mark"');
    expect(page).toContain('class="hero-brand-mark brand-mark"');
    expect(page).toContain('rel="icon" type="image/svg+xml"');
    expect(page).toContain('application-name" content="FuryPipe Studio"');
    expect(page).toContain('@font-face');
    expect(page).not.toContain('fury-ring');
    expect(page).not.toContain('class="orbit');
  });
});
