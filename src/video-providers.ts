import { createVideoCaptionCues, type VideoCaptionCue, type VideoCaptionStyle } from './video-studio.js';

export type VideoProviderStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'MISCONFIGURED' | 'DEGRADED' | 'OPTIONAL_NOT_INSTALLED' | 'LICENSE_BLOCKED';
export type VideoLicenseStatus = 'PASS' | 'BLOCKED' | 'UNKNOWN' | 'OPTIONAL_NOT_INSTALLED';
export type VideoProviderCapability = 'understanding' | 'scene-detection' | 'asr' | 'tts' | 'music' | 'editing' | 'render' | 'captions' | 'audio-enhancement' | 'upscale' | 'interpolation';

export interface VideoProviderLicenseRecord {
  readonly component: string;
  readonly version: string;
  readonly source: string;
  readonly license: string;
  readonly commercialUse: boolean | null;
  readonly redistribution: boolean | null;
  readonly status: VideoLicenseStatus;
}

export interface VideoProviderDescriptor {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly status: VideoProviderStatus;
  readonly capabilities: readonly VideoProviderCapability[];
  readonly local: boolean;
  readonly license: VideoProviderLicenseRecord;
  readonly reason?: string;
}

export interface VideoProviderRegistry {
  list(): readonly VideoProviderDescriptor[];
  get(id: string): VideoProviderDescriptor | undefined;
  route(capability: VideoProviderCapability): VideoProviderDescriptor | undefined;
  health(): Readonly<Record<string, VideoProviderStatus>>;
}

export interface ScriptCaptionProvider {
  readonly id: 'script-captions';
  create(script: string, durationMs: number, style?: VideoCaptionStyle): readonly VideoCaptionCue[];
}

export interface SilentAudioProvider {
  readonly id: 'silent-audio';
  readonly durationMs: number;
  readonly sampleRate: 48000;
  readonly channels: 2;
}

export interface AudioMixPlan {
  readonly voice?: string;
  readonly music?: string;
  readonly sfx: readonly string[];
  readonly voiceGainDb: 0;
  readonly musicGainDb: -8;
  readonly musicDuckDb: -8;
  readonly limiterCeilingDb: -1;
  readonly targetLoudnessLufs: -14;
  readonly fadeMs: 120;
}

export interface VideoProviderRegistryOptions {
  readonly ffmpegAvailable?: boolean;
  readonly ffprobeAvailable?: boolean;
  readonly installed?: Readonly<Partial<Record<'sceneDetection' | 'asr' | 'tts' | 'music' | 'upscale' | 'interpolation', boolean>>>;
}

function license(input: VideoProviderLicenseRecord): VideoProviderLicenseRecord {
  return Object.freeze(input);
}

function descriptor(input: VideoProviderDescriptor): VideoProviderDescriptor {
  return Object.freeze({ ...input, capabilities: Object.freeze([...input.capabilities]) });
}

export function createScriptCaptionProvider(): ScriptCaptionProvider {
  return Object.freeze({ id: 'script-captions' as const, create: (script: string, durationMs: number, style: VideoCaptionStyle = 'premium-gaming') => createVideoCaptionCues(script, durationMs, style) });
}

export function createSilentAudioProvider(durationMs = 1500): SilentAudioProvider {
  if (!Number.isFinite(durationMs) || durationMs < 1 || durationMs > 7_200_000) throw new RangeError('durationMs is invalid');
  return Object.freeze({ id: 'silent-audio' as const, durationMs: Math.round(durationMs), sampleRate: 48000 as const, channels: 2 as const });
}

export function createAudioMixPlan(input: { readonly voice?: string; readonly music?: string; readonly sfx?: readonly string[] }): AudioMixPlan {
  return Object.freeze({ voice: input.voice, music: input.music, sfx: Object.freeze([...(input.sfx ?? [])]), voiceGainDb: 0 as const, musicGainDb: -8 as const, musicDuckDb: -8 as const, limiterCeilingDb: -1 as const, targetLoudnessLufs: -14 as const, fadeMs: 120 as const });
}

export function createVideoProviderRegistry(options: VideoProviderRegistryOptions = {}): VideoProviderRegistry {
  const ffmpegAvailable = options.ffmpegAvailable === true;
  const ffprobeAvailable = options.ffprobeAvailable === true;
  const installed = options.installed ?? {};
  const providers: VideoProviderDescriptor[] = [
    descriptor({
      id: 'native-ffmpeg', name: 'Native FFmpeg renderer', version: 'system', status: ffmpegAvailable && ffprobeAvailable ? 'AVAILABLE' : 'UNAVAILABLE', capabilities: ['editing', 'render'], local: true,
      license: license({ component: 'FFmpeg host runtime', version: 'system', source: 'https://ffmpeg.org', license: 'build-dependent; LGPL/GPL components vary by build', commercialUse: true, redistribution: false, status: 'PASS' }),
      ...(ffmpegAvailable && ffprobeAvailable ? { reason: 'Uses the host FFmpeg binary; FuryPipe does not bundle it' } : { reason: 'FFmpeg and FFprobe are required' }),
    }),
    descriptor({ id: 'script-captions', name: 'Deterministic script captions', version: '1', status: 'AVAILABLE', capabilities: ['captions'], local: true, license: license({ component: 'FuryPipe caption planner', version: '1', source: 'FuryPipe', license: 'MIT', commercialUse: true, redistribution: true, status: 'PASS' }) }),
    descriptor({ id: 'silent-audio', name: 'Deterministic silent audio track', version: '1', status: 'AVAILABLE', capabilities: ['audio-enhancement'], local: true, license: license({ component: 'FuryPipe silent-audio adapter', version: '1', source: 'FuryPipe', license: 'MIT', commercialUse: true, redistribution: true, status: 'PASS' }) }),
    descriptor({ id: 'local-scene-detection', name: 'Local scene detection adapter', version: 'uninstalled', status: installed.sceneDetection ? 'AVAILABLE' : 'OPTIONAL_NOT_INSTALLED', capabilities: ['scene-detection'], local: true, license: license({ component: 'PySceneDetect', version: 'unverified', source: 'https://github.com/Breakthrough/PySceneDetect', license: 'BSD-3-Clause (dependencies vary)', commercialUse: null, redistribution: null, status: 'UNKNOWN' }), reason: installed.sceneDetection ? 'Review the installed dependency set before distribution' : 'No local scene detector configured' }),
    descriptor({ id: 'local-asr', name: 'Local ASR adapter', version: 'uninstalled', status: installed.asr ? 'AVAILABLE' : 'OPTIONAL_NOT_INSTALLED', capabilities: ['asr', 'captions'], local: true, license: license({ component: 'faster-whisper', version: 'unverified', source: 'https://github.com/SYSTRAN/faster-whisper', license: 'MIT (model licenses vary)', commercialUse: null, redistribution: null, status: 'UNKNOWN' }), reason: installed.asr ? undefined : 'Install and license-check a local ASR model before enabling' }),
    descriptor({ id: 'local-asr-word', name: 'WhisperX word-timestamp adapter', version: 'uninstalled', status: installed.asr ? 'AVAILABLE' : 'OPTIONAL_NOT_INSTALLED', capabilities: ['asr', 'captions'], local: true, license: license({ component: 'WhisperX', version: 'unverified', source: 'https://github.com/m-bain/whisperX', license: 'BSD-2-Clause (model/alignment licenses vary)', commercialUse: null, redistribution: null, status: 'UNKNOWN' }), reason: installed.asr ? 'Review alignment model licenses before enabling' : 'No word-timestamp ASR configured' }),
    descriptor({ id: 'local-tts', name: 'Local TTS adapter', version: 'uninstalled', status: installed.tts ? 'AVAILABLE' : 'OPTIONAL_NOT_INSTALLED', capabilities: ['tts'], local: true, license: license({ component: 'local TTS model', version: 'unverified', source: 'not configured', license: 'unknown', commercialUse: null, redistribution: null, status: 'UNKNOWN' }), reason: installed.tts ? undefined : 'No local TTS model configured' }),
    descriptor({ id: 'chatterbox-multilingual', name: 'Chatterbox multilingual French TTS adapter', version: 'uninstalled', status: 'LICENSE_BLOCKED', capabilities: ['tts'], local: true, license: license({ component: 'Chatterbox Multilingual V3', version: 'unverified', source: 'https://github.com/resemble-ai/chatterbox', license: 'not clearly declared for redistribution', commercialUse: null, redistribution: null, status: 'BLOCKED' }), reason: 'French support is documented, but current repository licensing is not clear enough for a default production provider' }),
    descriptor({ id: 'local-music', name: 'Local music adapter', version: 'uninstalled', status: installed.music ? 'AVAILABLE' : 'OPTIONAL_NOT_INSTALLED', capabilities: ['music'], local: true, license: license({ component: 'local music model', version: 'unverified', source: 'not configured', license: 'unknown', commercialUse: null, redistribution: null, status: 'UNKNOWN' }), reason: installed.music ? undefined : 'No local music model configured' }),
    descriptor({ id: 'ace-step', name: 'ACE-Step local music adapter', version: 'uninstalled', status: 'OPTIONAL_NOT_INSTALLED', capabilities: ['music'], local: true, license: license({ component: 'ACE-Step', version: 'unverified', source: 'https://github.com/ace-step/ACE-Step', license: 'Apache-2.0 code; checkpoint/dependency review required', commercialUse: null, redistribution: null, status: 'UNKNOWN' }), reason: 'Optional local music generation; model and dependency licenses must be checked per install' }),
    descriptor({ id: 'local-upscale', name: 'Optional local upscaler', version: 'uninstalled', status: installed.upscale ? 'AVAILABLE' : 'OPTIONAL_NOT_INSTALLED', capabilities: ['upscale'], local: true, license: license({ component: 'upscaler', version: 'unverified', source: 'not configured', license: 'unknown', commercialUse: null, redistribution: null, status: 'UNKNOWN' }) }),
    descriptor({ id: 'local-interpolation', name: 'Optional local interpolation', version: 'uninstalled', status: installed.interpolation ? 'AVAILABLE' : 'OPTIONAL_NOT_INSTALLED', capabilities: ['interpolation'], local: true, license: license({ component: 'interpolation model', version: 'unverified', source: 'not configured', license: 'unknown', commercialUse: null, redistribution: null, status: 'UNKNOWN' }) }),
    descriptor({ id: 'moneyprinterturbo', name: 'MoneyPrinterTurbo adapter', version: '1.3.7', status: 'OPTIONAL_NOT_INSTALLED', capabilities: ['editing', 'render', 'tts', 'asr', 'music'], local: true, license: license({ component: 'MoneyPrinterTurbo', version: '1.3.7', source: 'https://github.com/harry0703/MoneyPrinterTurbo', license: 'MIT (models and dependency licenses vary)', commercialUse: null, redistribution: null, status: 'UNKNOWN' }), reason: 'Optional isolated adapter; not a FuryPipe runtime dependency' }),
  ];
  const byId = new Map(providers.map((provider) => [provider.id, provider]));
  return Object.freeze({
    list: () => Object.freeze([...providers]),
    get: (id: string) => byId.get(id),
    route: (capability: VideoProviderCapability) => providers.find((provider) => (provider.status === 'AVAILABLE' || provider.status === 'DEGRADED') && provider.license.status === 'PASS' && provider.capabilities.includes(capability)),
    health: () => Object.freeze(Object.fromEntries(providers.map((provider) => [provider.id, provider.status]))),
  });
}
