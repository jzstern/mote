# Mote — Visual Themes Design Spec

**Date:** 2026-06-15
**Status:** Approved (design), pending implementation plan
**Builds on:** [Mote design spec](2026-06-15-mote-ambient-generator-design.md)

## 1. Summary

Five distinct visual "skins" for Mote, switchable at runtime in one app, sharing
the exact same engine (simulation + audio + interaction). Each theme has its own
background, mote-rendering style, palette, control-strip chrome, wordmark font,
favicon, and OpenGraph image. The goal is to feel like five different rooms that
play the same instrument — not five recolors.

The five (picked from a 15-concept brainstorm):

| Theme | id | Background | Render mode | Font | Feel |
|---|---|---|---|---|---|
| Sumi-e zen *(default)* | `sumi` | light rice-paper | `ink` | Shippori Mincho | meditative, tactile, daylight |
| Botanical | `botanical` | mossy dark green | `glow` | Fraunces | garden growth, organic |
| Risograph mono | `riso` | warm paper | `halftone` | Space Mono | indie two-ink print |
| Tide pool | `tidepool` | abyssal teal | `glow` + ripple | Quicksand | deep-sea bioluminescence |
| Nocturne aurora | `aurora` | midnight indigo | `glow` | Space Grotesk | serene premium night |

## 2. Goals and non-goals

### Goals

- One app, a small theme switcher; selection persists (`localStorage` + `?theme=`).
- The engine (simulation, audio, scale, all interactions) is **untouched** in
  behavior. Themes are a pure presentation + identity layer.
- Each theme ships its own font, favicon, theme-color, wordmark, and OG image.
- Three genuinely different canvas rendering models (not just palette swaps).
- Each theme has a real shareable URL whose static `og:*`/favicon are correct for
  crawlers that do not run JS.

### Non-goals

- No change to audio voices, moods, scale, knobs, or the musical mapping.
- No new audio event types. (The roadmap "Ripple mode" audio feature is separate;
  Tide pool's ripple here is **visual only** — a ring on the existing `bounce`
  event, no sound change.)
- No per-theme settings divergence beyond visuals + identity. Mode/mood/knob state
  is shared across themes.
- No backend; still 100% client-side.

## 3. Architecture

### 3.1 The `Theme` token

A single data object per theme is the source of truth. The Renderer, the UI
chrome, and the document `<head>` all read from it.

```ts
interface Theme {
  id: ThemeId;              // 'sumi' | 'botanical' | 'riso' | 'tidepool' | 'aurora'
  name: string;             // 'Sumi-e zen'
  scheme: 'light' | 'dark'; // drives color-scheme + chrome defaults

  render: {
    mode: 'glow' | 'ink' | 'halftone';
    background: string;            // base canvas fill (paper / midnight / moss ...)
    trail: number;                 // overdraw-fade alpha per frame (0 = none)
    palette: Record<VoiceType, RGB>; // the six voice colors, retinted per theme
    ring: { rgb: RGB; mode: 'expand' | 'splat' | 'none' };
    ringOnBounce: boolean;         // Tide pool / Sumi-e cosmetic hook
    fuzz?: boolean;                // Botanical pollen edge
    duotone?: [RGB, RGB];          // Riso two-ink mapping + misregistration
  };

  chrome: Record<string, string>;  // CSS custom properties for ControlStrip/Knob/...
  copy: { hint: string };          // themed "click anywhere"

  font: { family: string; cssStack: string; googleHref: string };
  favicon: string;                 // /favicons/<id>.svg
  og: { image: string; title: string; description: string; themeColor: string };
}
```

`RGB = [number, number, number]`. `ThemeId` is a union; `VoiceType` is the
existing engine type (`peach|gold|rose|lilac|aqua|sky`) — kept as stable keys,
retinted per theme so the audio→color contract is unchanged.

### 3.2 Registry & resolver

- `src/themes/<id>.ts` — one file per theme.
- `src/themes/index.ts` — `THEMES` record, `DEFAULT_THEME_ID = 'sumi'`, and
  `resolveTheme(): Theme` reading `?theme=` → `localStorage` → injected
  `window.__MOTE_THEME__` (set by per-theme HTML entries) → default. Unknown ids
  fall back to default. Pure and unit-tested.
- `applyThemeToHead(theme)` — swaps `<title>`, `theme-color`, favicon link, the
  Google-font `<link>`, and `og:*` meta at runtime so the live tab is always
  correct.

### 3.3 Switcher

`src/ui/ThemeSwitcher.tsx` — a small unobtrusive control (corner). Selecting a
theme writes `localStorage` and navigates to that theme's entry URL (so the
static OG/favicon are correct on reload and when shared). In dev (single page) it
falls back to `?theme=` + in-place re-init.

### 3.4 Render modes (the core of the differentiation)

`Renderer` takes the active theme and branches on `render.mode`:

- **`glow`** (Aurora, Tide pool, Botanical) — the existing additive (`lighter`)
  radial-glow path, but background, palette, and `trail` come from the theme.
  Tide pool sets `ringOnBounce` (expanding water ring); Botanical sets `fuzz`
  (soft dashed pollen falloff).
- **`ink`** (Sumi-e) — light paper background; motes are soft feathered ink discs
  drawn with `source-over` (no additive glow); a faint high-alpha wash gives a
  gentle paper trail; `bounce` leaves a quick ink splat.
- **`halftone`** (Riso) — paper background; motes are flat solid dots mapped to two
  spot inks (`duotone`), each drawn twice with a small offset (misregistration);
  little/no trail; flat ring.

The simulation feeds the same `Particle[]` and `MusicalEvent[]` to the renderer
regardless of mode. `addRing` is generalized to take a ring style; `MoteApp`
calls it on `bounce` events when `render.ringOnBounce` is set — a cosmetic read,
no simulation change.

### 3.5 What changes vs. stays

- **Unchanged:** `Simulation.ts`, `AudioEngine.ts`, `scale.ts`, `rng.ts`,
  `Particle.ts`, `types.ts` (engine types), all input handling and easter eggs.
- **Changed:** `Renderer.ts` (mode dispatch), `MoteApp.ts` (accept theme, ring-on-
  bounce hook), `useMoteApp.ts` (pass theme), `ControlStrip/Knob/Segmented`
  (read CSS vars instead of hardcoded hex), `App.tsx` (themed hint + switcher),
  `index.css`, `index.html`, `vite.config.ts` (multi-page).
- **New:** `src/themes/*`, `src/ui/ThemeSwitcher.tsx`, `public/favicons/*`,
  `public/og/*`, per-theme HTML entries, `scripts/gen-assets.mjs`.

## 4. Identity delivery (font, favicon, OG)

- **Fonts** — each theme loads one Google font via a `<link>` injected by
  `applyThemeToHead`; the wordmark and chrome use `var(--mote-font)`. `display=swap`.
- **Favicons** — `public/favicons/<id>.svg`, one per theme, swapped at runtime and
  set statically in each per-theme HTML entry.
- **OG images** — authored as 1200×630 SVG by `scripts/gen-assets.mjs` (reusing the
  same mote-drawing logic as the approved concept previews, so they match), then
  rasterized to PNG in `public/og/<id>.png`. PNG because most unfurlers don't
  render SVG OG. The generated PNGs are committed so no build-time rasterizer is
  required for `vite build`.
- **Per-theme URLs** — Vite multi-page (`build.rollupOptions.input`) emits
  `index.html` (default = Sumi-e) plus `sumi.html`, `botanical.html`, `riso.html`,
  `tidepool.html`, `aurora.html`. Each carries its own static `og:*`, favicon,
  `theme-color`, and a tiny inline script setting `window.__MOTE_THEME__`. All boot
  the same app.

## 5. Testing

- `themes/index.test.ts` — `resolveTheme` precedence (query > storage > injected >
  default), unknown-id fallback, every theme has all six voice colors and required
  identity fields.
- `Renderer.test.ts` — extend the existing smoke test: constructs and `draw()`s in
  each of the three modes against a mocked 2D context without throwing; `ink`/
  `halftone` do not call `globalCompositeOperation='lighter'`.
- Engine tests stay green unchanged (proof the mechanism is untouched).
- Manual QA: switch all five in-browser; confirm font, favicon, palette, render
  style, wordmark, and that audio/interaction are identical across themes.

## 6. Risks & open questions

- **Google Fonts at runtime** — network dependency + FOUT. Acceptable for a
  prototype; `display=swap` + per-theme `cssStack` fallback keeps it readable.
  Self-hosting is a follow-up.
- **OG rasterization tooling** — if a rasterizer isn't reliably available in this
  environment, fall back to committing PNGs produced via the headless browser, or
  (last resort) reference the SVG OG directly. The SVG art is the durable artifact
  either way.
- **Multi-page vs. switcher ergonomics** — navigating between entry URLs reloads
  the app (re-seeds the field). Acceptable and arguably nice (fresh field per
  theme); dev keeps the in-place `?theme=` path for fast iteration.
- **Light-mode chrome contrast** — Sumi-e and Riso are light backgrounds; the
  control strip must invert legibly. Driven entirely by `chrome` CSS vars.
