export type Rng = () => number;

export const RULE_CYCLE: readonly number[] = [90, 150, 110, 105, 89];
export const ROWS_PER_RULE = 96;
export const SATURATION_FRACTION = 0.85;
export const SATURATION_RUN = 8;
export const THIN_TARGET = 0.4;
export const SEED_SPARSE_CELLS = 4;

export const STITCH_CREAM = 0;
export const STITCH_MADDER = 1;
export const STITCH_MARIGOLD = 2;
export const STITCH_USER = 3;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One elementary-CA step with wrap-around edges, written into `out`. */
export function nextRow(prev: Uint8Array, rule: number, out: Uint8Array): void {
  const n = prev.length;
  for (let i = 0; i < n; i++) {
    const left = prev[(i - 1 + n) % n];
    const right = prev[(i + 1) % n];
    const idx = (left << 2) | (prev[i] << 1) | right;
    out[i] = (rule >> idx) & 1;
  }
}

// col*31 keeps the hash coprime with the modulus so accents form diagonal
// motifs across the cloth instead of uniform speckle.
export function stitchColor(col: number, rowIndex: number): number {
  const h = (col * 31 + rowIndex) % 23;
  if (h === 5 || h === 11) return STITCH_MADDER;
  if (h === 17) return STITCH_MARIGOLD;
  return STITCH_CREAM;
}

export interface StepEvent {
  ruleChanged: boolean;
  reseeded: boolean;
  thinned: boolean;
  liveFraction: number;
}

/**
 * Elementary 1D cellular automaton woven into a ring buffer of rows.
 * Age 0 is the newest (bottom-most) row; higher ages are older cloth.
 */
export class LoomSim {
  cols: number;
  rule: number;
  rowCount = 1;
  size = 1;
  capacity: number;

  private ruleIndex = 0;
  private rowsInRule = 1;
  private satRun = 0;
  private head = 0;
  private rows: Uint8Array[];
  private colors: Uint8Array[];
  private selvage: Uint8Array;
  private readonly rng: Rng;

  constructor(cols: number, capacity: number, seed = 1) {
    this.cols = Math.max(3, cols);
    this.capacity = Math.max(2, capacity);
    this.rng = mulberry32(seed);
    this.rule = RULE_CYCLE[0];
    this.rows = [];
    this.colors = [];
    for (let i = 0; i < this.capacity; i++) {
      this.rows.push(new Uint8Array(this.cols));
      this.colors.push(new Uint8Array(this.cols));
    }
    this.selvage = new Uint8Array(this.capacity);
    this.seedInto(this.rows[0]);
    this.dyeRow(0, 0);
  }

  /** Row cells by age (0 = newest). */
  rowAt(age: number): Uint8Array {
    return this.rows[this.slot(age)];
  }

  /** Stitch color codes by age (0 = newest). */
  colorAt(age: number): Uint8Array {
    return this.colors[this.slot(age)];
  }

  isSelvage(age: number): boolean {
    return this.selvage[this.slot(age)] === 1;
  }

  liveFraction(age = 0): number {
    const row = this.rowAt(age);
    let live = 0;
    for (let i = 0; i < row.length; i++) live += row[i];
    return live / row.length;
  }

  /** Replace the newest row wholesale (test seam). */
  loadRow(cells: ArrayLike<number>): void {
    const row = this.rows[this.head];
    for (let i = 0; i < this.cols; i++) row[i] = cells[i] ? 1 : 0;
  }

  /** Force a cell in the newest row alive as a user stitch. */
  setUserCell(col: number): boolean {
    if (col < 0 || col >= this.cols) return false;
    const row = this.rows[this.head];
    const colors = this.colors[this.head];
    const changed = row[col] === 0 || colors[col] !== STITCH_USER;
    row[col] = 1;
    colors[col] = STITCH_USER;
    return changed;
  }

  step(): StepEvent {
    const event: StepEvent = {
      ruleChanged: false,
      reseeded: false,
      thinned: false,
      liveFraction: 0,
    };
    if (this.rowsInRule >= ROWS_PER_RULE) {
      this.ruleIndex = (this.ruleIndex + 1) % RULE_CYCLE.length;
      this.rule = RULE_CYCLE[this.ruleIndex];
      this.rowsInRule = 0;
      event.ruleChanged = true;
    }

    const prev = this.rows[this.head];
    this.head = (this.head + 1) % this.capacity;
    const row = this.rows[this.head];
    nextRow(prev, this.rule, row);
    this.selvage[this.head] = event.ruleChanged ? 1 : 0;

    let live = this.countLive(row);
    if (live === 0) {
      this.seedInto(row);
      live = this.countLive(row);
      event.reseeded = true;
      this.satRun = 0;
    } else if (live / this.cols > SATURATION_FRACTION) {
      this.satRun++;
      if (this.satRun >= SATURATION_RUN) {
        for (let i = 0; i < this.cols; i++) {
          if (row[i] === 1 && this.rng() > THIN_TARGET) row[i] = 0;
        }
        live = this.countLive(row);
        if (live === 0) {
          this.seedInto(row);
          live = this.countLive(row);
          event.reseeded = true;
        }
        event.thinned = true;
        this.satRun = 0;
      }
    } else {
      this.satRun = 0;
    }

    this.dyeRow(this.head, this.rowCount);
    this.rowCount++;
    this.rowsInRule++;
    if (this.size < this.capacity) this.size++;
    event.liveFraction = live / this.cols;
    return event;
  }

  /** Nearest-column remap of the existing cloth onto a new width/history depth. */
  resize(cols: number, capacity = this.capacity): void {
    const nextCols = Math.max(3, cols);
    const nextCap = Math.max(2, capacity);
    if (nextCols === this.cols && nextCap === this.capacity) return;
    const keep = Math.min(this.size, nextCap);
    const scale = (this.cols - 1) / Math.max(1, nextCols - 1);
    const rows: Uint8Array[] = [];
    const colors: Uint8Array[] = [];
    const selvage = new Uint8Array(nextCap);
    for (let i = 0; i < nextCap; i++) {
      rows.push(new Uint8Array(nextCols));
      colors.push(new Uint8Array(nextCols));
    }
    for (let k = 0; k < keep; k++) {
      const srcSlot = this.slot(keep - 1 - k);
      const src = this.rows[srcSlot];
      const srcColors = this.colors[srcSlot];
      for (let j = 0; j < nextCols; j++) {
        const s = nextCols === this.cols ? j : Math.round(j * scale);
        rows[k][j] = src[s];
        colors[k][j] = srcColors[s];
      }
      selvage[k] = this.selvage[srcSlot];
    }
    this.rows = rows;
    this.colors = colors;
    this.selvage = selvage;
    this.head = keep - 1;
    this.size = keep;
    this.cols = nextCols;
    this.capacity = nextCap;
    if (this.countLive(this.rows[this.head]) === 0) this.seedInto(this.rows[this.head]);
  }

  private slot(age: number): number {
    const a = Math.min(age, this.size - 1);
    return (this.head - a + this.capacity * 2) % this.capacity;
  }

  private countLive(row: Uint8Array): number {
    let live = 0;
    for (let i = 0; i < row.length; i++) live += row[i];
    return live;
  }

  private seedInto(row: Uint8Array): void {
    row.fill(0);
    row[this.cols >> 1] = 1;
    for (let k = 0; k < SEED_SPARSE_CELLS; k++) {
      row[Math.floor(this.rng() * this.cols)] = 1;
    }
  }

  private dyeRow(slot: number, rowIndex: number): void {
    const colors = this.colors[slot];
    for (let i = 0; i < this.cols; i++) {
      colors[i] = stitchColor(i, rowIndex);
    }
  }
}
