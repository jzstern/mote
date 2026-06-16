# Mote — Shader, ASCII & Terminal Implementation Plan

**Spec:** [2026-06-16-mote-shader-ascii-terminal-design.md](../specs/2026-06-16-mote-shader-ascii-terminal-design.md)
**Branch:** `feat/visual-themes`

Add `liquid` (shader), `ascii`, `terminal` interfaces + dropdown selector. Eight total.

## Phase 0 — Tokens & renderer interface
- [ ] `types.ts`: `RenderMode` += `ascii`|`shader`; `chromeVariant?`; `render.shader?`/`render.ascii?`.
- [ ] `MoteRenderer` interface + `createRenderer(canvas, theme, reducedMotion)` factory (2D vs WebGL2, fallback).
- [ ] `MoteApp` uses the factory; add `particleCount()`.

## Phase 1 — ASCII renderer (2D)
- [ ] `Renderer` `ascii` branch: cell grid, per-mote splat into typed-array brightness/color, draw glyphs for non-empty cells; `mono` override.
- [ ] `Renderer.test.ts`: ascii draws without throwing, no `lighter`.

## Phase 2 — Shader renderer (WebGL2)
- [ ] `ShaderRenderer.ts`: full-screen quad, metaball fragment shader, uniforms (uPos/uCol/uCount/uBg/uTime/uRes), reduced internal res.
- [ ] Factory fallback to 2D when WebGL2 missing; smoke test with mocked gl.

## Phase 3 — Themes
- [ ] `liquid.ts`, `ascii.ts`, `terminal.ts` (terminal: `chromeVariant:'terminal'`, ascii mono amber).
- [ ] Register in `index.ts`; extend `themes/index.test.ts`.

## Phase 4 — Chrome + dropdown
- [ ] `--mote-radius` in every theme's chrome; `Segmented`/`Knob`/`ControlStrip` consume it.
- [ ] `TerminalControlStrip.tsx` (status line + labeled rows + scanlines).
- [ ] `ThemeDropdown.tsx` replaces `ThemeSwitcher` (listbox, Esc/outside close, ARIA).
- [ ] `App.tsx` branches chrome by `chromeVariant`.

## Phase 5 — Assets
- [ ] `gen-assets.ts`: favicon + OG for liquid (blobs) / ascii (glyph grid) / terminal (amber panel); new HTML entries.
- [ ] `vite.config.ts` multi-page input += liquid/ascii/terminal.

## Phase 6 — Verify
- [ ] `tsc`, `pnpm lint`, `pnpm test`, `pnpm build` green.
- [ ] Browser: liquid/ascii/terminal render; dropdown switches all eight; audio identical.
- [ ] Commit per phase.

## Guardrails
- Engine (`Simulation`/`AudioEngine`/`scale`/`rng`/`Particle`/engine `types`) stays behavior-identical and tests unedited.
- Existing five interfaces unaffected beyond the additive `--mote-radius` (pill default).
