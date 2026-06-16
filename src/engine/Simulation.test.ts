import { describe, it, expect } from 'vitest';
import { Simulation, type SimConfig } from './Simulation';
import { mulberry32 } from './rng';
import type { RippleRing } from './ripple';

const cfg = (over: Partial<SimConfig> = {}): SimConfig => ({
  width: 800, height: 600, maxParticles: 50,
  sporeIntervalSec: 5, speedMul: 1, sporesEnabled: false,
  rippleEnabled: false, rippleEmitIntervalSec: 5, ringLifespanSec: 3, ringMaxRadius: 200, maxRings: 28,
  ...over,
});

describe('Simulation', () => {
  it('spawn adds a particle and returns a born event', () => {
    const s = new Simulation(cfg(), mulberry32(1));
    const ev = s.spawn(100, 100, 0, 0);
    expect(s.particles.length).toBe(1);
    expect(ev?.type).toBe('born');
  });

  it('integrates position by velocity * speedMul * dt (no walls hit)', () => {
    const s = new Simulation(cfg(), mulberry32(1));
    s.spawn(400, 300, 10, 0);
    s.step(1);
    expect(s.particles[0].pos.x).toBeCloseTo(410);
  });

  it('bounces off a wall, flipping velocity and emitting a bounce', () => {
    const s = new Simulation(cfg(), mulberry32(1));
    s.spawn(5, 300, -100, 0);   // heading into the left wall
    const events = s.step(0.5);
    expect(s.particles[0].vel.x).toBeGreaterThan(0);
    expect(events.some(e => e.type === 'bounce')).toBe(true);
  });

  it('removes a particle past its lifespan and emits death', () => {
    const s = new Simulation(cfg(), mulberry32(1));
    s.spawn(400, 300, 0, 0);
    s.particles[0].lifespan = 1;
    const events = s.step(2);
    expect(s.particles.length).toBe(0);
    expect(events.some(e => e.type === 'death')).toBe(true);
  });

  it('spawns spores when enabled, respecting maxParticles', () => {
    const s = new Simulation(cfg({ sporesEnabled: true, sporeIntervalSec: 0.1, maxParticles: 3 }), mulberry32(5));
    for (let i = 0; i < 50; i++) s.step(0.1);
    expect(s.particles.length).toBeLessThanOrEqual(3);
    expect(s.particles.length).toBeGreaterThan(0);
  });

  it('does not emit repeated bounces within the cooldown window', () => {
    const s = new Simulation(cfg(), mulberry32(1));
    s.spawn(5, 300, -100, 0);
    const first = s.step(0.05).filter(e => e.type === 'bounce').length;
    const second = s.step(0.05).filter(e => e.type === 'bounce').length; // still in cooldown
    expect(first).toBe(1);
    expect(second).toBe(0);
  });
});

describe('Simulation ripples', () => {
  const crossingRing = (over: Partial<RippleRing>): RippleRing =>
    ({ id: 1, x: 0, y: 0, size: 20, voice: 'peach', age: 0, ...over });

  it('emits a ring after the emit interval when enabled', () => {
    const s = new Simulation(cfg({ rippleEnabled: true, rippleEmitIntervalSec: 1 }), mulberry32(1));
    s.spawn(400, 300, 0, 0);
    for (let i = 0; i < 20; i++) s.step(0.1); // 2s elapsed > max first interval (1.3s)
    expect(s.ripples.length).toBeGreaterThan(0);
  });

  it('never exceeds maxRings active rings', () => {
    const s = new Simulation(cfg({ rippleEnabled: true, rippleEmitIntervalSec: 0.1, ringLifespanSec: 1000, maxRings: 5 }), mulberry32(2));
    for (let i = 0; i < 20; i++) s.spawn(100 + i, 100, 0, 0);
    for (let i = 0; i < 100; i++) s.step(0.1);
    expect(s.ripples.length).toBeLessThanOrEqual(5);
  });

  it('emits exactly one ring-cross for a crossing pair, then dedupes', () => {
    const s = new Simulation(cfg({ rippleEnabled: true, rippleEmitIntervalSec: 1000, ringLifespanSec: 10, ringMaxRadius: 100 }), mulberry32(3));
    // radius = 100*(age/10) = 10*age; centers 150 apart, equal radii cross once 2r>=150 (age>=7.5)
    s.ripples.push(crossingRing({ id: 1, x: 100, y: 300, age: 8, voice: 'peach' }));
    s.ripples.push(crossingRing({ id: 2, x: 250, y: 300, age: 8, voice: 'aqua' }));
    const first = s.step(0.001).filter(e => e.type === 'ring-cross');
    const second = s.step(0.001).filter(e => e.type === 'ring-cross');
    expect(first.length).toBe(1);
    expect(first[0]).toMatchObject({ type: 'ring-cross', voiceA: 'peach', voiceB: 'aqua' });
    expect(second.length).toBe(0);
    expect(s.rippleOverlaps.length).toBeGreaterThan(0);
  });

  it('clear() also removes active ripples', () => {
    const s = new Simulation(cfg({ rippleEnabled: true }), mulberry32(7));
    s.ripples.push(crossingRing({ id: 1, x: 100, y: 100, age: 0 }));
    s.clear();
    expect(s.ripples.length).toBe(0);
  });

  it('produces no ring-cross for well-separated rings', () => {
    const s = new Simulation(cfg({ rippleEnabled: true, rippleEmitIntervalSec: 1000, ringLifespanSec: 10, ringMaxRadius: 20 }), mulberry32(4));
    s.ripples.push(crossingRing({ id: 1, x: 50, y: 50, age: 5 }));
    s.ripples.push(crossingRing({ id: 2, x: 700, y: 550, age: 5 }));
    expect(s.step(0.001).filter(e => e.type === 'ring-cross').length).toBe(0);
  });

  it('removes a ring after its lifespan', () => {
    const s = new Simulation(cfg({ rippleEnabled: true, rippleEmitIntervalSec: 1000, ringLifespanSec: 1 }), mulberry32(5));
    s.ripples.push(crossingRing({ id: 1, x: 100, y: 100, age: 0 }));
    s.step(2);
    expect(s.ripples.length).toBe(0);
  });

  it('emits nothing when ripple is disabled', () => {
    const s = new Simulation(cfg({ rippleEnabled: false, rippleEmitIntervalSec: 0.1 }), mulberry32(6));
    s.spawn(400, 300, 0, 0);
    for (let i = 0; i < 50; i++) s.step(0.1);
    expect(s.ripples.length).toBe(0);
  });
});
