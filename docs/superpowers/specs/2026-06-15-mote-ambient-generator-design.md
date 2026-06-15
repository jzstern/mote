# Mote — Design Spec

**Date:** 2026-06-15
**Status:** Approved (design), pending implementation plan

## 1. Summary

Mote is a generative ambient music toy that runs entirely in the browser. The
user scatters glowing "motes" (particles) onto a dark canvas. Motes drift,
bounce off the walls and each other, and live a slow life cycle — born bright
and small, growing and mellowing, then fading and dying. Each mote and each
collision produces soft, in-key sound: long lush reverberant pads and/or gentle
plucks. Because every sound is locked to a single musical scale, there are no
wrong notes — it sounds pleasant no matter how it is used, with no knowledge of
music theory required. Because the particle population continuously turns over
and every musical event carries small randomness, the music evolves indefinitely
and (in at least most cases) never exactly repeats.

The experience is deliberately minimal: a calm dark field that is already alive
when you arrive, with all controls tucked into an unobtrusive Teenage
Engineering–style strip. It is simple enough for a child to enjoy, and rewarding
enough to leave running as a generative piece.

## 2. Goals and non-goals

### Goals

- Incredibly simple to use — discoverable with zero instructions.
- Always sounds pleasant and elegant, regardless of how it is played.
- Requires no music-theory knowledge.
- Soft, warm, light timbre: sine/triangle pads, no drums, no percussion.
- Generative and effectively non-repeating; able to continue indefinitely,
  including with no user input ("it plays itself").
- A complete first version ("full kit"): living-particle interaction,
  switchable pad/pluck voices, mood/scale presets, and a small set of gentle
  effect knobs (reverb, delay, tone, motion).
- Small, subtle delights / easter eggs in the spirit of Teenage Engineering.

### Non-goals (v1)

- No accounts, backend, database, or network calls. 100% client-side.
- No recording/export, no sharing/seed URLs (roadmap).
- No "Ripple" ring-interference mode yet (roadmap — see §11). The audio
  architecture is designed so it slots in cleanly later.
- No MIDI, no custom sample import.

## 3. Core experience

On load, the canvas is a calm dark field with a few motes already drifting and
quietly sounding, so it is alive before any interaction. A faint "click
anywhere" hint is shown; it fades after the first interaction. (That first
interaction also satisfies the browser's user-gesture requirement to start
audio — see §8.)

Interactions:

- **Click / tap** — drop a mote at the pointer location, with a small random
  initial velocity.
- **Click-drag / flick** — drop a mote with the drag's release velocity (throw).
- **Any keyboard key** — also spawns a mote. Mashing keys yields music, never
  noise.
- Motes **drift and bounce** off the walls and off each other (elastic-ish
  collisions).
- Motes **live**: each is born small and bright, grows and mellows over its
  lifespan, then fades out and dies. The population is always gently turning
  over.

"It plays itself": a slow ambient **spore spawner** introduces new motes on its
own at a low rate, so that left completely untouched, Mote keeps breathing. This
is what guarantees indefinite continuation even hands-off. The spore rate is
gentle and can be paused.

## 4. The musical system ("no wrong notes")

All pitch selection is constrained to a single active **scale**, so any timing
or position is guaranteed consonant. This — not any music-theory logic — is what
makes Mote always sound good.

- **Default scale:** major pentatonic (no dissonant intervals).
- **Moods** (presets that swap the allowed note set; all stay consonant):
  - *Warm* — major pentatonic
  - *Dream* — lydian-flavored
  - *Dusk* — minor pentatonic
  - *Mist* — a Japanese-flavored scale (e.g. in-sen / hirajoshi)
- **Spatial → musical mapping** (intuitive, discoverable without explanation):
  - **Vertical position** → pitch within the scale (higher on screen = higher
    pitch), spanning a few octaves like a soft staff. A mote's pad pitch is
    latched at birth from this mapping (see §5) — a drifting mote does not
    glissando.
  - **Size / speed** → register and brightness (large, slow motes read low and
    warm; small, fast motes read high and sparkly).
  - **Brightness / velocity** → note loudness and filter openness.
- Pitch quantization to the active scale lives in one module (`scale.ts`) and is
  the single source of "what notes exist."

Anti-mud guarantees so dense play never gets harsh:

- A cap on simultaneous sustained voices (with gentle voice-stealing of the
  oldest).
- A rate limiter on pluck triggers.
- A warm master low-pass plus gentle bus compression/ducking so density is felt
  as fullness, not loudness.

Non-repetition comes from: continuous population turnover, small per-event
randomization within the scale, slow LFO drift on detune/filter, and spore
randomness. A seeded RNG is injected (see §9) so behavior is deterministic in
tests while feeling free in the app.

## 5. Sound design (Tone.js)

- **Pad voice** — `PolySynth` of detuned sine/triangle voices with slow
  attack/release, into a long, soft convolution **reverb**, a touch of
  **feedback delay**, **chorus**, and a slow filter **LFO** for movement. Warm,
  lush, never bright.
- **Pluck voice** — short FM/triangle "bell" with quick decay, sharing the same
  reverb/delay sends → gentle music-box sparkle.
- **Mode** — Pads / Plucks / Both:
  - *Pads* — each living mote holds a sustained note for its lifetime (note-on
    at birth, note-off at death). Its pitch is fixed at birth from the spawn-time
    position/size/speed and does not change as the mote drifts. The current
    population *is* a slowly evolving chord.
  - *Plucks* — motes are silent while drifting; musical **events** (primarily
    bounces, plus births) trigger short plucks. On a fresh load and when idle,
    the initial motes' births and the ongoing spore births keep plucks sounding,
    so the field is never dead silent.
  - *Both* — motes hold pads and bounces add plucks.
- **Master chain** — warm low-pass, soft limiter, gentle stereo width. The
  output can never become loud or shrill.
- **Timing** — pads are free / slow-swelling. Plucks quantize to a global
  `Tone.Transport` tempo — the **speed** control, in BPM — so collisions land on a
  gentle grid and shimmer rather than clatter; a rate limit still prevents floods.

## 6. Controls — "full kit," child-simple

The canvas is clean by default. A corner control reveals a sliding strip:

- **Mode** (segmented): pads / plucks / both
- **Mood** (presets): warm / dream / dusk / mist
- **Knobs**, labeled in friendly words, not jargon:
  - **space** → reverb amount
  - **echo** → delay amount/feedback
  - **tone** → master filter brightness
  - **drift** → how fast the motes physically move (visual liveliness, and how
    often they collide)
- **speed** (slider) → the musical tempo in BPM (≈40–120, default ~70) that the
  plucks lock to — distinct from **drift**
- **clear** (motes fade out gently), **play/pause** (spore spawner), **volume**
- Settings (mode, mood, knob values, and volume) persist in `localStorage`. No
  accounts, no backend.

## 7. Visual design and delight

Visual:

- Deep, warm-dark background (dark indigo/charcoal with a subtle radial vignette
  that drifts hue very slowly over minutes), never pure black.
- Motes are soft radial glows drawn with additive (`lighter`) compositing, in a
  warm luminous pastel palette (peach, gold, rose, lilac, aqua); color encodes
  voice/timbre. Gentle fading-overdraw trails give a dreamy feel.
- Event feedback: births bloom in, deaths fade and drift up, bounces give a soft
  flash/expand.
- `prefers-reduced-motion: reduce` is respected — trails and the more motion-
  heavy easter eggs are reduced; the simulation still runs but calmer.
- Cursor affordances per project UI rules (pointer on all interactive controls).

Delight / easter eggs (all subtle, all skippable):

- **It plays itself** — the idle spore spawner makes a screensaver-grade
  generative piece.
- **Double-click a mote** → it "blooms" (a brief ring pulse + chord flourish) — a
  wink at the future Ripple mode.
- **Type "mote"** → all motes bloom in sync and the key shimmers (a gentle
  modulation).
- **Idle sunbeam** — after a while a faint light ray slowly sweeps the field;
  motes crossing it shimmer.
- **Time-of-day tint** — palette warms in the evening, cools at dawn (local
  clock).
- **Magnetize** — hold a key and motes gently drift toward the cursor.

## 8. Architecture, components, and data flow

A framework-agnostic **TypeScript engine** does all simulation, audio, and
rendering; React is a thin shell that only drives it. This keeps the per-frame
hot path out of React's render cycle, lets the pure logic be unit-tested
headlessly, and makes the future Ripple mode a clean add (a new event source,
not a rewrite).

### Modules

`src/engine/` (no React, no DOM framework):

- **`Particle.ts`** — a mote: id, position, velocity, size, age, lifespan,
  color, voice/type. Pure data + small helpers.
- **`Simulation.ts`** — owns the particle array and the per-frame step: integrate
  motion, resolve wall and particle collisions, advance aging/lifespan, run the
  spore spawner, enforce the population cap. Emits an array of abstract
  `MusicalEvent`s per step. Collision detection is O(n²) at the expected small
  population (hard cap ~150–200), with a spatial-hash upgrade path noted.
- **`scale.ts`** — the scales/moods and the mapping from
  `{ y, size, speed }` → a pitch within the active scale. The single source of
  truth for "what notes exist." Pure and fully unit-tested.
- **`AudioEngine.ts`** — the Tone.js graph (pad synth, pluck synth, reverb/delay/
  chorus/filter sends, master chain). Consumes `MusicalEvent`s and renders sound;
  owns voice allocation/stealing, the pluck rate limiter, and knob setters.
- **`Renderer.ts`** — Canvas 2D drawing: glow, additive blend, trails, birth/
  death/bounce visuals, palette, day-tint, reduced-motion handling.
- **`MoteApp.ts`** — composition root. Wires Simulation + AudioEngine + Renderer,
  owns the `requestAnimationFrame` loop and the fixed-timestep accumulator, and
  exposes a small imperative API: `addMote`, `setMode`, `setMood`, `setKnob`,
  `clear`, `setSporesEnabled`, `setVolume`, `start`, `dispose`.

`src/ui/` (React + Tailwind — thin shell):

- **`Canvas.tsx`** — hosts the `<canvas>`, mounts a `MoteApp` instance via a ref,
  forwards pointer/keyboard events to it, and handles resize (devicePixelRatio).
- **`ControlStrip.tsx`** — mode segmented control, mood presets, knobs, clear/
  play-pause/volume. Reads/writes control values in React state and calls the
  `MoteApp` API. Never touches the per-frame loop.
- **`Knob.tsx`** — a custom circular drag knob (pointer drag → value), with the
  soft TE-style look from the approved mockup.
- **`App.tsx`** — layout, the audio-unlock gate, `localStorage` persistence.

### Data flow

1. **Input:** pointer/key events on `Canvas` → `MoteApp.addMote(x, y, vx, vy)` →
   `Simulation` creates a `Particle`.
2. **Frame:** `MoteApp` RAF tick → `Simulation.step(dt)` returns the updated
   particle state + `MusicalEvent[]` → `AudioEngine.handle(events)` and
   `Renderer.draw(state)`.
3. **Controls:** `ControlStrip` → `MoteApp.setMode/setMood/setKnob/...` → updates
   `Simulation` / `AudioEngine` / `Renderer` configuration.

### Event model

```
MusicalEvent =
  { type: 'born' | 'bounce' | 'death' | 'bloom',
    particleId: number, x: number, y: number,
    size: number, speed: number, voice: VoiceType }
```

`AudioEngine` maps an event to a pitch via `scale.pitchFor({ y, size, speed })`
and decides pad vs pluck from the current mode and event type:

- `born` → allocate a sustained pad voice (if pads on); also a pluck (if plucks
  on).
- `bounce` → trigger a pluck (if plucks on, subject to the rate limiter); pads
  unaffected.
- `death` → release that mote's pad voice.
- `bloom` → easter-egg flourish (chord + visual ring).

Adding Ripple mode later means emitting new event types (e.g. `ring-cross`) from
`Simulation` and handling them in `AudioEngine` — no change to the rest.

## 9. Error handling and robustness

- **Audio unlock:** Web Audio requires a user gesture. `Tone.start()` runs on the
  first pointer/key interaction; the "click anywhere" hint doubles as the unlock
  affordance. Until unlocked, the visual field still animates silently.
- **Tab visibility:** on `visibilitychange` to hidden, pause the RAF loop and
  silence/release voices to avoid a backlog and an audio pile-up on return;
  resume cleanly on focus.
- **Fixed timestep:** the simulation steps on a fixed-timestep accumulator so
  physics and aging are frame-rate independent and deterministic given a seed.
- **Performance guard:** hard cap on particle count; if frame time degrades,
  reduce spore spawning and trail cost; oldest motes die first.
- **Determinism / seeded RNG:** all randomness goes through an injected RNG.
  Production seeds from the clock; tests inject a fixed seed so simulation and
  scale behavior are reproducible.
- **Input safety:** pointer events unify mouse and touch; default scroll/zoom/
  context-menu on the canvas is prevented. Resize uses `devicePixelRatio`.
- **Reduced motion:** honored as in §7.

## 10. Testing

Focus automated testing on the pure logic; treat audio/render as side-effecty.

- **`scale.ts` (Vitest):** every returned pitch is a member of the active scale;
  the vertical → pitch mapping is monotonic; switching mood changes the allowed
  set; octave span is bounded.
- **`Simulation.ts` (Vitest, seeded RNG):** motion integration is deterministic;
  wall/particle collisions reflect velocity correctly; lifespan removal works;
  the spore spawner respects its rate and the population cap; the expected
  `MusicalEvent`s are emitted for birth/bounce/death.
- **`AudioEngine` / `Renderer`:** thin smoke tests with mocked Tone / canvas
  context (constructs without throwing; voice cap and rate limiter hold), plus a
  short manual QA checklist for feel.
- Test-driven development is applied to the pure engine core, where it pays off.

## 11. Roadmap (post-v1)

- **Ripple mode** — particles periodically (or on collision with a wall, another
  particle, or a user-placed obstacle) emit expanding rings; when two rings
  intersect they sound a note whose timbre blends the two emitting particles'
  types. Architecturally a new `MusicalEvent` source feeding the same scale-
  locked synth.
- Shareable / seedable generative-state URLs.
- Record-a-loop audio export.
- User-placed obstacles and attractors.
- PWA install (a calm-down toy on the home screen).
- MIDI out.

## 12. Open questions / to validate during build

- Exact default key, octave range, and spore rate are tuning decisions to settle
  by ear during implementation.
- The exact pluck subdivision (8th vs 16th) and the **speed** / BPM range (≈40–120)
  are by-ear tuning; plucks quantize to the global tempo with a rate limit on top.
- Pad voice-cap number (target ~8–12) to balance richness against mud.
