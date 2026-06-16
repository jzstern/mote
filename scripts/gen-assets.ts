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
};

const rgba = ([r, g, b]: RGB, a = 1) => `rgba(${r},${g},${b},${a})`;
const voices = (t: Theme) => Object.values(t.render.palette);

function glowMote(id: string, x: number, y: number, r: number, c: RGB) {
  return {
    def: `<radialGradient id="${id}"><stop offset="0" stop-color="${rgba(c)}" stop-opacity="0.95"/><stop offset="0.5" stop-color="${rgba(c)}" stop-opacity="0.45"/><stop offset="1" stop-color="${rgba(c)}" stop-opacity="0"/></radialGradient>`,
    body: `<circle cx="${x}" cy="${y}" r="${r * 1.7}" fill="url(#${id})"/>`,
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
  return glowMote(id, x, y, r, c);
}

function scene(t: Theme, w: number, h: number, spots: [number, number, number][]) {
  const defs: string[] = [];
  const body: string[] = [];
  spots.forEach(([x, y, r], i) => {
    const pal = voices(t);
    const m = mote(t, `m${i}`, x, y, r, pal[i % pal.length]);
    if (m.def) defs.push(m.def);
    body.push(m.body);
  });
  return { bg: rgba(t.render.background), defs: defs.join(''), body: body.join('') };
}

function faviconSvg(t: Theme): string {
  const spots: [number, number, number][] = [
    [22, 22, 9],
    [44, 30, 6],
    [32, 46, 8],
  ];
  const s = scene(t, 64, 64, spots);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs>${s.defs}</defs><rect width="64" height="64" rx="14" fill="${s.bg}"/>${s.body}</svg>`;
}

function ogSvg(t: Theme): string {
  const W = 1200;
  const H = 630;
  const spots: [number, number, number][] = [
    [150, 130, 46], [340, 90, 30], [560, 170, 54], [820, 110, 36], [1010, 90, 44],
    [1080, 250, 28], [930, 330, 50], [700, 300, 34], [470, 360, 40], [250, 300, 30],
    [120, 420, 38], [1120, 470, 42], [600, 470, 30], [820, 500, 46], [340, 520, 34],
  ];
  const s = scene(t, W, H, spots);
  const text = t.chrome['--mote-text'];
  const dim = t.chrome['--mote-text-dim'];
  const em = parseFloat(t.font.wordmarkSpacing) || 0;
  const fs = 96;
  const ls = em * fs;
  const font = SYS_FONT[t.id];
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>${s.defs}</defs>` +
    `<rect width="${W}" height="${H}" fill="${s.bg}"/>` +
    s.body +
    `<text x="80" y="540" font-family="${font}" font-size="${fs}" font-weight="${t.font.wordmarkWeight}" letter-spacing="${ls}" fill="${text}">mote</text>` +
    `<text x="86" y="585" font-family="${font}" font-size="30" fill="${dim}">generative ambient music — ${t.name}</text>` +
    `</svg>`
  );
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
