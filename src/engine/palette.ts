import type { VoiceType } from './types';

export const VOICES: readonly VoiceType[] = ['peach', 'gold', 'rose', 'lilac', 'aqua', 'sky'];

export const VOICE_RGB: Record<VoiceType, [number, number, number]> = {
  peach: [255, 183, 138],
  gold:  [255, 214, 140],
  rose:  [255, 150, 170],
  lilac: [190, 170, 255],
  aqua:  [150, 225, 220],
  sky:   [150, 190, 255],
};

// brightness scalar per voice (warm/low -> cool/bright); drives the ripple blend
export const VOICE_TIMBRE: Record<VoiceType, number> = {
  peach: 0.35, gold: 0.5, rose: 0.45, lilac: 0.6, aqua: 0.7, sky: 0.8,
};

export function blendVoiceRgb(a: VoiceType, b: VoiceType): [number, number, number] {
  const ra = VOICE_RGB[a], rb = VOICE_RGB[b];
  return [
    Math.round((ra[0] + rb[0]) / 2),
    Math.round((ra[1] + rb[1]) / 2),
    Math.round((ra[2] + rb[2]) / 2),
  ];
}
