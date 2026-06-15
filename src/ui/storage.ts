import type { KnobValues, Mode, Mood } from '../engine/types';

export interface Settings { mode: Mode; mood: Mood; knobs: KnobValues; volume: number; spores: boolean; }
const KEY = 'mote.settings.v1';
export const DEFAULTS: Settings = {
  mode: 'both', mood: 'warm',
  knobs: { space: 0.6, echo: 0.3, tone: 0.5, drift: 0.5, speed: 0.5 },
  volume: 0.9, spores: true,
};

export function loadSettings(): Settings {
  try { const raw = localStorage.getItem(KEY); return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS; }
  catch { return DEFAULTS; }
}
export function saveSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore quota/private-mode */ }
}
