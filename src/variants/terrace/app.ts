import { VariantAudio } from '../audio';
import type { VariantApp, VariantAppOptions } from '../types';
import { Sandpile } from './sim';

const PAPER = '#f4eee2';
const INK = '#3b3a36';
const HEIGHT_COLORS: readonly string[] = ['', '#e3cf9f', '#c4643b', '#7a8b6f'];
const CELL_TARGET = 13;
const MAX_CELLS = 16000;
const TOPPLE_BUDGET = 40;
const TOPPLE_BUDGET_REDUCED = 320;
const DRIP_INTERVAL = 0.7;
const RAKE_INTERVAL = 180;
const RAKE_DURATION = 2;
const DRAG_STEP_PX = 24;
const AVALANCHE_THRESHOLDS: readonly number[] = [1, 3, 8, 20, 50, 120, 280];
const BLOOM_MIN_TOPPLES = 300;
const BLOOM_COOLDOWN = 30;
const PAD_RELEASE_DELAY = 2;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface RakeState {
  edge: number;
  depth: number;
  progress: number;
}

export function createTerrace(canvas: HTMLCanvasElement, opts: VariantAppOptions): VariantApp {
  const maybeCtx = canvas.getContext('2d');
  if (!maybeCtx) throw new Error('canvas 2d context unavailable');
  const ctx: CanvasRenderingContext2D = maybeCtx;
  const rng = mulberry32(opts.seed ?? (Math.random() * 2 ** 32) >>> 0);
  const toppleBudget = opts.reducedMotion ? TOPPLE_BUDGET_REDUCED : TOPPLE_BUDGET;

  const audio = new VariantAudio({
    intervals: [0, 1, 5, 7, 8],
    rootMidi: 57,
    octaves: 2,
    bpm: 80,
    pluck: { preset: 'string', volume: -10 },
    pad: { voices: 4, volume: -23, attack: 5, release: 8 },
    fx: {
      reverbDecay: 6,
      reverbWet: 0.4,
      delayTime: 0.45,
      delayFeedback: 0.25,
      delayWet: 0.2,
      filterBase: 2200,
      filterSpan: 2000,
      chorus: false,
    },
  });

  let width = 0;
  let height = 0;
  let cell = CELL_TARGET;
  let offsetX = 0;
  let offsetY = 0;
  let pile = new Sandpile(1, 1);
  let flash = new Float32Array(1);
  let grainPattern: CanvasPattern | null = null;

  let raf = 0;
  let running = false;
  let last = 0;
  let elapsed = 0;

  let dripTimer = 0;
  let dripCount = 0;
  let rakeTimer = 0;
  let rake: RakeState | null = null;

  let cascadeActive = false;
  let avalancheTopples = 0;
  let thresholdIdx = 0;
  let baseDegree = 0;
  let avalancheBloomed = false;
  let lastBloomAt = -Infinity;
  let padReleaseAt: number | null = null;

  let dragLast: [number, number] | null = null;
  let dragCarry = 0;

  function gaussian(): number {
    const u = Math.max(rng(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  }

  function makeGrainPattern(): CanvasPattern | null {
    const tile = document.createElement('canvas');
    tile.width = 96;
    tile.height = 96;
    const tctx = tile.getContext('2d');
    if (!tctx) return null;
    for (let i = 0; i < 420; i++) {
      tctx.fillStyle = rng() < 0.5 ? INK : '#ffffff';
      tctx.fillRect(Math.floor(rng() * 96), Math.floor(rng() * 96), 1, 1);
    }
    return ctx.createPattern(tile, 'repeat');
  }

  function cellAt(px: number, py: number): [number, number] {
    const cx = Math.min(pile.cols - 1, Math.max(0, Math.floor((px - offsetX) / cell)));
    const cy = Math.min(pile.rows - 1, Math.max(0, Math.floor((py - offsetY) / cell)));
    return [cx, cy];
  }

  function beginAvalanche(originYpx: number): void {
    cascadeActive = true;
    avalancheTopples = 0;
    thresholdIdx = 0;
    avalancheBloomed = false;
    baseDegree = Math.round((1 - originYpx / Math.max(1, height)) * (audio.degreeCount - 1));
    padReleaseAt = null;
    audio.padSet(0, audio.degree(0) - 12, 0.25);
  }

  function drop(px: number, py: number, grains: number): void {
    const [cx, cy] = cellAt(px, py);
    pile.addGrain(cx, cy, grains);
    if (!cascadeActive && pile.pending > 0) beginAvalanche(py);
  }

  function seedPile(): void {
    // Synchronous center-drop resolve yields the classic mandala on load.
    // Batched because cell heights are Uint8-capped at 255.
    let grains = Math.floor(pile.cols * pile.rows * 0.9);
    while (grains > 0) {
      const batch = Math.min(200, grains);
      grains -= batch;
      pile.addGrain(pile.cols >> 1, pile.rows >> 1, batch);
      pile.resolve();
    }
  }

  function updateDripper(dt: number): void {
    dripTimer += dt;
    if (dripTimer < DRIP_INTERVAL) return;
    dripTimer -= DRIP_INTERVAL;
    dripCount++;
    const cx = (pile.cols >> 1) + Math.round(gaussian() * 1.6);
    const cy = (pile.rows >> 1) + Math.round(gaussian() * 1.6);
    const px = offsetX + (cx + 0.5) * cell;
    const py = offsetY + (cy + 0.5) * cell;
    drop(px, py, 1);
    if (dripCount % 4 === 0) audio.pluck(audio.degree(0) + 24, { vel: 0.15 });
  }

  function startRake(): void {
    const edge = Math.floor(rng() * 4);
    const across = edge < 2 ? pile.cols : pile.rows;
    const depth = Math.min(12, Math.max(4, Math.round(across * 0.1)));
    rake = { edge, depth, progress: 0 };
    audio.pluck(audio.degree(0) - 12, { vel: 0.3, dur: '2n' });
  }

  function rakeLine(r: RakeState, line: number): void {
    for (let d = 0; d < r.depth; d++) {
      const along = r.edge % 2 === 0 ? d : (r.edge < 2 ? pile.cols : pile.rows) - 1 - d;
      const x = r.edge < 2 ? along : line;
      const y = r.edge < 2 ? line : along;
      if (!pile.inBounds(x, y)) continue;
      pile.clearCell(x, y);
      if (!opts.reducedMotion) {
        const i = pile.index(x, y);
        flash[i] = Math.max(flash[i], 0.35);
      }
    }
  }

  function updateRake(dt: number): void {
    if (!rake) {
      rakeTimer += dt;
      if (rakeTimer >= RAKE_INTERVAL) {
        rakeTimer = 0;
        startRake();
      }
      return;
    }
    const span = rake.edge < 2 ? pile.rows : pile.cols;
    const before = Math.floor(rake.progress * span);
    rake.progress = Math.min(1, rake.progress + dt / RAKE_DURATION);
    const after = Math.floor(rake.progress * span);
    for (let line = before; line < after; line++) rakeLine(rake, line);
    if (rake.progress >= 1) rake = null;
  }

  function updateCascade(): void {
    if (pile.pending > 0) {
      const { toppled, count } = pile.step(toppleBudget);
      avalancheTopples += count;
      if (!opts.reducedMotion) for (const i of toppled) flash[i] = 1;
      while (
        thresholdIdx < AVALANCHE_THRESHOLDS.length &&
        avalancheTopples >= AVALANCHE_THRESHOLDS[thresholdIdx]
      ) {
        audio.pluck(audio.degree(baseDegree + thresholdIdx), {
          quantize: '16n',
          vel: 0.4 + 0.06 * thresholdIdx,
        });
        thresholdIdx++;
      }
      if (
        avalancheTopples > BLOOM_MIN_TOPPLES &&
        !avalancheBloomed &&
        elapsed - lastBloomAt > BLOOM_COOLDOWN
      ) {
        avalancheBloomed = true;
        lastBloomAt = elapsed;
        audio.bloom([
          audio.degree(baseDegree),
          audio.degree(baseDegree + 1),
          audio.degree(baseDegree + 2),
        ]);
      }
    }
    if (cascadeActive && pile.pending === 0) {
      cascadeActive = false;
      padReleaseAt = elapsed + PAD_RELEASE_DELAY;
    }
    if (padReleaseAt != null && elapsed >= padReleaseAt) {
      padReleaseAt = null;
      audio.padSet(0, null);
    }
  }

  function decayFlash(dt: number): void {
    const k = dt * 6;
    for (let i = 0; i < flash.length; i++) {
      if (flash[i] > 0) flash[i] = Math.max(0, flash[i] - k);
    }
  }

  function draw(): void {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, width, height);
    const side = cell - 1;
    for (let level = 1; level <= 3; level++) {
      ctx.fillStyle = HEIGHT_COLORS[level];
      for (let i = 0; i < pile.heights.length; i++) {
        const h = Math.min(3, pile.heights[i]);
        if (h !== level) continue;
        const x = i % pile.cols;
        const y = (i - x) / pile.cols;
        ctx.fillRect(offsetX + x * cell, offsetY + y * cell, side, side);
      }
    }
    if (!opts.reducedMotion) {
      ctx.fillStyle = INK;
      for (let i = 0; i < flash.length; i++) {
        if (flash[i] <= 0) continue;
        const x = i % pile.cols;
        const y = (i - x) / pile.cols;
        ctx.globalAlpha = flash[i];
        ctx.fillRect(offsetX + x * cell, offsetY + y * cell, side, side);
      }
      ctx.globalAlpha = 1;
    }
    if (grainPattern) {
      ctx.globalAlpha = 0.03;
      ctx.fillStyle = grainPattern;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;
    }
  }

  function frame(t: number): void {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.25, (t - last) / 1000);
    last = t;
    elapsed += dt;
    updateDripper(dt);
    updateRake(dt);
    updateCascade();
    decayFlash(dt);
    draw();
  }

  return {
    start(): void {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    stop(): void {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
    },
    resize(w: number, h: number, dpr: number): void {
      width = w;
      height = h;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cell = CELL_TARGET;
      let cols = Math.max(1, Math.floor(w / cell));
      let rows = Math.max(1, Math.floor(h / cell));
      while (cols * rows > MAX_CELLS) {
        cell++;
        cols = Math.max(1, Math.floor(w / cell));
        rows = Math.max(1, Math.floor(h / cell));
      }
      offsetX = (w - cols * cell) / 2;
      offsetY = (h - rows * cell) / 2;
      pile = new Sandpile(cols, rows);
      flash = new Float32Array(cols * rows);
      rake = null;
      cascadeActive = false;
      padReleaseAt = null;
      if (!grainPattern) grainPattern = makeGrainPattern();
      seedPile();
      draw();
    },
    pointerDown(x: number, y: number): void {
      dragLast = [x, y];
      dragCarry = 0;
      drop(x, y, 4);
    },
    pointerMove(x: number, y: number, down: boolean): void {
      if (!down || !dragLast) return;
      const [lx, ly] = dragLast;
      const dist = Math.hypot(x - lx, y - ly);
      dragCarry += dist;
      while (dragCarry >= DRAG_STEP_PX) {
        dragCarry -= DRAG_STEP_PX;
        const t = dist > 0 ? 1 - dragCarry / dist : 1;
        drop(lx + (x - lx) * t, ly + (y - ly) * t, 1);
      }
      dragLast = [x, y];
    },
    pointerUp(): void {
      dragLast = null;
      dragCarry = 0;
    },
    async unlockAudio(): Promise<void> {
      await audio.init();
    },
    setVolume(v: number): void {
      audio.setVolume(v);
    },
    dispose(): void {
      this.stop();
      audio.dispose();
    },
  };
}
