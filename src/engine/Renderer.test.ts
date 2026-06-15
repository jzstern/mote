import { describe, it, expect, vi } from 'vitest';
import { Renderer } from './Renderer';
import type { Particle } from './Particle';

function fakeCanvas() {
  const ctx = {
    setTransform: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    globalCompositeOperation: '', fillStyle: '' as unknown,
  };
  return { canvas: { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement, ctx };
}
const p = (over: Partial<Particle> = {}): Particle => ({
  id: 1, pos: { x: 10, y: 10 }, vel: { x: 0, y: 0 }, size: 30, age: 5, lifespan: 20, voice: 'aqua', bounceCooldown: 0, ...over,
});

describe('Renderer', () => {
  it('draws a trail fill then a glow per particle', () => {
    const { canvas, ctx } = fakeCanvas();
    const r = new Renderer(canvas, false);
    r.draw([p(), p({ id: 2 })], 800, 600, 0);
    expect(ctx.fillRect).toHaveBeenCalled();        // trail fade
    expect(ctx.arc).toHaveBeenCalledTimes(2);       // one glow per particle
  });
});
