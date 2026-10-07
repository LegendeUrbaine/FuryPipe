import { describe, expect, it } from 'vitest';
import {
  FURYCRAFT_VIDEO_PROFILE,
  createGenericVideoProfile,
  createVideoCaptionCues,
  createVideoHookVariants,
  createVideoRecipe,
  createVideoStoryboard,
  lintFuryCraftPublicContent,
  renderVideoCaptionsSrt,
  validateVideoProjectInput,
} from '../src/video-studio.js';

describe('video studio domain contracts', () => {
  it('accepts a bounded local project and rejects traversal', () => {
    expect(validateVideoProjectInput({
      projectId: 'demo-project',
      title: 'FuryCraft demo',
      sourcePaths: ['rush.mp4'],
      targetDurationSeconds: 20,
      width: 1080,
      height: 1920,
      fps: 60,
      brand: 'furycraft',
      platform: 'tiktok',
    })).toMatchObject({ projectId: 'demo-project', sourcePaths: ['rush.mp4'] });

    expect(() => validateVideoProjectInput({
      projectId: 'bad-project',
      title: 'bad',
      sourcePaths: ['../secret.mp4'],
    })).toThrow(/source path/i);
  });

  it('creates readable timed captions and deterministic SRT', () => {
    const cues = createVideoCaptionCues(
      'Mine plus vite. Débloque ta pioche évolutive. Rejoins FuryCraft.',
      9000,
      'premium-gaming',
    );
    expect(cues.length).toBeGreaterThan(1);
    expect(cues.every((cue) => cue.startMs < cue.endMs)).toBe(true);
    expect(cues.every((cue) => cue.text.length <= 64)).toBe(true);
    expect(renderVideoCaptionsSrt(cues)).toContain('00:00:00,000 -->');
  });

  it('blocks internal implementation names and unsupported claims', () => {
    const failed = lintFuryCraftPublicContent({
      title: 'Le meilleur serveur',
      script: 'FuryCore donne accès à FuryPickaxes. Plus de 1000 joueurs.',
      captions: ['Rejoins le serveur #1'],
      overlays: ['Nexo'],
      cta: 'play.furycraft.fr',
    });
    expect(failed.status).toBe('FAIL');
    expect(failed.violations.map((item) => item.term)).toEqual(expect.arrayContaining([
      'FuryCore', 'FuryPickaxes', 'Nexo', '#1',
    ]));
    expect(failed.violations[0]?.suggestion).toBeTruthy();

    const passed = lintFuryCraftPublicContent({
      title: 'Passe au niveau supérieur',
      script: 'Mine, améliore ta pioche et grimpe les prestiges.',
      captions: ['Rejoins FuryCraft'],
      overlays: ['play.furycraft.fr'],
      cta: 'FuryCraft · play.furycraft.fr',
    });
    expect(passed.status).toBe('PASS');
  });

  it('builds a storyboard, meaningful hooks, and a reusable recipe', () => {
    const storyboard = createVideoStoryboard({
      sourcePaths: ['mine.mp4', 'rank.mp4'],
      durationMs: 20000,
      profile: FURYCRAFT_VIDEO_PROFILE,
    });
    expect(storyboard.shots.length).toBeGreaterThanOrEqual(3);
    expect(storyboard.shots[0]?.purpose).toBe('hook');
    expect(storyboard.shots.at(-1)?.purpose).toBe('cta');
    expect(storyboard.shots.every((shot) => shot.endMs > shot.startMs)).toBe(true);

    const variants = createVideoHookVariants(storyboard, FURYCRAFT_VIDEO_PROFILE);
    expect(variants).toHaveLength(3);
    expect(new Set(variants.map((variant) => variant.openingShotId)).size).toBeGreaterThan(1);
    expect(new Set(variants.map((variant) => variant.firstLine)).size).toBe(3);

    const recipe = createVideoRecipe({
      profile: FURYCRAFT_VIDEO_PROFILE,
      platform: 'tiktok',
      durationSeconds: 20,
      captionStyle: 'premium-gaming',
      voiceProvider: 'none',
      musicProvider: 'none',
      editingProvider: 'native-ffmpeg',
    });
    expect(recipe.brand).toBe('furycraft');
    expect(recipe.platform).toBe('tiktok');
    expect(recipe.editingProvider).toBe('native-ffmpeg');
  });

  it('supports generic profiles without FuryCraft-specific policy', () => {
    const profile = createGenericVideoProfile({
      id: 'creator-demo',
      name: 'Creator Demo',
      language: 'en-US',
      defaultCta: 'Subscribe',
    });
    expect(profile.id).toBe('creator-demo');
    expect(profile.defaultCta).toBe('Subscribe');
    expect(profile.forbiddenTerms).toEqual([]);
  });
});
