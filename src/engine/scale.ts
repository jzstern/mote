import type { Mood } from './types';

export const ROOT_MIDI = 57;   // A3 — warm low root; tune by ear later
export const OCTAVE_SPAN = 3;  // octaves mapped across the vertical axis

const SCALES: Record<Mood, number[]> = {
  warm:  [0, 2, 4, 7, 9],          // major pentatonic
  dream: [0, 2, 4, 6, 7, 9, 11],   // lydian
  dusk:  [0, 3, 5, 7, 10],         // minor pentatonic
  mist:  [0, 1, 5, 7, 8],          // in-sen / hirajoshi flavour
};

export interface PitchInput { y: number; height: number; size: number; speed: number; }

export function scaleNotes(mood: Mood): number[] { return SCALES[mood]; }

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function pitchFor(mood: Mood, input: PitchInput): number {
  const offsets = SCALES[mood];
  const degrees = offsets.length * OCTAVE_SPAN;
  const vertical = clamp01(1 - input.y / input.height);          // top => 1 => high
  const sizeBias = clamp01(input.size / 120);                    // bigger => lower
  const pos = clamp01(vertical * 0.85 + (1 - sizeBias) * 0.15);
  const degreeIndex = Math.round(pos * (degrees - 1));
  const octave = Math.floor(degreeIndex / offsets.length);
  const within = degreeIndex % offsets.length;
  return ROOT_MIDI + octave * 12 + offsets[within];
}
