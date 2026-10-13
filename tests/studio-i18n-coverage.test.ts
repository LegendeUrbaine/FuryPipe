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
];

function frenchKeys(): string[] {
  const html = renderStudioHtml().html;
  const start = html.indexOf('const FR = Object.freeze({');
  const end = html.indexOf('\n  });', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const block = html.slice(start, end);
  return [...block.matchAll(/^\s*'((?:[^'\\]|\\.)*)':/gmu)].map((match) => match[1]!.replace(/\\(.)/gu, '$1'));
}

describe('Studio French coverage', () => {
  it('keeps a French entry for each visible static label', () => {
    const keys = new Set(frenchKeys());
    expect(VISIBLE_STATIC_LABELS.filter((label) => !keys.has(label))).toEqual([]);
  });
});
