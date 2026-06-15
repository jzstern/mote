import { lifePhase, type Particle } from './Particle';
import { VOICE_RGB } from './palette';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private rings: { x: number; y: number; age: number }[] = [];
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
    this.rings.push({ x, y, age: 0 });
  }

  draw(particles: Particle[], width: number, height: number, tint: number) {
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

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      ring.age += 1 / 60;
      const t = ring.age / 0.9;
      if (t >= 1) { this.rings.splice(i, 1); continue; }
      const radius = 18 + t * 130;
      ctx.strokeStyle = `rgba(255, 240, 220, ${(1 - t) * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
