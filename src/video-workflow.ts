import {
  createVideoHookVariants,
  createVideoRecipe,
  createVideoStoryboard,
  createVideoCaptionCues,
  createVideoTimeline,
  FURYCRAFT_VIDEO_PROFILE,
  lintFuryCraftPublicContent,
  type VideoBrandProfile,
  type VideoCaptionStyle,
  type VideoHookVariant,
  type VideoPolicyReport,
  type VideoRecipe,
  type VideoStoryboard,
  type VideoProjectInput,
  type VideoTimeline,
  validateVideoProjectInput,
} from './video-studio.js';
import {
  createVideoProviderRegistry,
  type VideoProviderDescriptor,
} from './video-providers.js';
import type {
  LocalVideoProject,
  LocalVideoEngine,
  VideoAnalysis,
  VideoArtifactReference,
  VideoDoctorReport,
  VideoQCReport,
  VideoRenderResult,
  VideoSourceManifest,
  VideoRenderOptions,
  VideoWorkflowArtifacts,
  VideoWorkflowProvenance,
} from './video-local-engine.js';
import { VideoEngineError } from './video-local-engine.js';
import { selectVideoSkills, type VideoSkillSelection } from './video-skills.js';

export type VideoWorkflowErrorCode = 'VIDEO_APPROVAL_REQUIRED' | 'VIDEO_DOCTOR_NOT_READY' | 'PUBLIC_CONTENT_POLICY_FAILED' | 'VIDEO_QC_FAILED';

export class VideoWorkflowError extends Error {
  readonly code: VideoWorkflowErrorCode;

  constructor(code: VideoWorkflowErrorCode, message: string) {
    super(message);
    this.name = 'VideoWorkflowError';
    this.code = code;
  }
}

export interface VideoWorkflowEngine {
  doctor(): Promise<VideoDoctorReport>;
  createProject(input: unknown): Promise<LocalVideoProject>;
  getProject(projectId: string): Promise<LocalVideoProject>;
  ingest(projectId: string): Promise<VideoSourceManifest>;
  analyze(projectId: string): Promise<VideoAnalysis>;
  render(projectId: string, options?: VideoRenderOptions): Promise<VideoRenderResult>;
  qc(projectId: string): Promise<VideoQCReport>;
  persistWorkflowArtifacts(projectId: string, artifacts: VideoWorkflowArtifacts): Promise<void>;
  listArtifacts(projectId: string): Promise<VideoArtifactReference[]>;
}

export interface VideoWorkflowInput {
  readonly project: unknown;
  readonly confirm: boolean;
  readonly force?: boolean;
  readonly captionScript?: string;
  readonly captionStyle?: VideoCaptionStyle;
  readonly profile?: VideoBrandProfile;
  readonly signal?: AbortSignal;
}

export interface VideoWorkflowResult {
  readonly status: 'PASS';
  readonly doctor: VideoDoctorReport;
  readonly providerRegistry: readonly VideoProviderDescriptor[];
  readonly providerHealth: Readonly<Record<string, string>>;
  readonly project: LocalVideoProject;
  readonly manifest: VideoSourceManifest;
  readonly analysis: VideoAnalysis;
  readonly storyboard: VideoStoryboard;
  readonly timeline: VideoTimeline;
  readonly hookVariants: readonly VideoHookVariant[];
  readonly policy: VideoPolicyReport;
  readonly render: VideoRenderResult;
  readonly qc: VideoQCReport;
  readonly recipe: VideoRecipe;
  readonly skills: VideoSkillSelection;
  readonly artifacts: readonly VideoArtifactReference[];
}

function normalizedProjectInput(value: unknown): VideoProjectInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('video project must be an object');
  const raw = value as Record<string, unknown>;
  return validateVideoProjectInput({
    projectId: raw.projectId,
    title: raw.title,
    sourcePaths: raw.sourcePaths,
    targetDurationSeconds: raw.targetDurationSeconds,
    width: raw.width,
    height: raw.height,
    fps: raw.fps,
    brand: raw.brand,
    platform: raw.platform,
  });
}

function defaultProfile(project: LocalVideoProject): VideoBrandProfile {
  return project.brand.toLowerCase() === 'furycraft' ? FURYCRAFT_VIDEO_PROFILE : {
    id: project.brand || 'generic',
    name: project.brand || 'Generic video',
    language: 'en-US',
    defaultCta: 'Learn more',
    forbiddenTerms: [],
    playerFacingTerms: {},
  };
}

function defaultScript(profile: VideoBrandProfile): string {
  if (profile.id === 'furycraft') return 'Mine plus vite. Améliore ta pioche. Grimpe les prestiges. Rejoins FuryCraft sur play.furycraft.fr.';
  return `Découvre ${profile.name}. ${profile.defaultCta}.`;
}

function genericPolicy(profile: VideoBrandProfile, fields: readonly string[]): VideoPolicyReport {
  return Object.freeze({ status: 'PASS' as const, profileId: profile.id, violations: Object.freeze([]), checkedFields: Object.freeze([...fields]) });
}

function actualRenderSegments(manifest: VideoSourceManifest, durationMs: number): readonly { readonly sourcePath: string; readonly durationMs: number }[] {
  let remainingMs = durationMs;
  const segments: { sourcePath: string; durationMs: number }[] = [];
  for (const source of manifest.sources) {
    if (remainingMs <= 0) break;
    const segmentDurationMs = Math.min(Math.max(1, Math.round(source.durationMs)), remainingMs);
    segments.push(Object.freeze({ sourcePath: source.originalPath, durationMs: segmentDurationMs }));
    remainingMs -= segmentDurationMs;
  }
  return Object.freeze(segments);
}

export async function runVideoWorkflow(engine: LocalVideoEngine | VideoWorkflowEngine, input: VideoWorkflowInput): Promise<VideoWorkflowResult> {
  if (input.confirm !== true) throw new VideoWorkflowError('VIDEO_APPROVAL_REQUIRED', 'explicit video execution approval is required');
  const doctor = await engine.doctor();
  if (doctor.status !== 'READY') throw new VideoWorkflowError('VIDEO_DOCTOR_NOT_READY', 'FFmpeg and FFprobe are required for local video rendering');
  const projectInput = normalizedProjectInput(input.project);
  let project: LocalVideoProject;
  try {
    project = await engine.createProject(projectInput);
  } catch (error) {
    if (error instanceof VideoEngineError && error.code === 'VIDEO_PROJECT_EXISTS') {
      project = await engine.getProject(projectInput.projectId);
    } else {
      throw error;
    }
  }
  const profile = input.profile ?? defaultProfile(project);
  const providerRegistry = createVideoProviderRegistry({ ffmpegAvailable: doctor.ffmpeg.status === 'PASS', ffprobeAvailable: doctor.ffprobe.status === 'PASS' });
  const manifest = await engine.ingest(project.projectId);
  const analysis = await engine.analyze(project.projectId);
  const sourceDurationMs = analysis.sources.reduce((total, source) => total + Math.max(0, source.source.durationMs), 0);
  const availableDurationMs = sourceDurationMs > 0 ? sourceDurationMs : project.targetDurationSeconds * 1000;
  const durationMs = Math.max(1000, Math.min(project.targetDurationSeconds * 1000, availableDurationMs));
  const storyboard = createVideoStoryboard({ sourcePaths: manifest.sources.map((source) => source.originalPath), durationMs, profile });
  const hookVariants = createVideoHookVariants(storyboard, profile);
  const script = input.captionScript ?? defaultScript(profile);
  const policy = profile.id === FURYCRAFT_VIDEO_PROFILE.id
    ? lintFuryCraftPublicContent({ title: project.title, script, captions: storyboard.shots.map((shot) => shot.captionText), overlays: hookVariants.map((variant) => variant.firstLine), cta: profile.defaultCta })
    : genericPolicy(profile, ['title', 'script', 'captions', 'overlays', 'cta']);
  if (policy.status !== 'PASS') throw new VideoWorkflowError('PUBLIC_CONTENT_POLICY_FAILED', 'public video content policy failed');
  const render = await engine.render(project.projectId, { captionScript: script, captionStyle: input.captionStyle ?? 'premium-gaming', force: input.force, signal: input.signal });
  const qc = await engine.qc(project.projectId);
  if (qc.status !== 'PASS') throw new VideoWorkflowError('VIDEO_QC_FAILED', 'video technical QC failed');
  const renderedProject = await engine.getProject(project.projectId);
  const recipe = createVideoRecipe({ profile, platform: project.platform, durationSeconds: Math.max(1, Math.round(render.durationMs / 1000)), captionStyle: input.captionStyle ?? 'premium-gaming', voiceProvider: 'none', musicProvider: 'none', editingProvider: 'native-ffmpeg', width: project.width, height: project.height, fps: project.fps });
  const timeline = createVideoTimeline({
    storyboard,
    captions: createVideoCaptionCues(script, render.durationMs, input.captionStyle ?? 'premium-gaming'),
    renderSegments: actualRenderSegments(manifest, render.durationMs),
  });
  const skills = selectVideoSkills({ intent: `${project.title} ${profile.name} ${project.platform}`, profile, platform: project.platform, width: project.width, height: project.height });
  const provenance: VideoWorkflowProvenance = Object.freeze({
    format: 'furypipe-video-provenance/v1',
    projectId: project.projectId,
    createdAt: new Date().toISOString(),
    sourceHashes: Object.freeze(manifest.sources.map((source) => source.sha256)),
    provider: 'native-ffmpeg',
    providerVersion: 'system',
    model: 'unknown',
    modelVersion: 'unknown',
    skillVersions: skills.versions,
    renderSettings: Object.freeze({ width: project.width, height: project.height, fps: project.fps, format: 'mp4', videoCodec: 'libx264', audioCodec: 'aac', captionStyle: input.captionStyle ?? 'premium-gaming' }),
    toolVersions: Object.freeze({ ffmpeg: doctor.ffmpeg.version, ffprobe: doctor.ffprobe.version }),
    command: Object.freeze([...render.command]),
    qcStatus: qc.status,
  });
  await engine.persistWorkflowArtifacts(project.projectId, { storyboard, timeline, hookVariants: Object.freeze(hookVariants), policy, recipe, provenance });
  const artifacts = await engine.listArtifacts(project.projectId);
  return Object.freeze({ status: 'PASS' as const, doctor, providerRegistry: Object.freeze(providerRegistry.list()), providerHealth: providerRegistry.health(), project: renderedProject, manifest, analysis, storyboard, timeline, hookVariants: Object.freeze(hookVariants), policy, render, qc, recipe, skills, artifacts: Object.freeze(artifacts) });
}
