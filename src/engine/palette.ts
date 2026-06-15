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
