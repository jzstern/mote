# Mote — Shader, ASCII & Terminal Interfaces Design Spec

**Date:** 2026-06-16
**Status:** Approved (design), pending implementation plan
**Builds on:** [Visual themes spec](2026-06-15-mote-visual-themes-design.md)

## 1. Summary

Three new interfaces on the same untouched engine, bringing the total to eight,
plus a dropdown selector that replaces the swatch switcher.

| Interface | id | Canvas | Chrome | Identity |
|---|---|---|---|---|
| liquid light | `liquid` | WebGL metaball shader | soft | Sora, fluid |
| ascii | `ascii` | monospace density grid (2D) | soft | IBM Plex Mono |
| terminal | `terminal` | monochrome ASCII (2D) | terminal (brutalist) | VT323, amber CRT |

The simulation and audio remain byte-for-byte unchanged; these are pure
render + chrome layers, exactly like the first five.

## 2. Architecture

### 2.1 A renderer interface + factory

Today `MoteApp` constructs `new Renderer(canvas, theme, reducedMotion)` directly.
A canvas element has a single context type (2D or WebGL), but theme switching
reloads the page, so the context is chosen once per load. Introduce:

```ts
interface MoteRenderer {
  resize(w: number, h: number, dpr: number): void;
  draw(particles: Particle[], w: number, h: number): void;
  addRing(x: number, y: number): void;
  setTheme(theme: Theme): void;
}
```

`createRenderer(canvas, theme, reducedMotion)` returns:
- `ShaderRenderer` (WebGL2) when `theme.render.mode === 'shader'`,
- otherwise the existing 2D `Renderer` (now also handling `ascii`).

The factory falls back to the 2D `Renderer` (glow) if WebGL2 is unavailable, so
the liquid theme degrades gracefully rather than blanking.

### 2.2 New render modes

`RenderMode = 'glow' | 'ink' | 'halftone' | 'ascii' | 'shader'`.

- **`shader`** — `ShaderRenderer` draws a full-screen quad. Up to 64 motes
  (largest first) are uploaded as uniforms (`vec3 uPos[64]` = x,y,radius;
  `vec3 uCol[64]` = rgb). The fragment shader sums a metaball field, colors it by
  the contributing motes, adds a domain-warp flow (time-driven value noise) and an
  iridescent rim. Rendered at reduced internal resolution (dpr capped ~1) — the
  field is smooth, so it stays cheap and looks soft. `addRing` is a no-op here.
- **`ascii`** — in the 2D `Renderer`. Each frame: clear to bg, splat each mote
  into a small neighborhood of a `cols×rows` cell grid (typed-array brightness +
  weighted color accumulators), then draw a glyph from ` .:-=+*#%@` for every
  non-empty cell, sized to the cell, in monospace. `render.ascii = { cell, mono? }`:
  when `mono` is set (terminal) every glyph uses that one phosphor color with
  brightness→alpha; otherwise glyphs take the accumulated mote color.

### 2.3 Terminal chrome variant

`Theme.chromeVariant?: 'soft' | 'terminal'` (default `soft`). `App` renders
`TerminalControlStrip` when `terminal`, else the existing `ControlStrip`. The
terminal strip is a hard-edged monospace panel: a status line
(`MOTE//OS … PARTICLES:NNN [SYS NOMINAL]`), labeled control rows, scanline
overlay, amber-on-near-black. It reuses `Segmented`, `Knob`, and the sliders —
all of which become square via a new `--mote-radius` CSS var (soft = pill,
terminal = 2px). A new `MoteApp.particleCount()` feeds the live readout (polled
on a slow interval, not per frame).

### 2.4 Dropdown selector

`ThemeSwitcher` (swatch buttons) is replaced by `ThemeDropdown`: a button showing
the current interface that toggles a listbox of all eight; selecting one persists
and navigates to that interface's entry URL (same `rememberTheme` +
`themeEntryUrl`). It is used by every interface and themed via CSS vars +
`--mote-radius`; in the terminal it renders as the boxed amber selector. Closes on
outside-click and Escape; `aria-haspopup="listbox"`, `aria-expanded`, roles on items.

### 2.5 Tokens, fonts, assets

- `ThemeRender` gains optional `shader?: { maxMotes }` and `ascii?: { cell; mono? }`.
- New Google fonts: Sora (liquid), IBM Plex Mono (ascii), VT323 (terminal).
- `scripts/gen-assets.ts` extends to render representative favicon + OG art for the
  three new modes: liquid = blended metaball blobs, ascii = colored glyph grid,
  terminal = amber console panel with scanlines + wordmark.
- New per-theme HTML entries (`liquid.html`, `ascii.html`, `terminal.html`) added
  to the Vite multi-page input.

## 3. What changes vs. stays

- **Unchanged:** `Simulation`, `AudioEngine`, `scale`, `rng`, `Particle`, engine
  `types`, all input + easter eggs. The existing five interfaces are unaffected
  except for the additive `--mote-radius` var (defaulted to their current pill).
- **Changed:** `Renderer` (+`ascii`), `MoteApp` (renderer factory,
  `particleCount`), `types`/theme tokens (+modes, +chromeVariant, +radius var),
  `App` (chrome-variant branch), switcher → dropdown, `vite.config`, `gen-assets`.
- **New:** `ShaderRenderer`, `MoteRenderer` interface + `createRenderer`,
  `TerminalControlStrip`, `ThemeDropdown`, `liquid`/`ascii`/`terminal` theme files.

## 4. Testing

- `themes/index.test.ts` — extend: eight themes; new fields present; `terminal`
  has `chromeVariant: 'terminal'`; `liquid` mode `shader`; ascii themes carry
  `render.ascii`.
- `Renderer.test.ts` — add an `ascii` smoke test (draws without throwing; never
  uses `lighter`).
- `ShaderRenderer` — construct against a mocked WebGL2 context without throwing;
  factory falls back to 2D when `getContext('webgl2')` returns null.
- Engine tests stay green and unedited.
- Manual QA: all eight switch via the dropdown; shader/ascii/terminal render and
  remain interactive; audio identical across all.

## 5. Risks

- **WebGL availability / perf** — guarded by the 2D fallback and reduced internal
  resolution. Uniform-array cap (64) bounds cost.
- **ASCII cost** — bounded by splatting per-mote into local cells and drawing only
  non-empty cells; the field is sparse.
- **Custom dropdown a11y** — keep it simple (button + listbox, Escape/outside-close,
  ARIA roles); native `<select>` is the fallback if it proves fiddly.
- **Terminal legibility** — VT323 is decorative; keep readouts short and large
  enough; amber on near-black holds contrast.
