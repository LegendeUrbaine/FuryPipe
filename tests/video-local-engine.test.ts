import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LocalVideoEngine } from '../src/video-local-engine.js';

const execFileAsync = promisify(execFile);
let root = '';
let engine: LocalVideoEngine;

describe('local video engine', () => {
  beforeAll(async () => {
    root = await mkdtemp(`${tmpdir()}/furypipe-video-engine-`);
    await execFileAsync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'color=c=orange:s=320x180:r=24:d=1.2',
      '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
      '-t', '1.2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
      `${root}/fixture.mp4`,
    ]);
    await execFileAsync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'color=c=blue:s=320x180:r=24:d=1.2',
      '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
      '-t', '1.2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
      `${root}/fixture-two.mp4`,
    ]);
    engine = new LocalVideoEngine({ workspaceRoot: `${root}/workspace`, assetRoot: root });
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('reports real ffmpeg capability', async () => {
    const report = await engine.doctor();
    expect(report.ffmpeg.status).toBe('PASS');
    expect(report.ffprobe.status).toBe('PASS');
    expect(report.status).toBe('READY');
  });

  it('ingests immutable source metadata and produces explicit analysis', async () => {
    await engine.createProject({
      projectId: 'engine-smoke',
      title: 'Engine smoke',
      sourcePaths: ['fixture.mp4'],
      targetDurationSeconds: 2,
      width: 1080,
      height: 1920,
      fps: 30,
      brand: 'generic',
      platform: 'tiktok',
    });
    const manifest = await engine.ingest('engine-smoke');
    expect(manifest.sources).toHaveLength(1);
    expect(manifest.sources[0]?.sha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(manifest.sources[0]?.codec).toBe('h264');

    const analysis = await engine.analyze('engine-smoke');
    expect(analysis.sources).toHaveLength(1);
    expect(analysis.sources[0]?.scenes[0]?.visualInterest).toBeNull();
    expect(analysis.sources[0]?.scenes[0]?.description).toMatch(/semantic|technical/i);
  });

  it('renders a real portrait mp4, persists captions, and passes qc', async () => {
    const rendered = await engine.render('engine-smoke', {
      captionScript: 'Mine plus vite. Rejoins FuryCraft.',
      captionStyle: 'premium-gaming',
      force: true,
    });
    expect(rendered.status).toBe('RENDERED');
    expect(rendered.outputPath.endsWith('.mp4')).toBe(true);
    expect(rendered.captionPath?.endsWith('.srt')).toBe(true);

    const qc = await engine.qc('engine-smoke');
    expect(qc.status).toBe('PASS');
    expect(qc.width).toBe(1080);
    expect(qc.height).toBe(1920);
    expect(qc.hasAudio).toBe(true);

    const artifacts = await engine.listArtifacts('engine-smoke');
    expect(artifacts.some((artifact) => artifact.type === 'video')).toBe(true);
    expect(artifacts.some((artifact) => artifact.type === 'qc-report')).toBe(true);
  });

  it('concatenates multiple immutable sources before final render', async () => {
    await engine.createProject({
      projectId: 'multi-source-smoke',
      title: 'Multi source smoke',
      sourcePaths: ['fixture.mp4', 'fixture-two.mp4'],
      targetDurationSeconds: 5,
      width: 1080,
      height: 1920,
      fps: 30,
      brand: 'generic',
      platform: 'tiktok',
    });
    const manifest = await engine.ingest('multi-source-smoke');
    expect(manifest.sources).toHaveLength(2);
    const rendered = await engine.render('multi-source-smoke', { force: true, captionScript: 'Two clips, one timeline.' });
    expect(rendered.status).toBe('RENDERED');
    const qc = await engine.qc('multi-source-smoke');
    expect(qc.status).toBe('PASS');
    expect(qc.durationMs).toBeGreaterThan(2_000);
  });

  it('rejects persisted source paths that escape the project workspace', async () => {
    await engine.createProject({
      projectId: 'manifest-integrity-smoke',
      title: 'Manifest integrity smoke',
      sourcePaths: ['fixture.mp4'],
      targetDurationSeconds: 2,
      width: 1080,
      height: 1920,
      fps: 30,
      brand: 'generic',
      platform: 'tiktok',
    });
    await engine.ingest('manifest-integrity-smoke');
    const manifestPath = `${root}/workspace/manifest-integrity-smoke/source-manifest.json`;
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { sources: Array<Record<string, unknown>> };
    manifest.sources[0]!.workspacePath = '../../outside.mp4';
    await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);

    await expect(engine.render('manifest-integrity-smoke', { force: true })).rejects.toMatchObject({ code: 'VIDEO_PATH_DENIED' });
  });

  it('rejects a symlinked input destination before copying source bytes', async () => {
    await engine.createProject({
      projectId: 'symlink-destination-smoke',
      title: 'Symlink destination smoke',
      sourcePaths: ['fixture.mp4'],
      targetDurationSeconds: 2,
      width: 1080,
      height: 1920,
      fps: 30,
      brand: 'generic',
      platform: 'tiktok',
    });
    const outside = `${root}/outside-destination.mp4`;
    await copyFile(`${root}/fixture-two.mp4`, outside);
    await symlink(outside, `${root}/workspace/symlink-destination-smoke/inputs/001.mp4`);

    await expect(engine.ingest('symlink-destination-smoke')).rejects.toMatchObject({ code: 'VIDEO_PATH_DENIED' });
    expect(await readFile(outside)).toEqual(await readFile(`${root}/fixture-two.mp4`));
  });

  it('rejects a symlinked inputs directory before creating a destination', async () => {
    await engine.createProject({
      projectId: 'symlink-inputs-smoke',
      title: 'Symlink inputs smoke',
      sourcePaths: ['fixture.mp4'],
      targetDurationSeconds: 2,
      width: 1080,
      height: 1920,
      fps: 30,
      brand: 'generic',
      platform: 'tiktok',
    });
    const outside = `${root}/outside-inputs`;
    await mkdir(outside, { recursive: true });
    await rm(`${root}/workspace/symlink-inputs-smoke/inputs`, { recursive: true, force: true });
    await symlink(outside, `${root}/workspace/symlink-inputs-smoke/inputs`, 'dir');

    await expect(engine.ingest('symlink-inputs-smoke')).rejects.toMatchObject({ code: 'VIDEO_PATH_DENIED' });
    expect(await readFile(`${root}/fixture.mp4`)).toBeInstanceOf(Buffer);
    expect(await readFile(`${outside}/001.mp4`).catch(() => null)).toBeNull();
  });

  it('rejects source bytes that no longer match the ingested manifest', async () => {
    await engine.createProject({
      projectId: 'manifest-hash-smoke',
      title: 'Manifest hash smoke',
      sourcePaths: ['fixture.mp4'],
      targetDurationSeconds: 2,
      width: 1080,
      height: 1920,
      fps: 30,
      brand: 'generic',
      platform: 'tiktok',
    });
    await engine.ingest('manifest-hash-smoke');
    await writeFile(`${root}/workspace/manifest-hash-smoke/inputs/001.mp4`, 'tampered source');

    await expect(engine.render('manifest-hash-smoke', { force: true })).rejects.toMatchObject({ code: 'VIDEO_INPUT_INVALID' });
  });

  it('does not replace an existing immutable manifest on re-ingest', async () => {
    await engine.createProject({
      projectId: 'reingest-immutable-smoke',
      title: 'Re-ingest immutable smoke',
      sourcePaths: ['fixture.mp4'],
      targetDurationSeconds: 2,
      width: 1080,
      height: 1920,
      fps: 30,
      brand: 'generic',
      platform: 'tiktok',
    });
    const first = await engine.ingest('reingest-immutable-smoke');
    const persistedInput = `${root}/workspace/reingest-immutable-smoke/inputs/001.mp4`;
    const firstBytes = await readFile(persistedInput);
    const originalAsset = await readFile(`${root}/fixture.mp4`);
    try {
      await copyFile(`${root}/fixture-two.mp4`, `${root}/fixture.mp4`);
      const second = await engine.ingest('reingest-immutable-smoke');
      expect(second).toEqual(first);
      expect(await readFile(persistedInput)).toEqual(firstBytes);
    } finally {
      await writeFile(`${root}/fixture.mp4`, originalAsset);
    }
  });

  it('fails QC when output duration and frame rate violate the render contract', async () => {
    await engine.createProject({
      projectId: 'qc-contract-smoke',
      title: 'QC contract smoke',
      sourcePaths: ['fixture.mp4'],
      targetDurationSeconds: 10,
      width: 1080,
      height: 1920,
      fps: 60,
      brand: 'generic',
      platform: 'tiktok',
    });
    await engine.ingest('qc-contract-smoke');
    const renders = `${root}/workspace/qc-contract-smoke/renders`;
    await mkdir(renders, { recursive: true });
    await execFileAsync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'color=c=red:s=1080x1920:r=1:d=0.1',
      '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', '0.1',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', `${renders}/final.mp4`,
    ]);

    const qc = await engine.qc('qc-contract-smoke');
    expect(qc.status).toBe('FAIL');
    expect(qc.issues.some((issue) => /duration|fps/iu.test(issue))).toBe(true);
  });

  it('does not start child processing for an already-cancelled multi-source render', async () => {
    await engine.createProject({
      projectId: 'cancelled-render-smoke',
      title: 'Cancelled render smoke',
      sourcePaths: ['fixture.mp4', 'fixture-two.mp4'],
      targetDurationSeconds: 3,
      width: 1080,
      height: 1920,
      fps: 30,
      brand: 'generic',
      platform: 'tiktok',
    });
    await engine.ingest('cancelled-render-smoke');
    const controller = new AbortController();
    controller.abort();

    await expect(engine.render('cancelled-render-smoke', { force: true, signal: controller.signal })).rejects.toMatchObject({ code: 'VIDEO_JOB_CANCELLED' });
    expect(existsSync(`${root}/workspace/cancelled-render-smoke/renders/segments`)).toBe(false);
  });
});
