export type Rng = () => number;

export const SENSOR_ANGLE = 0.44;
export const SENSOR_DIST = 9;
export const TURN_RATE = 0.32;
export const STEP_LEN = 1.1;
export const DEPOSIT = 1.0;
export const DECAY = 0.955;
export const DIFFUSE = 0.2;
export const JITTER = 0.12;
export const ATTRACTOR_LIFE = 25;
export const ATTRACTOR_DEPOSIT = 2.4;
export const MAX_ATTRACTORS = 12;

export interface Attractor {
  x: number;
  y: number;
  /** Remaining strength 0..1; ticks down over ATTRACTOR_LIFE seconds. */
  strength: number;
}

/**
 * Physarum trail-following on a toroidal Float32 field. Agents live in flat
 * arrays; step() performs zero allocations. All coordinates are field pixels.
 */
export class HyphaSim {
  readonly width: number;
  readonly height: number;
  readonly agentCount: number;
  readonly agentX: Float32Array;
  readonly agentY: Float32Array;
  readonly agentHeading: Float32Array;
  readonly attractors: Attractor[] = [];
  private front: Float32Array;
  private back: Float32Array;
  private readonly rng: Rng;

  constructor(width: number, height: number, agentCount: number, rng: Rng = Math.random) {
    if (width < 4 || height < 4) throw new RangeError('field must be at least 4x4');
    this.width = width;
    this.height = height;
    this.agentCount = agentCount;
    this.rng = rng;
    this.front = new Float32Array(width * height);
    this.back = new Float32Array(width * height);
    this.agentX = new Float32Array(agentCount);
    this.agentY = new Float32Array(agentCount);
    this.agentHeading = new Float32Array(agentCount);
    this.seedRing();
  }

  get field(): Float32Array {
    return this.front;
  }

  /** Scatter agents in a loose ring around center with tangential headings. */
  seedRing(): void {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const radius = Math.min(this.width, this.height) * 0.28;
    for (let i = 0; i < this.agentCount; i++) {
      const ang = this.rng() * Math.PI * 2;
      const rad = radius * (0.7 + this.rng() * 0.6);
      this.agentX[i] = this.wrapX(cx + Math.cos(ang) * rad);
      this.agentY[i] = this.wrapY(cy + Math.sin(ang) * rad);
      this.agentHeading[i] = ang + Math.PI / 2 + (this.rng() - 0.5) * 0.6;
    }
  }

  deposit(x: number, y: number, amount: number): void {
    this.front[this.cellIndex(x, y)] += amount;
  }

  fieldAt(x: number, y: number): number {
    return this.front[this.cellIndex(x, y)];
  }

  addAttractor(x: number, y: number): void {
    this.attractors.push({ x, y, strength: 1 });
    if (this.attractors.length > MAX_ATTRACTORS) this.attractors.shift();
  }

  step(dt: number): void {
    this.stepAttractors(dt);
    this.stepAgents();
    this.stepField();
  }

  /** Decay attractor strengths and stamp 3x3 nutrient blobs into the field. */
  stepAttractors(dt: number): void {
    for (let i = this.attractors.length - 1; i >= 0; i--) {
      const a = this.attractors[i];
      a.strength -= dt / ATTRACTOR_LIFE;
      if (a.strength <= 0) {
        this.attractors.splice(i, 1);
        continue;
      }
      const amount = ATTRACTOR_DEPOSIT * a.strength;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const w = ox === 0 && oy === 0 ? 1 : 0.5;
          this.front[this.cellIndex(a.x + ox, a.y + oy)] += amount * w;
        }
      }
    }
  }

  /** Sense three samples, turn toward the strongest, move, deposit. */
  stepAgents(): void {
    const { agentX, agentY, agentHeading, front, width } = this;
    for (let i = 0; i < this.agentCount; i++) {
      const x = agentX[i];
      const y = agentY[i];
      let h = agentHeading[i];
      const ahead = this.sense(x, y, h);
      const left = this.sense(x, y, h - SENSOR_ANGLE);
      const right = this.sense(x, y, h + SENSOR_ANGLE);
      h += (this.rng() - 0.5) * JITTER;
      if (left > ahead && left >= right) h -= TURN_RATE;
      else if (right > ahead && right > left) h += TURN_RATE;
      const nx = this.wrapX(x + Math.cos(h) * STEP_LEN);
      const ny = this.wrapY(y + Math.sin(h) * STEP_LEN);
      agentX[i] = nx;
      agentY[i] = ny;
      agentHeading[i] = h;
      front[(ny | 0) * width + (nx | 0)] += DEPOSIT;
    }
  }

  /** Exponential decay plus one-pass 4-neighbor diffusion (toroidal). */
  stepField(): void {
    const { front, back, width, height } = this;
    for (let y = 0; y < height; y++) {
      const up = (y === 0 ? height - 1 : y - 1) * width;
      const down = (y === height - 1 ? 0 : y + 1) * width;
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const xl = x === 0 ? width - 1 : x - 1;
        const xr = x === width - 1 ? 0 : x + 1;
        const v = front[row + x];
        const avg = (front[up + x] + front[down + x] + front[row + xl] + front[row + xr]) * 0.25;
        back[row + x] = (v + (avg - v) * DIFFUSE) * DECAY;
      }
    }
    const tmp = this.front;
    this.front = this.back;
    this.back = tmp;
  }

  totalEnergy(): number {
    let sum = 0;
    const f = this.front;
    for (let i = 0; i < f.length; i++) sum += f[i];
    return sum;
  }

  /** Mean density over a (2r+1)^2 window centered on (cx, cy), wrapped. */
  windowMean(cx: number, cy: number, radius: number): number {
    let sum = 0;
    const side = radius * 2 + 1;
    for (let oy = -radius; oy <= radius; oy++) {
      for (let ox = -radius; ox <= radius; ox++) {
        sum += this.front[this.cellIndex(cx + ox, cy + oy)];
      }
    }
    return sum / (side * side);
  }

  private sense(x: number, y: number, angle: number): number {
    return this.front[
      this.cellIndex(x + Math.cos(angle) * SENSOR_DIST, y + Math.sin(angle) * SENSOR_DIST)
    ];
  }

  private cellIndex(x: number, y: number): number {
    const { width, height } = this;
    const ix = (((Math.round(x) % width) + width) % width) | 0;
    const iy = (((Math.round(y) % height) + height) % height) | 0;
    return iy * width + ix;
  }

  private wrapX(x: number): number {
    const w = this.width;
    return x >= w ? x - w : x < 0 ? x + w : x;
  }

  private wrapY(y: number): number {
    const h = this.height;
    return y >= h ? y - h : y < 0 ? y + h : y;
  }
}
