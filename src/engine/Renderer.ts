import { lifePhase, type Particle } from './Particle';
import { VOICE_RGB, blendVoiceRgb } from './palette';
import { ringRadius, type RippleRing, type RippleOverlap } from './ripple';
import type { VoiceType } from './types';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private bloomRings: { x: number; y: number; age: number }[] = [];
  private rippleFlashes: { x: number; y: number; r: number; g: number; b: number; age: number }[] = [];
  private ringLifespan = 3;
  private ringMaxRadius = 200;
  constructor(private canvas: HTMLCanvasElement, private reducedMotion = false) {
    const c = canvas.getContext('2d');
    if (!c) throw new Error('2D canvas context unavailable');
    this.ctx = c;
  }

  resize(w: number, h: number, dpr: number) {
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  addRing(x: number, y: number) {
    if (this.reducedMotion) return;
    this.bloomRings.push({ x, y, age: 0 });
  }

  setRippleParams(lifespan: number, maxRadius: number) {
    this.ringLifespan = lifespan;
    this.ringMaxRadius = maxRadius;
  }

  addRippleFlash(x: number, y: number, voiceA: VoiceType, voiceB: VoiceType) {
    if (this.reducedMotion) return;
    const [r, g, b] = blendVoiceRgb(voiceA, voiceB);
    this.rippleFlashes.push({ x, y, r, g, b, age: 0 });
  }

  draw(
    particles: Particle[], width: number, height: number, tint: number,
    ripples: RippleRing[] = [], overlaps: RippleOverlap[] = [],
  ) {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'source-over';
    const br = Math.round(12 + tint * 6);
    const bb = Math.round(18 - tint * 6);
    ctx.fillStyle = `rgba(${br}, 10, ${bb}, ${this.reducedMotion ? 1 : 0.18})`;
    ctx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      const [r, g, b] = VOICE_RGB[p.voice];
      const life = lifePhase(p);
      const fade = life < 0.1 ? life / 0.1 : life > 0.85 ? (1 - life) / 0.15 : 1;
      const radius = p.size * (0.8 + 0.6 * life);
      const grad = ctx.createRadialGradient(p.pos.x, p.pos.y, 0, p.pos.x, p.pos.y, radius);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.5 * fade})`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // ripple rings (expanding outlines, colored by emitter voice)
    for (const ring of ripples) {
      const [r, g, b] = VOICE_RGB[ring.voice];
      const t = Math.min(1, ring.age / this.ringLifespan);
      const radius = ringRadius(ring, this.ringLifespan, this.ringMaxRadius);
      const alpha = (1 - t) * (this.reducedMotion ? 0.12 : 0.3);
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // sweeping crossing nodes (continuous, while rings overlap)
    for (const o of overlaps) {
      const [r, g, b] = blendVoiceRgb(o.voiceA, o.voiceB);
      const nodeR = this.reducedMotion ? 2 : 4;
      const grad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, nodeR * 2);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${this.reducedMotion ? 0.4 : 0.8})`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(o.x, o.y, nodeR * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // note-trigger flashes (one bright bloom per fired crossing)
    for (let i = this.rippleFlashes.length - 1; i >= 0; i--) {
      const f = this.rippleFlashes[i];
      f.age += 1 / 60;
      const t = f.age / 0.4;
      if (t >= 1) { this.rippleFlashes.splice(i, 1); continue; }
      const radius = 6 + t * 26;
      const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, radius);
      grad.addColorStop(0, `rgba(${f.r}, ${f.g}, ${f.b}, ${(1 - t) * 0.85})`);
      grad.addColorStop(1, `rgba(${f.r}, ${f.g}, ${f.b}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(f.x, f.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = this.bloomRings.length - 1; i >= 0; i--) {
      const ring = this.bloomRings[i];
      ring.age += 1 / 60;
      const t = ring.age / 0.9;
      if (t >= 1) { this.bloomRings.splice(i, 1); continue; }
      const radius = 18 + t * 130;
      ctx.strokeStyle = `rgba(255, 240, 220, ${(1 - t) * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
