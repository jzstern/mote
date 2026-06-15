import { describe, it, expect } from 'vitest';
import { Simulation, type SimConfig } from './Simulation';
import { mulberry32 } from './rng';

const cfg = (over: Partial<SimConfig> = {}): SimConfig => ({
  width: 800, height: 600, maxParticles: 50,
  sporeIntervalSec: 5, speedMul: 1, sporesEnabled: false, ...over,
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
