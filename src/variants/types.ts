export type VariantId = 'pulse' | 'ember' | 'terrace' | 'loom' | 'hypha';

export interface VariantFont {
  family: string;
  cssStack: string;
  googleHref: string;
  wordmarkSpacing: string;
  wordmarkWeight: number;
}

export interface VariantOg {
  image: string;
  title: string;
  description: string;
  themeColor: string;
}

export interface VariantMeta {
  id: VariantId;
  name: string;
  /** One-line poetic descriptor shown on the lab page. */
  tagline: string;
  /** Interaction hint shown until first gesture. */
  hint: string;
  scheme: 'light' | 'dark';
  chrome: Record<string, string>;
  font: VariantFont;
  favicon: string;
  og: VariantOg;
}

export interface VariantApp {
  start(): void;
  stop(): void;
  resize(width: number, height: number, dpr: number): void;
  pointerDown(x: number, y: number): void;
  pointerMove(x: number, y: number, down: boolean): void;
  pointerUp(x: number, y: number): void;
  /** Must be called from a user gesture before any sound. */
  unlockAudio(): Promise<void>;
  setVolume(v: number): void;
  dispose(): void;
}

export interface VariantAppOptions {
  reducedMotion: boolean;
  seed?: number;
}

export type VariantFactory = (canvas: HTMLCanvasElement, opts: VariantAppOptions) => VariantApp;

export interface VariantDef {
  meta: VariantMeta;
  create: VariantFactory;
}
