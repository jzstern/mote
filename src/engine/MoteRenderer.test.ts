import { describe, it, expect } from 'vitest';
import { createRenderer } from './MoteRenderer';
import { Renderer } from './Renderer';
import { ShaderRenderer } from './ShaderRenderer';
import { aurora } from '../themes/aurora';
import { liquid } from '../themes/liquid';

const ctx2d = () => ({}) as unknown as CanvasRenderingContext2D;

function fakeGl(): WebGL2RenderingContext {
  const consts: Record<string, number> = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4,
    ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8,
  };
  const handler: ProxyHandler<object> = {
    get(_t, prop) {
      const key = String(prop);
      if (key in consts) return consts[key];
      if (key === 'getShaderParameter' || key === 'getProgramParameter') return () => true;
      if (key === 'createShader' || key === 'createProgram' || key === 'createBuffer' || key === 'getUniformLocation') return () => ({});
      if (key === 'getAttribLocation') return () => 0;
      if (key === 'getShaderInfoLog' || key === 'getProgramInfoLog') return () => '';
      return () => undefined;
    },
  };
  return new Proxy({}, handler) as unknown as WebGL2RenderingContext;
}

function canvasWith(ctx: (type: string) => unknown): HTMLCanvasElement {
  return { width: 0, height: 0, getContext: ctx } as unknown as HTMLCanvasElement;
}

describe('createRenderer', () => {
  it('uses the 2D renderer for non-shader themes', () => {
    // #when
    const r = createRenderer(canvasWith(() => ctx2d()), aurora, false);
    // #then
    expect(r).toBeInstanceOf(Renderer);
  });

  it('uses the shader renderer when WebGL2 is available', () => {
    // #given
    const gl = fakeGl();
    // #when
    const r = createRenderer(canvasWith((t) => (t === 'webgl2' ? gl : ctx2d())), liquid, false);
    // #then
    expect(r).toBeInstanceOf(ShaderRenderer);
  });

  it('falls back to the 2D renderer when WebGL2 is unavailable', () => {
    // #when
    const r = createRenderer(canvasWith((t) => (t === 'webgl2' ? null : ctx2d())), liquid, false);
    // #then
    expect(r).toBeInstanceOf(Renderer);
  });
});
