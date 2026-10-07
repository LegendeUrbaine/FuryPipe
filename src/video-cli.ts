import path from 'node:path';
import { LocalVideoEngine } from './video-local-engine.js';
import { runVideoWorkflow } from './video-workflow.js';
import type { VideoCaptionStyle } from './video-studio.js';

export type FuryVideoCliCommand = 'help' | 'doctor' | 'project' | 'ingest' | 'analyze' | 'render' | 'qc' | 'artifacts';

export interface FuryVideoCliArgs {
  readonly command: FuryVideoCliCommand;
  readonly help: boolean;
  readonly json: boolean;
  readonly confirm: boolean;
  readonly force: boolean;
  readonly projectId?: string;
  readonly title?: string;
  readonly sourcePaths: readonly string[];
  readonly durationSeconds?: number;
  readonly width?: number;
  readonly height?: number;
  readonly fps?: number;
  readonly brand?: string;
  readonly platform?: string;
  readonly captionScript?: string;
  readonly captionStyle?: VideoCaptionStyle;
}

export interface FuryVideoCliWriter {
  write(value: string): unknown;
}

export interface FuryVideoCliIo {
  readonly stdout: FuryVideoCliWriter;
  readonly stderr: FuryVideoCliWriter;
}

export class FuryVideoCliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FuryVideoCliUsageError';
  }
}

const COMMANDS = new Set<FuryVideoCliCommand>(['help', 'doctor', 'project', 'ingest', 'analyze', 'render', 'qc', 'artifacts']);
const CAPTION_STYLES = new Set<VideoCaptionStyle>(['clean', 'premium-gaming', 'kinetic', 'minimal', 'high-impact']);

export function furyVideoCliHelp(): string {
  return `Usage:
  furypipe video doctor [--json]
  furypipe video project --project ID --source FILE [--source FILE ...] --confirm [--json]
  furypipe video ingest --project ID [--json]
  furypipe video analyze --project ID [--json]
  furypipe video render --project ID --confirm [--caption-script TEXT] [--caption-style STYLE] [--force] [--json]
  furypipe video qc --project ID [--json]
  furypipe video artifacts --project ID [--json]

The local engine uses FFmpeg and FFprobe. Workspace defaults to .furypipe/video;
set FURYPIPE_VIDEO_WORKSPACE and FURYPIPE_VIDEO_ASSETS to override the roots.
Rendering is an explicit approved operation and persists a receipt and QC report.`;
}

function numberOption(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new FuryVideoCliUsageError(`${name} must be a number`);
  return parsed;
}

export function parseFuryVideoCliArgs(argv: readonly string[]): FuryVideoCliArgs {
  const first = argv[0];
  const command = (first === undefined || first === '--help' || first === '-h' ? 'help' : first) as FuryVideoCliCommand;
  if (!COMMANDS.has(command)) throw new FuryVideoCliUsageError(`unknown video command: ${first}`);
  let help = command === 'help';
  let json = false;
  let confirm = false;
  let force = false;
  let projectId: string | undefined;
  let title: string | undefined;
  const sourcePaths: string[] = [];
  let durationSeconds: number | undefined;
  let width: number | undefined;
  let height: number | undefined;
  let fps: number | undefined;
  let brand: string | undefined;
  let platform: string | undefined;
  let captionScript: string | undefined;
  let captionStyle: VideoCaptionStyle | undefined;
  for (let index = command === 'help' ? 0 : 1; index < argv.length; index += 1) {
    const raw = argv[index];
    if (raw === undefined) continue;
    if (raw === '-h' || raw === '--help') { help = true; continue; }
    if (raw === '--json') { json = true; continue; }
    if (raw === '--confirm') { confirm = true; continue; }
    if (raw === '--force') { force = true; continue; }
    const equals = raw.indexOf('=');
    const key = equals >= 0 ? raw.slice(0, equals) : raw;
    const inline = equals >= 0 ? raw.slice(equals + 1) : undefined;
    const value = (): string => {
      const next = inline ?? argv[++index];
      if (next === undefined || next === '' || next.startsWith('--')) throw new FuryVideoCliUsageError(`${key} requires a value`);
      return next;
    };
    if (key === '--project') projectId = value();
    else if (key === '--title') title = value();
    else if (key === '--source') sourcePaths.push(value());
    else if (key === '--duration') durationSeconds = numberOption(value(), 'duration');
    else if (key === '--width') width = numberOption(value(), 'width');
    else if (key === '--height') height = numberOption(value(), 'height');
    else if (key === '--fps') fps = numberOption(value(), 'fps');
    else if (key === '--brand') brand = value();
    else if (key === '--platform') platform = value();
    else if (key === '--caption-script') captionScript = value();
    else if (key === '--caption-style') {
      const rawStyle = value();
      if (!CAPTION_STYLES.has(rawStyle as VideoCaptionStyle)) throw new FuryVideoCliUsageError(`unsupported caption style: ${rawStyle}`);
      captionStyle = rawStyle as VideoCaptionStyle;
    } else throw new FuryVideoCliUsageError(`unknown video option: ${raw}`);
  }
  return Object.freeze({ command, help, json, confirm, force, ...(projectId ? { projectId } : {}), ...(title ? { title } : {}), sourcePaths: Object.freeze(sourcePaths), ...(durationSeconds === undefined ? {} : { durationSeconds }), ...(width === undefined ? {} : { width }), ...(height === undefined ? {} : { height }), ...(fps === undefined ? {} : { fps }), ...(brand ? { brand } : {}), ...(platform ? { platform } : {}), ...(captionScript ? { captionScript } : {}), ...(captionStyle ? { captionStyle } : {}) });
}

function output(io: FuryVideoCliIo, value: unknown, json: boolean): void {
  if (json) io.stdout.write(`${JSON.stringify(value)}\n`);
  else if (typeof value === 'string') io.stdout.write(`${value}\n`);
  else io.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export async function runFuryVideoCli(argv: readonly string[], io: FuryVideoCliIo): Promise<number> {
  try {
    const parsed = parseFuryVideoCliArgs(argv);
    if (parsed.help) { io.stdout.write(`${furyVideoCliHelp()}\n`); return 0; }
    const workspaceRoot = process.env.FURYPIPE_VIDEO_WORKSPACE?.trim() || path.join(process.cwd(), '.furypipe', 'video');
    const assetRoot = process.env.FURYPIPE_VIDEO_ASSETS?.trim() || process.cwd();
    const engine = new LocalVideoEngine({ workspaceRoot, assetRoot });
    if (parsed.command === 'doctor') {
      const report = await engine.doctor();
      output(io, parsed.json ? report : `VIDEO DOCTOR\nFFmpeg ${report.ffmpeg.status}\nFFprobe ${report.ffprobe.status}\nSTATUS ${report.status}`, parsed.json);
      return report.status === 'READY' ? 0 : 2;
    }
    if (parsed.command === 'project') {
      if (!parsed.projectId || !parsed.title || parsed.sourcePaths.length === 0 || !parsed.confirm) throw new FuryVideoCliUsageError('project requires --project, --title, at least one --source, and --confirm');
      const project = await engine.createProject({ projectId: parsed.projectId, title: parsed.title, sourcePaths: parsed.sourcePaths, targetDurationSeconds: parsed.durationSeconds ?? 25, width: parsed.width ?? 1080, height: parsed.height ?? 1920, fps: parsed.fps ?? 60, brand: parsed.brand ?? 'generic', platform: parsed.platform ?? 'tiktok' });
      output(io, parsed.json ? project : `VIDEO PROJECT\n${project.projectId}\nSTATE ${project.state}`, parsed.json);
      return 0;
    }
    if (!parsed.projectId) throw new FuryVideoCliUsageError(`${parsed.command} requires --project`);
    if (parsed.command === 'ingest') { output(io, await engine.ingest(parsed.projectId), parsed.json); return 0; }
    if (parsed.command === 'analyze') { output(io, await engine.analyze(parsed.projectId), parsed.json); return 0; }
    if (parsed.command === 'qc') { const qc = await engine.qc(parsed.projectId); output(io, qc, parsed.json); return qc.status === 'PASS' ? 0 : 1; }
    if (parsed.command === 'artifacts') { output(io, await engine.listArtifacts(parsed.projectId), parsed.json); return 0; }
    if (parsed.command === 'render') {
      if (!parsed.confirm) throw new FuryVideoCliUsageError('render requires --confirm');
      const project = await engine.getProject(parsed.projectId);
      const result = await runVideoWorkflow(engine, { project, confirm: true, force: parsed.force, ...(parsed.captionScript ? { captionScript: parsed.captionScript } : {}), ...(parsed.captionStyle ? { captionStyle: parsed.captionStyle } : {}) });
      output(io, parsed.json ? result : `VIDEO RENDER\n${result.render.outputPath}\nQC ${result.qc.status}\nARTIFACTS ${result.artifacts.length}`, parsed.json);
      return 0;
    }
    throw new FuryVideoCliUsageError(`unsupported video command: ${parsed.command}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'video command failed';
    io.stderr.write(`[furypipe] video: ${message}\n`);
    return error instanceof FuryVideoCliUsageError ? 2 : 1;
  }
}
