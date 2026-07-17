export const READY = 0;
export const FIRING = 1;
export const REFRACTORY = 2;

export type Rng = () => number;

/**
 * Brian's Brain on a non-wrapping grid. Double-buffered Uint8Arrays; step()
 * performs zero allocations.
 */
export class BrianSim {
  readonly cols: number;
  readonly rows: number;
  private front: Uint8Array;
  private back: Uint8Array;
  private firing = 0;

  constructor(cols: number, rows: number) {
    if (cols < 1 || rows < 1) throw new RangeError('grid must be at least 1x1');
    this.cols = cols;
    this.rows = rows;
    this.front = new Uint8Array(cols * rows);
    this.back = new Uint8Array(cols * rows);
  }

  get cells(): Uint8Array {
    return this.front;
  }

  get firingCount(): number {
    return this.firing;
  }

  inBounds(col: number, row: number): boolean {
    return col >= 0 && col < this.cols && row >= 0 && row < this.rows;
  }

  stateAt(col: number, row: number): number {
    return this.front[row * this.cols + col];
  }

  /** Force a cell to firing (any prior state). Returns true if it changed. */
  setFiring(col: number, row: number): boolean {
    if (!this.inBounds(col, row)) return false;
    const i = row * this.cols + col;
    if (this.front[i] === FIRING) return false;
    this.front[i] = FIRING;
    this.firing++;
    return true;
  }

  step(): void {
    const { cols, rows, front, back } = this;
    let firing = 0;
    for (let r = 0; r < rows; r++) {
      const r0 = r > 0 ? r - 1 : r;
      const r1 = r < rows - 1 ? r + 1 : r;
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const s = front[i];
        if (s === FIRING) {
          back[i] = REFRACTORY;
          continue;
        }
        if (s === REFRACTORY) {
          back[i] = READY;
          continue;
        }
        const c0 = c > 0 ? c - 1 : c;
        const c1 = c < cols - 1 ? c + 1 : c;
        let n = 0;
        for (let rr = r0; rr <= r1; rr++) {
          const base = rr * cols;
          for (let cc = c0; cc <= c1; cc++) {
            if ((rr !== r || cc !== c) && front[base + cc] === FIRING) n++;
          }
        }
        if (n === 2) {
          back[i] = FIRING;
          firing++;
        } else {
          back[i] = READY;
        }
      }
    }
    this.front = back;
    this.back = front;
    this.firing = firing;
  }

  /** Sprinkle firing cells (probability p) in a size x size patch, clipped to bounds. */
  seedSoup(centerCol: number, centerRow: number, size: number, p: number, rand: Rng): void {
    const half = Math.floor(size / 2);
    for (let r = centerRow - half; r < centerRow - half + size; r++) {
      for (let c = centerCol - half; c < centerCol - half + size; c++) {
        if (this.inBounds(c, r) && rand() < p) this.setFiring(c, r);
      }
    }
  }

  /**
   * Reservoir-sample one firing cell from each horizontal third of the grid.
   * Writes cell indices into out; returns how many were found (0-3).
   */
  pickSpreadFiring(out: Int32Array, rand: Rng): number {
    const { cols, front } = this;
    let n0 = 0;
    let n1 = 0;
    let n2 = 0;
    let p0 = -1;
    let p1 = -1;
    let p2 = -1;
    for (let i = 0; i < front.length; i++) {
      if (front[i] !== FIRING) continue;
      const third = Math.min(2, Math.floor(((i % cols) * 3) / cols));
      if (third === 0) {
        n0++;
        if (rand() * n0 < 1) p0 = i;
      } else if (third === 1) {
        n1++;
        if (rand() * n1 < 1) p1 = i;
      } else {
        n2++;
        if (rand() * n2 < 1) p2 = i;
      }
    }
    let k = 0;
    if (p0 >= 0) out[k++] = p0;
    if (p1 >= 0) out[k++] = p1;
    if (p2 >= 0) out[k++] = p2;
    return k;
  }

  /** Fraction of the 8 Moore neighbors currently firing (edges count missing as ready). */
  firingNeighborFraction(index: number): number {
    const { cols, rows, front } = this;
    const c = index % cols;
    const r = (index - c) / cols;
    const r0 = r > 0 ? r - 1 : r;
    const r1 = r < rows - 1 ? r + 1 : r;
    const c0 = c > 0 ? c - 1 : c;
    const c1 = c < cols - 1 ? c + 1 : c;
    let n = 0;
    for (let rr = r0; rr <= r1; rr++) {
      const base = rr * cols;
      for (let cc = c0; cc <= c1; cc++) {
        if ((rr !== r || cc !== c) && front[base + cc] === FIRING) n++;
      }
    }
    return n / 8;
  }
}
