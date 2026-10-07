import { describe, expect, it } from 'vitest';
import { FURYCRAFT_VIDEO_PROFILE } from '../src/video-studio.js';
import { getVideoSkillDefinition, selectVideoSkills } from '../src/video-skills.js';

describe('video skill routing', () => {
  it('selects director, vertical, and gaming skills for a FuryCraft TikTok', () => {
    const selection = selectVideoSkills({
      intent: 'Create a professional FuryCraft Minecraft gameplay TikTok',
      profile: FURYCRAFT_VIDEO_PROFILE,
      platform: 'tiktok',
      width: 1080,
      height: 1920,
    });
    expect(selection.selected).toEqual(['video-director', 'vertical-short-form', 'gaming-promo']);
    expect(selection.versions['video-director']).toBe('1.0.0');
  });

  it('keeps a generic landscape job on the director skill only', () => {
    const selection = selectVideoSkills({
      intent: 'Make a documentary cut',
      profile: { id: 'generic', name: 'Generic', language: 'en-US', defaultCta: 'Learn more', forbiddenTerms: [], playerFacingTerms: {} },
      platform: 'web',
      width: 1920,
      height: 1080,
    });
    expect(selection.selected).toEqual(['video-director']);
  });

  it('exposes bounded local provenance for each selected skill', () => {
    expect(getVideoSkillDefinition('gaming-promo')).toMatchObject({
      version: '1.0.0',
      provenance: { sourceKind: 'local', license: 'MIT' },
    });
  });
});
