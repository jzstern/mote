import type { LifeEvent, MusicalEvent } from './types';
import { speedOf, type Particle } from './Particle';
import { type Rng, randRange, pick } from './rng';
import { VOICES } from './palette';

export interface SimConfig {
  width: number;
  height: number;
  maxParticles: number;
  sporeIntervalSec: number;
  speedMul: number;       // driven by the "drift" knob
  sporesEnabled: boolean;
}

const BOUNCE_COOLDOWN = 0.12;

export class Simulation {
  particles: Particle[] = [];
  private nextId = 1;
  private sporeTimer = 0;

  constructor(private cfg: SimConfig, private rng: Rng) {}

  setConfig(patch: Partial<SimConfig>) { Object.assign(this.cfg, patch); }

  spawn(x: number, y: number, vx: number, vy: number): MusicalEvent | null {
    if (this.particles.length >= this.cfg.maxParticles) this.removeOldest();
    const p: Particle = {
      id: this.nextId++,
      pos: { x, y }, vel: { x: vx, y: vy },
      size: randRange(this.rng, 14, 64),
      age: 0,
      lifespan: randRange(this.rng, 18, 42),
      voice: pick(this.rng, VOICES),
      bounceCooldown: 0,
    };
    this.particles.push(p);
    return this.event('born', p);
  }

  step(dt: number): MusicalEvent[] {
    const events: MusicalEvent[] = [];
    const { width, height, speedMul } = this.cfg;

    if (this.cfg.sporesEnabled) {
      this.sporeTimer -= dt;
      if (this.sporeTimer <= 0) {
        this.sporeTimer = this.cfg.sporeIntervalSec * randRange(this.rng, 0.6, 1.4);
        if (this.particles.length < this.cfg.maxParticles) {
          const ang = randRange(this.rng, 0, Math.PI * 2);
          const sp = randRange(this.rng, 8, 26);
          const ev = this.spawn(
            randRange(this.rng, 40, width - 40),
            randRange(this.rng, 40, height - 40),
            Math.cos(ang) * sp, Math.sin(ang) * sp,
          );
          if (ev) events.push(ev);
        }
      }
    }

    for (const p of this.particles) {
      p.bounceCooldown = Math.max(0, p.bounceCooldown - dt);
      p.pos.x += p.vel.x * speedMul * dt;
      p.pos.y += p.vel.y * speedMul * dt;
      const r = p.size * 0.5;
      if (p.pos.x < r) { p.pos.x = r; p.vel.x = Math.abs(p.vel.x); this.maybeBounce(p, events); }
      else if (p.pos.x > width - r) { p.pos.x = width - r; p.vel.x = -Math.abs(p.vel.x); this.maybeBounce(p, events); }
      if (p.pos.y < r) { p.pos.y = r; p.vel.y = Math.abs(p.vel.y); this.maybeBounce(p, events); }
      else if (p.pos.y > height - r) { p.pos.y = height - r; p.vel.y = -Math.abs(p.vel.y); this.maybeBounce(p, events); }
    }

    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const a = this.particles[i], b = this.particles[j];
        const dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y;
        const dist = Math.hypot(dx, dy);
        const minD = (a.size + b.size) * 0.5;
        if (dist > 0 && dist < minD) {
          const nx = dx / dist, ny = dy / dist;
          const overlap = (minD - dist) * 0.5;
          a.pos.x -= nx * overlap; a.pos.y -= ny * overlap;
          b.pos.x += nx * overlap; b.pos.y += ny * overlap;
          const av = a.vel.x * nx + a.vel.y * ny;
          const bv = b.vel.x * nx + b.vel.y * ny;
          const diff = bv - av;
          a.vel.x += nx * diff; a.vel.y += ny * diff;
          b.vel.x -= nx * diff; b.vel.y -= ny * diff;
          this.maybeBounce(a, events); this.maybeBounce(b, events);
        }
      }
    }

    for (const p of this.particles) p.age += dt;

    const survivors: Particle[] = [];
    for (const p of this.particles) {
      if (p.age >= p.lifespan) events.push(this.event('death', p));
      else survivors.push(p);
    }
    this.particles = survivors;
    return events;
  }

  clear(): MusicalEvent[] {
    const evs = this.particles.map(p => this.event('death', p));
    this.particles = [];
    return evs;
  }

  private maybeBounce(p: Particle, events: MusicalEvent[]) {
    if (p.bounceCooldown > 0) return;
    p.bounceCooldown = BOUNCE_COOLDOWN;
    events.push(this.event('bounce', p));
  }

  private removeOldest() {
    let idx = 0, frac = -1;
    for (let i = 0; i < this.particles.length; i++) {
      const f = this.particles[i].age / this.particles[i].lifespan;
      if (f > frac) { frac = f; idx = i; }
    }
    this.particles.splice(idx, 1);
  }

  private event(type: LifeEvent['type'], p: Particle): LifeEvent {
    return { type, particleId: p.id, x: p.pos.x, y: p.pos.y, size: p.size, speed: speedOf(p), voice: p.voice };
  }
}
