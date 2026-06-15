import { describe, it, expect } from 'vitest';
import { pitchFor, scaleNotes, ROOT_MIDI, OCTAVE_SPAN } from './scale';
import type { Mood } from './types';

const MOODS: Mood[] = ['warm', 'dream', 'dusk', 'mist'];
const H = 600;
const pc = (midi: number) => (((midi - ROOT_MIDI) % 12) + 12) % 12;

describe('pitchFor', () => {
  it('only ever returns pitches whose pitch-class is in the active scale', () => {
    for (const mood of MOODS) {
      const allowed = new Set(scaleNotes(mood));
      for (let y = 0; y <= H; y += 10) {
        for (const size of [16, 40, 64]) {
          const midi = pitchFor(mood, { y, height: H, size, speed: 0 });
          expect(allowed.has(pc(midi))).toBe(true);
        }
      }
    }
  });
  it('maps higher-on-screen (smaller y) to >= pitch (monotonic), size fixed', () => {
    let prev = -Infinity;
    for (let y = H; y >= 0; y -= 5) {
      const midi = pitchFor('warm', { y, height: H, size: 40, speed: 0 });
      expect(midi).toBeGreaterThanOrEqual(prev);
      prev = midi;
    }
  });
  it('stays within the mapped octave range', () => {
    for (let y = 0; y <= H; y += 5) {
      const midi = pitchFor('dream', { y, height: H, size: 40, speed: 0 });
      expect(midi).toBeGreaterThanOrEqual(ROOT_MIDI);
      expect(midi).toBeLessThanOrEqual(ROOT_MIDI + OCTAVE_SPAN * 12);
    }
  });
  it('different moods can produce different pitch sets', () => {
    expect(scaleNotes('warm')).not.toEqual(scaleNotes('dusk'));
  });
});
