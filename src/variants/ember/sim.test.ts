import { describe, expect, it } from 'vitest';
import {
  clampToBounds,
  createSim,
  holdInfluence,
  makeConfig,
  mulberry32,
  nudgedPhase,
  pickDegree,
  populate,
  spawnAt,
  stepSim,
  syncMeasure,
  tuneForBounds,
  type EmberConfig,
  type Firefly,
  type SimState,
} from './sim';

const cfg = makeConfig(false, 10);

function makeFly(overrides: Partial<Firefly>): Firefly {
  return {
    id: 0,
    x: 500,
    y: 500,
    heading: 0,
    speed: 12,
    phase: 0.5,
    period: 4,
    flashAge: Number.POSITIVE_INFINITY,
    degree: 3,
    sprite: 0,
    ...overrides,
  };
}

function makeState(flies: Firefly[], width = 1000, height = 1000): SimState {
  return { width, height, flies, nextId: flies.length };
}

describe('phase advance', () => {
  it('advances phase by dt/period and ages the flash envelope', () => {
    const fly = makeFly({ phase: 0.2, period: 4, flashAge: 0.1 });
    const state = makeState([fly]);
    const events = stepSim(state, 0.5, mulberry32(1), cfg);
    expect(events).toHaveLength(0);
    expect(fly.phase).toBeCloseTo(0.325, 10);
    expect(fly.flashAge).toBeCloseTo(0.6, 10);
  });

  it('moves flies no faster than their speed and keeps them in bounds', () => {
    const fly = makeFly({ x: 3, y: 3, speed: 16 });
    const state = makeState([fly]);
    for (let i = 0; i < 200; i++) stepSim(state, 1 / 30, mulberry32(i), cfg);
    expect(fly.x).toBeGreaterThanOrEqual(0);
    expect(fly.y).toBeGreaterThanOrEqual(0);
    expect(fly.x).toBeLessThanOrEqual(1000);
    expect(fly.y).toBeLessThanOrEqual(1000);
  });
});

describe('flash reset', () => {
  it('emits an event and resets phase with only jitter left', () => {
    const fly = makeFly({ phase: 0.999, period: 4, degree: 7 });
    const state = makeState([fly]);
    const events = stepSim(state, 0.1, mulberry32(2), cfg);
    expect(events).toHaveLength(1);
    expect(events[0].degree).toBe(7);
    expect(fly.flashAge).toBe(0);
    expect(Math.abs(fly.phase)).toBeLessThanOrEqual(cfg.phaseJitter);
  });

  it('does not let simultaneous flashers un-flash each other', () => {
    const a = makeFly({ id: 0, x: 400, y: 400, phase: 1.01 });
    const b = makeFly({ id: 1, x: 420, y: 400, phase: 1.02 });
    const events = stepSim(makeState([a, b]), 0.001, mulberry32(3), cfg);
    expect(events).toHaveLength(2);
    expect(Math.abs(a.phase)).toBeLessThanOrEqual(cfg.phaseJitter);
    expect(Math.abs(b.phase)).toBeLessThanOrEqual(cfg.phaseJitter);
  });
});

describe('coupling nudge', () => {
  it('nudges neighbors within radius and leaves distant flies alone', () => {
    const dt = 0.001;
    const flasher = makeFly({ id: 0, x: 100, y: 100, phase: 0.9999, period: 4 });
    const near = makeFly({ id: 1, x: 150, y: 100, phase: 0.5, period: 4 });
    const far = makeFly({ id: 2, x: 600, y: 100, phase: 0.5, period: 4 });
    stepSim(makeState([flasher, near, far]), dt, mulberry32(4), cfg);
    const advanced = 0.5 + dt / 4;
    expect(near.phase).toBeCloseTo(nudgedPhase(advanced, cfg), 10);
    expect(far.phase).toBeCloseTo(advanced, 10);
  });

  it('leaves freshly-flashed neighbors alone (refractory)', () => {
    const flasher = makeFly({ id: 0, x: 100, y: 100, phase: 0.9999, period: 4 });
    const fresh = makeFly({ id: 1, x: 150, y: 100, phase: 0.05, period: 4 });
    stepSim(makeState([flasher, fresh]), 0.001, mulberry32(9), cfg);
    expect(fresh.phase).toBeCloseTo(0.05 + 0.001 / 4, 10);
  });

  it('nudges late flies harder and caps below 1', () => {
    const earlyGain = nudgedPhase(0.1, cfg) - 0.1;
    const lateGain = nudgedPhase(0.8, cfg) - 0.8;
    expect(lateGain).toBeGreaterThan(earlyGain);
    expect(nudgedPhase(0.99, cfg)).toBe(cfg.nudgeCap);
    expect(nudgedPhase(0.5, cfg)).toBeCloseTo(0.59, 10);
  });
});

describe('spawnAt', () => {
  it('flashes immediately and nudges close neighbors', () => {
    const near = makeFly({ id: 0, x: 520, y: 500, phase: 0.4 });
    const state = makeState([near]);
    const event = spawnAt(state, mulberry32(5), cfg, 500, 500);
    expect(event.x).toBe(500);
    const spawned = state.flies[state.flies.length - 1];
    expect(spawned.phase).toBe(0);
    expect(spawned.flashAge).toBe(0);
    expect(near.phase).toBeCloseTo(nudgedPhase(0.4, cfg), 10);
  });

  it('replaces the oldest fly at cap', () => {
    const rng = mulberry32(6);
    const small: EmberConfig = { ...cfg, count: cfg.cap };
    const state = createSim(1000, 1000);
    populate(state, rng, small);
    const oldestId = Math.min(...state.flies.map(f => f.id));
    spawnAt(state, rng, cfg, 10, 10);
    expect(state.flies).toHaveLength(cfg.cap);
    expect(state.flies.some(f => f.id === oldestId)).toBe(false);
  });
});

describe('holdInfluence', () => {
  it('pulls nearby flies toward the pointer and hurries their phase', () => {
    const near = makeFly({ id: 0, x: 600, y: 500, phase: 0.5 });
    const far = makeFly({ id: 1, x: 900, y: 500, phase: 0.5 });
    holdInfluence(makeState([near, far]), 500, 500, 0.5, cfg);
    expect(near.x).toBeLessThan(600);
    expect(near.phase).toBeGreaterThan(0.5);
    expect(far.x).toBe(900);
    expect(far.phase).toBe(0.5);
  });
});

describe('pickDegree', () => {
  it('stays in range and leans mid-low', () => {
    const rng = mulberry32(7);
    const samples = Array.from({ length: 1000 }, () => pickDegree(rng, 10));
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...samples)).toBeLessThanOrEqual(9);
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(mean).toBeLessThan(4.5);
  });
});

describe('clampToBounds', () => {
  it('keeps flies inside the new bounds', () => {
    const fly = makeFly({ x: 950, y: 950 });
    const state = makeState([fly]);
    clampToBounds(state, 400, 300);
    expect(fly.x).toBe(400);
    expect(fly.y).toBe(300);
    expect(state.width).toBe(400);
  });
});

describe('tuneForBounds', () => {
  it('scales population and coupling reach with screen size', () => {
    const phone = makeConfig(false, 10);
    tuneForBounds(phone, 375, 700);
    const desktop = makeConfig(false, 10);
    tuneForBounds(desktop, 1440, 800);
    expect(phone.count).toBeLessThan(desktop.count);
    expect(desktop.count).toBeLessThanOrEqual(120);
    expect(phone.couplingRadius).toBe(130);
    expect(desktop.couplingRadius).toBeGreaterThan(130);
    expect(desktop.couplingRadius).toBeLessThanOrEqual(170);
  });
});

describe('syncMeasure', () => {
  it('is 1 for coincident flashes and low for spread flashes', () => {
    expect(syncMeasure([10, 10.01, 10.02, 10.05], 10.1)).toBe(1);
    const spread = Array.from({ length: 20 }, (_, i) => 6 + i * 0.2);
    expect(syncMeasure(spread, 10)).toBeLessThan(0.35);
  });

  it('ignores flashes outside the trailing window', () => {
    expect(syncMeasure([1, 1.01, 1.02], 10)).toBe(0);
    expect(syncMeasure([9], 10)).toBe(0);
    expect(syncMeasure([2, 2.01, 9.5, 9.55], 10)).toBe(1);
  });

  it('rates two equal bursts around 0.7', () => {
    const burst = (t: number) => [t, t + 0.02, t + 0.04, t + 0.06];
    const value = syncMeasure([...burst(7), ...burst(9)], 10);
    expect(value).toBeCloseTo(Math.SQRT1_2, 5);
  });
});

describe('synchronization emerges', () => {
  function runSim(couplingRadius: number): number {
    const rng = mulberry32(42);
    const config: EmberConfig = { ...cfg, count: 12, couplingRadius };
    const state = createSim(300, 300);
    populate(state, rng, config);
    const dt = 1 / 30;
    const times: number[] = [];
    let now = 0;
    let lateSum = 0;
    let lateSamples = 0;
    for (let step = 0; step < Math.round(150 / dt); step++) {
      now += dt;
      for (const ev of stepSim(state, dt, rng, config)) {
        void ev;
        times.push(now);
      }
      if (now > 120 && step % 30 === 0) {
        lateSum += syncMeasure(times, now);
        lateSamples++;
      }
    }
    return lateSum / lateSamples;
  }

  it('coupled flies drift into sync; uncoupled ones never do', () => {
    const coupled = runSim(500);
    const uncoupled = runSim(0);
    expect(coupled).toBeGreaterThan(0.6);
    expect(uncoupled).toBeLessThan(0.45);
    expect(coupled).toBeGreaterThan(uncoupled + 0.25);
  });
});
