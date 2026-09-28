import { describe, expect, it } from 'vitest';

import {
  STUDIO_NAVIGATION_SECTIONS,
  STUDIO_PRIMARY_NAVIGATION,
} from '../src/studio/studio-navigation.js';
import { renderStudioHtml } from '../src/studio/studio-page.js';

describe('FuryPipe Local information architecture', () => {
  it('keeps daily navigation small while preserving discoverable capability routes', () => {
    const items = [
      ...STUDIO_PRIMARY_NAVIGATION,
      ...STUDIO_NAVIGATION_SECTIONS.flatMap((section) => section.items),
    ];
    const views = items.map((item) => item.view);

    expect(new Set(views).size).toBe(views.length);
    expect(views).toContain('chat');
    expect(views).toContain('projects');
    expect(views).toContain('research');
    expect(views).toContain('observability');
    expect(views).toContain('connections');
    expect(STUDIO_PRIMARY_NAVIGATION.map((item) => item.view)).toEqual(['chat', 'projects']);
  });

  it('renders the local shell without user modes or permanent capability navigation', () => {
    const html = renderStudioHtml().html;

    expect(html).toContain('class="workspace-badge"');
    expect(html).toContain('data-view="projects"');
    expect(html).toContain('data-view="research"');
    expect(html).toContain('id="add-menu"');
    expect(html).toContain('id="context-workspace"');
    expect(html).not.toContain('id="nav-more"');
    expect(html).not.toContain('id="mode-button"');
    expect(html).not.toContain('id="mode-menu"');
    expect(html).not.toContain('id="effort-select"');
    expect(html).not.toContain('class="suggest"');
    expect(html).toContain('class="hero-trust"');
    expect(html).toContain('data-view="observability"');
  });
});
