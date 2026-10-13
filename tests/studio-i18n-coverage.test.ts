import { describe, expect, it } from 'vitest';

import { renderStudioHtml } from '../src/studio/studio-page.js';

// Studio translates by exact text match, so a reworded English label silently
// falls back to English in a French browser. These labels are visible on the
// default screens and must keep a French entry.
const VISIBLE_STATIC_LABELS = [
  'Ask, build and inspect in one governed workspace for models, agents and tools.',
  'How this workspace runs',
  'Choose a local model',
  'Configure local model',
  'Provider diagnostics',
  'No local model running yet.',
  'No run yet. Start one above; only local runtimes are used unless you allow cloud runtimes.',
  'Add MCP',
  'Create skill',
  'Import skill',
  'Custom instructions',
  'Save instructions',
  'Preview plan',
  'Project graph',
  'Show diff',
  'Thick border: critical step',
  'not installed',
  'Skip to content',
  'One governed path',
  'Plan a governed task',
  'Commit verified artifact',
  'Add conversation context',
];

function splitPage(): { readonly keys: Set<string>; readonly pageWithoutDictionary: string } {
  const html = renderStudioHtml().html;
  const start = html.indexOf('const FR = Object.freeze({');
  const end = html.indexOf('\n  });', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const block = html.slice(start, end);
  const keys = [...block.matchAll(/^\s*'((?:[^'\\]|\\.)*)':/gmu)].map((match) => match[1]!.replace(/\\(.)/gu, '$1'));
  return { keys: new Set(keys), pageWithoutDictionary: html.slice(0, start) + html.slice(end) };
}

describe('Studio French coverage', () => {
  it('keeps a French entry for each visible static label', () => {
    const { keys, pageWithoutDictionary } = splitPage();
    // A label reworded in the page must fail here instead of silently
    // falling back to English behind a stale dictionary key.
    expect(VISIBLE_STATIC_LABELS.filter((label) => !pageWithoutDictionary.includes(label))).toEqual([]);
    expect(VISIBLE_STATIC_LABELS.filter((label) => !keys.has(label))).toEqual([]);
  });

  it('keeps the shared Workspace key in sentence case', () => {
    // Section headings are upper-cased by CSS; the nav item and view title use
    // the same key and must not render in capitals. Run-time counters are
    // checked in a real French session by scripts/studio-browser-qa.ts.
    expect(renderStudioHtml().html).toContain("'Workspace': 'Espace de travail',");
  });
});
