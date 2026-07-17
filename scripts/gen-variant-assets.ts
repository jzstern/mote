import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { VARIANT_LIST } from '../src/variants/meta';
import type { VariantMeta } from '../src/variants/types';
import { mulberry32, randRange, type Rng } from '../src/engine/rng';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SYS_FONT: Record<string, string> = {
  pulse: "'Helvetica Neue', Arial, sans-serif",
  ember: 'Georgia, serif',
  terrace: "'Hiragino Mincho ProN', Georgia, serif",
  loom: "'Iowan Old Style', Georgia, serif",
  hypha: "'Optima', 'Avenir Next', sans-serif",
};

const W = 1200;
const H = 630;

/* ---------- pulse: Brian's Brain cells ---------- */

function pulseArt(rng: Rng, x0: number, y0: number, x1: number, y1: number, cell: number): string {
  const cols = Math.floor((x1 - x0) / cell);
  const rows = Math.floor((y1 - y0) / cell);
  const out: string[] = [];
  const blobs: [number, number, number][] = [];
  for (let i = 0; i < 7; i++) {
    blobs.push([randRange(rng, 0, cols), randRange(rng, 0, rows), randRange(rng, 3, 9)]);
  }
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      let v = 0;
      for (const [bx, by, br] of blobs) v = Math.max(v, 1 - Math.hypot(gx - bx, gy - by) / br);
      if (v <= 0.05 || rng() > v * 0.85) continue;
      const firing = rng() < 0.45;
      const c = firing ? '#4df3ff' : '#b04cff';
      const a = firing ? 0.6 + v * 0.4 : 0.25 + v * 0.35;
      const x = x0 + gx * cell;
      const y = y0 + gy * cell;
      if (firing && v > 0.5) {
        out.push(
          `<rect x="${x - 3}" y="${y - 3}" width="${cell + 4}" height="${cell + 4}" rx="4" fill="${c}" opacity="${(a * 0.25).toFixed(2)}"/>`,
        );
      }
      out.push(
        `<rect x="${x}" y="${y}" width="${cell - 2}" height="${cell - 2}" rx="2" fill="${c}" opacity="${a.toFixed(2)}"/>`,
      );
    }
  }
  return out.join('');
}

/* ---------- ember: fireflies ---------- */

function emberArt(rng: Rng, n: number, x1: number, y1: number, big: number): string {
  const defs: string[] = [];
  const body: string[] = [];
  for (let i = 0; i < n; i++) {
    const x = randRange(rng, 30, x1);
    const y = randRange(rng, 30, y1);
    const bright = rng() < 0.2;
    const r = bright ? randRange(rng, big * 0.7, big) : randRange(rng, big * 0.2, big * 0.5);
    const c = rng() < 0.75 ? '255,198,107' : '255,158,100';
    const a = bright ? 0.95 : randRange(rng, 0.15, 0.45);
    const id = `f${i}`;
    defs.push(
      `<radialGradient id="${id}"><stop offset="0" stop-color="rgba(${c},${a})"/><stop offset="0.4" stop-color="rgba(${c},${(a * 0.5).toFixed(2)})"/><stop offset="1" stop-color="rgba(${c},0)"/></radialGradient>`,
    );
    body.push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(r * 2.2).toFixed(0)}" fill="url(#${id})"/>`);
    if (bright) body.push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(r * 0.35).toFixed(1)}" fill="#fff3d8"/>`);
  }
  return `<defs>${defs.join('')}</defs>${body.join('')}`;
}

/* ---------- terrace: a real stabilized sandpile ---------- */

function sandpile(size: number, grains: number): Uint8Array {
  const h = new Int32Array(size * size);
  const c = Math.floor(size / 2);
  h[c * size + c] = grains;
  let unstable = true;
  while (unstable) {
    unstable = false;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        if (h[i] >= 4) {
          const t = Math.floor(h[i] / 4);
          h[i] -= t * 4;
          if (x > 0) h[i - 1] += t;
          if (x < size - 1) h[i + 1] += t;
          if (y > 0) h[i - size] += t;
          if (y < size - 1) h[i + size] += t;
          unstable = true;
        }
      }
    }
  }
  return Uint8Array.from(h);
}

const TERRACE_COLORS = ['#f4eee2', '#e3cf9f', '#c4643b', '#7a8b6f'];

function terraceArt(size: number, grains: number, cx: number, cy: number, target: number): string {
  const pile = sandpile(size, grains);
  let min = size;
  let max = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (pile[y * size + x] > 0) {
        min = Math.min(min, x, y);
        max = Math.max(max, x, y);
      }
    }
  }
  const extent = max - min + 1;
  const cell = target / extent;
  const gap = cell > 4 ? 1 : 0;
  const out: string[] = [];
  const half = target / 2;
  for (let y = min; y <= max; y++) {
    for (let x = min; x <= max; x++) {
      const v = pile[y * size + x];
      if (v === 0) continue;
      out.push(
        `<rect x="${(cx - half + (x - min) * cell).toFixed(1)}" y="${(cy - half + (y - min) * cell).toFixed(1)}" width="${(cell - gap).toFixed(1)}" height="${(cell - gap).toFixed(1)}" fill="${TERRACE_COLORS[v]}"/>`,
      );
    }
  }
  return out.join('');
}

/* ---------- loom: real Rule 90 woven rows ---------- */

const LOOM_THREADS = ['#ede4d0', '#c65b4e', '#e2a93b'];

function loomArt(cols: number, rows: number, x0: number, y0: number, cw: number, ch: number): string {
  let row = new Uint8Array(cols);
  row[Math.floor(cols / 2)] = 1;
  const out: string[] = [];
  for (let x = 0; x < cols; x++) {
    out.push(
      `<line x1="${x0 + x * cw + cw / 2}" y1="${y0 - 10}" x2="${x0 + x * cw + cw / 2}" y2="${y0 + rows * ch + 10}" stroke="#ede4d0" stroke-opacity="0.07"/>`,
    );
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!row[x]) continue;
      const color = LOOM_THREADS[(x * 31 + y * 17) % 9 === 0 ? 2 : (x * 13 + y * 7) % 11 === 0 ? 1 : 0];
      out.push(
        `<rect x="${x0 + x * cw + 1}" y="${y0 + y * ch + ch * 0.22}" width="${cw - 2}" height="${ch * 0.56}" rx="${ch * 0.28}" fill="${color}"/>`,
      );
    }
    const next = new Uint8Array(cols);
    for (let x = 0; x < cols; x++) {
      next[x] = row[(x - 1 + cols) % cols] ^ row[(x + 1) % cols];
    }
    row = next;
  }
  return out.join('');
}

/* ---------- hypha: branching filament network ---------- */

function hyphaArt(rng: Rng, cx: number, cy: number, reach: number): string {
  const out: string[] = [];
  const paths: string[] = [];
  const branch = (x: number, y: number, angle: number, len: number, depth: number, width: number) => {
    if (depth <= 0 || len < 6) return;
    const nx = x + Math.cos(angle) * len;
    const ny = y + Math.sin(angle) * len;
    const mx = (x + nx) / 2 + randRange(rng, -len * 0.3, len * 0.3);
    const my = (y + ny) / 2 + randRange(rng, -len * 0.3, len * 0.3);
    paths.push(
      `<path d="M${x.toFixed(0)} ${y.toFixed(0)} Q${mx.toFixed(0)} ${my.toFixed(0)} ${nx.toFixed(0)} ${ny.toFixed(0)}" stroke-width="${width.toFixed(1)}"/>`,
    );
    const kids = rng() < 0.65 ? 2 : 1;
    for (let i = 0; i < kids; i++) {
      branch(nx, ny, angle + randRange(rng, -0.7, 0.7), len * randRange(rng, 0.65, 0.9), depth - 1, Math.max(0.6, width * 0.7));
    }
    if (depth === 1 && rng() < 0.5) {
      out.push(`<circle cx="${nx.toFixed(0)}" cy="${ny.toFixed(0)}" r="2.5" fill="#cfc8ff" opacity="0.8"/>`);
    }
  };
  for (let i = 0; i < 9; i++) {
    branch(cx, cy, (i / 9) * Math.PI * 2 + randRange(rng, -0.2, 0.2), reach * randRange(rng, 0.16, 0.24), 5, 3.2);
  }
  return (
    `<g stroke="#3fe8c8" fill="none" opacity="0.22" stroke-linecap="round">${paths.map(p => p.replace(/stroke-width="([\d.]+)"/, (_, w) => `stroke-width="${(parseFloat(w) * 3).toFixed(1)}"`)).join('')}</g>` +
    `<g stroke="#3fe8c8" fill="none" opacity="0.85" stroke-linecap="round">${paths.join('')}</g>` +
    `<circle cx="${cx}" cy="${cy}" r="5" fill="#d2f5ea"/>` +
    out.join('')
  );
}

/* ---------- composition ---------- */

function artFor(meta: VariantMeta, favicon: boolean): string {
  const rng = mulberry32(41 + meta.id.length * 7);
  switch (meta.id) {
    case 'pulse':
      return favicon ? pulseArt(rng, 6, 6, 58, 58, 12) : pulseArt(rng, 40, 30, W - 40, H - 140, 18);
    case 'ember':
      return favicon ? emberArt(rng, 7, 56, 56, 9) : emberArt(rng, 38, W - 40, H - 130, 22);
    case 'terrace':
      return favicon ? terraceArt(21, 128, 32, 32, 52) : terraceArt(91, 4000, W / 2, (H - 130) / 2, 430);
    case 'loom':
      return favicon ? loomArt(9, 8, 4, 4, 6.2, 7) : loomArt(64, 26, 40, 30, (W - 80) / 64, 17);
    case 'hypha':
      return favicon ? hyphaArt(rng, 32, 32, 30) : hyphaArt(rng, W / 2, (H - 100) / 2, 300);
  }
}

function ogSvg(meta: VariantMeta): string {
  const font = SYS_FONT[meta.id];
  const em = parseFloat(meta.font.wordmarkSpacing) || 0;
  const text = meta.chrome['--mote-text'];
  const dim = meta.chrome['--mote-text-dim'];
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="${meta.chrome['--mote-bg']}"/>` +
    artFor(meta, false) +
    `<text x="80" y="552" font-family="${font}" font-size="96" font-weight="${meta.font.wordmarkWeight}" letter-spacing="${em * 96}" fill="${text}">mote · ${meta.name}</text>` +
    `<text x="86" y="595" font-family="${font}" font-size="28" fill="${dim}">generative ambient music — ${meta.tagline.split('—')[0].trim()}</text>` +
    `</svg>`
  );
}

function faviconSvg(meta: VariantMeta): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" rx="14" fill="${meta.chrome['--mote-bg']}"/>` +
    artFor(meta, true) +
    `</svg>`
  );
}

function htmlEntry(meta: VariantMeta): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="${meta.favicon}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="${meta.scheme}" />
    <meta name="theme-color" content="${meta.og.themeColor}" />
    <meta name="description" content="${meta.og.description}" />
    <meta property="og:title" content="${meta.og.title}" />
    <meta property="og:description" content="${meta.og.description}" />
    <meta property="og:image" content="${meta.og.image}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${meta.og.title}" />
    <meta name="twitter:description" content="${meta.og.description}" />
    <meta name="twitter:image" content="${meta.og.image}" />
    <title>${meta.og.title}</title>
    <style>html,body{background:${meta.og.themeColor};margin:0}</style>
    <script>window.__MOTE_VARIANT__=${JSON.stringify(meta.id)}</script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/variant-main.ts"></script>
  </body>
</html>
`;
}

mkdirSync(resolve(root, 'public/favicons'), { recursive: true });
mkdirSync(resolve(root, 'public/og'), { recursive: true });

for (const meta of VARIANT_LIST) {
  writeFileSync(resolve(root, `public/favicons/${meta.id}.svg`), faviconSvg(meta));
  const svg = ogSvg(meta);
  writeFileSync(resolve(root, `public/og/${meta.id}.svg`), svg);
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 }, font: { loadSystemFonts: true } })
    .render()
    .asPng();
  writeFileSync(resolve(root, `public/og/${meta.id}.png`), png);
  writeFileSync(resolve(root, `${meta.id}.html`), htmlEntry(meta));
  console.log(`generated ${meta.id}: favicon, og (svg+png), ${meta.id}.html`);
}
