import type { Particle } from './Particle';
import type { Theme } from '../themes/types';
import { Renderer } from './Renderer';
import { ShaderRenderer } from './ShaderRenderer';

export interface MoteRenderer {
  resize(w: number, h: number, dpr: number): void;
  draw(particles: Particle[], w: number, h: number): void;
  addRing(x: number, y: number): void;
  setTheme(theme: Theme): void;
}

/** Pick a renderer for the theme. Shader themes use WebGL2, falling back to 2D glow. */
export function createRenderer(
  canvas: HTMLCanvasElement,
  theme: Theme,
  reducedMotion: boolean,
): MoteRenderer {
  if (theme.render.mode === 'shader') {
    try {
      return new ShaderRenderer(canvas, theme, reducedMotion);
    } catch {
      return new Renderer(canvas, theme, reducedMotion);
    }
  }
  return new Renderer(canvas, theme, reducedMotion);
}
