import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LocalVideoEngine } from '../src/video-local-engine.js';
import { runVideoWorkflow } from '../src/video-workflow.js';

const execFileAsync = promisify(execFile);
let root = '';
let engine: LocalVideoEngine;

describe('video workflow', () => {
  beforeAll(async () => {
    root = await mkdtemp(`${tmpdir()}/furypipe-video-workflow-`);
    await execFileAsync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=24:duration=1.2',
      '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', '1.2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', `${root}/rush.mp4`,
    ]);
    engine = new LocalVideoEngine({ workspaceRoot: `${root}/workspace`, assetRoot: root });
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('requires explicit approval before execution', async () => {
    await expect(runVideoWorkflow(engine, {
      project: { projectId: 'approval-check', title: 'Approval check', sourcePaths: ['rush.mp4'] },
      confirm: false,
    })).rejects.toMatchObject({ code: 'VIDEO_APPROVAL_REQUIRED' });
  });

  it('runs an approved FuryCraft workflow through render and QC', async () => {
    const result = await runVideoWorkflow(engine, {
      project: {
        projectId: 'workflow-smoke',
        title: 'FuryCraft vertical smoke',
        sourcePaths: ['rush.mp4'],
        targetDurationSeconds: 2,
        width: 1080,
        height: 1920,
        fps: 30,
        brand: 'furycraft',
        platform: 'tiktok',
      },
      confirm: true,
      captionScript: 'Mine plus vite. Grimpe les prestiges. Rejoins FuryCraft sur play.furycraft.fr.',
      captionStyle: 'premium-gaming',
    });
    expect(result.status).toBe('PASS');
    expect(result.project.state).toBe('rendered');
    expect(result.policy.status).toBe('PASS');
    expect(result.hookVariants).toHaveLength(3);
    expect(result.timeline.format).toBe('furypipe-video-timeline/v1');
    expect(result.timeline.durationMs).toBe(result.render.durationMs);
    expect(result.timeline.tracks.map((track) => track.id)).toEqual(['video', 'captions']);
    expect(result.timeline.tracks[0]?.items).toHaveLength(1);
    expect(result.timeline.tracks[0]?.items[0]).toMatchObject({ sourcePath: 'rush.mp4', startMs: 0, endMs: result.render.durationMs });
    expect(result.timeline.optionalAudio).toEqual({ voice: 'not-configured', music: 'not-configured', sfx: [] });
    expect(result.skills.selected).toEqual(['video-director', 'vertical-short-form', 'gaming-promo']);
    expect(result.qc.status).toBe('PASS');
    expect(result.artifacts.some((artifact) => artifact.type === 'video')).toBe(true);
    expect(result.artifacts.map((artifact) => artifact.type)).toEqual(expect.arrayContaining([
      'storyboard', 'timeline', 'hook-variants', 'policy-report', 'recipe', 'provenance',
    ]));
    expect(result.recipe.brand).toBe('furycraft');

    const reopened = await runVideoWorkflow(engine, {
      project: result.project,
      confirm: true,
      force: true,
      captionScript: 'Mine plus vite. Grimpe les prestiges. Rejoins FuryCraft sur play.furycraft.fr.',
      captionStyle: 'premium-gaming',
    });
    expect(reopened.status).toBe('PASS');
    expect(reopened.project.projectId).toBe(result.project.projectId);
    expect(reopened.manifest).toEqual(result.manifest);

    const multi = await runVideoWorkflow(engine, {
      project: {
        projectId: 'workflow-multi',
        title: 'FuryCraft multi-source smoke',
        sourcePaths: ['rush.mp4', 'rush.mp4'],
        targetDurationSeconds: 5,
        width: 1080,
        height: 1920,
        fps: 30,
        brand: 'furycraft',
        platform: 'tiktok',
      },
      confirm: true,
      captionScript: 'Deux rushs. Une timeline. Rejoins FuryCraft sur play.furycraft.fr.',
    });
    expect(multi.qc.status).toBe('PASS');
    expect(multi.timeline.durationMs).toBe(multi.render.durationMs);
    expect(multi.timeline.durationMs).toBeGreaterThan(result.render.durationMs);
    expect(multi.timeline.tracks[0]?.items.map((item) => item.sourcePath)).toEqual(['rush.mp4', 'rush.mp4']);
    expect(multi.timeline.tracks[0]?.items.at(-1)?.endMs).toBe(multi.render.durationMs);
  });
});
