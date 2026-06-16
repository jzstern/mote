import { lifePhase, type Particle } from './Particle';
import type { Theme } from '../themes/types';

interface Ring {
  x: number;
  y: number;
  age: number;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private rings: Ring[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private theme: Theme,
    private reducedMotion = false,
  ) {
    const c = canvas.getContext('2d');
    if (!c) throw new Error('2D canvas context unavailable');
    this.ctx = c;
  }

  setTheme(theme: Theme) {
    this.theme = theme;
  }

  resize(w: number, h: number, dpr: number) {
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  addRing(x: number, y: number) {
    if (this.reducedMotion) return;
    if (this.theme.render.ring.mode === 'none') return;
    if (this.rings.length > 48) this.rings.shift();
    this.rings.push({ x, y, age: 0 });
  }

  draw(particles: Particle[], width: number, height: number) {
    switch (this.theme.render.mode) {
      case 'ink':
        this.drawInk(particles, width, height);
        break;
      case 'halftone':
        this.drawHalftone(particles, width, height);
        break;
      default:
        this.drawGlow(particles, width, height);
    }
    this.drawRings();
  }

  private clearBackground(width: number, height: number) {
    const [r, g, b] = this.theme.render.background;
    const a = this.reducedMotion ? 1 : this.theme.render.fade;
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
    this.ctx.fillRect(0, 0, width, height);
  }

  private envelope(p: Particle): number {
    const life = lifePhase(p);
    return life < 0.1 ? life / 0.1 : life > 0.85 ? (1 - life) / 0.15 : 1;
  }

  private drawGlow(particles: Particle[], width: number, height: number) {
    const ctx = this.ctx;
    const { palette, fuzz } = this.theme.render;
    this.clearBackground(width, height);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      const [r, g, b] = palette[p.voice];
      const env = this.envelope(p);
      const life = lifePhase(p);
      const radius = p.size * (0.8 + 0.6 * life);
      const grad = ctx.createRadialGradient(p.pos.x, p.pos.y, 0, p.pos.x, p.pos.y, radius);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.5 * env})`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, radius, 0, Math.PI * 2);
      ctx.fill();
      if (fuzz && !this.reducedMotion) {
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.18 * env})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([1, 5]);
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, radius * 1.15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  private drawInk(particles: Particle[], width: number, height: number) {
    const ctx = this.ctx;
    const { palette } = this.theme.render;
    this.clearBackground(width, height);
    ctx.globalCompositeOperation = 'source-over';
    for (const p of particles) {
      const [r, g, b] = palette[p.voice];
      const env = this.envelope(p);
      const life = lifePhase(p);
      const radius = p.size * (0.7 + 0.5 * life);
      const grad = ctx.createRadialGradient(p.pos.x, p.pos.y, 0, p.pos.x, p.pos.y, radius);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.55 * env})`);
      grad.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, ${0.28 * env})`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.5 * env})`;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawHalftone(particles: Particle[], width: number, height: number) {
    const ctx = this.ctx;
    const { palette, duotone } = this.theme.render;
    this.clearBackground(width, height);
    ctx.globalCompositeOperation = 'source-over';
    for (const p of particles) {
      const [r, g, b] = palette[p.voice];
      const env = this.envelope(p);
      const radius = p.size * 0.42;
      if (duotone) {
        const isInk0 = r === duotone[0][0] && g === duotone[0][1] && b === duotone[0][2];
        const [or, og, ob] = isInk0 ? duotone[1] : duotone[0];
        ctx.fillStyle = `rgba(${or}, ${og}, ${ob}, ${0.5 * env})`;
        ctx.beginPath();
        ctx.arc(p.pos.x + 2, p.pos.y + 2, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.92 * env})`;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawRings() {
    const ctx = this.ctx;
    const { ring } = this.theme.render;
    if (ring.mode === 'none') {
      this.rings.length = 0;
      return;
    }
    const [rr, rg, rb] = ring.rgb;
    const dur = ring.mode === 'splat' ? 0.45 : 0.9;
    ctx.globalCompositeOperation = 'source-over';
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring0 = this.rings[i];
      ring0.age += 1 / 60;
      const t = ring0.age / dur;
      if (t >= 1) {
        this.rings.splice(i, 1);
        continue;
      }
      if (ring.mode === 'splat') {
        const radius = 6 + t * 26;
        ctx.fillStyle = `rgba(${rr}, ${rg}, ${rb}, ${(1 - t) * 0.28})`;
        ctx.beginPath();
        ctx.arc(ring0.x, ring0.y, radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const radius = 18 + t * 130;
        ctx.strokeStyle = `rgba(${rr}, ${rg}, ${rb}, ${(1 - t) * 0.4})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ring0.x, ring0.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
}
