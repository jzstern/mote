# Ripple Mode — Design Spec

**Date:** 2026-06-15
**Status:** Approved (design), pending implementation plan
**Base branch:** `feat/ripple-mode`, branched off the finished mote build (`5eeaea4`).
`main` does not yet contain the engine, so Ripple is built on top of the finished
build rather than off `main`.

## 1. Summary

Ripple mode is the roadmap headliner described in the main design spec §11. When
enabled, each living mote periodically sends out a slow, soft expanding **ring**
from where it currently sits — a ripple on water, whose center stays put as the
mote drifts on. Where two rings cross, a single gentle bell-note sounds, with its
pitch locked to the active scale and its timbre blended from the two emitting
motes' voices. The crossing is shown twice over: a bright **flash** at the moment
the note fires, and **continuous sweeping nodes** that mark where the ring
outlines overlap for as long as they do.

Ripple is an **additive layer**, not a replacement: it is an independent on/off
toggle that sounds on top of whatever mode (pads / plucks / both) is active. It
slots into the engine as a new `MusicalEvent` source (`ring-cross`) feeding the
same scale-locked synth bus — exactly the seam the architecture was built to
protect. No existing module is rewritten; the change is purely additive.

## 2. Goals and non-goals

### Goals

- A calm, breathing "ripples on a pond" layer that stays musical and never harsh.
- Every ripple note locked to the active scale (no wrong notes), via the existing
  `scale.pitchFor()` — the single source of truth for pitch.
- Timbre that audibly blends the two crossing motes' voices.
- Clear cause→effect: you can *see* why each chime sounded (the trigger flash) and
  *see* the geometry that produces it (the sweeping crossing nodes).
- Cheap at the 160-particle population cap: ring–ring work is bounded by a global
  ring budget, independent of particle count.
- Pure, deterministic, unit-testable ring geometry and intersection detection
  (seeded RNG), TDD-first.

### Non-goals (this feature)

- No change to pads / plucks / both behavior, the existing one-shot **bloom**
  rings, or the double-click / type-"mote" easter eggs.
- No user-placed obstacles or wall-emitted rings (spec §11 lists them; deferred).
- No new mood/scale; ripple reuses the active mood.
- No spatial-hash rewrite of collision detection; the existing O(n²) loop is
  retained and the ripple pass mirrors it within a small bounded budget.

## 3. Behavior and UX

- A **ripple** toggle (concentric-rings icon) lives in the control strip next to
  the spore play/pause and clear controls. It is **off by default** so the
  established soundscape is unchanged for returning users; ripple is an opt-in
  delight. The setting persists in `localStorage`.
- When **on**:
  - Each living mote emits a ring on a jittered interval (~4–7 s). The ring's
    center is fixed at the emission point; it expands over its lifespan (~3 s)
    from the mote's radius out to a wide radius (~35% of `min(width, height)`),
    growing fainter as it goes, then is removed.
  - A **global ring budget** (~28 simultaneous rings) bounds both visual density
    and intersection cost. At the cap, emission is skipped (no queueing).
  - When two rings first touch (tangency), a `ring-cross` note fires **once** for
    that pair — pitch from the crossing height, timbre blended from the two
    voices, panned to the crossing's x — and a bright flash blooms at the touch
    point.
  - As the two rings keep growing, the single touch point splits into the two
    points where the outlines cross; soft glowing **nodes** track those points,
    sweeping apart, for as long as the pair overlaps.
- When **off**: no rings are emitted, no rings are drawn, and no `ring-cross`
  events are produced. The toy behaves exactly as today.

## 4. Event model

`MusicalEvent` becomes a discriminated union. The four life events keep today's
shape; `ring-cross` is its own variant carrying two voices and no `particleId`:

```ts
export type LifeEventType = 'born' | 'bounce' | 'death' | 'bloom';

export interface LifeEvent {
  type: LifeEventType;
  particleId: number;
  x: number; y: number;
  size: number; speed: number;
  voice: VoiceType;
}

export interface RingCrossEvent {
  type: 'ring-cross';
  x: number; y: number;     // crossing location (for pitch/pan/flash)
  size: number;             // averaged emitter size → register bias
  speed: number;            // averaged emitter speed (carried for symmetry)
  voiceA: VoiceType;
  voiceB: VoiceType;
}

export type MusicalEvent = LifeEvent | RingCrossEvent;
```

`AudioEngine.handle()` switches on `e.type`; the existing cases narrow to
`LifeEvent` (so `e.particleId` stays valid in the `born`/`death`/`bounce`/`bloom`
cases), and a new `ring-cross` case narrows to `RingCrossEvent`. The
`MusicalEventType` alias in `types.ts` is updated to include `'ring-cross'`.

`ring-cross` reuses the existing pitch path: `AudioEngine.midiFor()` already
supplies `height` from engine state (`this.height`) and reads only
`{ y, size, speed }` off the event, so `RingCrossEvent` does **not** carry
`height` — it is wired through `midiFor` exactly like every existing event. The
real `pitchFor` signature is `{ y, height, size, speed }` (`scale.ts`); `height`
comes from the engine, not the event.

## 5. Simulation — pure, TDD core

Ring geometry lives in a small pure module so it can be unit-tested directly, and
`Simulation` composes it.

### 5.1 `ripple.ts` (new, pure)

```ts
export interface RippleRing {
  id: number;
  x: number; y: number;   // fixed center
  size: number;           // emitter diameter (register bias on cross)
  voice: VoiceType;
  age: number;            // seconds
}

export interface RippleOverlap { x: number; y: number; voiceA: VoiceType; voiceB: VoiceType; }

// radius at the ring's current age
export function ringRadius(ring: RippleRing, lifespan: number, maxRadius: number): number;

// circle–circle intersection of two ring outlines at radii r0, r1.
// returns null if they do not cross (one inside the other, or too far apart),
// else the two intersection points (coincident at tangency).
export function circleIntersection(
  x0: number, y0: number, r0: number,
  x1: number, y1: number, r1: number,
): { p0: Vec2; p1: Vec2; mid: Vec2 } | null;
```

`circleIntersection` uses the standard construction: `d = hypot(dx, dy)`; cross iff
`abs(r0 - r1) <= d <= r0 + r1` and `d > 0`; `a = (r0² - r1² + d²) / (2d)`;
`h = sqrt(max(0, r0² - a²))`; midpoint `mid = c0 + a·û`; points `mid ± h·n̂` where
`n̂` is `û` rotated 90°. At tangency `h = 0`, so `p0 == p1 == mid`.

### 5.2 `Simulation` integration

- New config: `rippleEnabled: boolean`, `rippleEmitIntervalSec: number` (jitter
  base), `ringLifespanSec: number`, `ringMaxRadius: number`, `maxRings: number`.
- New state: `ripples: RippleRing[]`, `rippleOverlaps: RippleOverlap[]` (transient,
  recomputed each step), a per-particle `rippleTimer`, a `nextRingId` counter, and
  a `firedPairs: Set<string>` for note de-duplication (key = `"idLo:idHi"`).
- Per `step(dt)` when `rippleEnabled`:
  1. **Emit:** decrement each particle's `rippleTimer`; on elapse, reset it to a
     jittered interval (RNG) and, if `ripples.length < maxRings`, push a new
     `RippleRing` at the particle's current position carrying its voice and size.
  2. **Age & cull:** add `dt` to each ring's age; remove rings past
     `ringLifespanSec`; when a ring is removed, delete every `firedPairs` entry
     containing its id.
  3. **Intersect:** clear `rippleOverlaps`; for each ring pair (O(R²),
     `R ≤ maxRings`), cheap-reject on center distance, else call
     `circleIntersection`. If it crosses: push the two points (with both voices)
     into `rippleOverlaps`; if the pair key is not in `firedPairs`, add it and
     emit one `ring-cross` event at `mid` with averaged size/speed and both voices.
- `rippleEnabled` toggling off clears `ripples`, `rippleOverlaps`, and
  `firedPairs`.
- Determinism: emission timers and jitter draw from the injected RNG, so a seeded
  simulation produces identical rings, crossings, and events.

### 5.3 Cost

`R` is capped at `maxRings` (~28), so the intersection pass is ~`28²/2 ≈ 400`
cheap checks per step **regardless of the 160-particle cap** — about the same
order as the existing particle-collision loop, and far below it at high
population. Per-pair work is a few subtractions, one `hypot`, and (only for
crossing pairs) one `sqrt`.

## 6. Audio design

- A dedicated **ripple synth**: a soft, glassy bell voice (FM/AM or triangle-based
  `PolySynth` with a short bell envelope), distinct from the pluck, into its own
  `rippleBus` `Gain` → the shared chorus → filter → delay → reverb → limiter
  chain at a gentle level. The ripple layer therefore inherits space/echo/tone and
  the master limiter automatically.
- **Voice blend:** each `VoiceType` gets a small timbre profile — a single
  *brightness* scalar in `[0, 1]` (a `VOICE_TIMBRE` map alongside `VOICE_RGB`). A
  `ring-cross` averages the two motes' brightness and maps the result to the
  synth's tone (filter cutoff / FM modulation index / harmonicity). The visual
  flash and nodes use the averaged `VOICE_RGB` so the blend is seen as well as
  heard.
- **Pitch:** `pitchFor(mood, { y, size, speed })` at the crossing — always in the
  active scale. `size` is the averaged emitter size, giving a gentle register
  bias.
- **Density control:** `ring-cross` notes quantize to the transport grid (`4n`,
  bell-spaced) and pass through a ripple-specific rate limit (~0.08 s min spacing),
  layered on top of the global ring budget and the master limiter.
- Smoke-tested only (Web Audio is side-effecty): constructs without throwing,
  `handle([ring-cross])` allocates a ripple note without throwing, the rate limit
  holds.

## 7. Visual design

Ripple visuals are a separate code path from the existing decorative bloom rings.

- **Rings:** drawn from `Simulation.ripples`, each a soft additive stroke colored
  by its emitter voice, expanding and fading with age.
- **Trigger flash:** when a `ring-cross` event fires, a brief (~0.4 s) bright
  bloom — colored by the blended voice — is spawned at the crossing point and
  fades. This is the 1:1 "a note just sounded here" cue.
- **Sweeping crossing nodes:** drawn from `Simulation.rippleOverlaps`, a small
  glowing dot at each current intersection point, colored by the blended voice.
  They persist while the pair overlaps and sweep apart as the rings grow (chosen
  over a filled lens region to stay light and calm).
- **Relationship to existing bloom rings:** the current `Renderer.rings`
  (one-shot, silent, triggered by `bloom`/double-click) are renamed `bloomRings`
  for clarity and left functionally unchanged. Ripple rings, flashes, and nodes
  are new, separate fields. The double-click bloom stays as the "wink at Ripple."
- **Reduced motion:** rings and nodes are drawn dim/without heavy bloom and
  flashes are minimized; **audio is unaffected**.

### Data flow

`MoteApp` already runs the fixed-timestep loop. Per substep it passes
`sim.step(dt)`'s events to `AudioEngine.handle()`; it additionally scans those
events for `ring-cross` and calls `renderer.addRippleFlash(x, y, voiceA, voiceB)`.
Each frame it draws with the current ring + overlap state. The ripple arguments
are **appended last** so existing four-argument callers stay valid:
`renderer.draw(particles, width, height, tint, sim.ripples, sim.rippleOverlaps)`.
The overlaps reflect the last substep (<1/120 s stale) — visually exact.

## 8. UI and persistence

- `Settings` gains `ripple: boolean`; `DEFAULTS.ripple = false`.
- `ControlStrip` gains a toggle button (concentric-rings icon, `aria-pressed`),
  grouped with spores/clear, following the existing button styling and the global
  `cursor: pointer` rule.
- `MoteApp.setRipple(on)` → `sim.setConfig({ rippleEnabled: on })`.
- `useMoteApp` pushes `settings.ripple` to the engine alongside the other settings
  and persists it. Older persisted settings without the key fall back to the
  default via the existing `{ ...DEFAULTS, ...parsed }` merge.

## 9. Testing

TDD-first on the pure parts; smoke tests for the side-effecty parts.

- **`ripple.test.ts` (pure):** `ringRadius` grows 0→maxRadius across the lifespan;
  `circleIntersection` returns `null` when separate or nested, two coincident
  points at tangency, and two correct symmetric points when crossing (verified
  against hand-computed coordinates).
- **`Simulation.test.ts` (seeded RNG):** a ring is emitted after the interval;
  ring count never exceeds `maxRings`; two motes whose rings grow into each other
  produce **exactly one** `ring-cross` (deduped across steps) and populate
  `rippleOverlaps`; well-separated motes produce none; a ring is removed after its
  lifespan (and its `firedPairs` entries pruned); `rippleEnabled: false` emits no
  rings or events.
- **`AudioEngine.test.ts`:** `handle([ring-cross])` does not throw and allocates a
  ripple note; the ripple rate limit holds; the mocked Tone graph still constructs.
- **`Renderer.test.ts`:** given ripples + overlaps + a flash, the expected
  per-ring / per-node / per-flash draw calls happen.
- **Manual browser QA:** with ripple on, rings render and expand; crossings chime
  in-key and audibly blended; trigger flashes and sweeping nodes appear at the
  right places; layering over pads/plucks stays calm; perf is smooth at the
  160-mote cap; no console errors. Reduced-motion check: visuals calm, audio
  intact.

## 10. Tunable defaults (settle by ear/eye in implementation)

| Parameter | Default |
| --- | --- |
| Ripple toggle | off |
| Emit interval (jittered per mote) | 4–7 s |
| Ring lifespan | ~3 s |
| Ring max radius | ~35% of `min(width, height)` |
| Global ring budget (`maxRings`) | ~28 |
| Note quantize / rate-limit | `4n` grid, ~0.08 s min spacing |
| Trigger flash duration | ~0.4 s |
| Ripple bus level | gentle (below pads/pluck) |

## 11. Files

- **New:** `src/engine/ripple.ts` (+ `ripple.test.ts`).
- **Modified:** `src/engine/types.ts` (event union, `ripple` plumbing types),
  `src/engine/Simulation.ts` (emission, intersection, events, config),
  `src/engine/palette.ts` (`VOICE_TIMBRE`), `src/engine/AudioEngine.ts` (ripple
  synth + `ring-cross` handling), `src/engine/Renderer.ts` (ripple rings, flashes,
  nodes; rename `rings`→`bloomRings`), `src/engine/MoteApp.ts` (`setRipple`, flash
  wiring, draw signature), `src/ui/storage.ts` (`ripple` setting),
  `src/ui/useMoteApp.ts` (push/persist), `src/ui/ControlStrip.tsx` (toggle).
  Tests updated alongside (`Simulation.test.ts`, `AudioEngine.test.ts`,
  `Renderer.test.ts`).
