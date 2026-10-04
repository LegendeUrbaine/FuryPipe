import { describe, expect, it } from 'vitest';

import {
  STUDIO_NAVIGATION_SECTIONS,
  STUDIO_PRIMARY_NAVIGATION,
} from '../src/studio/studio-navigation.js';
import { renderStudioHtml, studioHtmlResponse } from '../src/studio/studio-page.js';

describe('FuryPipe Local information architecture', () => {
  it('keeps every workspace view in one progressive disclosure map', () => {
    const items = [
      ...STUDIO_PRIMARY_NAVIGATION,
      ...STUDIO_NAVIGATION_SECTIONS.flatMap((section) => section.items),
    ];
    const views = items.map((item) => item.view);

    expect(new Set(views).size).toBe(views.length);
    expect(views).toContain('chat');
    expect(views).toContain('autopilot');
    expect(views).toContain('observability');
    expect(views).toContain('connections');
    expect(views).toContain('video');
  });

  it('renders the unified shell landmarks without changing runtime view ids', () => {
    const html = renderStudioHtml().html;

    expect(html).toContain('class="workspace-badge"');
    expect(html).toContain('id="nav-more"');
    expect(html).toContain('data-nav-section="explore"');
    expect(html).toContain('data-nav-section="operate"');
    expect(html).toContain('data-nav-section="connect"');
    expect(html).toContain('class="hero-trust"');
    expect(html).toContain('data-view="autopilot"');
    expect(html).toContain('data-view="observability"');
    expect(html).toContain('data-view="video"');
    expect(html).toContain('id="video-render"');
  });

  it('keeps video controls valid in Chromium and allows same-origin preview media', () => {
    const html = renderStudioHtml().html;
    const response = studioHtmlResponse();
    const contentSecurityPolicy = response.headers.get('content-security-policy');

    expect(html).toContain('pattern="[a-z][a-z0-9._\\-]{0,63}"');
    expect(contentSecurityPolicy).toContain("media-src 'self'");
  });

  it('exposes the Composer progressive-disclosure and confirmation anchors', () => {
    const html = renderStudioHtml().html;

    expect(html).toContain('aria-describedby="capability-composer-intro capability-composer-status"');
    expect(html).toContain('capability-composer-route-summary');
    expect(html).toContain('capability-composer-capability-details');
    expect(html).toContain('capability-composer-confirmation-explainer');
    expect(html).toContain('capability-composer-execution-raw');
    expect(html).toContain('capability-composer-receipts');
  });
});
