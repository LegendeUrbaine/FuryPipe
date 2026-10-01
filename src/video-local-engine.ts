import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { basename, dirname, extname, isAbsolute, relative, resolve, win32 as windowsPath } from 'node:path';
import {
  createVideoCaptionCues,
  digestVideoValue,
  renderVideoCaptionsSrt,
  type VideoCaptionCue,
  type VideoCaptionStyle,
  type VideoHookVariant,
  type VideoPolicyReport,
  type VideoRecipe,
  type VideoProjectInput,
  type VideoSceneObservation,
  type VideoStoryboard,
  type VideoTimeline,
  validateVideoProjectInput,
} from './video-studio.js';

export type VideoEngineErrorCode =
  | 'VIDEO_TOOL_UNAVAILABLE'
  | 'VIDEO_TOOL_FAILED'
  | 'VIDEO_PATH_DENIED'
  | 'VIDEO_INPUT_INVALID'
  | 'VIDEO_PROJECT_NOT_FOUND'
  | 'VIDEO_PROJECT_EXISTS'
  | 'VIDEO_RENDER_FAILED'
  | 'VIDEO_QC_FAILED'
  | 'VIDEO_JOB_CANCELLED'
  | 'VIDEO_OUTPUT_TOO_LARGE';

export class VideoEngineError extends Error {
  readonly code: VideoEngineErrorCode;
  readonly details?: Readonly<Record<string, string>>;

  constructor(code: VideoEngineErrorCode, message: string, details?: Readonly<Record<string, string>>) {
    super(message);
    this.name = 'VideoEngineError';
    this.code = code;
    this.details = details;
  }
}

export type VideoToolStatus = 'PASS' | 'FAIL';
export type VideoDoctorStatus = 'READY' | 'DEGRADED' | 'BLOCKED';

export interface VideoToolHealth {
  readonly status: VideoToolStatus;
  readonly command: string;
  readonly version: string | null;
  readonly errorCode?: VideoEngineErrorCode;
}

export interface VideoDoctorReport {
  readonly status: VideoDoctorStatus;
  readonly workspaceRoot: string;
  readonly assetRoot: string;
  readonly ffmpeg: VideoToolHealth;
  readonly ffprobe: VideoToolHealth;
  readonly checkedAt: string;
}

export interface VideoLocalEngineOptions {
  readonly workspaceRoot: string;
  readonly assetRoot?: string;
  readonly ffmpegPath?: string;
  readonly ffprobePath?: string;
  readonly maxInputBytes?: number;
  readonly commandTimeoutMs?: number;
}

export interface LocalVideoProject extends VideoProjectInput {
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly state: 'created' | 'ingested' | 'analyzed' | 'rendered';
}

export interface VideoSourceManifestEntry {
  readonly index: number;
  readonly originalPath: string;
  readonly workspacePath: string;
  readonly filename: string;
  readonly sha256: string;
  readonly sizeBytes: number;
  readonly durationMs: number;
  readonly codec: string | null;
  readonly container: string | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly fps: number | null;
  readonly audioStreams: number;
  readonly rotation: number | null;
}

export interface VideoSourceManifest {
  readonly format: 'furypipe-video-source-manifest/v1';
  readonly projectId: string;
  readonly createdAt: string;
  readonly sources: readonly VideoSourceManifestEntry[];
}

export interface VideoSourceAnalysis {
  readonly source: VideoSourceManifestEntry;
  readonly scenes: readonly VideoSceneObservation[];
  readonly method: 'ffprobe-duration';
  readonly semanticInspection: 'not-installed';
}

export interface VideoAnalysis {
  readonly format: 'furypipe-video-analysis/v1';
  readonly projectId: string;
  readonly createdAt: string;
  readonly sources: readonly VideoSourceAnalysis[];
}

export interface VideoRenderOptions {
  readonly captionScript?: string;
  readonly captionStyle?: VideoCaptionStyle;
  readonly force?: boolean;
  readonly signal?: AbortSignal;
}

export interface VideoRenderResult {
  readonly status: 'RENDERED' | 'CACHED';
  readonly projectId: string;
  readonly outputPath: string;
  readonly outputSha256: string;
  readonly durationMs: number;
  readonly captionPath?: string;
  readonly receiptPath: string;
  readonly command: readonly string[];
}

export interface VideoQCReport {
  readonly format: 'furypipe-video-qc/v1';
  readonly projectId: string;
  readonly status: 'PASS' | 'FAIL';
  readonly checkedAt: string;
  readonly path: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly fps: number | null;
  readonly durationMs: number;
  readonly hasAudio: boolean;
  readonly decodeExitCode: number;
  readonly issues: readonly string[];
}

export type VideoArtifactType = 'project' | 'source-manifest' | 'analysis' | 'storyboard' | 'timeline' | 'hook-variants' | 'policy-report' | 'recipe' | 'provenance' | 'captions' | 'video' | 'render-receipt' | 'qc-report';

export interface VideoArtifactReference {
  readonly type: VideoArtifactType;
  readonly projectId: string;
  readonly path: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

export interface VideoWorkflowProvenance {
  readonly format: 'furypipe-video-provenance/v1';
  readonly projectId: string;
  readonly createdAt: string;
  readonly sourceHashes: readonly string[];
  readonly provider: string;
  readonly providerVersion: string;
  readonly model: string;
  readonly modelVersion: string;
  readonly skillVersions: Readonly<Record<string, string>>;
  readonly renderSettings: Readonly<Record<string, string | number | boolean | null>>;
  readonly toolVersions: Readonly<{ ffmpeg: string | null; ffprobe: string | null }>;
  readonly command: readonly string[];
  readonly qcStatus: VideoQCReport['status'];
}

export interface VideoWorkflowArtifacts {
  readonly storyboard: VideoStoryboard;
  readonly timeline: VideoTimeline;
  readonly hookVariants: readonly VideoHookVariant[];
  readonly policy: VideoPolicyReport;
  readonly recipe: VideoRecipe;
  readonly provenance: VideoWorkflowProvenance;
}

interface CommandResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

interface ProbeStream {
  readonly codec_type?: unknown;
  readonly codec_name?: unknown;
  readonly width?: unknown;
  readonly height?: unknown;
  readonly r_frame_rate?: unknown;
  readonly tags?: unknown;
  readonly side_data_list?: unknown;
}

interface ProbePayload {
  readonly streams?: unknown;
  readonly format?: unknown;
}

interface ProbeResult {
  readonly durationMs: number;
  readonly codec: string | null;
  readonly container: string | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly fps: number | null;
  readonly audioStreams: number;
  readonly rotation: number | null;
}

const DEFAULT_MAX_INPUT_BYTES = 512 * 1024 * 1024;
const MAX_COMMAND_OUTPUT = 2 * 1024 * 1024;
const DEFAULT_COMMAND_TIMEOUT_MS = 180_000;
const ALLOWED_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.mkv', '.png', '.jpg', '.jpeg', '.wav', '.mp3', '.flac']);

function now(): string {
  return new Date().toISOString();
}

function plainRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseFps(value: unknown): number | null {
  const raw = stringValue(value);
  if (!raw) return null;
  const parts = raw.split('/');
  const numerator = Number(parts[0]);
  const denominator = Number(parts[1]);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function relativeSafe(root: string, path: string): string {
  const rel = relative(root, path);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) throw new VideoEngineError('VIDEO_PATH_DENIED', 'path escapes the configured video workspace');
  return rel.replaceAll('\\', '/');
}

function containedPath(root: string, path: string): void {
  const rel = relative(root, path);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new VideoEngineError('VIDEO_PATH_DENIED', 'path escapes the configured video workspace');
}

async function secureWorkspacePath(root: string, relativePath: string, kind: 'file' | 'directory' | 'any' = 'any', requireExisting = false): Promise<string> {
  const candidate = resolve(root, relativePath);
  relativeSafe(root, candidate);
  const rootReal = await realpath(root);
  const parentReal = await realpath(dirname(candidate));
  containedPath(rootReal, parentReal);
  const metadata = await lstat(candidate).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  });
  if (!metadata) {
    if (requireExisting) throw new VideoEngineError('VIDEO_INPUT_INVALID', `video workspace path does not exist: ${relativePath}`);
    return candidate;
  }
  if (metadata.isSymbolicLink()) throw new VideoEngineError('VIDEO_PATH_DENIED', 'video workspace symlinks are not allowed');
  if (kind === 'file' && !metadata.isFile()) throw new VideoEngineError('VIDEO_PATH_DENIED', 'video output is not a regular file');
  if (kind === 'directory' && !metadata.isDirectory()) throw new VideoEngineError('VIDEO_PATH_DENIED', 'video output directory is not a directory');
  containedPath(rootReal, await realpath(candidate));
  return candidate;
}

function escapeSubtitlePath(path: string): string {
  return path.replaceAll('\\', '/').replaceAll(':', '\\:').replaceAll("'", "\\'");
}

function escapeConcatPath(path: string): string {
  return path.replaceAll('\\', '/').replaceAll("'", "'\\''");
}

function expectedRenderDurationMs(project: LocalVideoProject, manifest: VideoSourceManifest): number {
  const sourceDurationMs = manifest.sources.reduce((total, source) => total + Math.max(0, source.durationMs), 0);
  return Math.max(100, Math.min(Math.round(project.targetDurationSeconds * 1000), Math.max(100, sourceDurationMs)));
}

function expectedFpsTolerance(project: LocalVideoProject): number {
  return Math.max(0.5, Math.round(project.fps) * 0.02);
}

function validatePersistedManifest(value: unknown, projectId: string): VideoSourceManifest {
  const record = plainRecord(value);
  if (record.format !== 'furypipe-video-source-manifest/v1' || record.projectId !== projectId || !Array.isArray(record.sources) || record.sources.length === 0) {
    throw new VideoEngineError('VIDEO_INPUT_INVALID', 'video source manifest is invalid');
  }
  for (const [index, candidate] of record.sources.entries()) {
    const source = plainRecord(candidate);
    const workspacePath = source.workspacePath;
    if (source.index !== index || typeof workspacePath !== 'string' || workspacePath.length === 0) {
      throw new VideoEngineError('VIDEO_INPUT_INVALID', 'video source manifest contains an invalid source entry');
    }
    if (isAbsolute(workspacePath) || windowsPath.isAbsolute(workspacePath)) {
      throw new VideoEngineError('VIDEO_PATH_DENIED', 'video source manifest contains an absolute workspace path');
    }
    if (typeof source.sha256 !== 'string' || !/^[0-9a-f]{64}$/u.test(source.sha256)) {
      throw new VideoEngineError('VIDEO_INPUT_INVALID', 'video source manifest contains an invalid source hash');
    }
    if (typeof source.durationMs !== 'number' || !Number.isFinite(source.durationMs) || source.durationMs < 0 || typeof source.audioStreams !== 'number' || !Number.isInteger(source.audioStreams) || source.audioStreams < 0) {
      throw new VideoEngineError('VIDEO_INPUT_INVALID', 'video source manifest contains invalid media metadata');
    }
  }
  return value as VideoSourceManifest;
}

async function runCommand(command: string, args: readonly string[], options: { readonly cwd?: string; readonly timeoutMs: number; readonly signal?: AbortSignal }): Promise<CommandResult> {
  if (options.signal?.aborted) throw new VideoEngineError('VIDEO_JOB_CANCELLED', 'video job was cancelled before starting');
  return await new Promise<CommandResult>((resolveResult, rejectResult) => {
    const child = spawn(command, [...args], { cwd: options.cwd, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      rejectResult(new VideoEngineError('VIDEO_TOOL_FAILED', `${command} timed out`));
    }, options.timeoutMs);
    const onAbort = (): void => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      clearTimeout(timer);
      rejectResult(new VideoEngineError('VIDEO_JOB_CANCELLED', 'video job was cancelled'));
    };
    options.signal?.addEventListener('abort', onAbort, { once: true });
    child.stdout.on('data', (chunk: Buffer | string) => {
      if (stdout.length < MAX_COMMAND_OUTPUT) stdout += String(chunk).slice(0, MAX_COMMAND_OUTPUT - stdout.length);
    });
    child.stderr.on('data', (chunk: Buffer | string) => {
      if (stderr.length < MAX_COMMAND_OUTPUT) stderr += String(chunk).slice(0, MAX_COMMAND_OUTPUT - stderr.length);
    });
    child.once('error', (error: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      if (error.code === 'ENOENT') rejectResult(new VideoEngineError('VIDEO_TOOL_UNAVAILABLE', `${command} is not installed`));
      else rejectResult(new VideoEngineError('VIDEO_TOOL_FAILED', `${command} failed to start`));
    });
    child.once('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      resolveResult({ code: code ?? -1, stdout, stderr });
    });
  });
}

function toolHealth(command: string, result: CommandResult): VideoToolHealth {
  const output = `${result.stdout}\n${result.stderr}`.trim();
  return Object.freeze({ status: result.code === 0 ? 'PASS' : 'FAIL', command, version: output.split('\n')[0] ?? null, ...(result.code === 0 ? {} : { errorCode: 'VIDEO_TOOL_FAILED' as const }) });
}

async function jsonFile<T>(path: string): Promise<T> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch (error) {
    throw new VideoEngineError('VIDEO_INPUT_INVALID', `could not read project state: ${path}`, { reason: error instanceof Error ? error.message : 'unknown' });
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
}

export class LocalVideoEngine {
  readonly workspaceRoot: string;
  readonly assetRoot: string;
  readonly ffmpegPath: string;
  readonly ffprobePath: string;
  readonly maxInputBytes: number;
  readonly commandTimeoutMs: number;

  constructor(options: VideoLocalEngineOptions) {
    if (!options.workspaceRoot || isAbsolute(options.workspaceRoot) === false) throw new TypeError('workspaceRoot must be an absolute path');
    this.workspaceRoot = resolve(options.workspaceRoot);
    this.assetRoot = resolve(options.assetRoot ?? process.cwd());
    this.ffmpegPath = options.ffmpegPath ?? 'ffmpeg';
    this.ffprobePath = options.ffprobePath ?? 'ffprobe';
    this.maxInputBytes = options.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES;
    this.commandTimeoutMs = options.commandTimeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;
    if (!Number.isSafeInteger(this.maxInputBytes) || this.maxInputBytes < 1) throw new RangeError('maxInputBytes is invalid');
  }

  private projectRoot(projectId: string): string {
    const project = validateVideoProjectInput({ projectId, title: 'project', sourcePaths: [] });
    const path = resolve(this.workspaceRoot, project.projectId);
    relativeSafe(this.workspaceRoot, path);
    return path;
  }

  private async ensureWorkspace(): Promise<void> {
    await mkdir(this.workspaceRoot, { recursive: true, mode: 0o700 });
  }

  private async readProject(projectId: string): Promise<LocalVideoProject> {
    const root = this.projectRoot(projectId);
    try {
      const path = await secureWorkspacePath(root, 'project.json', 'file', true);
      return await jsonFile<LocalVideoProject>(path);
    } catch (error) {
      if (error instanceof VideoEngineError && error.details?.reason?.includes('ENOENT')) throw new VideoEngineError('VIDEO_PROJECT_NOT_FOUND', `video project not found: ${projectId}`);
      throw error;
    }
  }

  async doctor(): Promise<VideoDoctorReport> {
    await this.ensureWorkspace();
    const [ffmpegResult, ffprobeResult] = await Promise.all([
      runCommand(this.ffmpegPath, ['-version'], { timeoutMs: 10_000 }).catch((error: unknown) => error),
      runCommand(this.ffprobePath, ['-version'], { timeoutMs: 10_000 }).catch((error: unknown) => error),
    ]);
    const health = (command: string, result: CommandResult | unknown): VideoToolHealth => {
      if (result && typeof result === 'object' && 'code' in result) return toolHealth(command, result as CommandResult);
      const error = result instanceof VideoEngineError ? result : undefined;
      return Object.freeze({ status: 'FAIL', command, version: null, errorCode: error?.code ?? 'VIDEO_TOOL_UNAVAILABLE' });
    };
    const ffmpeg = health(this.ffmpegPath, ffmpegResult);
    const ffprobe = health(this.ffprobePath, ffprobeResult);
    const status: VideoDoctorStatus = ffmpeg.status === 'PASS' && ffprobe.status === 'PASS' ? 'READY' : 'BLOCKED';
    return Object.freeze({ status, workspaceRoot: this.workspaceRoot, assetRoot: this.assetRoot, ffmpeg, ffprobe, checkedAt: now() });
  }

  async createProject(input: unknown): Promise<LocalVideoProject> {
    await this.ensureWorkspace();
    const normalized = validateVideoProjectInput(input);
    const root = this.projectRoot(normalized.projectId);
    try {
      await stat(root);
      throw new VideoEngineError('VIDEO_PROJECT_EXISTS', `video project already exists: ${normalized.projectId}`);
    } catch (error) {
      if (error instanceof VideoEngineError) throw error;
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    await mkdir(resolve(root, 'inputs'), { recursive: true, mode: 0o700 });
    await mkdir(resolve(root, 'renders'), { recursive: true, mode: 0o700 });
    const timestamp = now();
    const project: LocalVideoProject = Object.freeze({ ...normalized, createdAt: timestamp, updatedAt: timestamp, state: 'created' });
    await writeJson(resolve(root, 'project.json'), project);
    return project;
  }

  async getProject(projectId: string): Promise<LocalVideoProject> {
    return await this.readProject(projectId);
  }

  private async resolveAsset(sourcePath: string): Promise<string> {
    if (isAbsolute(sourcePath) || sourcePath.includes('\0')) throw new VideoEngineError('VIDEO_PATH_DENIED', 'source paths must be relative to assetRoot');
    const candidate = resolve(this.assetRoot, sourcePath);
    relativeSafe(this.assetRoot, candidate);
    const metadata = await lstat(candidate).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new VideoEngineError('VIDEO_INPUT_INVALID', `source file not found: ${sourcePath}`);
      throw error;
    });
    if (metadata.isSymbolicLink() || !metadata.isFile()) throw new VideoEngineError('VIDEO_PATH_DENIED', `source is not a regular file: ${sourcePath}`);
    const actual = await realpath(candidate);
    relativeSafe(this.assetRoot, actual);
    if (!ALLOWED_EXTENSIONS.has(extname(actual).toLowerCase())) throw new VideoEngineError('VIDEO_INPUT_INVALID', `unsupported media extension: ${sourcePath}`);
    if (metadata.size > this.maxInputBytes) throw new VideoEngineError('VIDEO_OUTPUT_TOO_LARGE', `source exceeds the configured size limit: ${sourcePath}`);
    return actual;
  }

  private async probe(path: string): Promise<ProbeResult> {
    const result = await runCommand(this.ffprobePath, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path], { timeoutMs: this.commandTimeoutMs });
    if (result.code !== 0) throw new VideoEngineError('VIDEO_TOOL_FAILED', `ffprobe failed for ${basename(path)}`, { stderr: result.stderr.slice(0, 2000) });
    let payload: ProbePayload;
    try {
      payload = JSON.parse(result.stdout) as ProbePayload;
    } catch {
      throw new VideoEngineError('VIDEO_TOOL_FAILED', 'ffprobe returned invalid JSON');
    }
    const streams = Array.isArray(payload.streams) ? payload.streams.map(plainRecord) as ProbeStream[] : [];
    const video = streams.find((stream) => stream.codec_type === 'video');
    const format = plainRecord(payload.format);
    const duration = Number(format.duration);
    const tags = plainRecord(video?.tags);
    const sideData = Array.isArray(video?.side_data_list) ? video.side_data_list.map(plainRecord) : [];
    const rotation = Number(tags.rotate ?? sideData[0]?.rotation);
    return {
      durationMs: Number.isFinite(duration) ? Math.max(0, Math.round(duration * 1000)) : 0,
      codec: stringValue(video?.codec_name),
      container: stringValue(format.format_name),
      width: numberValue(video?.width),
      height: numberValue(video?.height),
      fps: parseFps(video?.r_frame_rate),
      audioStreams: streams.filter((stream) => stream.codec_type === 'audio').length,
      rotation: Number.isFinite(rotation) ? rotation : null,
    };
  }

  async ingest(projectId: string): Promise<VideoSourceManifest> {
    const project = await this.readProject(projectId);
    const root = this.projectRoot(project.projectId);
    const existingManifestPath = await secureWorkspacePath(root, 'source-manifest.json', 'file');
    try {
      const existingMetadata = await lstat(existingManifestPath);
      if (!existingMetadata.isFile()) throw new VideoEngineError('VIDEO_PATH_DENIED', 'video source manifest is not a regular file');
      const existingManifest = validatePersistedManifest(await jsonFile<VideoSourceManifest>(existingManifestPath), projectId);
      for (const source of existingManifest.sources) await this.secureManifestSource(root, source);
      return existingManifest;
    } catch (error) {
      if (error instanceof VideoEngineError) throw error;
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const inputRoot = resolve(root, 'inputs');
    await secureWorkspacePath(root, 'inputs', 'directory');
    await mkdir(inputRoot, { recursive: true, mode: 0o700 });
    await secureWorkspacePath(root, 'inputs', 'directory', true);
    const sources: VideoSourceManifestEntry[] = [];
    for (const [index, sourcePath] of project.sourcePaths.entries()) {
      const source = await this.resolveAsset(sourcePath);
      const metadata = await stat(source);
      const bytes = await readFile(source);
      const probe = await this.probe(source);
      const destinationRelative = `inputs/${String(index + 1).padStart(3, '0')}${extname(source).toLowerCase()}`;
      const destination = await secureWorkspacePath(root, destinationRelative, 'file');
      try {
        await copyFile(source, destination, fsConstants.COPYFILE_EXCL);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new VideoEngineError('VIDEO_PATH_DENIED', `video input destination already exists: ${destinationRelative}`);
        throw error;
      }
      await secureWorkspacePath(root, destinationRelative, 'file', true);
      sources.push(Object.freeze({
        index,
        originalPath: sourcePath,
        workspacePath: relativeSafe(root, destination),
        filename: basename(source),
        sha256: sha256(bytes),
        sizeBytes: metadata.size,
        durationMs: probe.durationMs,
        codec: probe.codec,
        container: probe.container,
        width: probe.width,
        height: probe.height,
        fps: probe.fps,
        audioStreams: probe.audioStreams,
        rotation: probe.rotation,
      }));
    }
    const manifest: VideoSourceManifest = Object.freeze({ format: 'furypipe-video-source-manifest/v1', projectId, createdAt: now(), sources: Object.freeze(sources) });
    await writeJson(await secureWorkspacePath(root, 'source-manifest.json', 'file'), manifest);
    const updated: LocalVideoProject = Object.freeze({ ...project, updatedAt: now(), state: 'ingested' });
    await writeJson(await secureWorkspacePath(root, 'project.json', 'file', true), updated);
    return manifest;
  }

  async analyze(projectId: string): Promise<VideoAnalysis> {
    const { project, root, manifest } = await this.readManifest(projectId);
    const sources = manifest.sources.map((source) => {
      const scene: VideoSceneObservation = Object.freeze({
        id: `scene-${String(source.index + 1).padStart(3, '0')}`,
        startMs: 0,
        endMs: Math.max(1, source.durationMs),
        durationMs: Math.max(1, source.durationMs),
        description: 'Technical segment; semantic visual inspection is not installed.',
        motion: 'unknown',
        uiReadable: 'unknown',
        visualInterest: null,
        promoUtility: null,
        tags: Object.freeze(['technical-segment']),
      });
      return Object.freeze({ source, scenes: Object.freeze([scene]), method: 'ffprobe-duration' as const, semanticInspection: 'not-installed' as const });
    });
    const analysis: VideoAnalysis = Object.freeze({ format: 'furypipe-video-analysis/v1', projectId, createdAt: now(), sources: Object.freeze(sources) });
    await writeJson(await secureWorkspacePath(root, 'analysis.json', 'file'), analysis);
    const updated: LocalVideoProject = Object.freeze({ ...project, updatedAt: now(), state: 'analyzed' });
    await writeJson(await secureWorkspacePath(root, 'project.json', 'file', true), updated);
    return analysis;
  }

  private async secureManifestSource(root: string, source: VideoSourceManifestEntry): Promise<string> {
    const inputPath = await secureWorkspacePath(root, source.workspacePath, 'file', true);
    const bytes = await readFile(inputPath);
    if (bytes.byteLength > this.maxInputBytes) throw new VideoEngineError('VIDEO_OUTPUT_TOO_LARGE', `source exceeds the configured size limit: ${source.filename}`);
    if (Number.isFinite(source.sizeBytes) && bytes.byteLength !== source.sizeBytes) throw new VideoEngineError('VIDEO_INPUT_INVALID', `source size changed after ingest: ${source.filename}`);
    if (sha256(bytes) !== source.sha256) throw new VideoEngineError('VIDEO_INPUT_INVALID', `source hash changed after ingest: ${source.filename}`);
    return inputPath;
  }

  private async readManifest(projectId: string): Promise<{ readonly project: LocalVideoProject; readonly root: string; readonly manifest: VideoSourceManifest; }> {
    const project = await this.readProject(projectId);
    const root = this.projectRoot(project.projectId);
    const manifestPath = await secureWorkspacePath(root, 'source-manifest.json', 'file', true);
    const manifest = validatePersistedManifest(await jsonFile<VideoSourceManifest>(manifestPath), project.projectId);
    for (const source of manifest.sources) await this.secureManifestSource(root, source);
    return { project, root, manifest };
  }

  private async prepareConcatInput(root: string, project: LocalVideoProject, manifest: VideoSourceManifest, videoFilter: string, signal?: AbortSignal): Promise<string> {
    if (signal?.aborted) throw new VideoEngineError('VIDEO_JOB_CANCELLED', 'video job was cancelled before segment preparation');
    const segmentsRoot = resolve(root, 'renders', 'segments');
    await mkdir(segmentsRoot, { recursive: true, mode: 0o700 });
    await secureWorkspacePath(root, 'renders/segments', 'directory', true);
    const segmentPaths: string[] = [];
    for (const source of manifest.sources) {
      if (signal?.aborted) throw new VideoEngineError('VIDEO_JOB_CANCELLED', 'video job was cancelled during segment preparation');
      const inputPath = await this.secureManifestSource(root, source);
      const segmentPath = resolve(segmentsRoot, `${String(source.index + 1).padStart(3, '0')}.mp4`);
      await secureWorkspacePath(root, `renders/segments/${String(source.index + 1).padStart(3, '0')}.mp4`, 'file');
      const command = ['-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath];
      if (source.audioStreams === 0) command.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000');
      command.push(
        '-t', (Math.max(100, source.durationMs) / 1000).toFixed(3),
        '-map', '0:v:0',
        '-map', source.audioStreams > 0 ? '0:a:0' : '1:a:0',
        '-vf', videoFilter,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(Math.round(project.fps)),
        '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-movflags', '+faststart', '-shortest', segmentPath,
      );
      const result = await runCommand(this.ffmpegPath, command, { timeoutMs: this.commandTimeoutMs, signal });
      if (result.code !== 0) throw new VideoEngineError('VIDEO_RENDER_FAILED', `ffmpeg could not normalize source ${source.filename}`, { stderr: result.stderr.slice(-4000) });
      segmentPaths.push(segmentPath);
    }
    if (signal?.aborted) throw new VideoEngineError('VIDEO_JOB_CANCELLED', 'video job was cancelled before concatenation');
    const listPath = resolve(root, 'renders', 'segments.txt');
    await secureWorkspacePath(root, 'renders/segments.txt', 'file');
    await writeFile(listPath, `${segmentPaths.map((segmentPath) => `file '${escapeConcatPath(segmentPath)}'`).join('\n')}\n`, { encoding: 'utf8', mode: 0o600 });
    const concatPath = resolve(root, 'renders', 'concatenated.mp4');
    await secureWorkspacePath(root, 'renders/concatenated.mp4', 'file');
    const result = await runCommand(this.ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', concatPath], { timeoutMs: this.commandTimeoutMs, signal });
    if (result.code !== 0) throw new VideoEngineError('VIDEO_RENDER_FAILED', 'ffmpeg could not concatenate video sources', { stderr: result.stderr.slice(-4000) });
    return concatPath;
  }

  async render(projectId: string, options: VideoRenderOptions = {}): Promise<VideoRenderResult> {
    if (options.signal?.aborted) throw new VideoEngineError('VIDEO_JOB_CANCELLED', 'video job was cancelled before starting');
    const { project, root, manifest } = await this.readManifest(projectId);
    const outputPath = await secureWorkspacePath(root, 'renders/final.mp4', 'file');
    const receiptPath = await secureWorkspacePath(root, 'renders/render-receipt.json', 'file');
    const first = manifest.sources[0];
    if (!first) throw new VideoEngineError('VIDEO_INPUT_INVALID', 'video project has no first source');
    const firstInputPath = await this.secureManifestSource(root, first);
    const durationMs = expectedRenderDurationMs(project, manifest);
    const captionCues: VideoCaptionCue[] = options.captionScript ? createVideoCaptionCues(options.captionScript, durationMs, options.captionStyle ?? 'premium-gaming') : [];
    const captionPath = captionCues.length > 0 ? await secureWorkspacePath(root, 'renders/captions.srt', 'file') : undefined;
    if (captionPath) await writeFile(captionPath, renderVideoCaptionsSrt(captionCues), { encoding: 'utf8', mode: 0o600 });
    try {
      const existing = await stat(outputPath);
      if (!options.force && existing.size > 0 && !options.captionScript) {
        const bytes = await readFile(outputPath);
        await writeJson(await secureWorkspacePath(root, 'project.json', 'file', true), Object.freeze({ ...project, updatedAt: now(), state: 'rendered' }));
        return Object.freeze({ status: 'CACHED', projectId, outputPath, outputSha256: sha256(bytes), durationMs, receiptPath, command: Object.freeze([]) });
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const videoFilter = [`scale=${Math.round(project.width)}:${Math.round(project.height)}:force_original_aspect_ratio=increase`, `crop=${Math.round(project.width)}:${Math.round(project.height)}`, 'setsar=1', `fps=${Math.round(project.fps)}`].join(',');
    const inputPath = manifest.sources.length > 1
      ? await this.prepareConcatInput(root, project, manifest, videoFilter, options.signal)
      : firstInputPath;
    const filterParts = manifest.sources.length > 1 ? [] : [videoFilter];
    if (captionPath) filterParts.push(`subtitles='${escapeSubtitlePath(captionPath)}':force_style='FontName=Arial,FontSize=18,Outline=2,Shadow=1,Alignment=2,MarginV=120'`);
    const command = ['-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath];
    const inputHasAudio = manifest.sources.length > 1 || first.audioStreams > 0;
    if (!inputHasAudio) command.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000');
    command.push('-t', (durationMs / 1000).toFixed(3), '-map', '0:v:0', '-map', inputHasAudio ? '0:a:0' : '1:a:0');
    if (filterParts.length > 0) command.push('-vf', filterParts.join(','));
    command.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(Math.round(project.fps)), '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-movflags', '+faststart', '-shortest', outputPath);
    const result = await runCommand(this.ffmpegPath, command, { timeoutMs: this.commandTimeoutMs, signal: options.signal });
    if (result.code !== 0) throw new VideoEngineError('VIDEO_RENDER_FAILED', 'ffmpeg render failed', { stderr: result.stderr.slice(-4000) });
    const outputBytes = await readFile(outputPath).catch(() => { throw new VideoEngineError('VIDEO_RENDER_FAILED', 'ffmpeg did not create the output file'); });
    if (outputBytes.byteLength > this.maxInputBytes) throw new VideoEngineError('VIDEO_OUTPUT_TOO_LARGE', 'rendered video exceeds the configured size limit');
    const outputSha256 = sha256(outputBytes);
    const receipt = Object.freeze({ format: 'furypipe-video-render-receipt/v1', projectId, createdAt: now(), provider: 'native-ffmpeg', command, sourceHashes: manifest.sources.map((source) => source.sha256), outputSha256, outputBytes: outputBytes.byteLength, captionCount: captionCues.length, options: { captionStyle: options.captionStyle ?? null } });
    await writeJson(receiptPath, receipt);
    const updated: LocalVideoProject = Object.freeze({ ...project, updatedAt: now(), state: 'rendered' });
    await writeJson(await secureWorkspacePath(root, 'project.json', 'file', true), updated);
    return Object.freeze({ status: 'RENDERED', projectId, outputPath, outputSha256, durationMs, ...(captionPath ? { captionPath } : {}), receiptPath, command: Object.freeze(command) });
  }

  async qc(projectId: string): Promise<VideoQCReport> {
    const { project, root, manifest } = await this.readManifest(projectId);
    const outputPath = await secureWorkspacePath(root, 'renders/final.mp4', 'file');
    const issues: string[] = [];
    let probe: ProbeResult | undefined;
    try {
      probe = await this.probe(outputPath);
    } catch (error) {
      issues.push(error instanceof Error ? error.message : 'ffprobe failed');
    }
    const decode = await runCommand(this.ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', outputPath, '-f', 'null', '-'], { timeoutMs: this.commandTimeoutMs }).catch((error: unknown) => ({ code: -1, stdout: '', stderr: error instanceof Error ? error.message : 'decode failed' }));
    if (decode.code !== 0) issues.push(`decode failed: ${decode.stderr.slice(-1000)}`);
    if (!probe) issues.push('output probe unavailable');
    else {
      if (probe.width !== Math.round(project.width) || probe.height !== Math.round(project.height)) issues.push(`unexpected dimensions: ${probe.width}x${probe.height}`);
      if (probe.audioStreams < 1) issues.push('audio stream missing');
      const expectedDurationMs = expectedRenderDurationMs(project, manifest);
      const durationToleranceMs = Math.max(100, Math.ceil(2_000 / Math.max(1, Math.round(project.fps))));
      if (Math.abs(probe.durationMs - expectedDurationMs) > durationToleranceMs) issues.push(`unexpected duration: expected ${expectedDurationMs}ms ±${durationToleranceMs}ms, got ${probe.durationMs}ms`);
      if (probe.fps === null || Math.abs(probe.fps - Math.round(project.fps)) > expectedFpsTolerance(project)) issues.push(`unexpected fps: expected ${Math.round(project.fps)}, got ${probe.fps ?? 'unknown'}`);
    }
    const report: VideoQCReport = Object.freeze({ format: 'furypipe-video-qc/v1', projectId, status: issues.length === 0 ? 'PASS' : 'FAIL', checkedAt: now(), path: outputPath, width: probe?.width ?? null, height: probe?.height ?? null, fps: probe?.fps ?? null, durationMs: probe?.durationMs ?? 0, hasAudio: (probe?.audioStreams ?? 0) > 0, decodeExitCode: decode.code, issues: Object.freeze(issues) });
    await writeJson(await secureWorkspacePath(root, 'renders/qc-report.json', 'file'), report);
    return report;
  }

  async persistWorkflowArtifacts(projectId: string, artifacts: VideoWorkflowArtifacts): Promise<void> {
    const project = await this.readProject(projectId);
    const root = this.projectRoot(project.projectId);
    await writeJson(await secureWorkspacePath(root, 'storyboard.json', 'file'), artifacts.storyboard);
    await writeJson(await secureWorkspacePath(root, 'timeline.json', 'file'), artifacts.timeline);
    await writeJson(await secureWorkspacePath(root, 'hook-variants.json', 'file'), artifacts.hookVariants);
    await writeJson(await secureWorkspacePath(root, 'policy-report.json', 'file'), artifacts.policy);
    await writeJson(await secureWorkspacePath(root, 'recipe.json', 'file'), artifacts.recipe);
    await writeJson(await secureWorkspacePath(root, 'provenance.json', 'file'), artifacts.provenance);
  }

  async listArtifacts(projectId: string): Promise<VideoArtifactReference[]> {
    const project = await this.readProject(projectId);
    const root = this.projectRoot(project.projectId);
    const candidates: readonly [VideoArtifactType, string][] = [
      ['project', 'project.json'], ['source-manifest', 'source-manifest.json'], ['analysis', 'analysis.json'],
      ['storyboard', 'storyboard.json'], ['timeline', 'timeline.json'], ['hook-variants', 'hook-variants.json'], ['policy-report', 'policy-report.json'],
      ['recipe', 'recipe.json'], ['provenance', 'provenance.json'], ['captions', 'renders/captions.srt'],
      ['video', 'renders/final.mp4'], ['render-receipt', 'renders/render-receipt.json'], ['qc-report', 'renders/qc-report.json'],
    ];
    const artifacts: VideoArtifactReference[] = [];
    for (const [type, relativePath] of candidates) {
      const path = await secureWorkspacePath(root, relativePath, 'file');
      try {
        const metadata = await stat(path);
        const bytes = await readFile(path);
        artifacts.push(Object.freeze({ type, projectId, path, sizeBytes: metadata.size, sha256: sha256(bytes) }));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    return artifacts;
  }

  async readAnalysis(projectId: string): Promise<VideoAnalysis> {
    const project = await this.readProject(projectId);
    return await jsonFile<VideoAnalysis>(await secureWorkspacePath(this.projectRoot(project.projectId), 'analysis.json', 'file', true));
  }

  static digestProject(project: LocalVideoProject): string {
    return digestVideoValue(project);
  }
}
