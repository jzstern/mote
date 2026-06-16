export function Segmented<T extends string>({ options, value, onChange }: {
  options: readonly T[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-full bg-[var(--mote-control-bg)] p-0.5">
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)}
          className={`rounded-full px-3.5 py-1.5 text-xs tracking-wide transition-colors ${
            value === o
              ? 'bg-[var(--mote-control-active)] text-[var(--mote-text)]'
              : 'text-[var(--mote-text-dim)] hover:text-[var(--mote-text)]'}`}>
          {o}
        </button>
      ))}
    </div>
  );
}
