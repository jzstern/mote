import type { Vec2, VoiceType } from './types';

export interface RippleRing {
  id: number;
  x: number; y: number;   // fixed center (emission point)
  size: number;           // emitter diameter — register bias on a crossing
  voice: VoiceType;
  age: number;            // seconds
}

export interface RippleOverlap {
  x: number; y: number;
  voiceA: VoiceType; voiceB: VoiceType;
}

export interface RingIntersection { p0: Vec2; p1: Vec2; mid: Vec2; }

export function ringRadius(ring: RippleRing, lifespan: number, maxRadius: number): number {
  const t = ring.age / lifespan;
  return maxRadius * (t < 0 ? 0 : t > 1 ? 1 : t);
}

export function circleIntersection(
  x0: number, y0: number, r0: number,
  x1: number, y1: number, r1: number,
): RingIntersection | null {
  const dx = x1 - x0, dy = y1 - y0;
  const d = Math.hypot(dx, dy);
  if (d === 0) return null;                  // concentric: no distinct crossing
  if (d > r0 + r1) return null;              // too far apart
  if (d < Math.abs(r0 - r1)) return null;    // one nested inside the other
  const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r0 * r0 - a * a));
  const ux = dx / d, uy = dy / d;            // unit vector center→center
  const mx = x0 + a * ux, my = y0 + a * uy;  // chord midpoint
  const nx = -uy, ny = ux;                   // perpendicular unit
  return {
    p0: { x: mx + h * nx, y: my + h * ny },
    p1: { x: mx - h * nx, y: my - h * ny },
    mid: { x: mx, y: my },
  };
}
