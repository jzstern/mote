import { Segmented } from './Segmented';
import { Knob } from './Knob';
import type { Settings } from './storage';
import type { Mode, Mood } from '../engine/types';

const MODES: readonly Mode[] = ['pads', 'plucks', 'both'];
const MOODS: readonly Mood[] = ['warm', 'dream', 'dusk', 'mist'];
const KNOBS: { key: keyof Settings['knobs']; glow: string }[] = [
  { key: 'space', glow: 'rgba(255,150,170,.25)' },
  { key: 'echo', glow: 'rgba(150,225,220,.22)' },
  { key: 'tone', glow: 'rgba(255,214,140,.22)' },
  { key: 'drift', glow: 'rgba(190,170,255,.25)' },
];

export function ControlStrip({ settings, onChange, onClear }: {
  settings: Settings; onChange: (patch: Partial<Settings>) => void; onClear: () => void;
}) {
  return (
    <div className="pointer-events-auto mx-4 mb-4 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#14111e]/60 px-4 py-2.5 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[#ffb78a] shadow-[0_0_10px_#ffb78a]" />
        <span className="text-lg tracking-[0.3em] text-[#efe9fb]">mote</span>
      </div>

      <div className="flex items-center gap-3">
        <Segmented options={MODES} value={settings.mode} onChange={(mode) => onChange({ mode })} />
        <Segmented options={MOODS} value={settings.mood} onChange={(mood) => onChange({ mood })} />
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-start gap-4">
          {KNOBS.map(({ key, glow }) => (
            <Knob key={key} label={key} glow={glow} value={settings.knobs[key]}
              onChange={(v) => onChange({ knobs: { ...settings.knobs, [key]: v } })} />
          ))}
        </div>

        <div className="flex items-center gap-3 self-center">
          <button onClick={() => onChange({ ripple: !settings.ripple })} aria-pressed={settings.ripple}
            aria-label={settings.ripple ? 'disable ripple mode' : 'enable ripple mode'}
            className={`flex h-8 w-8 items-center justify-center rounded-full border text-[#b9b2cf] hover:text-[#f3eefe] ${
              settings.ripple ? 'border-[#cdbcff]/60 text-[#f3eefe]' : 'border-white/15'}`}>
            <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1">
              <circle cx="7" cy="7" r="2" /><circle cx="7" cy="7" r="4" /><circle cx="7" cy="7" r="6" />
            </svg>
          </button>

          <button onClick={() => onChange({ spores: !settings.spores })} aria-pressed={settings.spores}
            aria-label={settings.spores ? 'auto-spawn on — click to pause' : 'auto-spawn off — click to resume'}
            title="auto-spawn"
            className={`flex h-8 w-8 items-center justify-center rounded-full border hover:text-[#f3eefe] ${
              settings.spores ? 'border-[#9fe6d2]/50 text-[#c7f2e6]' : 'border-white/15 text-[#6f6a86]'}`}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="currentColor">
              <circle cx="7" cy="7" r="2" />
              <circle cx="7" cy="1.7" r="1.05" /><circle cx="7" cy="12.3" r="1.05" />
              <circle cx="1.7" cy="7" r="1.05" /><circle cx="12.3" cy="7" r="1.05" />
            </svg>
          </button>

          <label className="flex flex-col items-center gap-1 text-[11px] tracking-wide text-[#7d7796]">
            <input type="range" min={0} max={1} step={0.01} value={settings.knobs.speed} aria-label="speed (tempo)"
              onChange={(e) => onChange({ knobs: { ...settings.knobs, speed: Number(e.target.value) } })}
              className="h-1 w-16 accent-[#ffd68c]" />
            speed
          </label>

          <label className="flex flex-col items-center gap-1 text-[11px] tracking-wide text-[#7d7796]">
            <input type="range" min={0} max={1} step={0.01} value={settings.volume} aria-label="volume"
              onChange={(e) => onChange({ volume: Number(e.target.value) })}
              className="h-1 w-16 accent-[#cdbcff]" />
            vol
          </label>

          <button onClick={onClear} aria-label="clear"
            className="self-start rounded-full border border-white/15 px-3 py-1.5 text-xs text-[#b9b2cf] hover:text-[#f3eefe]">clear</button>
        </div>
      </div>
    </div>
  );
}
