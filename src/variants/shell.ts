import type { VariantDef, VariantMeta } from './types';

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function applyHead(meta: VariantMeta): void {
  document.title = meta.og.title;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(meta.chrome)) root.style.setProperty(k, v);
  root.style.setProperty('--mote-font', meta.font.cssStack);
  root.style.setProperty('--mote-wordmark-spacing', meta.font.wordmarkSpacing);
  root.style.setProperty('--mote-wordmark-weight', String(meta.font.wordmarkWeight));
  root.style.colorScheme = meta.scheme;

  upsertMeta('name', 'theme-color', meta.og.themeColor);
  upsertMeta('name', 'description', meta.og.description);
  upsertMeta('property', 'og:title', meta.og.title);
  upsertMeta('property', 'og:description', meta.og.description);
  upsertMeta('property', 'og:image', meta.og.image);

  let icon = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!icon) {
    icon = document.createElement('link');
    icon.rel = 'icon';
    document.head.appendChild(icon);
  }
  icon.type = 'image/svg+xml';
  icon.href = meta.favicon;

  const font = document.createElement('link');
  font.rel = 'stylesheet';
  font.href = meta.font.googleHref;
  document.head.appendChild(font);
}

/** Boot a variant into #root: canvas, chrome, pointer + audio-unlock wiring. */
export function bootVariant(def: VariantDef, siblings: readonly VariantMeta[]): void {
  const { meta } = def;
  applyHead(meta);

  const root = document.getElementById('root');
  if (!root) throw new Error('missing #root');
  root.innerHTML = `
    <div class="vshell">
      <canvas class="vshell-canvas" aria-label="${meta.name} — generative sound field"></canvas>
      <header class="vshell-top">
        <a class="vshell-wordmark" href="/">mote<span class="vshell-sep">·</span>${meta.name}</a>
        <nav class="vshell-nav" aria-label="variants">
          ${siblings
            .map(s =>
              s.id === meta.id
                ? `<span class="vshell-navlink is-current">${s.name}</span>`
                : `<a class="vshell-navlink" href="/${s.id}.html">${s.name}</a>`,
            )
            .join('')}
          <a class="vshell-navlink vshell-navlink-lab" href="/lab.html">lab ↗</a>
        </nav>
      </header>
      <p class="vshell-hint">${meta.hint}</p>
      <div class="vshell-bottom">
        <span class="vshell-sound" data-sound>tap for sound</span>
        <label class="vshell-volume">
          <span class="vshell-volume-label">vol</span>
          <input type="range" min="0" max="1" step="0.01" value="0.8" aria-label="volume" />
        </label>
      </div>
    </div>
  `;

  const canvas = root.querySelector<HTMLCanvasElement>('.vshell-canvas');
  const hint = root.querySelector<HTMLParagraphElement>('.vshell-hint');
  const soundPill = root.querySelector<HTMLSpanElement>('[data-sound]');
  const volume = root.querySelector<HTMLInputElement>('.vshell-volume input');
  if (!canvas || !hint || !soundPill || !volume) throw new Error('shell markup missing');

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const app = def.create(canvas, { reducedMotion });

  const size = () => {
    app.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1);
  };
  size();
  window.addEventListener('resize', size);

  let audioUnlocked = false;
  const unlock = () => {
    if (audioUnlocked) return;
    audioUnlocked = true;
    soundPill.classList.add('is-hidden');
    void app.unlockAudio().then(() => app.setVolume(Number(volume.value)));
  };

  const pos = (e: PointerEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  let down = false;
  canvas.addEventListener('pointerdown', e => {
    unlock();
    hint.classList.add('is-hidden');
    down = true;
    canvas.setPointerCapture(e.pointerId);
    app.pointerDown(...pos(e));
  });
  canvas.addEventListener('pointermove', e => {
    app.pointerMove(...pos(e), down);
  });
  canvas.addEventListener('pointerup', e => {
    down = false;
    app.pointerUp(...pos(e));
  });
  canvas.addEventListener('pointercancel', e => {
    down = false;
    app.pointerUp(...pos(e));
  });

  volume.addEventListener('input', () => app.setVolume(Number(volume.value)));

  app.start();
}
