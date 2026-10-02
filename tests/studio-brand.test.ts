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
  it('keeps the owner-approved Flux identity centralized and flat at UI size', () => {
    const mark = renderFuryPipeMonogramSvg({ className: 'mark brand-mark', tone: 'accent' });
    const wordmark = renderFuryPipeWordmarkHtml();

    expect(FURYPIPE_BRAND_SOURCE.creator).toBe('LégendeUrbaine');
    expect(FURYPIPE_BRAND_SOURCE.reference).toBe('codex-clipboard-b0965a62-5a35-4629-9f9d-63b8669ba9c3.png');
    expect(FURYPIPE_BRAND_SOURCE.concept).toBe('FLUX');
    expect(FURYPIPE_BRAND_SOURCE.sourceStatus).toBe('OWNER_APPROVED_REFERENCE_DERIVED');
    expect(mark).toContain('data-brand="furypipe-flux-symbol"');
    expect(mark).toContain('fill="currentColor"');
    expect(mark).toContain('viewBox="0 0 512 420"');
    expect(mark).not.toContain('fury-ring');
    expect(mark).not.toContain('M12 79');
    expect(wordmark).toContain('Fury');
    expect(wordmark).toContain('Pipe');
    expect(FURYPIPE_BRAND_COLORS.fluxOrange).toBe('#FF7A1A');
  });

  it('provides a standalone favicon variant without external requests', () => {
    expect(FURYPIPE_FAVICON_SVG).toContain('<svg');
    expect(FURYPIPE_FAVICON_SVG).toContain(FURYPIPE_BRAND_COLORS.charcoal);
    expect(FURYPIPE_FAVICON_SVG).toContain(FURYPIPE_BRAND_COLORS.fluxOrange);
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
