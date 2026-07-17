import { describe, expect, it } from 'vitest';
import { BrianSim, FIRING, READY, REFRACTORY } from './sim';

function makeSim(cols = 5, rows = 5): BrianSim {
  return new BrianSim(cols, rows);
}

describe('BrianSim rules', () => {
  it('fires a ready cell with exactly two firing neighbors', () => {
    const sim = makeSim();
    sim.setFiring(1, 1);
    sim.setFiring(2, 1);
    sim.step();
    expect(sim.stateAt(1, 0)).toBe(FIRING);
    expect(sim.stateAt(2, 0)).toBe(FIRING);
    expect(sim.stateAt(1, 2)).toBe(FIRING);
    expect(sim.stateAt(2, 2)).toBe(FIRING);
  });

  it('keeps a ready cell ready with one or three firing neighbors', () => {
    const one = makeSim();
    one.setFiring(2, 2);
    one.step();
    expect(one.firingCount).toBe(0);

    const three = makeSim();
    three.setFiring(1, 1);
    three.setFiring(2, 1);
    three.setFiring(3, 1);
    three.step();
    expect(three.stateAt(2, 0)).toBe(READY);
    expect(three.stateAt(2, 2)).toBe(READY);
  });

  it('moves firing cells to refractory and refractory cells to ready', () => {
    const sim = makeSim();
    sim.setFiring(2, 2);
    sim.step();
    expect(sim.stateAt(2, 2)).toBe(REFRACTORY);
    sim.step();
    expect(sim.stateAt(2, 2)).toBe(READY);
  });

  it('does not wrap edges', () => {
    const sim = makeSim(4, 1);
    sim.setFiring(3, 0);
    sim.setFiring(0, 0);
    sim.step();
    for (let c = 0; c < 4; c++) expect(sim.stateAt(c, 0)).not.toBe(FIRING);
  });

  it('refractory cells never fire even with two firing neighbors', () => {
    const sim = makeSim();
    sim.setFiring(2, 2);
    sim.step();
    sim.setFiring(1, 2);
    sim.setFiring(3, 2);
    sim.step();
    expect(sim.stateAt(2, 2)).toBe(READY);
  });

  it('applies updates simultaneously via the double buffer', () => {
    const sim = makeSim();
    sim.setFiring(1, 1);
    sim.setFiring(2, 1);
    sim.step();
    expect(sim.stateAt(1, 1)).toBe(REFRACTORY);
    expect(sim.stateAt(2, 1)).toBe(REFRACTORY);
    expect(sim.firingCount).toBe(4);
  });
});

describe('firing count and stamping', () => {
  it('tracks firingCount through setFiring and step', () => {
    const sim = makeSim();
    expect(sim.firingCount).toBe(0);
    expect(sim.setFiring(1, 1)).toBe(true);
    expect(sim.setFiring(1, 1)).toBe(false);
    expect(sim.firingCount).toBe(1);
    sim.step();
    expect(sim.firingCount).toBe(0);
  });

  it('ignores out-of-bounds stamps', () => {
    const sim = makeSim();
    expect(sim.setFiring(-1, 0)).toBe(false);
    expect(sim.setFiring(0, 5)).toBe(false);
    expect(sim.firingCount).toBe(0);
  });

  it('overrides a refractory cell when stamped', () => {
    const sim = makeSim();
    sim.setFiring(2, 2);
    sim.step();
    expect(sim.stateAt(2, 2)).toBe(REFRACTORY);
    expect(sim.setFiring(2, 2)).toBe(true);
    expect(sim.stateAt(2, 2)).toBe(FIRING);
    expect(sim.firingCount).toBe(1);
  });
});

describe('seedSoup', () => {
  it('fires every cell in the patch when p forces it', () => {
    const sim = makeSim(20, 20);
    sim.seedSoup(10, 10, 4, 1, () => 0);
    expect(sim.firingCount).toBe(16);
  });

  it('clips the patch at grid edges', () => {
    const sim = makeSim(6, 6);
    sim.seedSoup(0, 0, 6, 1, () => 0);
    expect(sim.firingCount).toBe(9);
  });

  it('seeds nothing when p is zero', () => {
    const sim = makeSim();
    sim.seedSoup(2, 2, 4, 0, () => 0.99);
    expect(sim.firingCount).toBe(0);
  });
});

describe('pickSpreadFiring', () => {
  it('returns zero picks on an empty field', () => {
    const sim = makeSim();
    const out = new Int32Array(3);
    expect(sim.pickSpreadFiring(out, () => 0.5)).toBe(0);
  });

  it('picks one firing cell from each occupied horizontal third', () => {
    const sim = makeSim(9, 3);
    sim.setFiring(0, 1);
    sim.setFiring(4, 1);
    sim.setFiring(8, 1);
    const out = new Int32Array(3);
    const n = sim.pickSpreadFiring(out, () => 0.5);
    expect(n).toBe(3);
    expect(out[0] % 9).toBeLessThan(3);
    expect(out[1] % 9).toBeGreaterThanOrEqual(3);
    expect(out[1] % 9).toBeLessThan(6);
    expect(out[2] % 9).toBeGreaterThanOrEqual(6);
  });

  it('returns fewer picks when some thirds are empty', () => {
    const sim = makeSim(9, 3);
    sim.setFiring(1, 0);
    sim.setFiring(2, 2);
    const out = new Int32Array(3);
    const n = sim.pickSpreadFiring(out, () => 0.5);
    expect(n).toBe(1);
    expect(out[0] % 9).toBeLessThan(3);
  });
});

describe('firingNeighborFraction', () => {
  it('counts firing Moore neighbors out of eight', () => {
    const sim = makeSim();
    sim.setFiring(1, 1);
    sim.setFiring(3, 3);
    const center = 2 * 5 + 2;
    expect(sim.firingNeighborFraction(center)).toBe(2 / 8);
  });

  it('treats off-grid neighbors as ready at corners', () => {
    const sim = makeSim();
    sim.setFiring(1, 0);
    expect(sim.firingNeighborFraction(0)).toBe(1 / 8);
  });
});
