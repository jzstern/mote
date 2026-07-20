import { describe, it, expect } from 'vitest';
import { floatToInt16, interleave, encodeWavBuffer } from './wav';

const readString = (view: DataView, offset: number, length: number) =>
  Array.from({ length }, (_, i) => String.fromCharCode(view.getUint8(offset + i))).join('');

describe('floatToInt16', () => {
  it('maps silence to zero', () => {
    // #when
    const out = floatToInt16(new Float32Array([0]));
    // #then
    expect(out[0]).toBe(0);
  });

  it('maps full positive scale to INT16 max', () => {
    // #when
    const out = floatToInt16(new Float32Array([1]));
    // #then
    expect(out[0]).toBe(32767);
  });

  it('maps full negative scale to INT16 min', () => {
    // #when
    const out = floatToInt16(new Float32Array([-1]));
    // #then
    expect(out[0]).toBe(-32768);
  });

  it('clamps values above 1 instead of wrapping', () => {
    // #when
    const out = floatToInt16(new Float32Array([2.5]));
    // #then
    expect(out[0]).toBe(32767);
  });

  it('clamps values below -1 instead of wrapping', () => {
    // #when
    const out = floatToInt16(new Float32Array([-2.5]));
    // #then
    expect(out[0]).toBe(-32768);
  });
});

describe('interleave', () => {
  it('returns empty for no channels', () => {
    // #then
    expect(interleave([]).length).toBe(0);
  });

  it('passes a single channel through unchanged', () => {
    // #given
    const mono = new Float32Array([1, 2, 3]);
    // #then
    expect(Array.from(interleave([mono]))).toEqual([1, 2, 3]);
  });

  it('weaves stereo frames L/R/L/R', () => {
    // #given
    const left = new Float32Array([1, 2, 3]);
    const right = new Float32Array([4, 5, 6]);
    // #when
    const out = interleave([left, right]);
    // #then
    expect(Array.from(out)).toEqual([1, 4, 2, 5, 3, 6]);
  });
});

describe('encodeWavBuffer', () => {
  // #given
  const pcm = new Int16Array([0, 100, -100, 32767]);
  const sampleRate = 48000;
  const channels = 2;
  const view = new DataView(encodeWavBuffer(pcm, sampleRate, channels));

  it('starts with the RIFF magic', () => {
    // #then
    expect(readString(view, 0, 4)).toBe('RIFF');
  });

  it('declares the WAVE format', () => {
    // #then
    expect(readString(view, 8, 4)).toBe('WAVE');
  });

  it('writes PCM audio format (1)', () => {
    // #then
    expect(view.getUint16(20, true)).toBe(1);
  });

  it('records the channel count', () => {
    // #then
    expect(view.getUint16(22, true)).toBe(channels);
  });

  it('records the sample rate', () => {
    // #then
    expect(view.getUint32(24, true)).toBe(sampleRate);
  });

  it('computes the byte rate as sampleRate * channels * 2', () => {
    // #then
    expect(view.getUint32(28, true)).toBe(sampleRate * channels * 2);
  });

  it('computes the block align as channels * 2', () => {
    // #then
    expect(view.getUint16(32, true)).toBe(channels * 2);
  });

  it('declares 16 bits per sample', () => {
    // #then
    expect(view.getUint16(34, true)).toBe(16);
  });

  it('sizes the data chunk to the PCM byte length', () => {
    // #then
    expect(view.getUint32(40, true)).toBe(pcm.length * 2);
  });

  it('sizes the RIFF chunk to 36 + data bytes', () => {
    // #then
    expect(view.getUint32(4, true)).toBe(36 + pcm.length * 2);
  });

  it('produces a buffer of header + data length', () => {
    // #then
    expect(view.byteLength).toBe(44 + pcm.length * 2);
  });

  it('round-trips the PCM samples after the header', () => {
    // #then
    expect(view.getInt16(44 + 3 * 2, true)).toBe(32767);
  });
});
