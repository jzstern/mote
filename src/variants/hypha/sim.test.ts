import { describe, expect, it } from 'vitest';
import {
  ATTRACTOR_LIFE,
  DECAY,
  DEPOSIT,
  DIFFUSE,
  HyphaSim,
  MAX_ATTRACTORS,
  SENSOR_ANGLE,
  SENSOR_DIST,
  STEP_LEN,
  TURN_RATE,
} from './sim';

const flat = (): number => 0.5;

function placeAgent(sim: HyphaSim, x: number, y: number, heading: number): void {
  sim.agentX[0] = x;
  sim.agentY[0] = y;
  sim.agentHeading[0] = heading;
}

function sensorCell(x: number, y: number, angle: number): [number, number] {
  return [
    Math.round(x + Math.cos(angle) * SENSOR_DIST),
    Math.round(y + Math.sin(angle) * SENSOR_DIST),
  ];
}

describe('sensing and steering', () => {
  it('turns toward a stronger left sample', () => {
    const sim = new HyphaSim(64, 64, 1, flat);
    placeAgent(sim, 32, 32, 0);
    const [sx, sy] = sensorCell(32, 32, -SENSOR_ANGLE);
    sim.deposit(sx, sy, 10);
    sim.stepAgents();
    expect(sim.agentHeading[0]).toBeCloseTo(-TURN_RATE, 5);
  });

  it('turns toward a stronger right sample', () => {
    const sim = new HyphaSim(64, 64, 1, flat);
    placeAgent(sim, 32, 32, 0);
    const [sx, sy] = sensorCell(32, 32, SENSOR_ANGLE);
    sim.deposit(sx, sy, 10);
    sim.stepAgents();
    expect(sim.agentHeading[0]).toBeCloseTo(TURN_RATE, 5);
  });

  it('holds course when the ahead sample dominates', () => {
    const sim = new HyphaSim(64, 64, 1, flat);
    placeAgent(sim, 32, 32, 0);
    const [sx, sy] = sensorCell(32, 32, 0);
    sim.deposit(sx, sy, 10);
    sim.stepAgents();
    expect(sim.agentHeading[0]).toBeCloseTo(0, 5);
    expect(sim.agentX[0]).toBeCloseTo(32 + STEP_LEN, 5);
    expect(sim.agentY[0]).toBeCloseTo(32, 5);
  });

  it('wraps toroidally at the field edge', () => {
    const sim = new HyphaSim(64, 64, 1, flat);
    placeAgent(sim, 63.5, 32, 0);
    sim.stepAgents();
    expect(sim.agentX[0]).toBeCloseTo(63.5 + STEP_LEN - 64, 5);
  });
});

describe('deposit', () => {
  it('stamps DEPOSIT into the cell the agent lands on', () => {
    const sim = new HyphaSim(64, 64, 1, flat);
    placeAgent(sim, 10, 10, 0);
    sim.stepAgents();
    expect(sim.fieldAt(Math.floor(10 + STEP_LEN), 10)).toBeCloseTo(DEPOSIT, 5);
  });
});

describe('decay and diffusion', () => {
  it('decays a spike and bleeds into 4-neighbors', () => {
    const sim = new HyphaSim(64, 64, 0, flat);
    sim.deposit(20, 20, 10);
    sim.stepField();
    const center = (10 + (0 - 10) * DIFFUSE) * DECAY;
    const neighbor = (10 / 4) * DIFFUSE * DECAY;
    expect(sim.fieldAt(20, 20)).toBeCloseTo(center, 4);
    expect(sim.fieldAt(21, 20)).toBeCloseTo(neighbor, 4);
    expect(sim.fieldAt(20, 19)).toBeCloseTo(neighbor, 4);
    expect(sim.fieldAt(22, 20)).toBe(0);
  });

  it('loses total energy each step (endless equilibrium, not blowup)', () => {
    const sim = new HyphaSim(32, 32, 0, flat);
    sim.deposit(16, 16, 10);
    const before = sim.totalEnergy();
    sim.stepField();
    expect(sim.totalEnergy()).toBeLessThan(before);
    expect(sim.totalEnergy()).toBeGreaterThan(0);
  });
});

describe('attractors', () => {
  it('deposits a strength-scaled blob each step', () => {
    const sim = new HyphaSim(64, 64, 0, flat);
    sim.addAttractor(30, 30);
    sim.stepAttractors(1 / 60);
    expect(sim.fieldAt(30, 30)).toBeGreaterThan(0);
    expect(sim.fieldAt(31, 30)).toBeCloseTo(sim.fieldAt(30, 30) / 2, 4);
    expect(sim.fieldAt(10, 10)).toBe(0);
  });

  it('steers an agent toward an attractor blob', () => {
    const sim = new HyphaSim(64, 64, 1, flat);
    const ax = 32;
    const ay = 32;
    sim.addAttractor(ax, ay);
    sim.stepAttractors(1 / 60);
    placeAgent(
      sim,
      ax - Math.cos(SENSOR_ANGLE) * SENSOR_DIST,
      ay - Math.sin(SENSOR_ANGLE) * SENSOR_DIST,
      0,
    );
    sim.stepAgents();
    expect(sim.agentHeading[0]).toBeCloseTo(TURN_RATE, 5);
  });

  it('decays strength over ATTRACTOR_LIFE and expires', () => {
    const sim = new HyphaSim(64, 64, 0, flat);
    sim.addAttractor(30, 30);
    sim.stepAttractors(ATTRACTOR_LIFE / 2);
    expect(sim.attractors[0].strength).toBeCloseTo(0.5, 5);
    sim.stepAttractors(ATTRACTOR_LIFE);
    expect(sim.attractors).toHaveLength(0);
  });

  it('caps the list by dropping the oldest', () => {
    const sim = new HyphaSim(64, 64, 0, flat);
    for (let i = 0; i <= MAX_ATTRACTORS; i++) sim.addAttractor(i, 0);
    expect(sim.attractors).toHaveLength(MAX_ATTRACTORS);
    expect(sim.attractors[0].x).toBe(1);
  });
});

describe('seeding', () => {
  it('places all agents in bounds, in a loose ring around center', () => {
    const sim = new HyphaSim(100, 80, 200);
    const ringMax = Math.min(100, 80) * 0.28 * 1.3 + 1;
    for (let i = 0; i < sim.agentCount; i++) {
      const x = sim.agentX[i];
      const y = sim.agentY[i];
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(80);
      const d = Math.hypot(x - 50, y - 40);
      expect(d).toBeLessThanOrEqual(ringMax);
    }
  });
});
