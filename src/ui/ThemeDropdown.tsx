import { useEffect, useRef, useState } from 'react';
import { THEME_LIST, rememberTheme, themeEntryUrl, type ThemeId } from '../themes';

export function ThemeDropdown({ current }: { current: ThemeId }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cur = THEME_LIST.find((t) => t.id === current);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function pick(id: ThemeId) {
    setOpen(false);
    if (id === current) return;
    rememberTheme(id);
    window.location.assign(themeEntryUrl(id));
  }

  return (
    <div ref={ref} className="pointer-events-auto absolute right-3 top-3 text-xs" style={{ fontFamily: 'var(--mote-font)' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="select interface"
        className="flex items-center gap-2 rounded-[var(--mote-radius-box)] border border-[var(--mote-border)] bg-[var(--mote-panel)] px-3 py-1.5 text-[var(--mote-text)] backdrop-blur-md"
      >
        <span className="h-2 w-2 rounded-full" style={{ background: 'var(--mote-accent)', boxShadow: '0 0 8px var(--mote-accent)' }} />
        <span className="tracking-wide">{cur?.name ?? current}</span>
        <span className="text-[var(--mote-text-faint)]">▾</span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="interface"
          className="absolute right-0 mt-1.5 min-w-[170px] overflow-hidden rounded-[var(--mote-radius-box)] border border-[var(--mote-border)] bg-[var(--mote-panel)] py-1 backdrop-blur-md"
        >
          {THEME_LIST.map((t) => (
            <li key={t.id} role="option" aria-selected={t.id === current}>
              <button
                onClick={() => pick(t.id)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left tracking-wide transition-colors hover:bg-[var(--mote-control-active)] ${
                  t.id === current ? 'text-[var(--mote-text)]' : 'text-[var(--mote-text-dim)]'
                }`}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: t.id === current ? 'var(--mote-accent)' : 'transparent',
                    boxShadow: t.id === current ? '0 0 6px var(--mote-accent)' : 'none',
                  }}
                />
                {t.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
