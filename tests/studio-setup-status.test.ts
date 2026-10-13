import { describe, expect, it } from 'vitest';

import { renderStudioHtml } from '../src/studio/studio-page.js';

describe('Studio setup status', () => {
  it('collapses the empty setup status line without removing the live region', () => {
    const page = renderStudioHtml().html;
    const base = page.indexOf('.setup #setup-status{margin:10px 0 0}');
    const collapse = page.indexOf('#setup-status:empty{min-height:0;margin:0}');

    expect(base).toBeGreaterThan(-1);
    // Same specificity as the base rule, so it must come later to apply.
    expect(collapse).toBeGreaterThan(base);
    expect(page).not.toMatch(/#setup-status:empty\{[^}]*display:\s*none/);
    expect(page).toContain('<p id="setup-status" class="status muted" role="status"></p>');
  });
});
