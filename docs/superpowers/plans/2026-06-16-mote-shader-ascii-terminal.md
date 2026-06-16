# Mote — Shader, ASCII & Terminal Implementation Plan

**Spec:** [2026-06-16-mote-shader-ascii-terminal-design.md](../specs/2026-06-16-mote-shader-ascii-terminal-design.md)
**Branch:** `feat/visual-themes`

Add `liquid` (shader), `ascii`, `terminal` interfaces + dropdown selector. Eight total.

## Phase 0 — Tokens & renderer interface
- [x] `types.ts`: `RenderMode` += `ascii`|`shader`; `chromeVariant?`; `render.shader?`/`render.ascii?`.
- [x] `MoteRenderer` interface + `createRenderer(canvas, theme, reducedMotion)` factory (2D vs WebGL2, fallback).
- [x] `MoteApp` uses the factory; add `particleCount()`.

## Phase 1 — ASCII renderer (2D)
- [x] `Renderer` `ascii` branch: cell grid, per-mote splat into typed-array brightness/color, draw glyphs for non-empty cells; `mono` override.
- [x] `Renderer.test.ts`: ascii draws without throwing, no `lighter`.

## Phase 2 — Shader renderer (WebGL2)
- [x] `ShaderRenderer.ts`: full-screen quad, metaball fragment shader, uniforms (uPos/uCol/uCount/uBg/uTime/uRes), reduced internal res.
- [x] Factory fallback to 2D when WebGL2 missing; smoke test with mocked gl.

## Phase 3 — Themes
- [x] `liquid.ts`, `ascii.ts`, `terminal.ts` (terminal: `chromeVariant:'terminal'`, ascii mono amber).
- [x] Register in `index.ts`; extend `themes/index.test.ts`.

## Phase 4 — Chrome + dropdown
- [x] `--mote-radius` in every theme's chrome; `Segmented`/`Knob`/`ControlStrip` consume it.
- [x] `TerminalControlStrip.tsx` (status line + labeled rows + scanlines).
- [x] `ThemeDropdown.tsx` replaces `ThemeSwitcher` (listbox, Esc/outside close, ARIA).
- [x] `App.tsx` branches chrome by `chromeVariant`.

## Phase 5 — Assets
- [x] `gen-assets.ts`: favicon + OG for liquid (blobs) / ascii (glyph grid) / terminal (amber panel); new HTML entries.
- [x] `vite.config.ts` multi-page input += liquid/ascii/terminal.

## Phase 6 — Verify
- [x] `tsc`, `pnpm lint`, `pnpm test`, `pnpm build` green.
- [x] Browser: liquid/ascii/terminal render; dropdown switches all eight; audio identical.
- [x] Commit per phase.

## Guardrails
- Engine (`Simulation`/`AudioEngine`/`scale`/`rng`/`Particle`/engine `types`) stays behavior-identical and tests unedited.
- Existing five interfaces unaffected beyond the additive `--mote-radius` (pill default).
