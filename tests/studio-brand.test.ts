import { describe, expect, it } from 'vitest';

import {
  FURYPIPE_BRAND_COLORS,
  FURYPIPE_BRAND_SOURCE,
  FURYPIPE_FAVICON_SVG,
  renderFuryPipeMonogramSvg,
  renderFuryPipeWordmarkHtml,
} from '../src/studio/studio-brand.js';
import { renderStudioHtml } from '../src/studio/studio-page.js';

describe('FuryPipe Studio brand', () => {
  it('keeps the supplied identity centralized and flat at UI size', () => {
    const mark = renderFuryPipeMonogramSvg({ className: 'mark brand-mark', tone: 'accent' });
    const wordmark = renderFuryPipeWordmarkHtml();

    expect(FURYPIPE_BRAND_SOURCE.creator).toBe('LégendeUrbaine');
    expect(FURYPIPE_BRAND_SOURCE.reference).toBe('Image ChatGPT 27 sept. 2026, 15_27_59-1.png');
    expect(FURYPIPE_BRAND_SOURCE.sourceStatus).toBe('REFERENCE_DERIVED');
    expect(mark).toContain('data-brand="furypipe-monogram"');
    expect(mark).toContain('fill="currentColor"');
    expect(mark).toContain('fill-rule="evenodd"');
    expect(mark).not.toContain('fury-ring');
    expect(wordmark).toContain('Fury');
    expect(wordmark).toContain('Pipe');
    expect(FURYPIPE_BRAND_COLORS.orange).toBe('#ff6a1a');
  });

  it('provides a standalone favicon variant without external requests', () => {
    expect(FURYPIPE_FAVICON_SVG).toContain('<svg');
    expect(FURYPIPE_FAVICON_SVG).toContain(FURYPIPE_BRAND_COLORS.charcoal);
    expect(FURYPIPE_FAVICON_SVG).toContain(FURYPIPE_BRAND_COLORS.orange);
    expect(FURYPIPE_FAVICON_SVG).not.toContain('currentColor');
  });

  it('integrates the same mark into Studio shell and favicon', () => {
    const page = renderStudioHtml().html;

    expect(page).toContain('data-brand="furypipe"');
    expect(page).toContain('class="mark brand-mark"');
    expect(page).toContain('class="top-brand-mark brand-mark"');
    expect(page).toContain('class="hero-brand-mark brand-mark"');
    expect(page).toContain('rel="icon" type="image/svg+xml"');
    expect(page).toContain('application-name" content="FuryPipe Studio"');
    expect(page).not.toContain('fury-ring');
    expect(page).not.toContain('class="orbit');
  });
});
