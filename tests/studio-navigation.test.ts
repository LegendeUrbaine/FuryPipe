import { describe, expect, it } from 'vitest';

import {
  STUDIO_NAVIGATION_SECTIONS,
  STUDIO_PRIMARY_NAVIGATION,
} from '../src/studio/studio-navigation.js';
import { renderStudioHtml } from '../src/studio/studio-page.js';

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
  });
});
