import { describe, expect, it } from 'vitest';
import { Sandpile } from './sim';

describe('topple rule', () => {
  it('topples a cell at 4: -4 self, +1 to each von Neumann neighbor', () => {
    const pile = new Sandpile(5, 5);
    pile.addGrain(2, 2, 4);
    expect(pile.pending).toBe(1);

    const { count, toppled } = pile.step(10);
    expect(count).toBe(1);
    expect(toppled).toEqual([pile.index(2, 2)]);
    expect(pile.heights[pile.index(2, 2)]).toBe(0);
    expect(pile.heights[pile.index(1, 2)]).toBe(1);
    expect(pile.heights[pile.index(3, 2)]).toBe(1);
    expect(pile.heights[pile.index(2, 1)]).toBe(1);
    expect(pile.heights[pile.index(2, 3)]).toBe(1);
    expect(pile.pending).toBe(0);
  });

  it('cells below 4 are stable and never enqueue', () => {
    const pile = new Sandpile(3, 3);
    pile.addGrain(1, 1, 3);
    expect(pile.pending).toBe(0);
    expect(pile.step(10).count).toBe(0);
  });

  it('a cell at 8 topples twice', () => {
    const pile = new Sandpile(5, 5);
    pile.addGrain(2, 2, 8);
    expect(pile.resolve()).toBe(2);
    expect(pile.heights[pile.index(2, 2)]).toBe(0);
    expect(pile.heights[pile.index(1, 2)]).toBe(2);
  });
});

describe('grain conservation', () => {
  it('interior topples conserve total grains', () => {
    const pile = new Sandpile(7, 7);
    pile.addGrain(3, 3, 4);
    const before = pile.totalGrains();
    pile.step(1);
    expect(pile.totalGrains()).toBe(before);
  });

  it('grains fall off the edge from border topples', () => {
    const pile = new Sandpile(5, 5);
    pile.addGrain(0, 0, 4);
    pile.step(1);
    // Corner topple: 2 neighbors in bounds, 2 grains vanish.
    expect(pile.totalGrains()).toBe(2);
    expect(pile.heights[pile.index(1, 0)]).toBe(1);
    expect(pile.heights[pile.index(0, 1)]).toBe(1);
  });
});

describe('cascade counting', () => {
  it('counts the full 3x3 all-threes avalanche (10 topples)', () => {
    const pile = new Sandpile(3, 3);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) pile.addGrain(x, y, 3);
    pile.addGrain(1, 1, 1);
    expect(pile.resolve()).toBe(10);
    // Hand-computed stable result: center 0, edge-centers 3, corners 1.
    expect(Array.from(pile.heights)).toEqual([1, 3, 1, 3, 0, 3, 1, 3, 1]);
  });

  it('step counts sum to the resolve total', () => {
    const a = new Sandpile(9, 9);
    const b = new Sandpile(9, 9);
    for (const pile of [a, b]) {
      for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) pile.addGrain(x, y, 3);
      pile.addGrain(4, 4, 4);
    }
    const total = a.resolve();
    let stepped = 0;
    while (b.pending > 0) stepped += b.step(3).count;
    expect(stepped).toBe(total);
    expect(Array.from(b.heights)).toEqual(Array.from(a.heights));
  });
});

describe('queue processing', () => {
  it('respects the per-step budget and leaves the rest pending', () => {
    const pile = new Sandpile(9, 9);
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) pile.addGrain(x, y, 3);
    pile.addGrain(4, 4, 4);
    const { count } = pile.step(5);
    expect(count).toBe(5);
    expect(pile.pending).toBeGreaterThan(0);
    pile.resolve();
    expect(pile.pending).toBe(0);
    for (const h of pile.heights) expect(h).toBeLessThan(4);
  });

  it('skips stale queue entries after a rake clears them', () => {
    const pile = new Sandpile(5, 5);
    pile.addGrain(2, 2, 4);
    pile.clearCell(2, 2);
    expect(pile.step(10).count).toBe(0);
    expect(pile.totalGrains()).toBe(0);
  });

  it('is abelian: drop order does not change the stable configuration', () => {
    const drops: [number, number][] = [
      [2, 2],
      [5, 3],
      [3, 5],
      [4, 4],
      [2, 2],
      [4, 4],
    ];
    const a = new Sandpile(8, 8);
    for (const [x, y] of drops) {
      a.addGrain(x, y, 4);
      a.resolve();
    }
    const b = new Sandpile(8, 8);
    for (const [x, y] of [...drops].reverse()) b.addGrain(x, y, 4);
    b.resolve();
    expect(Array.from(b.heights)).toEqual(Array.from(a.heights));
  });
});
