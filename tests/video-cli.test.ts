import { describe, expect, it } from 'vitest';
import { furyVideoCliHelp, parseFuryVideoCliArgs } from '../src/video-cli.js';

describe('video CLI', () => {
  it('parses bounded project and render options', () => {
    expect(parseFuryVideoCliArgs(['render', '--project', 'demo', '--confirm', '--caption-style=clean', '--force'])).toMatchObject({
      command: 'render', projectId: 'demo', confirm: true, captionStyle: 'clean', force: true,
    });
  });

  it('rejects unknown options and documents real commands', () => {
    expect(() => parseFuryVideoCliArgs(['render', '--wat'])).toThrow(/unknown video option/i);
    expect(furyVideoCliHelp()).toContain('furypipe video render');
    expect(furyVideoCliHelp()).toContain('confirm');
  });
});
