import { describe, expect, it } from 'vitest';
import {
  createAudioMixPlan,
  createScriptCaptionProvider,
  createSilentAudioProvider,
  createVideoProviderRegistry,
} from '../src/video-providers.js';

describe('video provider registry', () => {
  it('routes local render and caption capabilities to healthy providers', () => {
    const registry = createVideoProviderRegistry({ ffmpegAvailable: true, ffprobeAvailable: true });
    expect(registry.get('native-ffmpeg')?.status).toBe('AVAILABLE');
    expect(registry.route('render')?.id).toBe('native-ffmpeg');
    expect(registry.route('captions')?.id).toBe('script-captions');
    expect(registry.list().every((provider) => provider.license.status !== 'BLOCKED' || provider.status !== 'AVAILABLE')).toBe(true);
  });

  it('does not route an unavailable local renderer', () => {
    const registry = createVideoProviderRegistry({ ffmpegAvailable: false, ffprobeAvailable: false });
    expect(registry.route('render')).toBeUndefined();
    expect(registry.get('native-ffmpeg')?.status).toBe('UNAVAILABLE');
  });

  it('creates deterministic caption and silent-audio provider outputs', () => {
    const captions = createScriptCaptionProvider();
    expect(captions.id).toBe('script-captions');
    expect(captions.create('One. Two.', 2000, 'clean')).toHaveLength(2);

    const silent = createSilentAudioProvider();
    expect(silent.id).toBe('silent-audio');
    expect(silent.durationMs).toBe(1500);

    const mix = createAudioMixPlan({ voice: 'voice.wav', music: 'music.wav', sfx: ['hit.wav'] });
    expect(mix.voiceGainDb).toBe(0);
    expect(mix.musicGainDb).toBe(-8);
    expect(mix.limiterCeilingDb).toBe(-1);
  });
});
