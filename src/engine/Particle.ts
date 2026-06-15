import type { Vec2, VoiceType } from './types';

export interface Particle {
  id: number;
  pos: Vec2;
  vel: Vec2;          // px / second
  size: number;       // diameter
  age: number;        // seconds
  lifespan: number;   // seconds
  voice: VoiceType;
  bounceCooldown: number; // seconds until it may emit another bounce event
}

export function speedOf(p: Particle): number { return Math.hypot(p.vel.x, p.vel.y); }
export function lifePhase(p: Particle): number { return Math.min(1, p.age / p.lifespan); }
