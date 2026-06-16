# Mote — Visual Themes Implementation Plan

**Spec:** [2026-06-15-mote-visual-themes-design.md](../specs/2026-06-15-mote-visual-themes-design.md)
**Branch:** `feat/visual-themes`

Five switchable skins over the unchanged engine: `sumi` (default), `botanical`,
`riso`, `tidepool`, `aurora`. Check boxes as completed; commit per phase.

## Phase 0 — Theme foundation
- [ ] `src/themes/types.ts` — `Theme`, `ThemeId`, `RGB`, render/chrome/font/og shapes.
- [ ] `src/themes/sumi.ts`, `botanical.ts`, `riso.ts`, `tidepool.ts`, `aurora.ts` — full tokens.
- [ ] `src/themes/index.ts` — `THEMES`, `DEFAULT_THEME_ID='sumi'`, `resolveTheme()`, `applyThemeToHead()`.
- [ ] `src/themes/index.test.ts` — resolve precedence, fallback, completeness.

## Phase 1 — Renderer modes
- [ ] `Renderer.ts` accepts `Theme`; branch `glow` | `ink` | `halftone`.
- [ ] Background + `trail` + `palette` come from theme (drop hardcoded day-tint hex).
- [ ] Generalize `addRing(x,y,style)`; `glow` expand, `ink` splat, flat for `halftone`.
- [ ] `fuzz` (botanical pollen edge), `duotone` misregistration (riso).
- [ ] `Renderer.test.ts` — draws in all three modes w/o throwing; ink/halftone never use `lighter`.

## Phase 2 — Wiring
- [ ] `MoteApp.ts` — constructor takes `theme`; `ringOnBounce` hook on `bounce` events.
- [ ] `useMoteApp.ts` — `resolveTheme()`, pass to `MoteApp`, call `applyThemeToHead`.
- [ ] Day-tint: keep as subtle per-theme modulation or retire (decide in build; keep mechanism).

## Phase 3 — Chrome
- [ ] `index.css` — `--mote-*` CSS vars, `color-scheme` per theme, light/dark legibility.
- [ ] `ControlStrip.tsx`, `Knob.tsx`, `Segmented.tsx` — read CSS vars, drop hardcoded hex.
- [ ] `ThemeSwitcher.tsx` — corner control; persists + navigates to entry URL (dev: `?theme=`).
- [ ] `App.tsx` — themed hint copy; mount switcher.

## Phase 4 — Identity assets
- [ ] `scripts/gen-assets.mjs` — emit `public/favicons/<id>.svg` + `public/og/<id>.svg` from theme tokens (reuse mote-draw logic).
- [ ] Rasterize OG → `public/og/<id>.png` (committed). Fallback to headless render if no rasterizer.
- [ ] Per-theme HTML entries (`sumi.html` … `aurora.html`) + `index.html` (default) with static `og:*`, favicon, `theme-color`, `window.__MOTE_THEME__`.
- [ ] `vite.config.ts` — `build.rollupOptions.input` multi-page.
- [ ] `applyThemeToHead` swaps title/theme-color/favicon/font/og at runtime.

## Phase 5 — Verify
- [ ] `pnpm lint`, `tsc --noEmit`, `pnpm test` green.
- [ ] `pnpm build` (multi-page) succeeds; OG/favicons in `dist`.
- [ ] `pnpm dev` — switch all five; screenshot each; confirm identical audio/interaction.
- [ ] Commit per phase; finish branch (PR or merge).

## Guardrails
- Engine files (`Simulation`, `AudioEngine`, `scale`, `rng`, `Particle`, engine `types`) stay behavior-identical. Existing engine tests must remain green and unedited.
- Voice keys (`peach…sky`) stay stable; only their RGB retints per theme.
