import { describe, it, expect } from 'vitest';
import { ringRadius, circleIntersection, type RippleRing } from './ripple';

const ring = (over: Partial<RippleRing> = {}): RippleRing => ({
  id: 1, x: 0, y: 0, size: 20, voice: 'peach', age: 0, ...over,
});

describe('ringRadius', () => {
  it('is 0 at birth, half at mid-life, max at/after end', () => {
    expect(ringRadius(ring({ age: 0 }), 10, 100)).toBe(0);
    expect(ringRadius(ring({ age: 5 }), 10, 100)).toBeCloseTo(50);
    expect(ringRadius(ring({ age: 10 }), 10, 100)).toBeCloseTo(100);
    expect(ringRadius(ring({ age: 99 }), 10, 100)).toBeCloseTo(100); // clamped
  });
});

describe('circleIntersection', () => {
  it('returns null when the circles are too far apart', () => {
    expect(circleIntersection(0, 0, 1, 10, 0, 1)).toBeNull();
  });
  it('returns null when one circle is nested inside the other', () => {
    expect(circleIntersection(0, 0, 5, 1, 0, 1)).toBeNull();
  });
  it('returns null when the circles are concentric', () => {
    expect(circleIntersection(0, 0, 5, 0, 0, 3)).toBeNull();
  });
  it('returns one coincident point at external tangency', () => {
    const hit = circleIntersection(0, 0, 1, 2, 0, 1);
    expect(hit).not.toBeNull();
    expect(hit!.p0.x).toBeCloseTo(1); expect(hit!.p0.y).toBeCloseTo(0);
    expect(hit!.p1.x).toBeCloseTo(1); expect(hit!.p1.y).toBeCloseTo(0);
    expect(hit!.mid.x).toBeCloseTo(1); expect(hit!.mid.y).toBeCloseTo(0);
  });
  it('returns two symmetric points when the outlines cross', () => {
    const hit = circleIntersection(0, 0, 2, 2, 0, 2);
    expect(hit).not.toBeNull();
    expect(hit!.mid.x).toBeCloseTo(1); expect(hit!.mid.y).toBeCloseTo(0);
    const ys = [hit!.p0.y, hit!.p1.y].sort((a, b) => a - b);
    expect(ys[0]).toBeCloseTo(-Math.sqrt(3));
    expect(ys[1]).toBeCloseTo(Math.sqrt(3));
    expect(hit!.p0.x).toBeCloseTo(1); expect(hit!.p1.x).toBeCloseTo(1);
  });
});
