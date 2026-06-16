import { useEffect, useState } from 'react';
import { Segmented } from './Segmented';
import { Knob } from './Knob';
import type { Settings } from './storage';
import type { Mode, Mood } from '../engine/types';
import type { MoteApp } from '../engine/MoteApp';

const MODES: readonly Mode[] = ['pads', 'plucks', 'both'];
const MOODS: readonly Mood[] = ['warm', 'dream', 'dusk', 'mist'];
const KNOBS: (keyof Settings['knobs'])[] = ['space', 'echo', 'tone', 'drift'];

export function TerminalControlStrip({ settings, onChange, onClear, app }: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClear: () => void;
  app: React.RefObject<MoteApp | null>;
}) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setCount(app.current?.particleCount() ?? 0), 250);
    return () => clearInterval(id);
  }, [app]);

  return (
    <div className="pointer-events-auto relative mx-4 mb-4 max-w-5xl overflow-hidden rounded-[var(--mote-radius-box)] border bg-[var(--mote-panel)] backdrop-blur-md"
      style={{ borderColor: 'var(--mote-border)', fontFamily: 'var(--mote-font)' }}>
      <div aria-hidden className="pointer-events-none absolute inset-0"
        style={{ background: 'repeating-linear-gradient(rgba(0,0,0,0.20) 0 1px, transparent 1px 3px)' }} />

      <div className="relative flex items-center justify-between gap-6 border-b px-4 py-1.5 text-[13px] tracking-[0.12em] text-[var(--mote-text-dim)]"
        style={{ borderColor: 'var(--mote-border)' }}>
        <span className="text-[var(--mote-text)]">MOTE//OS v1.0</span>
        <span>PARTICLES:{String(count).padStart(3, '0')} · AUDIO:LIVE · [SYS NOMINAL]</span>
      </div>

      <div className="relative flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 text-[13px] tracking-[0.08em]">
        <label className="flex items-center gap-2 text-[var(--mote-text-dim)]">OSC
          <Segmented options={MODES} value={settings.mode} onChange={(mode) => onChange({ mode })} /></label>
        <label className="flex items-center gap-2 text-[var(--mote-text-dim)]">SCALE
          <Segmented options={MOODS} value={settings.mood} onChange={(mood) => onChange({ mood })} /></label>

        <div className="flex items-start gap-4">
          {KNOBS.map((key) => (
            <Knob key={key} label={key} value={settings.knobs[key]}
              onChange={(v) => onChange({ knobs: { ...settings.knobs, [key]: v } })} />
          ))}
        </div>

        <button onClick={() => onChange({ spores: !settings.spores })} aria-pressed={settings.spores}
          aria-label={settings.spores ? 'pause auto-spawn' : 'resume auto-spawn'}
          className="self-center rounded-[var(--mote-radius)] border px-2.5 py-1 text-[var(--mote-text-dim)] hover:text-[var(--mote-text)]"
          style={{ borderColor: 'var(--mote-border)' }}>
          {settings.spores ? 'SPORES:ON' : 'SPORES:OFF'}
        </button>

        <label className="flex items-center gap-2 self-center text-[var(--mote-text-faint)]">SPD
          <input type="range" min={0} max={1} step={0.01} value={settings.knobs.speed} aria-label="speed (tempo)"
            onChange={(e) => onChange({ knobs: { ...settings.knobs, speed: Number(e.target.value) } })}
            className="h-1 w-16 accent-[var(--mote-accent)]" /></label>
        <label className="flex items-center gap-2 self-center text-[var(--mote-text-faint)]">VOL
          <input type="range" min={0} max={1} step={0.01} value={settings.volume} aria-label="volume"
            onChange={(e) => onChange({ volume: Number(e.target.value) })}
            className="h-1 w-16 accent-[var(--mote-accent)]" /></label>

        <button onClick={onClear} aria-label="clear"
          className="self-center rounded-[var(--mote-radius)] border px-2.5 py-1 text-[var(--mote-text-dim)] hover:text-[var(--mote-text)]"
          style={{ borderColor: 'var(--mote-border)' }}>CLR</button>
      </div>
    </div>
  );
}
