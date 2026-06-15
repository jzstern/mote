import { describe, it, expect } from 'vitest';
import { mulberry32, randRange } from './rng';

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42); const b = mulberry32(42);
    const seqA = [a(), a(), a()]; const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });
  it('returns values in [0, 1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
  it('different seeds diverge', () => {
    expect(mulberry32(1)()).not.toEqual(mulberry32(2)());
  });
  it('randRange stays within bounds', () => {
    const r = mulberry32(99);
    for (let i = 0; i < 1000; i++) { const v = randRange(r, 5, 9); expect(v).toBeGreaterThanOrEqual(5); expect(v).toBeLessThan(9); }
  });
});
