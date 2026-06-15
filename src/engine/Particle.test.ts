import { describe, it, expect } from 'vitest';
import { speedOf, lifePhase, type Particle } from './Particle';

const make = (over: Partial<Particle> = {}): Particle => ({
  id: 1, pos: { x: 0, y: 0 }, vel: { x: 3, y: 4 }, size: 30,
  age: 0, lifespan: 20, voice: 'peach', bounceCooldown: 0, ...over,
});

describe('Particle helpers', () => {
  it('speedOf returns vector magnitude', () => {
    expect(speedOf(make())).toBeCloseTo(5);
  });
  it('lifePhase goes 0 -> 1 and clamps', () => {
    expect(lifePhase(make({ age: 0 }))).toBe(0);
    expect(lifePhase(make({ age: 10, lifespan: 20 }))).toBeCloseTo(0.5);
    expect(lifePhase(make({ age: 99, lifespan: 20 }))).toBe(1);
  });
});
