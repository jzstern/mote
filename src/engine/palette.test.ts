import { describe, it, expect } from 'vitest';
import { VOICE_TIMBRE, VOICES, blendVoiceRgb, VOICE_RGB } from './palette';

describe('palette ripple helpers', () => {
  it('defines a 0..1 brightness for every voice', () => {
    for (const v of VOICES) {
      expect(VOICE_TIMBRE[v]).toBeGreaterThanOrEqual(0);
      expect(VOICE_TIMBRE[v]).toBeLessThanOrEqual(1);
    }
  });
  it('blendVoiceRgb averages the two voices channelwise', () => {
    const [r, g, b] = blendVoiceRgb('peach', 'aqua');
    expect(r).toBe(Math.round((VOICE_RGB.peach[0] + VOICE_RGB.aqua[0]) / 2));
    expect(g).toBe(Math.round((VOICE_RGB.peach[1] + VOICE_RGB.aqua[1]) / 2));
    expect(b).toBe(Math.round((VOICE_RGB.peach[2] + VOICE_RGB.aqua[2]) / 2));
  });
});
