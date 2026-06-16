import { Segmented } from './Segmented';
import { Knob } from './Knob';
import type { Settings } from './storage';
import type { Mode, Mood } from '../engine/types';

const MODES: readonly Mode[] = ['pads', 'plucks', 'both'];
const MOODS: readonly Mood[] = ['warm', 'dream', 'dusk', 'mist'];
const KNOBS: (keyof Settings['knobs'])[] = ['space', 'echo', 'tone', 'drift'];

export function ControlStrip({ settings, onChange, onClear }: {
  settings: Settings; onChange: (patch: Partial<Settings>) => void; onClear: () => void;
}) {
  return (
    <div className="pointer-events-auto mx-4 mb-4 flex items-center justify-between gap-4 rounded-2xl border border-[var(--mote-border)] bg-[var(--mote-panel)] px-4 py-2.5 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--mote-accent)] shadow-[0_0_10px_var(--mote-accent)]" />
        <span className="text-lg text-[var(--mote-text)]"
          style={{ fontFamily: 'var(--mote-font)', letterSpacing: 'var(--mote-wordmark-spacing)', fontWeight: 'var(--mote-wordmark-weight)' as React.CSSProperties['fontWeight'] }}>
          mote
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Segmented options={MODES} value={settings.mode} onChange={(mode) => onChange({ mode })} />
        <Segmented options={MOODS} value={settings.mood} onChange={(mood) => onChange({ mood })} />
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-start gap-4">
          {KNOBS.map((key) => (
            <Knob key={key} label={key} value={settings.knobs[key]}
              onChange={(v) => onChange({ knobs: { ...settings.knobs, [key]: v } })} />
          ))}
        </div>

        <div className="flex items-center gap-3 self-center">
          <button onClick={() => onChange({ spores: !settings.spores })} aria-pressed={settings.spores}
            aria-label={settings.spores ? 'pause auto-spawn' : 'resume auto-spawn'}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--mote-border)] text-[var(--mote-text-dim)] hover:text-[var(--mote-text)]">
            {settings.spores ? (
              <svg width="11" height="11" viewBox="0 0 10 10" aria-hidden="true">
                <rect x="1" y="1" width="3" height="8" fill="currentColor" /><rect x="6" y="1" width="3" height="8" fill="currentColor" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 1l7 4-7 4z" fill="currentColor" /></svg>
            )}
          </button>

          <label className="flex flex-col items-center gap-1 text-[11px] tracking-wide text-[var(--mote-text-faint)]">
            <input type="range" min={0} max={1} step={0.01} value={settings.knobs.speed} aria-label="speed (tempo)"
              onChange={(e) => onChange({ knobs: { ...settings.knobs, speed: Number(e.target.value) } })}
              className="h-1 w-16 accent-[var(--mote-accent)]" />
            speed
          </label>

          <label className="flex flex-col items-center gap-1 text-[11px] tracking-wide text-[var(--mote-text-faint)]">
            <input type="range" min={0} max={1} step={0.01} value={settings.volume} aria-label="volume"
              onChange={(e) => onChange({ volume: Number(e.target.value) })}
              className="h-1 w-16 accent-[var(--mote-accent)]" />
            vol
          </label>

          <button onClick={onClear} aria-label="clear"
            className="self-start rounded-full border border-[var(--mote-border)] px-3 py-1.5 text-xs text-[var(--mote-text-dim)] hover:text-[var(--mote-text)]">clear</button>
        </div>
      </div>
    </div>
  );
}
