import { Simulation, type SimConfig } from './Simulation';
import { AudioEngine } from './AudioEngine';
import { Renderer } from './Renderer';
import { mulberry32, randRange, type Rng } from './rng';
import type { KnobValues, Mode, Mood } from './types';

export interface MoteAppOptions { seed?: number; reducedMotion?: boolean; }

export class MoteApp {
  private rng: Rng;
  private sim: Simulation;
  private audio: AudioEngine;
  private renderer: Renderer;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private readonly STEP = 1 / 120;
  private width: number;
  private height: number;
  private running = false;

  constructor(private canvas: HTMLCanvasElement, opts: MoteAppOptions = {}) {
    this.rng = mulberry32(opts.seed ?? (Date.now() >>> 0));
    this.width = canvas.clientWidth || 800;
    this.height = canvas.clientHeight || 600;
    const cfg: SimConfig = {
      width: this.width, height: this.height,
      maxParticles: 160, sporeIntervalSec: 6, speedMul: 1, sporesEnabled: true,
    };
    this.sim = new Simulation(cfg, this.rng);
    this.audio = new AudioEngine();
    this.renderer = new Renderer(canvas, opts.reducedMotion);
    this.renderer.resize(this.width, this.height, window.devicePixelRatio || 1);
    this.audio.setHeight(this.height);

    for (let i = 0; i < 4; i++) {
      this.sim.spawn(
        randRange(this.rng, 40, this.width - 40),
        randRange(this.rng, 40, this.height - 40),
        randRange(this.rng, -20, 20), randRange(this.rng, -20, 20),
      );
    }
  }

  /** Must be called from a user gesture. Starts Tone and the audio graph. */
  async unlockAudio() {
    const Tone = await import('tone');
    await Tone.start();
    await this.audio.init();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    document.addEventListener('visibilitychange', this.onVisibility);
    this.raf = requestAnimationFrame(this.loop);
  }
  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private onVisibility = () => { if (document.hidden) this.stop(); else this.start(); };

  private dayTint(): number {
    const h = new Date().getHours() + new Date().getMinutes() / 60;
    return Math.cos((h / 24) * Math.PI * 2) * 0.6;
  }

  private loop = (t: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    let dt = (t - this.last) / 1000;
    this.last = t;
    if (dt > 0.25) dt = 0.25;
    this.acc += dt;
    while (this.acc >= this.STEP) {
      this.audio.handle(this.sim.step(this.STEP));
      this.acc -= this.STEP;
    }
    this.renderer.draw(this.sim.particles, this.width, this.height, this.dayTint());
  };

  addMote(x: number, y: number, vx = 0, vy = 0) {
    const ev = this.sim.spawn(x, y, vx, vy);
    if (ev) this.audio.handle([ev]);
  }
  bloomAt(x: number, y: number) {
    // nearest particle blooms (easter egg hook; see Task 9)
    let best = null as null | { id: number; d: number };
    for (const p of this.sim.particles) {
      const d = Math.hypot(p.pos.x - x, p.pos.y - y);
      if (!best || d < best.d) best = { id: p.id, d };
    }
    const p = this.sim.particles.find(p => p.id === best?.id);
    if (p) {
      this.audio.handle([{ type: 'bloom', particleId: p.id, x: p.pos.x, y: p.pos.y, size: p.size, speed: 0, voice: p.voice }]);
      this.renderer.addRing(p.pos.x, p.pos.y);
    }
  }
  bloomAll() {
    for (const p of this.sim.particles) {
      this.audio.handle([{ type: 'bloom', particleId: p.id, x: p.pos.x, y: p.pos.y, size: p.size, speed: 0, voice: p.voice }]);
      this.renderer.addRing(p.pos.x, p.pos.y);
    }
    this.audio.shimmer();
  }
  setMode(m: Mode) { this.audio.setMode(m); }
  setMood(m: Mood) { this.audio.setMood(m); }
  setKnob(k: Partial<KnobValues>) {
    this.audio.setKnobs(k);
    if (k.drift != null) this.sim.setConfig({ speedMul: 0.4 + k.drift * 1.6 });
  }
  setSpores(on: boolean) { this.sim.setConfig({ sporesEnabled: on }); }
  setVolume(v: number) { this.audio.setVolume(v); }
  clear() { this.audio.handle(this.sim.clear()); }

  resize() {
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.sim.setConfig({ width: this.width, height: this.height });
    this.audio.setHeight(this.height);
    this.renderer.resize(this.width, this.height, window.devicePixelRatio || 1);
  }
  dispose() {
    this.stop();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.audio.dispose();
  }
}
