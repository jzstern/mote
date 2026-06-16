# Mote — Visual Themes Implementation Plan

**Spec:** [2026-06-15-mote-visual-themes-design.md](../specs/2026-06-15-mote-visual-themes-design.md)
**Branch:** `feat/visual-themes`

Five switchable skins over the unchanged engine: `sumi` (default), `botanical`,
`riso`, `tidepool`, `aurora`. Check boxes as completed; commit per phase.

## Phase 0 — Theme foundation
- [x] `src/themes/types.ts` — `Theme`, `ThemeId`, `RGB`, render/chrome/font/og shapes.
- [x] `src/themes/sumi.ts`, `botanical.ts`, `riso.ts`, `tidepool.ts`, `aurora.ts` — full tokens.
- [x] `src/themes/index.ts` — `THEMES`, `DEFAULT_THEME_ID='sumi'`, `resolveTheme()`, `applyThemeToHead()`.
- [x] `src/themes/index.test.ts` — resolve precedence, fallback, completeness.

## Phase 1 — Renderer modes
- [x] `Renderer.ts` accepts `Theme`; branch `glow` | `ink` | `halftone`.
- [x] Background + `trail` + `palette` come from theme (drop hardcoded day-tint hex).
- [x] Generalize `addRing(x,y,style)`; `glow` expand, `ink` splat, flat for `halftone`.
- [x] `fuzz` (botanical pollen edge), `duotone` misregistration (riso).
- [x] `Renderer.test.ts` — draws in all three modes w/o throwing; ink/halftone never use `lighter`.

## Phase 2 — Wiring
- [x] `MoteApp.ts` — constructor takes `theme`; `ringOnBounce` hook on `bounce` events.
- [x] `useMoteApp.ts` — `resolveTheme()`, pass to `MoteApp`, call `applyThemeToHead`.
- [x] Day-tint: keep as subtle per-theme modulation or retire (decide in build; keep mechanism).

## Phase 3 — Chrome
- [x] `index.css` — `--mote-*` CSS vars, `color-scheme` per theme, light/dark legibility.
- [x] `ControlStrip.tsx`, `Knob.tsx`, `Segmented.tsx` — read CSS vars, drop hardcoded hex.
- [x] `ThemeSwitcher.tsx` — corner control; persists + navigates to entry URL (dev: `?theme=`).
- [x] `App.tsx` — themed hint copy; mount switcher.

## Phase 4 — Identity assets
- [x] `scripts/gen-assets.mjs` — emit `public/favicons/<id>.svg` + `public/og/<id>.svg` from theme tokens (reuse mote-draw logic).
- [x] Rasterize OG → `public/og/<id>.png` (committed). Fallback to headless render if no rasterizer.
- [x] Per-theme HTML entries (`sumi.html` … `aurora.html`) + `index.html` (default) with static `og:*`, favicon, `theme-color`, `window.__MOTE_THEME__`.
- [x] `vite.config.ts` — `build.rollupOptions.input` multi-page.
- [x] `applyThemeToHead` swaps title/theme-color/favicon/font/og at runtime.

## Phase 5 — Verify
- [x] `pnpm lint`, `tsc --noEmit`, `pnpm test` green.
- [x] `pnpm build` (multi-page) succeeds; OG/favicons in `dist`.
- [x] `pnpm dev` — switch all five; screenshot each; confirm identical audio/interaction.
- [x] Commit per phase. Branch ready; PR/merge pending review.

## Guardrails
- Engine files (`Simulation`, `AudioEngine`, `scale`, `rng`, `Particle`, engine `types`) stay behavior-identical. Existing engine tests must remain green and unedited.
- Voice keys (`peach…sky`) stay stable; only their RGB retints per theme.
