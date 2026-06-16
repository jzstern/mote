# mote

A generative ambient music toy. Scatter glowing motes onto a dark canvas; they
drift, bounce, and live like cells, sounding soft in-key pads and plucks that
evolve forever and never quite repeat. No music theory required — there are no
wrong notes.

Soft, warm, light. Just sine-wavey pads. Simple enough for a child.

See the [spec](docs/superpowers/specs/2026-06-15-mote-ambient-generator-design.md).

## Themes

The same engine wears five distinct skins, switchable from the corner picker
(persisted via `localStorage`; each also has its own entry URL). Themes are pure
visual + identity layers — the simulation and audio are identical across all of
them.

| Theme | Render | Feel |
| --- | --- | --- |
| `sumi` — sumi-e zen *(default)* | ink on rice paper | meditative, daylight |
| `botanical` | glow + pollen fuzz | mossy garden |
| `riso` — risograph mono | two-ink halftone | indie print |
| `tidepool` — tide pool | glow + ripple-on-bounce | deep-sea bioluminescence |
| `aurora` — nocturne aurora | glow + long trails | serene midnight |

Each theme defines its own palette, background, canvas render mode, control-strip
chrome, wordmark font, favicon, and OpenGraph image. See the
[themes spec](docs/superpowers/specs/2026-06-15-mote-visual-themes-design.md).

Theme tokens live in `src/themes/`. Favicons, OG images, and the per-theme HTML
entries are generated from those tokens with `pnpm gen:assets`.

## Stack

Vite + React + TypeScript + Tailwind, Tone.js for audio, HTML Canvas 2D for
rendering. 100% client-side — no backend.
