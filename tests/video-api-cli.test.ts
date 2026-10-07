import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { beforeAll, describe, expect, it, afterAll } from 'vitest';
import { createStudioApi, studioApiRoute } from '../src/studio/studio-api.js';
import { LocalVideoEngine } from '../src/video-local-engine.js';

const rootPromise = mkdtemp(`${tmpdir()}/furypipe-video-api-`);
const execFileAsync = promisify(execFile);

describe('video Studio API contracts', () => {
  beforeAll(async () => {
    const root = await rootPromise;
    await execFileAsync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=orange:s=320x180:r=24:d=1.2',
      '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', '1.2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', `${root}/rush.mp4`,
    ]);
  });

  afterAll(async () => {
    await rm(await rootPromise, { recursive: true, force: true });
  });

  it('discovers bounded video routes and exposes doctor/provider state', async () => {
    const root = await rootPromise;
    const engine = new LocalVideoEngine({ workspaceRoot: `${root}/workspace`, assetRoot: root, ffmpegPath: 'ffmpeg', ffprobePath: 'ffprobe' });
    const api = createStudioApi({ projectRoot: process.cwd(), videoEngine: engine });
    const route = studioApiRoute('/api/studio/video/doctor.json');
    expect(route).toEqual({ route: 'video-doctor', method: 'GET' });
    const doctor = await api.handle(route!.route, new Request('http://127.0.0.1/api/studio/video/doctor.json'));
    expect(doctor.status).toBe(200);
    await expect(doctor.json()).resolves.toMatchObject({ status: 'READY', ffmpeg: { status: 'PASS' }, ffprobe: { status: 'PASS' } });

    const providerRoute = studioApiRoute('/api/studio/video/providers.json');
    const providers = await api.handle(providerRoute!.route, new Request('http://127.0.0.1/api/studio/video/providers.json'));
    expect(providers.status).toBe(200);
    await expect(providers.json()).resolves.toMatchObject({ providers: expect.arrayContaining([expect.objectContaining({ id: 'native-ffmpeg' })]) });
  });

  it('keeps project creation behind explicit confirmation', async () => {
    const root = await rootPromise;
    const engine = new LocalVideoEngine({ workspaceRoot: `${root}/workspace-confirm`, assetRoot: root });
    const api = createStudioApi({ projectRoot: process.cwd(), videoEngine: engine });
    const route = studioApiRoute('/api/studio/video/project');
    const no = await api.handle(route!.route, new Request('http://127.0.0.1/api/studio/video/project', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: false, project: { projectId: 'api-project', title: 'API project', sourcePaths: [] } }) }));
    expect(no.status).toBe(400);
    const yes = await api.handle(route!.route, new Request('http://127.0.0.1/api/studio/video/project', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: true, project: { projectId: 'api-project', title: 'API project', sourcePaths: [] } }) }));
    expect(yes.status).toBe(201);
    await expect(yes.json()).resolves.toMatchObject({ project: { projectId: 'api-project' } });
  });

  it('runs an approved project through ingest, render, QC, artifacts, and file delivery', async () => {
    const root = await rootPromise;
    const engine = new LocalVideoEngine({ workspaceRoot: `${root}/workspace-api-flow`, assetRoot: root });
    const api = createStudioApi({ projectRoot: process.cwd(), videoEngine: engine });
    const projectRoute = studioApiRoute('/api/studio/video/project')!;
    const projectResponse = await api.handle(projectRoute.route, new Request('http://127.0.0.1/api/studio/video/project', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ confirm: true, project: { projectId: 'api-flow', title: 'API flow', sourcePaths: ['rush.mp4'], targetDurationSeconds: 2, width: 1080, height: 1920, fps: 30, brand: 'furycraft', platform: 'tiktok' } }),
    }));
    expect(projectResponse.status).toBe(201);

    for (const [url, body] of [
      ['/api/studio/video/ingest', { projectId: 'api-flow' }],
      ['/api/studio/video/analyze', { projectId: 'api-flow' }],
    ] as const) {
      const route = studioApiRoute(url)!;
      const response = await api.handle(route.route, new Request(`http://127.0.0.1${url}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
      expect(response.status).toBe(200);
    }

    const renderRoute = studioApiRoute('/api/studio/video/render')!;
    const render = await api.handle(renderRoute.route, new Request('http://127.0.0.1/api/studio/video/render', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: 'api-flow', confirm: true, force: true, captionScript: 'Mine plus vite. Rejoins FuryCraft sur play.furycraft.fr.' }) }));
    expect(render.status).toBe(201);
    await expect(render.json()).resolves.toMatchObject({
      status: 'PASS',
      qc: { status: 'PASS' },
      policy: { status: 'PASS' },
      timeline: { format: 'furypipe-video-timeline/v1', tracks: expect.arrayContaining([expect.objectContaining({ id: 'video' }), expect.objectContaining({ id: 'captions' })]) },
      providerRegistry: expect.arrayContaining([expect.objectContaining({ id: 'native-ffmpeg' })]),
    });

    const artifactsRoute = studioApiRoute('/api/studio/video/artifacts.json')!;
    const artifacts = await api.handle(artifactsRoute.route, new Request('http://127.0.0.1/api/studio/video/artifacts.json?projectId=api-flow'));
    expect(artifacts.status).toBe(200);
    await expect(artifacts.json()).resolves.toMatchObject({ artifacts: expect.arrayContaining([
      expect.objectContaining({ type: 'timeline' }),
      expect.objectContaining({ type: 'video' }),
      expect.objectContaining({ type: 'qc-report' }),
    ]) });

    const fileRoute = studioApiRoute('/api/studio/video/file')!;
    const file = await api.handle(fileRoute.route, new Request('http://127.0.0.1/api/studio/video/file?projectId=api-flow'));
    expect(file.status).toBe(200);
    expect(file.headers.get('content-type')).toBe('video/mp4');
    expect((await file.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });
});
