import type { VoiceType } from '../engine/types';

export type RGB = [number, number, number];
export type ThemeId =
  | 'sumi'
  | 'botanical'
  | 'riso'
  | 'tidepool'
  | 'aurora'
  | 'liquid'
  | 'ascii'
  | 'terminal';
export type RenderMode = 'glow' | 'ink' | 'halftone' | 'ascii' | 'shader';
export type RingMode = 'expand' | 'splat' | 'none';
export type ChromeVariant = 'soft' | 'terminal';

export interface ThemeRender {
  mode: RenderMode;
  background: RGB;
  /** Per-frame background fill alpha: 1 = crisp/no trail, lower = longer motion trails. */
  fade: number;
  palette: Record<VoiceType, RGB>;
  ring: { rgb: RGB; mode: RingMode };
  ringOnBounce: boolean;
  fuzz?: boolean;
  duotone?: [RGB, RGB];
  /** ASCII mode: cell size in px; `mono` forces a single phosphor color. */
  ascii?: { cell: number; mono?: RGB };
  /** Shader mode: max motes uploaded as uniforms. */
  shader?: { maxMotes: number };
}

export interface ThemeFont {
  family: string;
  cssStack: string;
  googleHref: string;
  wordmarkSpacing: string;
  wordmarkWeight: number;
}

export interface ThemeOg {
  image: string;
  title: string;
  description: string;
  themeColor: string;
}

export interface Theme {
  id: ThemeId;
  name: string;
  scheme: 'light' | 'dark';
  chromeVariant?: ChromeVariant;
  render: ThemeRender;
  chrome: Record<string, string>;
  copy: { hint: string };
  font: ThemeFont;
  favicon: string;
  og: ThemeOg;
}
