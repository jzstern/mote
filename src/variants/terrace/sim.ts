export interface ToppleStep {
  /** Indices of cells that toppled during this step (in topple order). */
  toppled: number[];
  count: number;
}

/**
 * Pure Abelian sandpile on a rectangular grid with von Neumann neighbors.
 * Cells at height >= 4 are unstable; toppling sends one grain to each
 * neighbor and grains pushed past the border vanish. Unstable cells wait in
 * a FIFO queue so cascades ripple outward when stepped with a small budget.
 */
export class Sandpile {
  readonly cols: number;
  readonly rows: number;
  readonly heights: Uint8Array;
  private queue: number[] = [];
  private head = 0;
  private queued: Uint8Array;

  constructor(cols: number, rows: number) {
    if (cols < 1 || rows < 1) throw new Error('grid must be at least 1x1');
    this.cols = cols;
    this.rows = rows;
    this.heights = new Uint8Array(cols * rows);
    this.queued = new Uint8Array(cols * rows);
  }

  get size(): number {
    return this.cols * this.rows;
  }

  /** Unstable cells still waiting to topple. */
  get pending(): number {
    return this.queue.length - this.head;
  }

  index(x: number, y: number): number {
    return y * this.cols + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.cols && y >= 0 && y < this.rows;
  }

  addGrain(x: number, y: number, amount = 1): void {
    if (!this.inBounds(x, y)) return;
    const i = this.index(x, y);
    // Uint8 ceiling; a real pile never gets near it mid-cascade.
    this.heights[i] = Math.min(255, this.heights[i] + amount);
    this.enqueueIfUnstable(i);
  }

  /** Zero a cell (rake). Stale queue entries are skipped at pop time. */
  clearCell(x: number, y: number): void {
    if (!this.inBounds(x, y)) return;
    this.heights[this.index(x, y)] = 0;
  }

  totalGrains(): number {
    let sum = 0;
    for (let i = 0; i < this.heights.length; i++) sum += this.heights[i];
    return sum;
  }

  /** Process at most maxTopples topples from the queue. */
  step(maxTopples: number): ToppleStep {
    const toppled: number[] = [];
    let count = 0;
    while (count < maxTopples && this.pending > 0) {
      const i = this.queue[this.head++];
      this.queued[i] = 0;
      if (this.heights[i] < 4) continue;
      this.heights[i] -= 4;
      count++;
      toppled.push(i);
      const x = i % this.cols;
      const y = (i - x) / this.cols;
      this.spill(x - 1, y);
      this.spill(x + 1, y);
      this.spill(x, y - 1);
      this.spill(x, y + 1);
      this.enqueueIfUnstable(i);
    }
    if (this.head > 4096 && this.head * 2 > this.queue.length) {
      this.queue = this.queue.slice(this.head);
      this.head = 0;
    }
    return { toppled, count };
  }

  /** Run the cascade to completion; returns total topples. */
  resolve(): number {
    let total = 0;
    while (this.pending > 0) total += this.step(Infinity).count;
    return total;
  }

  private spill(x: number, y: number): void {
    if (!this.inBounds(x, y)) return;
    const i = this.index(x, y);
    if (this.heights[i] < 255) this.heights[i] += 1;
    this.enqueueIfUnstable(i);
  }

  private enqueueIfUnstable(i: number): void {
    if (this.heights[i] >= 4 && this.queued[i] === 0) {
      this.queued[i] = 1;
      this.queue.push(i);
    }
  }
}
