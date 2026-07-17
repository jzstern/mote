import { VariantAudio } from '../audio';
import type { VariantApp, VariantAppOptions } from '../types';
import {
  clampToBounds,
  createSim,
  holdInfluence,
  makeConfig,
  mulberry32,
  populate,
  spawnAt,
  stepSim,
  syncMeasure,
  tuneForBounds,
  type FlashEvent,
  type Rng,
} from './sim';

const BG = '#0a0f0a';
const TRAIL_FADE = 'rgba(10,15,10,0.28)';
const SPRITE_SIZE = 64;
const BODY_SIZE = 26;
const PAD_ON_SYNC = 0.5;
const PAD_OFF_SYNC = 0.3;
const BLOOM_SYNC = 0.75;
const BLOOM_COOLDOWN = 20;
const SYNC_WINDOW = 4;

function makeGlowSprite(core: string, mid: string, edge: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = SPRITE_SIZE;
  c.height = SPRITE_SIZE;
  const g = c.getContext('2d');
  if (!g) return c;
  const half = SPRITE_SIZE / 2;
  const grad = g.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, core);
  grad.addColorStop(0.28, mid);
  grad.addColorStop(1, edge);
  g.fillStyle = grad;
  g.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return c;
}

function renderGrass(width: number, height: number, dpr: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(width * dpr));
  c.height = Math.max(1, Math.round(height * dpr));
  const g = c.getContext('2d');
  if (!g) return c;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const rng = mulberry32(7261);
  const layers = [
    { tone: 'rgba(22,33,20,0.9)', reach: 0.11, blades: Math.round(width / 26) },
    { tone: 'rgba(16,26,16,0.9)', reach: 0.08, blades: Math.round(width / 18) },
    { tone: 'rgba(12,20,12,0.95)', reach: 0.055, blades: Math.round(width / 12) },
  ];
  g.lineCap = 'round';
  for (const layer of layers) {
    g.strokeStyle = layer.tone;
    for (let i = 0; i < layer.blades; i++) {
      const x = rng() * width;
      const reach = height * layer.reach * (0.6 + rng() * 0.8);
      const lean = (rng() - 0.5) * reach * 1.1;
      g.lineWidth = 0.8 + rng() * 1.4;
      g.beginPath();
      g.moveTo(x, height + 2);
      g.quadraticCurveTo(x + lean * 0.3, height - reach * 0.6, x + lean, height - reach);
      g.stroke();
    }
  }
  return c;
}

function flashAlpha(age: number, duration: number): number {
  const t = age / duration;
  if (t >= 1) return 0;
  const attack = 0.18;
  if (t < attack) {
    const u = t / attack;
    return 1 - (1 - u) * (1 - u);
  }
  const u = (t - attack) / (1 - attack);
  return (1 - u) * (1 - u);
}

export function createEmber(canvas: HTMLCanvasElement, opts: VariantAppOptions): VariantApp {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('ember: 2d context unavailable');

  const audio = new VariantAudio({
    intervals: [0, 2, 4, 7, 9],
    rootMidi: 57,
    octaves: 2,
    bpm: 72,
    pluck: { preset: 'kalimba', volume: -12 },
    pad: { voices: 6, volume: -21, attack: 4, release: 7 },
    fx: {
      reverbDecay: 9,
      reverbWet: 0.55,
      delayTime: 0.45,
      delayFeedback: 0.3,
      delayWet: 0.15,
      filterBase: 1200,
      filterSpan: 1400,
      chorus: true,
    },
  });

  const cfg = makeConfig(opts.reducedMotion, audio.degreeCount);
  const rng: Rng = mulberry32(opts.seed ?? (Math.random() * 0xffffffff) >>> 0);
  const state = createSim(0, 0);
  const flashPeak = opts.reducedMotion ? 0.7 : 1;

  const sprites = [
    makeGlowSprite('rgba(255,236,190,1)', 'rgba(255,198,107,0.5)', 'rgba(255,198,107,0)'),
    makeGlowSprite('rgba(255,216,178,1)', 'rgba(255,158,100,0.5)', 'rgba(255,158,100,0)'),
    makeGlowSprite('rgba(255,248,224,1)', 'rgba(255,206,122,0.65)', 'rgba(255,198,107,0)'),
  ];
  let grass: HTMLCanvasElement | null = null;

  let width = 0;
  let height = 0;
  let raf = 0;
  let lastFrame = 0;
  let timeSec = 0;
  let flashTimes: number[] = [];
  let padOn = false;
  let lastBloom = -Infinity;
  let pointerX = 0;
  let pointerY = 0;
  let held = false;

  const onFlash = (ev: FlashEvent): void => {
    flashTimes.push(timeSec);
    const dx = ev.x - width / 2;
    const dy = ev.y - height / 2;
    const maxDist = Math.hypot(width, height) / 2 || 1;
    const proximity = 1 - Math.min(1, Math.hypot(dx, dy) / maxDist);
    audio.pluck(audio.degree(ev.degree), { vel: 0.35 + 0.45 * proximity });
  };

  const updateSyncSound = (sync: number): void => {
    if (!padOn && sync > PAD_ON_SYNC) {
      padOn = true;
      audio.padSet(0, audio.degree(0) - 12);
      audio.padSet(1, audio.degree(2));
    } else if (padOn && sync < PAD_OFF_SYNC) {
      padOn = false;
      audio.padSet(0, null);
      audio.padSet(1, null);
    }
    if (sync > BLOOM_SYNC && timeSec - lastBloom > BLOOM_COOLDOWN) {
      lastBloom = timeSec;
      audio.bloom([audio.degree(0), audio.degree(2), audio.degree(4), audio.degree(7)], 0.09);
    }
  };

  const render = (): void => {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = TRAIL_FADE;
    ctx.fillRect(0, 0, width, height);
    if (grass) {
      ctx.globalAlpha = 0.35;
      ctx.drawImage(grass, 0, 0, width, height);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const f of state.flies) {
      const sprite = sprites[f.sprite];
      const idle = 0.08 + 0.05 * (1 + Math.sin(f.phase * Math.PI * 2));
      ctx.globalAlpha = idle;
      ctx.drawImage(sprite, f.x - BODY_SIZE / 2, f.y - BODY_SIZE / 2, BODY_SIZE, BODY_SIZE);
      const fa = flashAlpha(f.flashAge, cfg.flashDuration) * flashPeak;
      if (fa > 0.01) {
        const size = BODY_SIZE * (1.8 + 0.6 * fa);
        ctx.globalAlpha = fa;
        ctx.drawImage(sprites[2], f.x - size / 2, f.y - size / 2, size, size);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  };

  const frame = (now: number): void => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - lastFrame) / 1000, 0.25);
    lastFrame = now;
    timeSec += dt;

    if (held) holdInfluence(state, pointerX, pointerY, dt, cfg);
    for (const ev of stepSim(state, dt, rng, cfg)) onFlash(ev);

    if (flashTimes.length > 600) {
      flashTimes = flashTimes.filter(t => timeSec - t <= SYNC_WINDOW);
    }
    updateSyncSound(syncMeasure(flashTimes, timeSec, SYNC_WINDOW));
    render();
  };

  return {
    start(): void {
      if (raf) return;
      lastFrame = performance.now();
      raf = requestAnimationFrame(frame);
    },
    stop(): void {
      cancelAnimationFrame(raf);
      raf = 0;
    },
    resize(w: number, h: number, dpr: number): void {
      width = w;
      height = h;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      tuneForBounds(cfg, w, h);
      clampToBounds(state, w, h);
      if (state.flies.length === 0 && w > 0 && h > 0) populate(state, rng, cfg);
      grass = renderGrass(w, h, dpr);
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);
    },
    pointerDown(x: number, y: number): void {
      pointerX = x;
      pointerY = y;
      held = true;
      onFlash(spawnAt(state, rng, cfg, x, y));
    },
    pointerMove(x: number, y: number, down: boolean): void {
      pointerX = x;
      pointerY = y;
      held = down;
    },
    pointerUp(): void {
      held = false;
    },
    unlockAudio(): Promise<void> {
      return audio.init();
    },
    setVolume(v: number): void {
      audio.setVolume(v);
    },
    dispose(): void {
      cancelAnimationFrame(raf);
      raf = 0;
      audio.dispose();
    },
  };
}
