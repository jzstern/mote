import { describe, expect, it } from 'vitest';
import {
  LoomSim,
  ROWS_PER_RULE,
  RULE_CYCLE,
  SATURATION_RUN,
  STITCH_USER,
  nextRow,
  stitchColor,
} from './sim';

function row(width: number, live: number[] = []): Uint8Array {
  const r = new Uint8Array(width);
  for (const i of live) r[i] = 1;
  return r;
}

function liveCols(r: Uint8Array): number[] {
  const out: number[] = [];
  for (let i = 0; i < r.length; i++) if (r[i]) out.push(i);
  return out;
}

describe('nextRow', () => {
  it('weaves the Sierpinski pattern under rule 90 from a single cell', () => {
    let current = row(17, [8]);
    const expected = [
      [7, 9],
      [6, 10],
      [5, 7, 9, 11],
      [4, 12],
    ];
    for (const want of expected) {
      const next = new Uint8Array(17);
      nextRow(current, 90, next);
      expect(liveCols(next)).toEqual(want);
      current = next;
    }
  });

  it('wraps around the edges', () => {
    const next = new Uint8Array(16);
    nextRow(row(16, [0]), 90, next);
    expect(liveCols(next)).toEqual([1, 15]);
    nextRow(row(16, [15]), 90, next);
    expect(liveCols(next)).toEqual([0, 14]);
  });

  it('applies rule 150 as left XOR self XOR right', () => {
    const next = new Uint8Array(11);
    nextRow(row(11, [4, 5]), 150, next);
    expect(liveCols(next)).toEqual([3, 6]);
  });
});

describe('LoomSim', () => {
  it('starts with a seeded row containing the center cell', () => {
    const sim = new LoomSim(48, 16, 7);
    expect(sim.rowAt(0)[24]).toBe(1);
    expect(sim.liveFraction()).toBeGreaterThan(0);
    expect(sim.liveFraction()).toBeLessThan(0.25);
  });

  it('is deterministic for a given seed', () => {
    const a = new LoomSim(64, 8, 42);
    const b = new LoomSim(64, 8, 42);
    for (let i = 0; i < 20; i++) {
      a.step();
      b.step();
    }
    expect(Array.from(a.rowAt(0))).toEqual(Array.from(b.rowAt(0)));
  });

  it('reseeds when a row goes extinct', () => {
    const sim = new LoomSim(48, 16, 3);
    sim.loadRow(new Uint8Array(48));
    const event = sim.step();
    expect(event.reseeded).toBe(true);
    expect(sim.rowAt(0)[24]).toBe(1);
    expect(sim.liveFraction()).toBeGreaterThan(0);
  });

  it('reseeds when rule 90 annihilates a uniform row', () => {
    const sim = new LoomSim(48, 16, 3);
    sim.loadRow(new Uint8Array(48).fill(1));
    const event = sim.step();
    expect(event.reseeded).toBe(true);
    expect(sim.liveFraction()).toBeGreaterThan(0);
  });

  it('advances the rule cycle every 96 rows and marks a selvage row', () => {
    const sim = new LoomSim(64, 8, 1);
    let changedAt = -1;
    for (let i = 1; i <= ROWS_PER_RULE + 1; i++) {
      const event = sim.step();
      if (event.ruleChanged) {
        changedAt = i;
        break;
      }
    }
    expect(changedAt).toBe(ROWS_PER_RULE);
    expect(sim.rule).toBe(RULE_CYCLE[1]);
    expect(sim.isSelvage(0)).toBe(true);
    sim.step();
    expect(sim.isSelvage(0)).toBe(false);
    expect(sim.isSelvage(1)).toBe(true);
  });

  it('cycles back to rule 90 after the full schedule', () => {
    const sim = new LoomSim(48, 8, 1);
    for (let i = 0; i < ROWS_PER_RULE * RULE_CYCLE.length; i++) sim.step();
    expect(sim.rule).toBe(RULE_CYCLE[0]);
  });

  it('thins the cloth after sustained saturation', () => {
    const sim = new LoomSim(64, 8, 9);
    sim.rule = 254;
    let thinned = false;
    for (let i = 0; i < ROWS_PER_RULE - SATURATION_RUN && !thinned; i++) {
      thinned = sim.step().thinned;
    }
    expect(thinned).toBe(true);
    expect(sim.liveFraction()).toBeLessThan(0.6);
    expect(sim.liveFraction()).toBeGreaterThan(0);
  });

  it('lets a user stitch participate in the next row', () => {
    const sim = new LoomSim(48, 16, 5);
    sim.loadRow(new Uint8Array(48));
    expect(sim.setUserCell(10)).toBe(true);
    expect(sim.rowAt(0)[10]).toBe(1);
    expect(sim.colorAt(0)[10]).toBe(STITCH_USER);
    const event = sim.step();
    expect(event.reseeded).toBe(false);
    expect(liveCols(sim.rowAt(0))).toEqual([9, 11]);
  });

  it('remaps rows onto a new column count on resize', () => {
    const sim = new LoomSim(96, 8, 2);
    for (let i = 0; i < 5; i++) sim.step();
    sim.resize(48);
    expect(sim.cols).toBe(48);
    expect(sim.rowAt(0).length).toBe(48);
    expect(sim.liveFraction()).toBeGreaterThan(0);
  });

  it('preserves the newest rows when capacity changes', () => {
    const sim = new LoomSim(48, 8, 2);
    for (let i = 0; i < 10; i++) sim.step();
    const newest = Array.from(sim.rowAt(0));
    const older = Array.from(sim.rowAt(3));
    sim.resize(48, 32);
    expect(sim.capacity).toBe(32);
    expect(sim.size).toBe(8);
    expect(Array.from(sim.rowAt(0))).toEqual(newest);
    expect(Array.from(sim.rowAt(3))).toEqual(older);
    sim.resize(48, 4);
    expect(sim.size).toBe(4);
    expect(Array.from(sim.rowAt(0))).toEqual(newest);
  });

  it('assigns deterministic accent colors', () => {
    expect(stitchColor(3, 10)).toBe(stitchColor(3, 10));
    let accents = 0;
    for (let col = 0; col < 100; col++) {
      for (let r = 0; r < 100; r++) {
        if (stitchColor(col, r) !== 0) accents++;
      }
    }
    expect(accents).toBeGreaterThan(300);
    expect(accents).toBeLessThan(3000);
  });
});
