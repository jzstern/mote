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

const WARN_REMAINING_SECONDS = 30;

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function RecordButton({ recording, seconds, maxSeconds, canRecord, onToggle }: {
  recording: boolean; seconds: number; maxSeconds: number; canRecord: boolean; onToggle: () => void;
}) {
  const remaining = maxSeconds - seconds;
  const nearLimit = recording && remaining <= WARN_REMAINING_SECONDS;
  const clock = recording ? (nearLimit ? `-${formatClock(remaining)}` : formatClock(seconds)) : null;

  return (
    <button onClick={onToggle} disabled={!canRecord} aria-pressed={recording}
      aria-label={recording ? 'stop recording' : 'record audio'}
      title={canRecord ? (recording ? 'stop recording' : 'record audio') : 'start the audio first'}
      className="flex items-center gap-2 self-start rounded-full border border-white/15 px-3 py-1.5 text-xs text-[#b9b2cf] hover:text-[#f3eefe] disabled:opacity-40 disabled:hover:text-[#b9b2cf]">
      {recording ? (
        <span className={`h-2 w-2 rounded-sm ${nearLimit ? 'bg-[#ff8a5c]' : 'bg-[#ff5c72]'} motion-safe:animate-pulse`} aria-hidden="true" />
      ) : (
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5c72]" aria-hidden="true" />
      )}
      <span className={`tabular-nums ${nearLimit ? 'text-[#ffb08a]' : ''}`}>{clock ?? 'rec'}</span>
    </button>
  );
}

export function ControlStrip({ settings, onChange, onClear, recording, recordingSeconds, recordMaxSeconds, canRecord, onToggleRecord }: {
  settings: Settings; onChange: (patch: Partial<Settings>) => void; onClear: () => void;
  recording: boolean; recordingSeconds: number; recordMaxSeconds: number; canRecord: boolean; onToggleRecord: () => void;
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
          <button onClick={() => onChange({ spores: !settings.spores })} aria-pressed={settings.spores}
            aria-label={settings.spores ? 'pause auto-spawn' : 'resume auto-spawn'}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-[#b9b2cf] hover:text-[#f3eefe]">
            {settings.spores ? (
              <svg width="11" height="11" viewBox="0 0 10 10" aria-hidden="true">
                <rect x="1" y="1" width="3" height="8" fill="currentColor" /><rect x="6" y="1" width="3" height="8" fill="currentColor" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 1l7 4-7 4z" fill="currentColor" /></svg>
            )}
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

          <RecordButton recording={recording} seconds={recordingSeconds} maxSeconds={recordMaxSeconds}
            canRecord={canRecord} onToggle={onToggleRecord} />

          <button onClick={onClear} aria-label="clear"
            className="self-start rounded-full border border-white/15 px-3 py-1.5 text-xs text-[#b9b2cf] hover:text-[#f3eefe]">clear</button>
        </div>
      </div>
    </div>
  );
}
