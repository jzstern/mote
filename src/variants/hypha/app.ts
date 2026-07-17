import { VariantAudio } from '../audio';
import type { VariantApp, VariantAppOptions } from '../types';
import { HyphaSim } from './sim';

const BASE_AGENTS = 3500;
const REDUCED_AGENTS = 2000;
const GOLDEN_ANGLE = 2.399963229728653;
const ANCHOR_DEGREES = [0, 4, 8, 11, 14, 18];
const ANCHOR_WINDOW = 4;
const ANCHOR_HI = 1.0;
const ANCHOR_LO = 0.45;
const ANCHOR_CHECK_INTERVAL = 0.25;
const SPARKLE_BASE_INTERVAL = 2.5;
const SPARKLE_MIN_DENSITY = 1.2;
const BRIGHTNESS_INTERVAL = 1;
const DRAG_DROP_SPACING = 60;
const DENSITY_TO_LUT = 34;
const BG = '#04070c';
const ACCENT = '#3fe8c8';

const LUT_STOPS: readonly [number, number, number, number][] = [
  [0.0, 4, 7, 12],
  [0.35, 28, 79, 70],
  [0.72, 63, 232, 200],
  [1.0, 207, 200, 255],
];

function buildLut(): Uint32Array {
  const littleEndian = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
  const lut = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    const t = Math.pow(i / 255, 0.85);
    let s = 0;
    while (s < LUT_STOPS.length - 2 && t > LUT_STOPS[s + 1][0]) s++;
    const [t0, r0, g0, b0] = LUT_STOPS[s];
    const [t1, r1, g1, b1] = LUT_STOPS[s + 1];
    const k = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    const r = Math.round(r0 + (r1 - r0) * k);
    const g = Math.round(g0 + (g1 - g0) * k);
    const b = Math.round(b0 + (b1 - b0) * k);
    lut[i] = littleEndian
      ? ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
      : ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0;
  }
  return lut;
}

interface Anchor {
  x: number;
  y: number;
  midi: number;
  sounding: boolean;
  /** Last sampled density norm 0..1; also drives the visual glow. */
  level: number;
  glow: number;
}

export function createHypha(canvas: HTMLCanvasElement, opts: VariantAppOptions): VariantApp {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');

  const audio = new VariantAudio({
    intervals: [0, 2, 4, 6, 7, 9, 11],
    rootMidi: 45,
    octaves: 3,
    bpm: 60,
    pluck: { preset: 'glass', volume: -18 },
    pad: { voices: 8, volume: -19, attack: 6, release: 9 },
    fx: {
      reverbDecay: 12,
      reverbWet: 0.6,
      delayTime: 0.6,
      delayFeedback: 0.35,
      delayWet: 0.18,
      filterBase: 900,
      filterSpan: 1200,
      chorus: true,
    },
  });

  const lut = buildLut();
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d');
  if (!offCtx) throw new Error('2d context unavailable');

  let width = 0;
  let height = 0;
  let sim: HyphaSim | null = null;
  let image: ImageData | null = null;
  let pixels: Uint32Array | null = null;
  const anchors: Anchor[] = [];

  let running = false;
  let rafId = 0;
  let lastTime = 0;
  let clock = 0;
  let anchorTimer = 0;
  let sparkleTimer = 0;
  let sparkleInterval = SPARKLE_BASE_INTERVAL;
  let brightnessTimer = 0;
  let lastDropX = 0;
  let lastDropY = 0;

  const agentBudget = (): number => {
    const base = opts.reducedMotion ? REDUCED_AGENTS : BASE_AGENTS;
    const areaScale = Math.min(1, Math.max(0.45, (width * height) / (1280 * 800)));
    return Math.round(base * areaScale);
  };

  const rebuildAnchors = (): void => {
    anchors.length = 0;
    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.min(width, height) * 0.36;
    for (let i = 0; i < ANCHOR_DEGREES.length; i++) {
      const r = maxR * Math.sqrt((i + 1) / ANCHOR_DEGREES.length);
      const a = i * GOLDEN_ANGLE - 0.5;
      anchors.push({
        x: cx + Math.cos(a) * r,
        y: cy + Math.sin(a) * r,
        midi: audio.degree(ANCHOR_DEGREES[i]),
        sounding: false,
        level: 0,
        glow: 0,
      });
    }
  };

  const releaseAllPads = (): void => {
    anchors.forEach((a, slot) => {
      if (a.sounding) audio.padSet(slot, null);
      a.sounding = false;
    });
  };

  const checkAnchors = (): void => {
    if (!sim) return;
    for (let slot = 0; slot < anchors.length; slot++) {
      const a = anchors[slot];
      const mean = sim.windowMean(a.x / 2, a.y / 2, ANCHOR_WINDOW);
      a.level = Math.min(1, mean / (ANCHOR_HI * 2));
      if (!a.sounding && mean > ANCHOR_HI) {
        a.sounding = true;
        audio.padSet(slot, a.midi, 0.4 + 0.4 * a.level);
      } else if (a.sounding && mean < ANCHOR_LO) {
        a.sounding = false;
        audio.padSet(slot, null);
      }
    }
  };

  const sparkle = (): void => {
    if (!sim) return;
    let bestDensity = 0;
    let bestY = 0;
    for (let i = 0; i < 24; i++) {
      const fx = Math.random() * sim.width;
      const fy = Math.random() * sim.height;
      const d = sim.fieldAt(fx, fy);
      if (d > bestDensity) {
        bestDensity = d;
        bestY = fy;
      }
    }
    if (bestDensity < SPARKLE_MIN_DENSITY) return;
    audio.pluck(audio.midiAt(1 - bestY / sim.height) + 24, { vel: 0.25 });
  };

  const audioTick = (dt: number): void => {
    if (!sim) return;
    anchorTimer += dt;
    if (anchorTimer >= ANCHOR_CHECK_INTERVAL) {
      anchorTimer = 0;
      checkAnchors();
    }
    sparkleTimer += dt;
    if (sparkleTimer >= sparkleInterval) {
      sparkleTimer = 0;
      sparkleInterval = SPARKLE_BASE_INTERVAL + (Math.random() - 0.5) * 1.6;
      sparkle();
    }
    brightnessTimer += dt;
    if (brightnessTimer >= BRIGHTNESS_INTERVAL) {
      brightnessTimer = 0;
      audio.setBrightness(Math.min(1, sim.totalEnergy() / (sim.agentCount * 22)));
    }
  };

  const render = (dt: number): void => {
    if (!sim || !image || !pixels) return;
    const field = sim.field;
    for (let i = 0; i < field.length; i++) {
      const idx = Math.min(255, (field[i] * DENSITY_TO_LUT) | 0);
      pixels[i] = lut[idx];
    }
    offCtx.putImageData(image, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, width, height);

    for (let i = 0; i < sim.attractors.length; i++) {
      const a = sim.attractors[i];
      const breathe = 0.5 + 0.5 * Math.sin(clock * 2.2 + i * 1.7);
      ctx.beginPath();
      ctx.arc(a.x * 2, a.y * 2, 9 + 4 * breathe, 0, Math.PI * 2);
      ctx.strokeStyle = ACCENT;
      ctx.globalAlpha = (0.15 + 0.15 * breathe) * a.strength;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    const ease = 1 - Math.exp(-dt * 3);
    for (const a of anchors) {
      const target = a.sounding ? a.level : 0;
      a.glow += (target - a.glow) * ease;
      if (a.glow > 0.02) {
        const glowR = 10 + 22 * a.glow;
        const grad = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, glowR);
        grad.addColorStop(0, ACCENT);
        grad.addColorStop(1, 'rgba(63,232,200,0)');
        ctx.globalAlpha = 0.22 * a.glow;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(a.x, a.y, glowR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 0.06 + 0.4 * a.glow;
      ctx.fillStyle = ACCENT;
      ctx.beginPath();
      ctx.arc(a.x, a.y, 1.8 + 2.4 * a.glow, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  const frame = (now: number): void => {
    if (!running) return;
    const dt = Math.min((now - lastTime) / 1000, 0.25);
    lastTime = now;
    clock += dt;
    if (sim) {
      sim.step(dt);
      audioTick(dt);
      render(dt);
    }
    rafId = requestAnimationFrame(frame);
  };

  const dropAttractor = (x: number, y: number): void => {
    sim?.addAttractor(x / 2, y / 2);
    lastDropX = x;
    lastDropY = y;
  };

  return {
    start(): void {
      if (running) return;
      running = true;
      lastTime = performance.now();
      rafId = requestAnimationFrame(frame);
    },

    stop(): void {
      running = false;
      cancelAnimationFrame(rafId);
    },

    resize(w: number, h: number, dpr: number): void {
      width = w;
      height = h;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const fw = Math.max(4, Math.ceil(w / 2));
      const fh = Math.max(4, Math.ceil(h / 2));
      sim = new HyphaSim(fw, fh, agentBudget());
      off.width = fw;
      off.height = fh;
      image = offCtx.createImageData(fw, fh);
      pixels = new Uint32Array(image.data.buffer);
      releaseAllPads();
      rebuildAnchors();
    },

    pointerDown(x: number, y: number): void {
      dropAttractor(x, y);
      audio.bloom([audio.degree(0), audio.degree(2), audio.degree(4)], 0.1);
    },

    pointerMove(x: number, y: number, down: boolean): void {
      if (!down) return;
      if (Math.hypot(x - lastDropX, y - lastDropY) >= DRAG_DROP_SPACING) dropAttractor(x, y);
    },

    pointerUp(): void {},

    async unlockAudio(): Promise<void> {
      await audio.init();
    },

    setVolume(v: number): void {
      audio.setVolume(v);
    },

    dispose(): void {
      running = false;
      cancelAnimationFrame(rafId);
      audio.dispose();
    },
  };
}
