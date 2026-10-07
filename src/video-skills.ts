import type { VideoBrandProfile } from './video-studio.js';

export type VideoSkillId = 'video-director' | 'vertical-short-form' | 'gaming-promo';

export interface VideoSkillDefinition {
  readonly id: VideoSkillId;
  readonly version: string;
  readonly category: 'direction' | 'short-form' | 'gaming';
  readonly description: string;
  readonly responsibilities: readonly string[];
  readonly provenance: {
    readonly sourceKind: 'local';
    readonly license: 'MIT';
  };
}

export interface VideoSkillSelection {
  readonly format: 'furypipe-video-skill-selection/v1';
  readonly selected: readonly VideoSkillId[];
  readonly reasons: Readonly<Record<VideoSkillId, string>>;
  readonly versions: Readonly<Record<VideoSkillId, string>>;
}

export const VIDEO_SKILL_DEFINITIONS: readonly VideoSkillDefinition[] = Object.freeze([
  Object.freeze({
    id: 'video-director',
    version: '1.0.0',
    category: 'direction',
    description: 'Plans a video from intent through storyboard, render, inspection, repair, and QC.',
    responsibilities: Object.freeze(['intent', 'media inspection', 'storyboard', 'timeline', 'preview', 'repair', 'quality control']),
    provenance: Object.freeze({ sourceKind: 'local' as const, license: 'MIT' as const }),
  }),
  Object.freeze({
    id: 'vertical-short-form',
    version: '1.0.0',
    category: 'short-form',
    description: 'Plans readable 9:16 TikTok, Reels, and Shorts edits with mobile-safe captions and CTA.',
    responsibilities: Object.freeze(['9:16 framing', 'hook pacing', 'safe areas', 'captions', 'CTA']),
    provenance: Object.freeze({ sourceKind: 'local' as const, license: 'MIT' as const }),
  }),
  Object.freeze({
    id: 'gaming-promo',
    version: '1.0.0',
    category: 'gaming',
    description: 'Turns real gameplay into a progression-led promotion without unverified claims or backend names.',
    responsibilities: Object.freeze(['gameplay proof', 'progression', 'visual escalation', 'player-facing language', 'CTA']),
    provenance: Object.freeze({ sourceKind: 'local' as const, license: 'MIT' as const }),
  }),
]);

const DEFINITIONS_BY_ID = new Map(VIDEO_SKILL_DEFINITIONS.map((definition) => [definition.id, definition]));

function boundedText(value: string, label: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64_000 || value.includes('\0')) throw new TypeError(`${label} is invalid`);
  return value;
}

export function getVideoSkillDefinition(id: VideoSkillId): VideoSkillDefinition {
  const definition = DEFINITIONS_BY_ID.get(id);
  if (!definition) throw new Error(`unknown video skill: ${id}`);
  return definition;
}

export function selectVideoSkills(input: {
  readonly intent: string;
  readonly profile: VideoBrandProfile;
  readonly platform?: string;
  readonly width?: number;
  readonly height?: number;
}): VideoSkillSelection {
  const intent = boundedText(input.intent, 'video intent').toLowerCase();
  const platform = (input.platform ?? '').trim().toLowerCase();
  const selected: VideoSkillId[] = ['video-director'];
  const reasons: Partial<Record<VideoSkillId, string>> = {
    'video-director': 'All Video Studio jobs require direction, planning, rendering, and QC.',
  };
  if (platform === 'tiktok' || platform === 'reels' || platform === 'shorts'
    || input.width === 1080 && input.height === 1920
    || /\b(?:tiktok|reels?|shorts?|vertical|9\s*:\s*16)\b/u.test(intent)) {
    selected.push('vertical-short-form');
    reasons['vertical-short-form'] = 'Platform or output format requires a mobile-first vertical edit.';
  }
  if (input.profile.id === 'furycraft' || /\b(?:gaming|gameplay|minecraft|prison|serveur)\b/u.test(intent)) {
    selected.push('gaming-promo');
    reasons['gaming-promo'] = 'Brand or intent describes gameplay promotion.';
  }
  return Object.freeze({
    format: 'furypipe-video-skill-selection/v1',
    selected: Object.freeze(selected),
    reasons: Object.freeze({
      'video-director': reasons['video-director'] ?? '',
      'vertical-short-form': reasons['vertical-short-form'] ?? '',
      'gaming-promo': reasons['gaming-promo'] ?? '',
    }),
    versions: Object.freeze(Object.fromEntries(selected.map((id) => [id, getVideoSkillDefinition(id).version])) as Record<VideoSkillId, string>),
  });
}
