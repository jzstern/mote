import { VariantAudio } from '../audio';
import type { VariantApp, VariantAppOptions } from '../types';
import { LoomSim, STITCH_CREAM, STITCH_MADDER } from './sim';

const BPM = 84;
const ROW_PERIOD = 60 / BPM / 2;
const MAX_DT = 0.25;
const COL_TARGET = 14;
const MIN_COLS = 48;
const MAX_COLS = 112;
const ROW_PITCH = 8;
const FELL = 0.7;
const OFFSCREEN_ROWS = 4;
const STITCH_H = 5;
const AGE_ALPHA_FLOOR = 0.75;
const AGE_ALPHA_RATE = 0.004;
const PAD_MIN = 0.05;
const PAD_MAX = 0.6;
const PLUCK_MIN_GAP = 0.2;

const BG = '#1b2340';
const CREAM = '#ede4d0';
const MADDER = '#c65b4e';
const MARIGOLD = '#e2a93b';
const WARP = 'rgba(237,228,208,0.07)';
const FELL_LINE = 'rgba(237,228,208,0.1)';
const SHUTTLE = 'rgba(226,169,59,0.5)';
const SELVAGE = 'rgba(226,169,59,0.28)';

function stitchFill(code: number): string {
  if (code === STITCH_CREAM) return CREAM;
  if (code === STITCH_MADDER) return MADDER;
  return MARIGOLD;
}

class LoomApp implements VariantApp {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly audio: VariantAudio;
  private readonly reducedMotion: boolean;

  private sim: LoomSim;
  private width = 0;
  private height = 0;
  private colPitch = COL_TARGET;
  private warp: HTMLCanvasElement | null = null;

  private raf = 0;
  private running = false;
  private lastTime = 0;
  private rowAcc = 0;
  private padOn = false;
  private lastPointerX = 0;
  private lastAudiblePluck = -Infinity;
  private readonly strokeCols = new Set<number>();

  constructor(canvas: HTMLCanvasElement, opts: VariantAppOptions) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;
    this.reducedMotion = opts.reducedMotion;
    const seed = opts.seed ?? ((Math.random() * 0xffffffff) >>> 0);
    this.sim = new LoomSim(MIN_COLS, 8, seed);
    this.audio = new VariantAudio({
      intervals: [0, 2, 4, 6, 7, 9, 11],
      rootMidi: 62,
      octaves: 2,
      bpm: BPM,
      pluck: { preset: 'bell', volume: -14 },
      pad: { voices: 4, volume: -24, attack: 5, release: 8 },
      fx: {
        reverbDecay: 5,
        reverbWet: 0.35,
        delayTime: 0.357,
        delayFeedback: 0.3,
        delayWet: 0.2,
        filterBase: 1800,
        filterSpan: 2200,
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

    const cols = Math.min(MAX_COLS, Math.max(MIN_COLS, Math.round(this.width / COL_TARGET)));
    this.colPitch = this.width / cols;
    const capacity = Math.ceil((this.height * FELL) / ROW_PITCH) + OFFSCREEN_ROWS;
    this.sim.resize(cols, Math.max(capacity, this.sim.capacity));
    this.buildWarp(dpr, cols);
  }

  pointerDown(x: number): void {
    this.strokeCols.clear();
    this.lastPointerX = x;
    this.stamp(this.colAt(x));
  }

  pointerMove(x: number, _y: number, down: boolean): void {
    if (!down) return;
    const from = this.colAt(this.lastPointerX);
    const to = this.colAt(x);
    const dir = to >= from ? 1 : -1;
    for (let col = from; col !== to + dir; col += dir) this.stamp(col);
    this.lastPointerX = x;
  }

  pointerUp(): void {
    this.strokeCols.clear();
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
    const dt = Math.min(MAX_DT, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.rowAcc += dt;
    while (this.rowAcc >= ROW_PERIOD) {
      this.rowAcc -= ROW_PERIOD;
      this.weaveRow();
    }
    this.render();
  };

  private weaveRow(): void {
    const event = this.sim.step();
    const { audio } = this;
    if (event.ruleChanged) audio.pluck(audio.degree(0), { vel: 0.4, dur: '2n', quantize: '8n' });
    if (event.reseeded) audio.pluck(audio.degree(1), { vel: 0.35, dur: '2n', quantize: '8n' });

    const row = this.sim.rowAt(0);
    const cols = this.sim.cols;
    const mid = (cols - 1) / 2;
    let left = -1;
    let right = -1;
    let center = -1;
    let bestDist = Infinity;
    for (let i = 0; i < cols; i++) {
      if (row[i] === 0) continue;
      if (left < 0) left = i;
      right = i;
      const d = Math.abs(i - mid);
      if (d < bestDist) {
        bestDist = d;
        center = i;
      }
    }
    if (left >= 0) {
      const vel = 0.45 + 0.25 * event.liveFraction;
      audio.pluck(audio.midiAt(left / (cols - 1)), { quantize: '8n', vel });
      if (center !== left) audio.pluck(audio.midiAt(center / (cols - 1)), { quantize: '8n', vel });
      if (right !== left && right !== center) {
        audio.pluck(audio.midiAt(right / (cols - 1)), { quantize: '8n', vel });
      }
    }

    // Before audio unlock padSet is a no-op, so padOn must not latch early.
    const healthy =
      audio.ready && event.liveFraction >= PAD_MIN && event.liveFraction <= PAD_MAX;
    if (healthy && !this.padOn) {
      audio.padSet(0, audio.degree(0) - 12);
      this.padOn = true;
    } else if (!healthy && this.padOn) {
      audio.padSet(0, null);
      this.padOn = false;
    }
    audio.setBrightness(event.liveFraction);
  }

  private render(): void {
    const { ctx, sim, colPitch } = this;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, this.width, this.height);
    if (this.warp) ctx.drawImage(this.warp, 0, 0, this.width, this.height);

    const frac = this.reducedMotion ? 0 : Math.min(1, this.rowAcc / ROW_PERIOD);
    const fellY = this.height * FELL;
    const stitchW = Math.min(10, colPitch * 0.72);
    const radius = STITCH_H / 2;

    for (let age = 0; age < sim.size; age++) {
      const y = fellY - (age + frac) * ROW_PITCH;
      if (y < -ROW_PITCH) break;
      ctx.globalAlpha = Math.max(AGE_ALPHA_FLOOR, 1 - age * AGE_ALPHA_RATE);
      if (sim.isSelvage(age)) {
        ctx.fillStyle = SELVAGE;
        ctx.fillRect(0, y + radius + 1, this.width, 1);
      }
      const row = sim.rowAt(age);
      const colors = sim.colorAt(age);
      let currentFill = '';
      for (let col = 0; col < sim.cols; col++) {
        if (row[col] === 0) continue;
        const fill = stitchFill(colors[col]);
        if (fill !== currentFill) {
          ctx.fillStyle = fill;
          currentFill = fill;
        }
        const x = (col + 0.5) * colPitch;
        ctx.beginPath();
        ctx.roundRect(x - stitchW / 2, y - radius, stitchW, STITCH_H, radius);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
    const lineY = Math.round(fellY + ROW_PITCH * 0.75) + 0.5;
    ctx.strokeStyle = FELL_LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, lineY);
    ctx.lineTo(this.width, lineY);
    ctx.stroke();
    // The shuttle traverses the loom once per row period.
    const shuttleX = (this.reducedMotion ? 0.5 : frac) * this.width;
    ctx.strokeStyle = SHUTTLE;
    ctx.beginPath();
    ctx.moveTo(shuttleX - 8, lineY);
    ctx.lineTo(shuttleX + 8, lineY);
    ctx.stroke();
  }

  private colAt(x: number): number {
    return Math.min(this.sim.cols - 1, Math.max(0, Math.floor(x / this.colPitch)));
  }

  private stamp(col: number): void {
    this.sim.setUserCell(col);
    if (this.strokeCols.has(col)) return;
    this.strokeCols.add(col);
    const now = performance.now() / 1000;
    if (now - this.lastAudiblePluck < PLUCK_MIN_GAP) return;
    this.lastAudiblePluck = now;
    this.audio.pluck(this.audio.midiAt(col / (this.sim.cols - 1)), { vel: 0.7 });
  }

  private buildWarp(dpr: number, cols: number): void {
    const warp = document.createElement('canvas');
    warp.width = this.canvas.width;
    warp.height = this.canvas.height;
    const wctx = warp.getContext('2d');
    if (!wctx) {
      this.warp = null;
      return;
    }
    wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    wctx.strokeStyle = WARP;
    wctx.lineWidth = 1;
    wctx.beginPath();
    for (let col = 0; col < cols; col++) {
      const x = Math.round((col + 0.5) * this.colPitch) + 0.5;
      wctx.moveTo(x, 0);
      wctx.lineTo(x, this.height);
    }
    wctx.stroke();
    this.warp = warp;
  }
}

export function createLoom(canvas: HTMLCanvasElement, opts: VariantAppOptions): VariantApp {
  return new LoomApp(canvas, opts);
}
