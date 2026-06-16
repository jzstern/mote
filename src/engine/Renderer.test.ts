import { describe, it, expect, vi } from 'vitest';
import { Renderer } from './Renderer';
import type { Particle } from './Particle';
import { aurora } from '../themes/aurora';
import { sumi } from '../themes/sumi';
import { riso } from '../themes/riso';
import { ascii } from '../themes/ascii';

function fakeCanvas() {
  const ops: string[] = [];
  const ctx = {
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    setLineDash: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillStyle: '' as unknown,
    strokeStyle: '' as unknown,
    lineWidth: 0,
    font: '',
    textBaseline: '' as unknown,
  };
  let gco = '';
  Object.defineProperty(ctx, 'globalCompositeOperation', {
    get: () => gco,
    set: (v: string) => {
      gco = v;
      ops.push(v);
    },
  });
  return {
    canvas: { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement,
    ctx,
    ops,
  };
}

const p = (over: Partial<Particle> = {}): Particle => ({
  id: 1,
  pos: { x: 10, y: 10 },
  vel: { x: 0, y: 0 },
  size: 30,
  age: 5,
  lifespan: 20,
  voice: 'aqua',
  bounceCooldown: 0,
  ...over,
});

describe('Renderer', () => {
  it('glow mode: trail fill then one additive glow per particle', () => {
    const { canvas, ctx, ops } = fakeCanvas();
    const r = new Renderer(canvas, aurora, false);
    r.draw([p(), p({ id: 2 })], 800, 600);
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalledTimes(2);
    expect(ops).toContain('lighter');
  });

  it('ink mode draws without throwing and never blends additively', () => {
    const { canvas, ops } = fakeCanvas();
    const r = new Renderer(canvas, sumi, false);
    expect(() => r.draw([p()], 800, 600)).not.toThrow();
    expect(ops).not.toContain('lighter');
  });

  it('halftone mode draws without throwing and never blends additively', () => {
    const { canvas, ops } = fakeCanvas();
    const r = new Renderer(canvas, riso, false);
    expect(() => r.draw([p(), p({ id: 2, voice: 'gold' })], 800, 600)).not.toThrow();
    expect(ops).not.toContain('lighter');
  });

  it('ascii mode draws glyphs without throwing and never blends additively', () => {
    const { canvas, ctx, ops } = fakeCanvas();
    const r = new Renderer(canvas, ascii, false);
    expect(() => r.draw([p({ size: 60 }), p({ id: 2, voice: 'gold', pos: { x: 200, y: 150 } })], 800, 600)).not.toThrow();
    expect(ctx.fillText).toHaveBeenCalled();
    expect(ops).not.toContain('lighter');
  });

  it('splat rings (sumi) clear after their lifetime', () => {
    const { canvas } = fakeCanvas();
    const r = new Renderer(canvas, sumi, false);
    r.addRing(100, 100);
    for (let i = 0; i < 40; i++) r.draw([], 800, 600);
    expect(() => r.draw([], 800, 600)).not.toThrow();
  });
});
