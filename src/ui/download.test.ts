import { describe, it, expect } from 'vitest';
import { recordingFilename } from './download';

describe('recordingFilename', () => {
  it('formats the local timestamp as mote-YYYY-MM-DD_HH-MM-SS.wav', () => {
    // #given
    const date = new Date(2026, 6, 20, 14, 32, 8);
    // #then
    expect(recordingFilename(date)).toBe('mote-2026-07-20_14-32-08.wav');
  });

  it('zero-pads single-digit month, day, and time parts', () => {
    // #given
    const date = new Date(2026, 0, 5, 9, 4, 3);
    // #then
    expect(recordingFilename(date)).toBe('mote-2026-01-05_09-04-03.wav');
  });

  it('always ends with the .wav extension', () => {
    // #given
    const date = new Date(2026, 11, 31, 23, 59, 59);
    // #then
    expect(recordingFilename(date).endsWith('.wav')).toBe(true);
  });
});
