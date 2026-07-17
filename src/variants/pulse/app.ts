import { VariantAudio } from '../audio';
import type { VariantApp, VariantAppOptions } from '../types';
import { BrianSim, FIRING, REFRACTORY, type Rng } from './sim';

const CELL_TARGET = 11;
const MAX_CELLS = 20000;
const TICK_HZ = 7;
const TICK_HZ_REDUCED = 5.5;
const DECAY_PER_FRAME = 0.9;
const REFRACTORY_LEVEL = 0.55;
const MIN_FIRING = 10;
const SOUP_SIZE = 14;
const SOUP_P = 0.35;
const ALPHA_LEVELS = 16;
const BG = '#050510';
const FADE = 'rgba(5,5,16,0.22)';

function alphaTable(r: number, g: number, b: number, scale: number): string[] {
  const table: string[] = [];
  for (let i = 0; i < ALPHA_LEVELS; i++) {
    const a = (((i + 1) / ALPHA_LEVELS) * scale).toFixed(3);
    table.push(`rgba(${r},${g},${b},${a})`);
  }
  return table;
}

const CYAN_CORE = alphaTable(77, 243, 255, 1);
const CYAN_GLOW = alphaTable(77, 243, 255, 0.12);
const MAGENTA_CORE = alphaTable(176, 76, 255, 1);
const MAGENTA_GLOW = alphaTable(176, 76, 255, 0.12);

function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

class PulseApp implements VariantApp {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly audio: VariantAudio;
  private readonly rand: Rng;
  private readonly tickInterval: number;
  private readonly flash: number;

  private sim: BrianSim;
  private intensity: Float32Array;
  private hue: Uint8Array;
  private strokeMark: Uint32Array;
  private strokeId = 0;
  private readonly picks = new Int32Array(3);

  private width = 0;
  private height = 0;
  private cell = CELL_TARGET;
  private gridX = 0;
  private gridY = 0;
  private dots: HTMLCanvasElement | null = null;

  private raf = 0;
  private running = false;
  private lastTime = 0;
  private tickAcc = 0;
  private padOn = false;
  private lastX = 0;
  private lastY = 0;

  constructor(canvas: HTMLCanvasElement, opts: VariantAppOptions) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;
    this.rand = opts.seed != null ? mulberry32(opts.seed) : Math.random;
    this.tickInterval = 1 / (opts.reducedMotion ? TICK_HZ_REDUCED : TICK_HZ);
    this.flash = opts.reducedMotion ? 0.65 : 1;
    this.sim = new BrianSim(1, 1);
    this.intensity = new Float32Array(1);
    this.hue = new Uint8Array(1);
    this.strokeMark = new Uint32Array(1);
    this.audio = new VariantAudio({
      intervals: [0, 3, 5, 7, 10],
      rootMidi: 64,
      octaves: 2,
      bpm: 96,
      pluck: { preset: 'glass', volume: -13 },
      pad: { voices: 4, volume: -22, attack: 3, release: 5 },
      fx: {
        reverbDecay: 7,
        reverbWet: 0.45,
        delayTime: 0.3125,
        delayFeedback: 0.35,
        delayWet: 0.22,
        filterBase: 1600,
        filterSpan: 2600,
        chorus: false,
      },
    });
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  resize(width: number, height: number, dpr: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.canvas.width = Math.max(1, Math.round(width * dpr));
    this.canvas.height = Math.max(1, Math.round(height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let cell = CELL_TARGET;
    if (Math.floor(this.width / cell) * Math.floor(this.height / cell) > MAX_CELLS) {
      cell = Math.ceil(Math.sqrt((this.width * this.height) / MAX_CELLS));
    }
    this.cell = cell;
    const cols = Math.max(1, Math.floor(this.width / cell));
    const rows = Math.max(1, Math.floor(this.height / cell));
    this.gridX = (this.width - cols * cell) / 2;
    this.gridY = (this.height - rows * cell) / 2;

    this.sim = new BrianSim(cols, rows);
    this.intensity = new Float32Array(cols * rows);
    this.hue = new Uint8Array(cols * rows);
    this.strokeMark = new Uint32Array(cols * rows);
    this.strokeId = 0;
    this.buildDots(dpr, cols, rows);

    this.sim.seedSoup(
      Math.floor(cols / 2 + (this.rand() - 0.5) * 6),
      Math.floor(rows / 2 + (this.rand() - 0.5) * 6),
      SOUP_SIZE,
      SOUP_P,
      this.rand,
    );
    this.syncEnvelopes();

    this.ctx.fillStyle = BG;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  pointerDown(x: number, y: number): void {
    this.strokeId++;
    this.lastX = x;
    this.lastY = y;
    const [col, row] = this.cellAt(x, y);
    this.stampBlock(col, row);
    this.audio.pluck(this.audio.midiAt(1 - row / this.sim.rows), { vel: 0.8 });
  }

  pointerMove(x: number, y: number, down: boolean): void {
    if (!down) return;
    const dx = x - this.lastX;
    const dy = y - this.lastY;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(dist / (this.cell * 0.5)));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const [col, row] = this.cellAt(this.lastX + dx * t, this.lastY + dy * t);
      this.stampBlock(col, row);
    }
    this.lastX = x;
    this.lastY = y;
  }

  pointerUp(): void {
    // stroke dedupe resets on the next pointerDown via strokeId
  }

  unlockAudio(): Promise<void> {
    return this.audio.init();
  }

  setVolume(v: number): void {
    this.audio.setVolume(v);
  }

  dispose(): void {
    this.stop();
    this.audio.dispose();
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.25, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.tickAcc += dt;
    while (this.tickAcc >= this.tickInterval) {
      this.tickAcc -= this.tickInterval;
      this.tick();
    }
    this.render(dt);
  };

  private tick(): void {
    this.sim.step();
    const firing = this.sim.firingCount;
    const total = this.sim.cols * this.sim.rows;

    const n = this.sim.pickSpreadFiring(this.picks, this.rand);
    for (let k = 0; k < n; k++) {
      const i = this.picks[k];
      const row = Math.floor(i / this.sim.cols);
      const density = this.sim.firingNeighborFraction(i);
      this.audio.pluck(this.audio.midiAt(1 - row / this.sim.rows), {
        quantize: '16n',
        vel: 0.5 + 0.4 * density,
      });
    }
    this.audio.setBrightness(clamp01(firing / (total * 0.05)));

    if (firing > 0 && !this.padOn) {
      this.audio.padSet(0, this.audio.degree(0) - 12);
      this.padOn = true;
    } else if (firing === 0 && this.padOn) {
      this.audio.padSet(0, null);
      this.padOn = false;
    }

    if (firing < MIN_FIRING) this.strike();
    this.syncEnvelopes();
  }

  private strike(): void {
    const col = Math.floor(this.rand() * this.sim.cols);
    const row = Math.floor(this.rand() * this.sim.rows);
    this.sim.seedSoup(col, row, SOUP_SIZE, SOUP_P, this.rand);
    this.audio.pluck(this.audio.midiAt(1 - row / this.sim.rows), { vel: 0.4, dur: '2n' });
  }

  private syncEnvelopes(): void {
    const cells = this.sim.cells;
    const refractoryGlow = this.flash * REFRACTORY_LEVEL;
    for (let i = 0; i < cells.length; i++) {
      const s = cells[i];
      if (s === FIRING) {
        this.intensity[i] = this.flash;
        this.hue[i] = 0;
      } else if (s === REFRACTORY) {
        this.hue[i] = 1;
        if (this.intensity[i] < refractoryGlow) this.intensity[i] = refractoryGlow;
      }
    }
  }

  private render(dt: number): void {
    const { ctx, cell, gridX, gridY } = this;
    const cols = this.sim.cols;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = FADE;
    ctx.fillRect(0, 0, this.width, this.height);
    if (this.dots) ctx.drawImage(this.dots, 0, 0, this.width, this.height);

    const decay = Math.pow(DECAY_PER_FRAME, dt * 60);
    const core = cell - 1;
    const glow = cell * 2;
    const glowOff = cell * 0.5;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.intensity.length; i++) {
      const v = this.intensity[i] * decay;
      this.intensity[i] = v;
      if (v < 0.02) {
        this.intensity[i] = 0;
        continue;
      }
      const level = Math.min(ALPHA_LEVELS - 1, Math.floor(v * ALPHA_LEVELS));
      const magenta = this.hue[i] === 1;
      const col = i % cols;
      const row = (i - col) / cols;
      const x = gridX + col * cell;
      const y = gridY + row * cell;
      ctx.fillStyle = magenta ? MAGENTA_GLOW[level] : CYAN_GLOW[level];
      ctx.fillRect(x - glowOff, y - glowOff, glow, glow);
      ctx.fillStyle = magenta ? MAGENTA_CORE[level] : CYAN_CORE[level];
      ctx.fillRect(x, y, core, core);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private cellAt(x: number, y: number): [number, number] {
    const col = Math.min(this.sim.cols - 1, Math.max(0, Math.floor((x - this.gridX) / this.cell)));
    const row = Math.min(this.sim.rows - 1, Math.max(0, Math.floor((y - this.gridY) / this.cell)));
    return [col, row];
  }

  private stampBlock(col: number, row: number): void {
    for (let r = row; r < row + 2; r++) {
      for (let c = col; c < col + 2; c++) {
        if (!this.sim.inBounds(c, r)) continue;
        const i = r * this.sim.cols + c;
        if (this.strokeMark[i] === this.strokeId) continue;
        this.strokeMark[i] = this.strokeId;
        this.sim.setFiring(c, r);
        this.intensity[i] = this.flash;
        this.hue[i] = 0;
      }
    }
  }

  // Dots prerendered at low alpha; the per-frame fade re-darkens them, so the
  // steady-state ghost level lands near 0.05.
  private buildDots(dpr: number, cols: number, rows: number): void {
    const dots = document.createElement('canvas');
    dots.width = this.canvas.width;
    dots.height = this.canvas.height;
    const dctx = dots.getContext('2d');
    if (!dctx) {
      this.dots = null;
      return;
    }
    dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dctx.fillStyle = 'rgba(150,190,230,0.012)';
    const half = this.cell / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        dctx.fillRect(this.gridX + c * this.cell + half - 0.75, this.gridY + r * this.cell + half - 0.75, 1.5, 1.5);
      }
    }
    this.dots = dots;
  }
}

export function createPulse(canvas: HTMLCanvasElement, opts: VariantAppOptions): VariantApp {
  return new PulseApp(canvas, opts);
}
