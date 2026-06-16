import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { THEME_LIST } from '../src/themes';
import type { Theme, RGB } from '../src/themes/types';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** System fonts the rasterizer can resolve, chosen to echo each theme's web font. */
const SYS_FONT: Record<string, string> = {
  sumi: "'Hiragino Mincho ProN', 'YuMincho', Georgia, serif",
  botanical: 'Georgia, serif',
  riso: "Menlo, 'Courier New', monospace",
  tidepool: "'Avenir Next', Helvetica, sans-serif",
  aurora: "'Helvetica Neue', Arial, sans-serif",
  liquid: "'Avenir Next', Helvetica, sans-serif",
  ascii: "Menlo, 'Courier New', monospace",
  terminal: "Menlo, 'Courier New', monospace",
};

const GLYPHS = ' .:-=+*#%@';
const rgba = ([r, g, b]: RGB, a = 1): string => `rgba(${r},${g},${b},${a})`;
const voices = (t: Theme): RGB[] => Object.values(t.render.palette);

function glowMote(id: string, x: number, y: number, r: number, c: RGB) {
  return {
    def: `<radialGradient id="${id}"><stop offset="0" stop-color="${rgba(c)}" stop-opacity="0.95"/><stop offset="0.5" stop-color="${rgba(c)}" stop-opacity="0.45"/><stop offset="1" stop-color="${rgba(c)}" stop-opacity="0"/></radialGradient>`,
    body: `<circle cx="${x}" cy="${y}" r="${r * 1.7}" fill="url(#${id})"/>`,
  };
}

function shaderMote(id: string, x: number, y: number, r: number, c: RGB) {
  return {
    def: `<radialGradient id="${id}"><stop offset="0" stop-color="${rgba(c)}" stop-opacity="0.9"/><stop offset="0.5" stop-color="${rgba(c)}" stop-opacity="0.5"/><stop offset="1" stop-color="${rgba(c)}" stop-opacity="0"/></radialGradient>`,
    body: `<circle cx="${x}" cy="${y}" r="${r * 2.1}" fill="url(#${id})"/>`,
  };
}

function inkMote(x: number, y: number, r: number, c: RGB) {
  return {
    def: '',
    body:
      `<circle cx="${x}" cy="${y}" r="${r * 1.35}" fill="${rgba(c, 0.16)}"/>` +
      `<circle cx="${x}" cy="${y}" r="${r}" fill="${rgba(c, 0.5)}"/>` +
      `<circle cx="${x - r * 0.18}" cy="${y - r * 0.18}" r="${r * 0.5}" fill="${rgba(c, 0.7)}"/>`,
  };
}

function halftoneMote(x: number, y: number, r: number, c: RGB, duo: [RGB, RGB]) {
  const isInk0 = c[0] === duo[0][0] && c[1] === duo[0][1] && c[2] === duo[0][2];
  const other = isInk0 ? duo[1] : duo[0];
  return {
    def: '',
    body:
      `<circle cx="${x + 3}" cy="${y + 3}" r="${r}" fill="${rgba(other, 0.5)}"/>` +
      `<circle cx="${x}" cy="${y}" r="${r}" fill="${rgba(c, 0.92)}"/>`,
  };
}

function mote(t: Theme, id: string, x: number, y: number, r: number, c: RGB) {
  if (t.render.mode === 'ink') return inkMote(x, y, r, c);
  if (t.render.mode === 'halftone') return halftoneMote(x, y, r, c, t.render.duotone!);
  if (t.render.mode === 'shader') return shaderMote(id, x, y, r, c);
  return glowMote(id, x, y, r, c);
}

function scene(t: Theme, spots: [number, number, number][]) {
  const defs: string[] = [];
  const body: string[] = [];
  const pal = voices(t);
  spots.forEach(([x, y, r], i) => {
    const m = mote(t, `m${i}`, x, y, r, pal[i % pal.length]);
    if (m.def) defs.push(m.def);
    body.push(m.body);
  });
  return { bg: rgba(t.render.background), defs: defs.join(''), body: body.join('') };
}

function glyphField(t: Theme, x0: number, y0: number, x1: number, y1: number, fs: number): string {
  const cw = fs * 0.6;
  const ch = fs;
  const cols = Math.floor((x1 - x0) / cw);
  const rows = Math.floor((y1 - y0) / ch);
  const mono = t.render.ascii?.mono;
  const pal = voices(t);
  const m = Math.max(cols, rows);
  const blobs: [number, number, number, number][] = [
    [cols * 0.2, rows * 0.35, m * 0.18, 0],
    [cols * 0.5, rows * 0.55, m * 0.24, 1],
    [cols * 0.76, rows * 0.32, m * 0.16, 2],
    [cols * 0.63, rows * 0.74, m * 0.2, 3],
    [cols * 0.34, rows * 0.78, m * 0.15, 4],
  ];
  const out: string[] = [];
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      let d = 0;
      let ci = 0;
      let best = 0;
      for (const [bx, by, br, idx] of blobs) {
        const v = Math.max(0, 1 - Math.hypot(gx - bx, gy - by) / br);
        d += v;
        if (v > best) { best = v; ci = idx; }
      }
      if (d < 0.12) continue;
      const g = GLYPHS[Math.min(GLYPHS.length - 1, Math.max(1, Math.round(d * (GLYPHS.length - 1) * 1.1)))];
      if (g === ' ') continue;
      const col = mono ?? pal[ci % pal.length];
      const a = Math.min(1, (mono ? 0.4 : 0.55) + d * 0.6);
      const px = (x0 + gx * cw).toFixed(1);
      const py = (y0 + (gy + 1) * ch).toFixed(1);
      out.push(`<text x="${px}" y="${py}" fill="${rgba(col, a)}">${g}</text>`);
    }
  }
  return `<g font-family="${SYS_FONT[t.id]}" font-size="${fs}">${out.join('')}</g>`;
}

function scanlines(w: number, h: number): string {
  let s = '';
  for (let y = 0; y < h; y += 4) {
    s += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="#000" stroke-opacity="0.18" stroke-width="1"/>`;
  }
  return s;
}

const OG_SPOTS: [number, number, number][] = [
  [150, 130, 46], [340, 90, 30], [560, 170, 54], [820, 110, 36], [1010, 90, 44],
  [1080, 250, 28], [930, 330, 50], [700, 300, 34], [470, 360, 40], [250, 300, 30],
  [120, 420, 38], [1120, 470, 42], [600, 470, 30], [820, 500, 46], [340, 520, 34],
];

function ogSvg(t: Theme): string {
  const W = 1200;
  const H = 630;
  const text = t.chrome['--mote-text'];
  const dim = t.chrome['--mote-text-dim'];
  const font = SYS_FONT[t.id] ?? 'sans-serif';
  const em = parseFloat(t.font.wordmarkSpacing) || 0;
  const wordmark =
    `<text x="80" y="552" font-family="${font}" font-size="96" font-weight="${t.font.wordmarkWeight}" letter-spacing="${em * 96}" fill="${text}">mote</text>` +
    `<text x="86" y="595" font-family="${font}" font-size="28" fill="${dim}">generative ambient music — ${t.name}</text>`;
  const bg = rgba(t.render.background);

  if (t.render.mode === 'ascii') {
    const terminal = t.chromeVariant === 'terminal';
    const bar = terminal
      ? `<rect x="0" y="0" width="${W}" height="56" fill="rgba(255,176,0,0.06)"/>` +
        `<line x1="0" y1="56" x2="${W}" y2="56" stroke="${t.chrome['--mote-border']}" stroke-width="1"/>` +
        `<text x="40" y="37" font-family="${font}" font-size="26" fill="${text}">MOTE//OS v1.0</text>` +
        `<text x="${W - 40}" y="37" text-anchor="end" font-family="${font}" font-size="22" fill="${dim}">[SYS NOMINAL]</text>`
      : '';
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
      `<rect width="${W}" height="${H}" fill="${bg}"/>` +
      glyphField(t, 70, terminal ? 80 : 50, 1130, 500, 26) +
      (terminal ? scanlines(W, H) : '') +
      bar +
      wordmark +
      `</svg>`
    );
  }

  const s = scene(t, OG_SPOTS);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>${s.defs}</defs>` +
    `<rect width="${W}" height="${H}" fill="${s.bg}"/>` +
    s.body +
    wordmark +
    `</svg>`
  );
}

const FAV_SPOTS: [number, number, number][] = [
  [22, 22, 9],
  [44, 30, 6],
  [32, 46, 8],
];

function faviconSvg(t: Theme): string {
  const bg = rgba(t.render.background);
  if (t.render.mode === 'ascii') {
    const mono = t.render.ascii?.mono;
    const pal = voices(t);
    const cells: [string, number, number, number][] = [
      ['@', 16, 28, 0], ['#', 36, 24, 1], ['*', 26, 44, 2], ['+', 46, 46, 3],
    ];
    const body = cells
      .map(([g, x, y, i]) => `<text x="${x}" y="${y}" fill="${rgba(mono ?? pal[i % pal.length])}">${g}</text>`)
      .join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${bg}"/><g font-family="${SYS_FONT[t.id]}" font-size="22">${body}</g></svg>`;
  }
  const s = scene(t, FAV_SPOTS);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs>${s.defs}</defs><rect width="64" height="64" rx="14" fill="${s.bg}"/>${s.body}</svg>`;
}

function htmlEntry(t: Theme): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="${t.favicon}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="${t.scheme}" />
    <meta name="theme-color" content="${t.og.themeColor}" />
    <meta name="description" content="${t.og.description}" />
    <meta property="og:title" content="${t.og.title}" />
    <meta property="og:description" content="${t.og.description}" />
    <meta property="og:image" content="${t.og.image}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${t.og.title}" />
    <meta name="twitter:description" content="${t.og.description}" />
    <meta name="twitter:image" content="${t.og.image}" />
    <title>${t.og.title}</title>
    <style>html,body{background:${t.og.themeColor};margin:0}</style>
    <script>window.__MOTE_THEME__=${JSON.stringify(t.id)}</script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
}

mkdirSync(resolve(root, 'public/favicons'), { recursive: true });
mkdirSync(resolve(root, 'public/og'), { recursive: true });

for (const t of THEME_LIST) {
  writeFileSync(resolve(root, `public/favicons/${t.id}.svg`), faviconSvg(t));

  const svg = ogSvg(t);
  writeFileSync(resolve(root, `public/og/${t.id}.svg`), svg);
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    font: { loadSystemFonts: true },
  })
    .render()
    .asPng();
  writeFileSync(resolve(root, `public/og/${t.id}.png`), png);

  const htmlName = t.id === 'sumi' ? 'index.html' : `${t.id}.html`;
  writeFileSync(resolve(root, htmlName), htmlEntry(t));

  console.log(`generated ${t.id}: favicon, og (svg+png), ${htmlName}`);
}
