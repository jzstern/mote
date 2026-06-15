import { lifePhase, type Particle } from './Particle';
import { VOICE_RGB } from './palette';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
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

  draw(particles: Particle[], width: number, height: number, _tint: number) {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(12, 10, 18, ${this.reducedMotion ? 1 : 0.18})`;
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
  }
}
