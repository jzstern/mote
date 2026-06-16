import { THEME_LIST, rememberTheme, themeEntryUrl, type Theme, type ThemeId } from '../themes';

function swatch(t: Theme): string {
  const accent = t.chrome['--mote-accent'];
  const bg = t.chrome['--mote-bg'];
  return `radial-gradient(circle, ${accent} 0 45%, ${bg} 48%)`;
}

export function ThemeSwitcher({ current }: { current: ThemeId }) {
  function pick(id: ThemeId) {
    if (id === current) return;
    rememberTheme(id);
    window.location.assign(themeEntryUrl(id));
  }

  return (
    <div className="pointer-events-auto absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-[var(--mote-border)] bg-[var(--mote-panel)] px-2 py-1.5 backdrop-blur-md">
      {THEME_LIST.map((t) => (
        <button key={t.id} onClick={() => pick(t.id)} title={t.name} aria-label={`theme: ${t.name}`}
          aria-pressed={t.id === current}
          className="h-5 w-5 rounded-full border transition-transform hover:scale-110"
          style={{ background: swatch(t), borderColor: t.id === current ? 'var(--mote-text)' : 'transparent' }} />
      ))}
    </div>
  );
}
