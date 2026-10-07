import { describe, expect, it } from 'vitest';
import { executeFuryHeadlessAsync, FURY_HEADLESS_REQUEST_FORMAT } from '../src/fury-headless.js';

describe('headless video boundary', () => {
  it('requires the same explicit approval as Studio', async () => {
    await expect(executeFuryHeadlessAsync({
      format: FURY_HEADLESS_REQUEST_FORMAT,
      operation: 'video-render',
      input: { project: { projectId: 'headless-demo', title: 'Demo', sourcePaths: ['demo.mp4'] }, confirm: false },
    })).rejects.toMatchObject({ code: 'VIDEO_APPROVAL_REQUIRED' });
  });
});
