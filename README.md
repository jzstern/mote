# mote

A generative ambient music toy. Scatter glowing motes onto a dark canvas; they
drift, bounce, and live like cells, sounding soft in-key pads and plucks that
evolve forever and never quite repeat. No music theory required — there are no
wrong notes.

Soft, warm, light. Just sine-wavey pads. Simple enough for a child.

See the [spec](docs/superpowers/specs/2026-06-15-mote-ambient-generator-design.md).

## Interfaces

The same engine wears eight distinct skins, switchable from the dropdown selector
(persisted via `localStorage`; each also has its own entry URL). Interfaces are
pure visual + identity layers — the simulation and audio are identical across all
of them.

| Interface | Render | Feel |
| --- | --- | --- |
| `sumi` — sumi-e zen *(default)* | ink on rice paper | meditative, daylight |
| `botanical` | glow + pollen fuzz | mossy garden |
| `riso` — risograph mono | two-ink halftone | indie print |
| `tidepool` — tide pool | glow + ripple-on-bounce | deep-sea bioluminescence |
| `aurora` — nocturne aurora | glow + long trails | serene midnight |
| `liquid` — liquid light | WebGL metaball shader | flowing liquid light |
| `ascii` | colored density glyphs | living ASCII art |
| `terminal` | amber ASCII + console chrome | brutalist government/sci-fi |

Each interface defines its own palette, background, canvas render mode,
control-strip chrome, wordmark font, favicon, and OpenGraph image. The canvas has
five render modes (`glow`, `ink`, `halftone`, `ascii`, `shader`); the `terminal`
adds a `chromeVariant` that swaps in a console-style control panel. See the
[themes spec](docs/superpowers/specs/2026-06-15-mote-visual-themes-design.md) and
the [shader/ascii/terminal spec](docs/superpowers/specs/2026-06-16-mote-shader-ascii-terminal-design.md).

Interface tokens live in `src/themes/`. Favicons, OG images, and the per-interface
HTML entries are generated from those tokens with `pnpm gen:assets`.

## Lab: mechanism variants

Where interfaces reskin the same particle simulation, the lab (`/lab.html`)
prototypes five different *living systems* — each with its own mechanism, sound
design, typography, favicon, and OG image, sharing only the scale-locked
instrument kit (`src/variants/audio.ts`) and page shell (`src/variants/shell.ts`).

| Variant | Mechanism | Sound | Feel |
| --- | --- | --- | --- |
| `pulse` | Brian's Brain cellular automaton | glassy FM plucks, 16th-quantized | neon synaptic storm |
| `ember` | pulse-coupled oscillators (firefly sync) | kalimba flashes, emergent rhythm | warm summer night |
| `terrace` | Abelian sandpile (self-organized criticality) | koto runs sized to avalanches | zen sand garden, light |
| `loom` | elementary 1D CA (Rule 90 → 150 → 110 → …) | music-box bells on a steady 8th-note weave | indigo textile |
| `hypha` | Physarum slime-mold agents | slow drone chords played by trail density | bioluminescent abyss |

Variant logic lives in `src/variants/<id>/` (pure `sim.ts` + `app.ts`); brand
tokens in `src/variants/meta.ts`. Favicons, OG images, and HTML entries are
generated with `pnpm gen:variant-assets`.

## Stack

Vite + React + TypeScript + Tailwind, Tone.js for audio, HTML Canvas 2D (and
WebGL2 for the shader interface) for rendering. 100% client-side — no backend.
