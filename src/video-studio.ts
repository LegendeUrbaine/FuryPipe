import { createHash } from 'node:crypto';
import { isAbsolute, win32 as windowsPath } from 'node:path';

export const FURY_VIDEO_STUDIO_FORMAT = 'furypipe-video-studio/v1' as const;

export type VideoCaptionStyle = 'clean' | 'premium-gaming' | 'kinetic' | 'minimal' | 'high-impact';
export type VideoMotion = 'low' | 'medium' | 'high' | 'unknown';
export type VideoPolicyStatus = 'PASS' | 'FAIL';
export type VideoStoryboardPurpose = 'hook' | 'proof' | 'escalation' | 'support' | 'cta';

export interface VideoProjectInput {
  readonly projectId: string;
  readonly title: string;
  readonly sourcePaths: readonly string[];
  readonly targetDurationSeconds: number;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly brand: string;
  readonly platform: string;
}

export interface VideoBrandProfile {
  readonly id: string;
  readonly name: string;
  readonly game?: string;
  readonly product?: string;
  readonly language: string;
  readonly defaultCta: string;
  readonly forbiddenTerms: readonly string[];
  readonly playerFacingTerms: Readonly<Record<string, string>>;
}

export interface VideoCaptionCue {
  readonly id: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly text: string;
  readonly style: VideoCaptionStyle;
}

export interface VideoSceneObservation {
  readonly id: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly durationMs: number;
  readonly description: string;
  readonly motion: VideoMotion;
  readonly uiReadable: 'yes' | 'no' | 'unknown';
  readonly visualInterest: number | null;
  readonly promoUtility: number | null;
  readonly tags: readonly string[];
}

export interface VideoStoryboardShot {
  readonly id: string;
  readonly purpose: VideoStoryboardPurpose;
  readonly sourcePath: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly voiceLine: string;
  readonly captionText: string;
  readonly effect: string;
  readonly musicCue: string;
  readonly reason: string;
}

export interface VideoStoryboard {
  readonly format: typeof FURY_VIDEO_STUDIO_FORMAT;
  readonly durationMs: number;
  readonly profileId: string;
  readonly shots: readonly VideoStoryboardShot[];
}

export interface VideoTimelineItem {
  readonly id: string;
  readonly kind: 'video' | 'caption';
  readonly startMs: number;
  readonly endMs: number;
  readonly sourcePath?: string;
  readonly text?: string;
  readonly effect?: string;
}

export interface VideoTimelineTrack {
  readonly id: 'video' | 'captions';
  readonly kind: 'video' | 'captions';
  readonly items: readonly VideoTimelineItem[];
}

export interface VideoTimeline {
  readonly format: 'furypipe-video-timeline/v1';
  readonly durationMs: number;
  readonly tracks: readonly VideoTimelineTrack[];
  readonly optionalAudio: Readonly<{ voice: 'not-configured'; music: 'not-configured'; sfx: readonly string[] }>;
}

export interface VideoHookVariant {
  readonly id: 'A' | 'B' | 'C';
  readonly openingShotId: string;
  readonly firstLine: string;
  readonly pace: 'fast' | 'measured' | 'impact';
  readonly structure: string;
}

export interface VideoRecipe {
  readonly format: typeof FURY_VIDEO_STUDIO_FORMAT;
  readonly brand: string;
  readonly platform: string;
  readonly durationSeconds: number;
  readonly output: Readonly<{ width: number; height: number; fps: number }>;
  readonly director: string;
  readonly captions: VideoCaptionStyle;
  readonly voiceProvider: string;
  readonly musicProvider: string;
  readonly editingProvider: string;
}

export interface VideoPolicyViolation {
  readonly term: string;
  readonly kind: 'internal-term' | 'unverified-claim';
  readonly field: string;
  readonly suggestion: string;
}

export interface VideoPolicyReport {
  readonly status: VideoPolicyStatus;
  readonly profileId: string;
  readonly violations: readonly VideoPolicyViolation[];
  readonly checkedFields: readonly string[];
}

export const FURYCRAFT_VIDEO_PROFILE: VideoBrandProfile = Object.freeze({
  id: 'furycraft',
  name: 'FuryCraft',
  game: 'Minecraft',
  product: 'OP Prison',
  language: 'fr-FR',
  defaultCta: 'FuryCraft · play.furycraft.fr',
  forbiddenTerms: Object.freeze([
    'FuryPickaxes', 'FuryPass', 'FuryCore', 'Nexo', 'LuckPerms', 'EssentialsX',
    'PlaceholderAPI', 'ProtocolLib', 'ShopGUIPlus', 'TAB',
  ]),
  playerFacingTerms: Object.freeze({
    FuryPickaxes: 'Pioche évolutive',
    FuryPass: 'Quêtes et récompenses',
    FuryCore: 'progression FuryCraft',
    Nexo: 'objets et visuels du serveur',
    LuckPerms: 'rangs',
    EssentialsX: 'fonctionnalités du serveur',
    PlaceholderAPI: 'informations en jeu',
    ProtocolLib: 'expérience de jeu',
    ShopGUIPlus: 'boutique',
    TAB: 'interface du serveur',
  }),
});

const PROJECT_ID = /^[a-z][a-z0-9._-]{0,63}$/u;
const MAX_PROJECT_SOURCES = 256;
const MAX_SOURCE_LENGTH = 4096;
const MAX_TITLE_LENGTH = 256;
const MAX_SCRIPT_LENGTH = 64_000;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${label} must be a plain object`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max: number, allowEmpty = false): string {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && value.length === 0) || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new TypeError(`${label} is invalid`);
  }
  return value;
}

function finiteNumber(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new RangeError(`${label} is invalid`);
  return value;
}

function pathIsSafe(value: string): boolean {
  if (!value || value.length > MAX_SOURCE_LENGTH || value.includes('\0') || isAbsolute(value) || windowsPath.isAbsolute(value)) return false;
  const segments = value.replaceAll('\\', '/').split('/');
  return !segments.some((segment) => segment === '..' || segment.length === 0 && segments.length > 1);
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

export function validateVideoProjectInput(value: unknown): VideoProjectInput {
  const input = record(value, 'video project');
  const allowed = new Set(['projectId', 'title', 'sourcePaths', 'targetDurationSeconds', 'width', 'height', 'fps', 'brand', 'platform']);
  for (const key of Object.keys(input)) if (!allowed.has(key)) throw new TypeError(`video project contains unsupported field: ${key}`);
  const projectId = text(input.projectId, 'projectId', 64);
  if (!PROJECT_ID.test(projectId)) throw new TypeError('projectId is invalid');
  const title = text(input.title, 'title', MAX_TITLE_LENGTH);
  if (!Array.isArray(input.sourcePaths) || input.sourcePaths.length > MAX_PROJECT_SOURCES) throw new TypeError('sourcePaths is invalid');
  const sourcePaths = input.sourcePaths.map((source, index) => {
    const path = text(source, `sourcePaths[${index}]`, MAX_SOURCE_LENGTH);
    if (!pathIsSafe(path)) throw new TypeError(`source path is unsafe: ${path}`);
    return path;
  });
  const targetDurationSeconds = input.targetDurationSeconds === undefined
    ? 25
    : finiteNumber(input.targetDurationSeconds, 'targetDurationSeconds', 1, 120);
  const width = input.width === undefined ? 1080 : finiteNumber(input.width, 'width', 320, 3840);
  const height = input.height === undefined ? 1920 : finiteNumber(input.height, 'height', 320, 3840);
  const fps = input.fps === undefined ? 60 : finiteNumber(input.fps, 'fps', 1, 120);
  const brand = input.brand === undefined ? 'generic' : text(input.brand, 'brand', 64);
  const platform = input.platform === undefined ? 'tiktok' : text(input.platform, 'platform', 32);
  return Object.freeze({ projectId, title, sourcePaths: Object.freeze(sourcePaths), targetDurationSeconds, width, height, fps, brand, platform });
}

function wrapCaption(value: string, maxLineLength = 32): string {
  const words = value.trim().split(/\s+/u).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (current.length > 0 && candidate.length > maxLineLength) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2).join('\n').slice(0, maxLineLength * 2 + 1);
}

export function createVideoCaptionCues(script: string, durationMs: number, style: VideoCaptionStyle = 'premium-gaming'): VideoCaptionCue[] {
  const safeScript = text(script, 'caption script', MAX_SCRIPT_LENGTH, true).trim();
  if (!safeScript) return [];
  const phrases = safeScript.match(/[^.!?…。！？]+[.!?…。！？]?/gu)?.map((item) => item.trim()).filter(Boolean) ?? [safeScript];
  const totalMs = Math.max(1, Math.round(finiteNumber(durationMs, 'durationMs', 1, 7_200_000)));
  const weights = phrases.map((phrase) => Math.max(1, phrase.replace(/\s/gu, '').length));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = 0;
  return phrases.map((phrase, index) => {
    const remaining = phrases.length - index;
    const allocated = index === phrases.length - 1
      ? totalMs - cursor
      : Math.max(1, Math.round(totalMs * (weights[index] ?? 1) / totalWeight));
    const startMs = cursor;
    const endMs = Math.max(startMs + 1, Math.min(totalMs, cursor + allocated));
    cursor = endMs;
    return Object.freeze({ id: `caption-${String(index + 1).padStart(3, '0')}`, startMs, endMs, text: wrapCaption(phrase), style });
  });
}

function timestamp(ms: number): string {
  const safeMs = Math.max(0, Math.round(ms));
  const hours = Math.floor(safeMs / 3_600_000);
  const minutes = Math.floor((safeMs % 3_600_000) / 60_000);
  const seconds = Math.floor((safeMs % 60_000) / 1_000);
  const millis = safeMs % 1_000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

export function renderVideoCaptionsSrt(cues: readonly VideoCaptionCue[]): string {
  return cues.map((cue, index) => `${index + 1}\n${timestamp(cue.startMs)} --> ${timestamp(cue.endMs)}\n${cue.text}\n`).join('\n');
}

function normalizePolicyFields(input: Record<string, unknown>): Readonly<Record<string, string>> {
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) fields[key] = value.filter((item): item is string => typeof item === 'string').join('\n');
    else if (typeof value === 'string') fields[key] = value;
  }
  return fields;
}

export function lintFuryCraftPublicContent(input: {
  readonly title?: string;
  readonly script?: string;
  readonly captions?: readonly string[];
  readonly overlays?: readonly string[];
  readonly cta?: string;
  readonly description?: string;
}): VideoPolicyReport {
  const fields = normalizePolicyFields(input as Record<string, unknown>);
  const violations: VideoPolicyViolation[] = [];
  for (const [field, value] of Object.entries(fields)) {
    for (const term of FURYCRAFT_VIDEO_PROFILE.forbiddenTerms) {
      const pattern = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\b`, 'iu');
      if (pattern.test(value)) {
        violations.push({ term, kind: 'internal-term', field, suggestion: FURYCRAFT_VIDEO_PROFILE.playerFacingTerms[term] ?? 'terme compréhensible par les joueurs' });
      }
    }
    const claimPatterns: readonly [RegExp, string, string][] = [
      [/#\s*1|num(?:é|e)ro\s*un|number\s*one/iu, '#1', 'Retirer le classement non vérifié et décrire une fonctionnalité réelle.'],
      [/\b(?:le|la|les)\s+meilleur(?:e|s)?\b|\bbest\b/iu, 'meilleur', 'Remplacer par une description vérifiable du gameplay.'],
      [/\b\d[\d\s.,]*\s+(?:joueurs?|players?)\b/iu, 'nombre de joueurs', 'Retirer le nombre non vérifié.'],
      [/\b(?:record|records?|award|awards|récompense mondiale|numéro un)\b/iu, 'claim', 'Retirer la revendication non vérifiée.'],
    ];
    for (const [pattern, term, suggestion] of claimPatterns) {
      const match = pattern.exec(value);
      if (match) violations.push({ term: match[0] || term, kind: 'unverified-claim', field, suggestion });
    }
  }
  return Object.freeze({ status: violations.length === 0 ? 'PASS' : 'FAIL', profileId: FURYCRAFT_VIDEO_PROFILE.id, violations: Object.freeze(violations), checkedFields: Object.freeze(Object.keys(fields)) });
}

export function createGenericVideoProfile(input: {
  readonly id: string;
  readonly name: string;
  readonly language: string;
  readonly defaultCta: string;
}): VideoBrandProfile {
  const id = text(input.id, 'profile id', 64);
  if (!PROJECT_ID.test(id)) throw new TypeError('profile id is invalid');
  return Object.freeze({ id, name: text(input.name, 'profile name', 128), language: text(input.language, 'language', 32), defaultCta: text(input.defaultCta, 'defaultCta', 256), forbiddenTerms: Object.freeze([]), playerFacingTerms: Object.freeze({}) });
}

export function createVideoStoryboard(input: {
  readonly sourcePaths: readonly string[];
  readonly durationMs: number;
  readonly profile: VideoBrandProfile;
}): VideoStoryboard {
  if (input.sourcePaths.length === 0) throw new TypeError('storyboard requires at least one source path');
  const durationMs = Math.max(1, Math.round(finiteNumber(input.durationMs, 'durationMs', 1, 7_200_000)));
  const purposes: readonly VideoStoryboardPurpose[] = ['hook', 'proof', 'escalation', 'support', 'cta'];
  const labels: Readonly<Record<VideoStoryboardPurpose, string>> = {
    hook: 'Accrocher immédiatement avec le moment le plus lisible.',
    proof: 'Montrer une fonctionnalité ou un moment de gameplay réel.',
    escalation: 'Augmenter le rythme avec une progression visible.',
    support: 'Donner une respiration courte et renforcer la promesse.',
    cta: 'Terminer avec une consigne claire et vérifiable.',
  };
  const base = Math.max(1, Math.floor(durationMs / purposes.length));
  const shots = purposes.map((purpose, index) => {
    const startMs = index * base;
    const endMs = index === purposes.length - 1 ? durationMs : Math.min(durationMs, (index + 1) * base);
    const sourcePath = input.sourcePaths[index % input.sourcePaths.length] ?? input.sourcePaths[0] ?? 'unknown';
    const voiceLine = purpose === 'cta' ? input.profile.defaultCta : purpose === 'hook' ? 'Tu veux passer au niveau supérieur ?' : 'Chaque action compte dans ta progression.';
    return Object.freeze({
      id: `shot-${String(index + 1).padStart(2, '0')}`,
      purpose,
      sourcePath,
      startMs,
      endMs: Math.max(startMs + 1, endMs),
      voiceLine,
      captionText: voiceLine,
      effect: purpose === 'hook' ? 'impact-cut' : purpose === 'cta' ? 'logo-hold' : 'clean-cut',
      musicCue: purpose === 'escalation' ? 'build' : purpose === 'cta' ? 'resolve' : 'steady',
      reason: labels[purpose],
    });
  });
  return Object.freeze({ format: FURY_VIDEO_STUDIO_FORMAT, durationMs, profileId: input.profile.id, shots: Object.freeze(shots) });
}

export function createVideoHookVariants(storyboard: VideoStoryboard, profile: VideoBrandProfile): VideoHookVariant[] {
  const first = storyboard.shots[0]?.id ?? 'shot-01';
  const second = storyboard.shots[1]?.id ?? first;
  const third = storyboard.shots[2]?.id ?? second;
  const lines = profile.id === 'furycraft'
    ? ['Tu crois avoir tout vu du Prison ?', 'Mine. Améliore. Prestige.', 'Passe au niveau supérieur sur FuryCraft.']
    : [`Découvre ${profile.name}.`, `Va plus loin avec ${profile.name}.`, profile.defaultCta];
  return [
    Object.freeze({ id: 'A', openingShotId: first, firstLine: lines[0] ?? profile.defaultCta, pace: 'fast', structure: 'action immédiate → preuve → CTA' }),
    Object.freeze({ id: 'B', openingShotId: second, firstLine: lines[1] ?? profile.defaultCta, pace: 'measured', structure: 'progression → détail → CTA' }),
    Object.freeze({ id: 'C', openingShotId: third, firstLine: lines[2] ?? profile.defaultCta, pace: 'impact', structure: 'récompense → escalade → CTA' }),
  ];
}

export function createVideoTimeline(input: {
  readonly storyboard: VideoStoryboard;
  readonly captions?: readonly VideoCaptionCue[];
  readonly renderSegments?: readonly { readonly sourcePath: string; readonly durationMs: number }[];
}): VideoTimeline {
  let renderCursor = 0;
  const videoItems = input.renderSegments
    ? input.renderSegments.flatMap((segment, index) => {
      const durationMs = Math.max(1, Math.round(segment.durationMs));
      const startMs = renderCursor;
      const endMs = Math.min(input.storyboard.durationMs, startMs + durationMs);
      renderCursor = endMs;
      if (endMs <= startMs) return [];
      return [Object.freeze({
        id: `render-segment-${String(index + 1).padStart(3, '0')}`,
        kind: 'video' as const,
        startMs,
        endMs,
        sourcePath: segment.sourcePath,
        effect: 'native-sequential-cut',
      })];
    })
    : input.storyboard.shots.map((shot) => Object.freeze({
      id: shot.id,
      kind: 'video' as const,
      startMs: shot.startMs,
      endMs: shot.endMs,
      sourcePath: shot.sourcePath,
      effect: shot.effect,
    }));
  const captionItems = (input.captions ?? []).map((cue) => Object.freeze({
    id: cue.id,
    kind: 'caption' as const,
    startMs: cue.startMs,
    endMs: cue.endMs,
    text: cue.text,
  }));
  return Object.freeze({
    format: 'furypipe-video-timeline/v1' as const,
    durationMs: input.storyboard.durationMs,
    tracks: Object.freeze([
      Object.freeze({ id: 'video' as const, kind: 'video' as const, items: Object.freeze(videoItems) }),
      Object.freeze({ id: 'captions' as const, kind: 'captions' as const, items: Object.freeze(captionItems) }),
    ]),
    optionalAudio: Object.freeze({ voice: 'not-configured' as const, music: 'not-configured' as const, sfx: Object.freeze([]) }),
  });
}

export function createVideoRecipe(input: {
  readonly profile: VideoBrandProfile;
  readonly platform: string;
  readonly durationSeconds: number;
  readonly captionStyle: VideoCaptionStyle;
  readonly voiceProvider: string;
  readonly musicProvider: string;
  readonly editingProvider: string;
  readonly width?: number;
  readonly height?: number;
  readonly fps?: number;
}): VideoRecipe {
  return Object.freeze({
    format: FURY_VIDEO_STUDIO_FORMAT,
    brand: input.profile.id,
    platform: text(input.platform, 'platform', 32),
    durationSeconds: Math.round(finiteNumber(input.durationSeconds, 'durationSeconds', 1, 120)),
    output: Object.freeze({ width: Math.round(finiteNumber(input.width ?? 1080, 'width', 320, 3840)), height: Math.round(finiteNumber(input.height ?? 1920, 'height', 320, 3840)), fps: Math.round(finiteNumber(input.fps ?? 60, 'fps', 1, 120)) }),
    director: input.profile.id === 'furycraft' ? 'gaming-promo' : 'video-director',
    captions: input.captionStyle,
    voiceProvider: text(input.voiceProvider, 'voiceProvider', 128),
    musicProvider: text(input.musicProvider, 'musicProvider', 128),
    editingProvider: text(input.editingProvider, 'editingProvider', 128),
  });
}

export function digestVideoValue(value: unknown): string {
  return digest(value);
}
