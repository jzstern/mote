# Ripple Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Ripple mode" — an additive, toggleable layer where motes emit slow expanding rings and each ring–ring crossing sounds one scale-locked, voice-blended bell note, with the crossing shown as a trigger flash plus continuously sweeping overlap nodes.

**Architecture:** A new `ring-cross` `MusicalEvent` source. Pure ring geometry lives in a new `src/engine/ripple.ts`; `Simulation` emits/ages rings, detects intersections (O(R²) bounded by a global ring budget), de-dupes notes per ring-pair, and exposes `ripples` + transient `rippleOverlaps`. `AudioEngine` gains a dedicated ripple synth that blends the two voices' timbres. `Renderer` draws rings, sweeping nodes, and trigger flashes (separate from the existing one-shot bloom rings). A `ripple` boolean is plumbed through settings/UI. No existing behavior changes.

**Tech Stack:** Vite, React, TypeScript (strict), Tailwind v4, Tone.js, HTML Canvas 2D, Vitest. Package manager: pnpm.

Design reference: [`../specs/2026-06-15-ripple-mode-design.md`](../specs/2026-06-15-ripple-mode-design.md).

---

## Conventions for every task

- **Worktree/branch:** all work is on `feat/ripple-mode` (already created off the finished build `5eeaea4`). Never commit to `main` (a repo hook blocks it).
- **Every commit message ends with this footer** (per this feature's instruction), so it is omitted from the short messages below:
  ```
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  ```
- **TDD where it pays:** `ripple.ts` and `Simulation.ts` ripple logic are unit-tested with Vitest + a seeded RNG. `AudioEngine` and `Renderer` get construction/draw smoke tests with mocked Tone / canvas (do not over-mock). `MoteApp` and UI are verified by `tsc` + manual browser QA.
- **Commands:** one-shot tests `pnpm test`; single file `pnpm exec vitest run <file>`; types `pnpm exec tsc --noEmit`; app `pnpm dev`; prod build `pnpm build`.
- **Match existing test style** (terse, inline comments — the repo's existing tests do not use BDD `#given/#when/#then` headers; stay consistent with the files you edit).
- **Reference skill:** @superpowers:test-driven-development for the red/green/commit rhythm.

## File map

- **Create:** `src/engine/ripple.ts`, `src/engine/ripple.test.ts`, `src/engine/palette.test.ts`.
- **Modify:** `src/engine/types.ts`, `src/engine/palette.ts`, `src/engine/Particle.ts`, `src/engine/Particle.test.ts`, `src/engine/Simulation.ts`, `src/engine/Simulation.test.ts`, `src/engine/AudioEngine.ts`, `src/engine/AudioEngine.test.ts`, `src/engine/Renderer.ts`, `src/engine/Renderer.test.ts`, `src/engine/MoteApp.ts`, `src/ui/storage.ts`, `src/ui/useMoteApp.ts`, `src/ui/ControlStrip.tsx`.

---

## Task 0: Worktree dependencies + baseline green

A fresh worktree has no `node_modules`. Install and confirm the existing suite passes before changing anything.

**Files:** none (environment only)

- [ ] **Step 1: Install deps**

Run: `pnpm install`
Expected: completes without error; `node_modules/` present.

- [ ] **Step 2: Baseline tests pass**

Run: `pnpm test`
Expected: all existing suites pass (rng, scale, Particle, Simulation, AudioEngine, Renderer).

- [ ] **Step 3: Baseline typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

> No commit (nothing changed). If baseline is red, STOP and report — do not start ripple work on a broken base.

---

## Task 1: Event model — `ring-cross` discriminated union

Make `MusicalEvent` a union so a crossing can carry two voices and no `particleId`.

**Files:**
- Modify: `src/engine/types.ts`
- Modify: `src/engine/Simulation.ts` (the `event()` helper return type)
- Modify: `src/engine/AudioEngine.ts` (`midiFor` param shape so both variants feed it)

- [ ] **Step 1: Rewrite the event types in `src/engine/types.ts`**

Replace the current `MusicalEventType` + `MusicalEvent` block with:

```ts
export type LifeEventType = 'born' | 'bounce' | 'death' | 'bloom';
export type MusicalEventType = LifeEventType | 'ring-cross';

export interface LifeEvent {
  type: LifeEventType;
  particleId: number;
  x: number; y: number;
  size: number; speed: number;
  voice: VoiceType;
}

export interface RingCrossEvent {
  type: 'ring-cross';
  x: number; y: number;
  size: number; speed: number;   // averaged from the two emitting motes
  voiceA: VoiceType;
  voiceB: VoiceType;
}

export type MusicalEvent = LifeEvent | RingCrossEvent;
```

- [ ] **Step 2: Narrow the `event()` return type in `src/engine/Simulation.ts`**

Change the helper signature so it is the life-event variant (it already builds that shape):

```ts
private event(type: LifeEvent['type'], p: Particle): LifeEvent {
  return { type, particleId: p.id, x: p.pos.x, y: p.pos.y, size: p.size, speed: speedOf(p), voice: p.voice };
}
```

Add `LifeEvent` to the `types` import: `import type { LifeEvent, MusicalEvent } from './types';`

- [ ] **Step 3: Decouple `midiFor` in `src/engine/AudioEngine.ts`**

So both event variants can feed it, change its parameter to the minimal shape it actually reads:

```ts
private midiFor(e: { y: number; size: number; speed: number }) {
  return pitchFor(this.mood, { y: e.y, height: this.height, size: e.size, speed: e.speed });
}
```

(No other AudioEngine change yet — `allocatePad`/`releasePad` are still only called from the `born`/`death` cases, which narrow to `LifeEvent`, so `e.particleId` stays valid.)

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Tests still green**

Run: `pnpm test`
Expected: all pass (no behavior changed).

- [ ] **Step 6: Commit**

```bash
git add src/engine/types.ts src/engine/Simulation.ts src/engine/AudioEngine.ts
git commit -m "feat(engine): ring-cross MusicalEvent union"
```

---

## Task 2: Pure ring geometry (`ripple.ts`)

Radius-from-age and circle–circle intersection — fully pure and unit-tested.

**Files:**
- Create: `src/engine/ripple.ts`
- Test: `src/engine/ripple.test.ts`

- [ ] **Step 1: Write the failing test — `src/engine/ripple.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { ringRadius, circleIntersection, type RippleRing } from './ripple';

const ring = (over: Partial<RippleRing> = {}): RippleRing => ({
  id: 1, x: 0, y: 0, size: 20, voice: 'peach', age: 0, ...over,
});

describe('ringRadius', () => {
  it('is 0 at birth, half at mid-life, max at/after end', () => {
    expect(ringRadius(ring({ age: 0 }), 10, 100)).toBe(0);
    expect(ringRadius(ring({ age: 5 }), 10, 100)).toBeCloseTo(50);
    expect(ringRadius(ring({ age: 10 }), 10, 100)).toBeCloseTo(100);
    expect(ringRadius(ring({ age: 99 }), 10, 100)).toBeCloseTo(100); // clamped
  });
});

describe('circleIntersection', () => {
  it('returns null when the circles are too far apart', () => {
    expect(circleIntersection(0, 0, 1, 10, 0, 1)).toBeNull();
  });
  it('returns null when one circle is nested inside the other', () => {
    expect(circleIntersection(0, 0, 5, 1, 0, 1)).toBeNull();
  });
  it('returns null when the circles are concentric', () => {
    expect(circleIntersection(0, 0, 5, 0, 0, 3)).toBeNull();
  });
  it('returns one coincident point at external tangency', () => {
    const hit = circleIntersection(0, 0, 1, 2, 0, 1);
    expect(hit).not.toBeNull();
    expect(hit!.p0.x).toBeCloseTo(1); expect(hit!.p0.y).toBeCloseTo(0);
    expect(hit!.p1.x).toBeCloseTo(1); expect(hit!.p1.y).toBeCloseTo(0);
    expect(hit!.mid.x).toBeCloseTo(1); expect(hit!.mid.y).toBeCloseTo(0);
  });
  it('returns two symmetric points when the outlines cross', () => {
    const hit = circleIntersection(0, 0, 2, 2, 0, 2);
    expect(hit).not.toBeNull();
    expect(hit!.mid.x).toBeCloseTo(1); expect(hit!.mid.y).toBeCloseTo(0);
    const ys = [hit!.p0.y, hit!.p1.y].sort((a, b) => a - b);
    expect(ys[0]).toBeCloseTo(-Math.sqrt(3));
    expect(ys[1]).toBeCloseTo(Math.sqrt(3));
    expect(hit!.p0.x).toBeCloseTo(1); expect(hit!.p1.x).toBeCloseTo(1);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`pnpm exec vitest run src/engine/ripple.test.ts` → cannot import `./ripple`).

- [ ] **Step 3: Implement `src/engine/ripple.ts`**

```ts
import type { Vec2, VoiceType } from './types';

export interface RippleRing {
  id: number;
  x: number; y: number;   // fixed center (emission point)
  size: number;           // emitter diameter — register bias on a crossing
  voice: VoiceType;
  age: number;            // seconds
}

export interface RippleOverlap {
  x: number; y: number;
  voiceA: VoiceType; voiceB: VoiceType;
}

export interface RingIntersection { p0: Vec2; p1: Vec2; mid: Vec2; }

export function ringRadius(ring: RippleRing, lifespan: number, maxRadius: number): number {
  const t = ring.age / lifespan;
  return maxRadius * (t < 0 ? 0 : t > 1 ? 1 : t);
}

export function circleIntersection(
  x0: number, y0: number, r0: number,
  x1: number, y1: number, r1: number,
): RingIntersection | null {
  const dx = x1 - x0, dy = y1 - y0;
  const d = Math.hypot(dx, dy);
  if (d === 0) return null;                  // concentric: no distinct crossing
  if (d > r0 + r1) return null;              // too far apart
  if (d < Math.abs(r0 - r1)) return null;    // one nested inside the other
  const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r0 * r0 - a * a));
  const ux = dx / d, uy = dy / d;            // unit vector center→center
  const mx = x0 + a * ux, my = y0 + a * uy;  // chord midpoint
  const nx = -uy, ny = ux;                   // perpendicular unit
  return {
    p0: { x: mx + h * nx, y: my + h * ny },
    p1: { x: mx - h * nx, y: my - h * ny },
    mid: { x: mx, y: my },
  };
}
```

- [ ] **Step 4: Run tests — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/engine/ripple.ts src/engine/ripple.test.ts
git commit -m "feat(engine): pure ripple ring geometry + intersection"
```

---

## Task 3: Voice timbre + color blend (`palette.ts`)

A brightness scalar per voice (for the audio blend) and an RGB blend (for the visual blend).

**Files:**
- Modify: `src/engine/palette.ts`
- Test: `src/engine/palette.test.ts`

- [ ] **Step 1: Write the failing test — `src/engine/palette.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { VOICE_TIMBRE, VOICES, blendVoiceRgb, VOICE_RGB } from './palette';

describe('palette ripple helpers', () => {
  it('defines a 0..1 brightness for every voice', () => {
    for (const v of VOICES) {
      expect(VOICE_TIMBRE[v]).toBeGreaterThanOrEqual(0);
      expect(VOICE_TIMBRE[v]).toBeLessThanOrEqual(1);
    }
  });
  it('blendVoiceRgb averages the two voices channelwise', () => {
    const [r, g, b] = blendVoiceRgb('peach', 'aqua');
    expect(r).toBe(Math.round((VOICE_RGB.peach[0] + VOICE_RGB.aqua[0]) / 2));
    expect(g).toBe(Math.round((VOICE_RGB.peach[1] + VOICE_RGB.aqua[1]) / 2));
    expect(b).toBe(Math.round((VOICE_RGB.peach[2] + VOICE_RGB.aqua[2]) / 2));
  });
});
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Append to `src/engine/palette.ts`**

```ts
// brightness scalar per voice (warm/low -> cool/bright); drives the ripple blend
export const VOICE_TIMBRE: Record<VoiceType, number> = {
  peach: 0.35, gold: 0.5, rose: 0.45, lilac: 0.6, aqua: 0.7, sky: 0.8,
};

export function blendVoiceRgb(a: VoiceType, b: VoiceType): [number, number, number] {
  const ra = VOICE_RGB[a], rb = VOICE_RGB[b];
  return [
    Math.round((ra[0] + rb[0]) / 2),
    Math.round((ra[1] + rb[1]) / 2),
    Math.round((ra[2] + rb[2]) / 2),
  ];
}
```

- [ ] **Step 4: Run tests — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/engine/palette.ts src/engine/palette.test.ts
git commit -m "feat(engine): per-voice timbre + rgb blend helpers"
```

---

## Task 4: Simulation ripple integration

Emission, aging/cull, intersection → `ring-cross` events (deduped), transient overlap points, config, and toggle-clearing. Pure + seeded.

**Files:**
- Modify: `src/engine/Particle.ts` (add `rippleTimer`)
- Modify: `src/engine/Particle.test.ts`, `src/engine/Renderer.test.ts` (add `rippleTimer` to particle factories)
- Modify: `src/engine/Simulation.ts`
- Modify: `src/engine/Simulation.test.ts`

- [ ] **Step 1: Add `rippleTimer` to the Particle model — `src/engine/Particle.ts`**

Add the field to the interface (after `bounceCooldown`):

```ts
  bounceCooldown: number; // seconds until it may emit another bounce event
  rippleTimer: number;    // seconds until it emits its next ripple ring
```

- [ ] **Step 2: Update particle factories so the suite still compiles**

In `src/engine/Particle.test.ts` `make()` default object, add `rippleTimer: 0,`.
In `src/engine/Renderer.test.ts` `p()` default object, add `rippleTimer: 0,`.

- [ ] **Step 3: Write the failing Simulation tests — append to `src/engine/Simulation.test.ts`**

First extend the `cfg()` helper (the new `SimConfig` fields are required) — replace the existing helper with:

```ts
const cfg = (over: Partial<SimConfig> = {}): SimConfig => ({
  width: 800, height: 600, maxParticles: 50,
  sporeIntervalSec: 5, speedMul: 1, sporesEnabled: false,
  rippleEnabled: false, rippleEmitIntervalSec: 5, ringLifespanSec: 3, ringMaxRadius: 200, maxRings: 28,
  ...over,
});
```

Then add a `describe` block (uses `RippleRing` — import it):

```ts
import type { RippleRing } from './ripple';

describe('Simulation ripples', () => {
  const crossingRing = (over: Partial<RippleRing>): RippleRing =>
    ({ id: 1, x: 0, y: 0, size: 20, voice: 'peach', age: 0, ...over });

  it('emits a ring after the emit interval when enabled', () => {
    const s = new Simulation(cfg({ rippleEnabled: true, rippleEmitIntervalSec: 1 }), mulberry32(1));
    s.spawn(400, 300, 0, 0);
    for (let i = 0; i < 20; i++) s.step(0.1); // 2s elapsed > max first interval (1.3s)
    expect(s.ripples.length).toBeGreaterThan(0);
  });

  it('never exceeds maxRings active rings', () => {
    const s = new Simulation(cfg({ rippleEnabled: true, rippleEmitIntervalSec: 0.1, ringLifespanSec: 1000, maxRings: 5 }), mulberry32(2));
    for (let i = 0; i < 20; i++) s.spawn(100 + i, 100, 0, 0);
    for (let i = 0; i < 100; i++) s.step(0.1);
    expect(s.ripples.length).toBeLessThanOrEqual(5);
  });

  it('emits exactly one ring-cross for a crossing pair, then dedupes', () => {
    const s = new Simulation(cfg({ rippleEnabled: true, rippleEmitIntervalSec: 1000, ringLifespanSec: 10, ringMaxRadius: 100 }), mulberry32(3));
    // radius = 100*(age/10) = 10*age; centers 150 apart, equal radii cross once 2r>=150 (age>=7.5)
    s.ripples.push(crossingRing({ id: 1, x: 100, y: 300, age: 8, voice: 'peach' }));
    s.ripples.push(crossingRing({ id: 2, x: 250, y: 300, age: 8, voice: 'aqua' }));
    const first = s.step(0.001).filter(e => e.type === 'ring-cross');
    const second = s.step(0.001).filter(e => e.type === 'ring-cross');
    expect(first.length).toBe(1);
    expect(first[0]).toMatchObject({ type: 'ring-cross', voiceA: 'peach', voiceB: 'aqua' });
    expect(second.length).toBe(0);
    expect(s.rippleOverlaps.length).toBeGreaterThan(0);
  });

  it('produces no ring-cross for well-separated rings', () => {
    const s = new Simulation(cfg({ rippleEnabled: true, rippleEmitIntervalSec: 1000, ringLifespanSec: 10, ringMaxRadius: 20 }), mulberry32(4));
    s.ripples.push(crossingRing({ id: 1, x: 50, y: 50, age: 5 }));
    s.ripples.push(crossingRing({ id: 2, x: 700, y: 550, age: 5 }));
    expect(s.step(0.001).filter(e => e.type === 'ring-cross').length).toBe(0);
  });

  it('removes a ring after its lifespan', () => {
    const s = new Simulation(cfg({ rippleEnabled: true, rippleEmitIntervalSec: 1000, ringLifespanSec: 1 }), mulberry32(5));
    s.ripples.push(crossingRing({ id: 1, x: 100, y: 100, age: 0 }));
    s.step(2);
    expect(s.ripples.length).toBe(0);
  });

  it('emits nothing when ripple is disabled', () => {
    const s = new Simulation(cfg({ rippleEnabled: false, rippleEmitIntervalSec: 0.1 }), mulberry32(6));
    s.spawn(400, 300, 0, 0);
    for (let i = 0; i < 50; i++) s.step(0.1);
    expect(s.ripples.length).toBe(0);
  });
});
```

- [ ] **Step 4: Run it — expect FAIL** (`s.ripples` undefined / config fields missing).

- [ ] **Step 5: Implement the Simulation changes — `src/engine/Simulation.ts`**

Add imports:

```ts
import { ringRadius, circleIntersection, type RippleRing, type RippleOverlap } from './ripple';
```

Extend `SimConfig` with:

```ts
  rippleEnabled: boolean;
  rippleEmitIntervalSec: number;
  ringLifespanSec: number;
  ringMaxRadius: number;
  maxRings: number;
```

Add public state + private fields to the class:

```ts
  ripples: RippleRing[] = [];
  rippleOverlaps: RippleOverlap[] = [];
  private nextRingId = 1;
  private firedPairs = new Set<string>();
```

In `spawn()`, initialise the timer on the new particle (add to the object literal, jittered like spores):

```ts
      bounceCooldown: 0,
      rippleTimer: this.cfg.rippleEmitIntervalSec * randRange(this.rng, 0.7, 1.3),
```

In `step(dt)`, just before `return events;`, add:

```ts
    if (this.cfg.rippleEnabled) this.stepRipples(dt, events);
    else if (this.ripples.length) this.clearRipples();
```

Add the three private methods:

```ts
  private stepRipples(dt: number, events: MusicalEvent[]) {
    const { rippleEmitIntervalSec, ringLifespanSec, ringMaxRadius, maxRings } = this.cfg;

    for (const p of this.particles) {
      p.rippleTimer -= dt;
      if (p.rippleTimer <= 0) {
        p.rippleTimer = rippleEmitIntervalSec * randRange(this.rng, 0.7, 1.3);
        if (this.ripples.length < maxRings) {
          this.ripples.push({ id: this.nextRingId++, x: p.pos.x, y: p.pos.y, size: p.size, voice: p.voice, age: 0 });
        }
      }
    }

    const alive: RippleRing[] = [];
    for (const ring of this.ripples) {
      ring.age += dt;
      if (ring.age >= ringLifespanSec) this.dropPairsFor(ring.id);
      else alive.push(ring);
    }
    this.ripples = alive;

    this.rippleOverlaps = [];
    for (let i = 0; i < this.ripples.length; i++) {
      for (let j = i + 1; j < this.ripples.length; j++) {
        const a = this.ripples[i], b = this.ripples[j];
        const ra = ringRadius(a, ringLifespanSec, ringMaxRadius);
        const rb = ringRadius(b, ringLifespanSec, ringMaxRadius);
        const hit = circleIntersection(a.x, a.y, ra, b.x, b.y, rb);
        if (!hit) continue;
        this.rippleOverlaps.push({ x: hit.p0.x, y: hit.p0.y, voiceA: a.voice, voiceB: b.voice });
        this.rippleOverlaps.push({ x: hit.p1.x, y: hit.p1.y, voiceA: a.voice, voiceB: b.voice });
        const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
        if (!this.firedPairs.has(key)) {
          this.firedPairs.add(key);
          events.push({
            type: 'ring-cross',
            x: hit.mid.x, y: hit.mid.y,
            size: (a.size + b.size) * 0.5, speed: 0,
            voiceA: a.voice, voiceB: b.voice,
          });
        }
      }
    }
  }

  private dropPairsFor(id: number) {
    for (const key of this.firedPairs) {
      if (key.startsWith(`${id}:`) || key.endsWith(`:${id}`)) this.firedPairs.delete(key);
    }
  }

  private clearRipples() {
    this.ripples = [];
    this.rippleOverlaps = [];
    this.firedPairs.clear();
  }
```

- [ ] **Step 6: Run the full suite — expect PASS** (`pnpm test`). Confirm existing Simulation/Particle/Renderer tests still pass with the new `rippleTimer` field.

- [ ] **Step 7: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/engine/Particle.ts src/engine/Particle.test.ts src/engine/Renderer.test.ts src/engine/Simulation.ts src/engine/Simulation.test.ts
git commit -m "feat(engine): simulate ripple rings, intersections, ring-cross events"
```

---

## Task 5: AudioEngine ripple voice

A dedicated ripple synth into its own bus + tone filter, blended timbre, scale-locked pitch, quantize + rate-limit.

**Files:**
- Modify: `src/engine/AudioEngine.ts`
- Modify: `src/engine/AudioEngine.test.ts`

- [ ] **Step 1: Add the failing smoke tests — `src/engine/AudioEngine.test.ts`**

In the `vi.mock('tone', ...)` factory, give `Filter` a ramped `frequency` so the ripple tone-filter ramp is callable (replace the `Filter` line):

```ts
  class Filter { frequency = ramp(); connect = vi.fn(); dispose = vi.fn(); }
```

Add tests inside the `describe('AudioEngine', ...)` block:

```ts
  it('handles a ring-cross without throwing (after init)', async () => {
    const a = new AudioEngine(); await a.init(); a.setHeight(600);
    expect(() => a.handle([{ type: 'ring-cross', x: 100, y: 200, size: 30, speed: 0, voiceA: 'peach', voiceB: 'aqua' }])).not.toThrow();
  });

  it('rate-limits ripple notes within the min interval (now() frozen at 0)', async () => {
    const a = new AudioEngine(); await a.init(); a.setHeight(600);
    const rc = { type: 'ring-cross', x: 0, y: 0, size: 30, speed: 0, voiceA: 'peach', voiceB: 'aqua' } as const;
    a.handle([rc]); a.handle([rc]);
    const ripple = (a as unknown as { ripple: { triggerAttackRelease: ReturnType<typeof vi.fn> } }).ripple;
    expect(ripple.triggerAttackRelease).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run it — expect FAIL** (`handle` ignores `ring-cross`; `a.ripple` undefined).

- [ ] **Step 3: Implement the AudioEngine changes — `src/engine/AudioEngine.ts`**

Add to the `types` import: `RingCrossEvent`. Add to the palette import (new import line):

```ts
import { VOICE_TIMBRE } from './palette';
```

Add fields:

```ts
  private lastRippleAt = -1;
  private readonly rippleMinInterval = 0.08;
  private ripple!: Tone.PolySynth;
  private rippleBus!: Tone.Gain;
  private rippleTone!: Tone.Filter;
```

In `init()`, after the pluck is created and connected, add the ripple chain (before `this.ready = true;`):

```ts
    this.rippleBus = new Tone.Gain(0.5);
    this.rippleTone = new Tone.Filter({ type: 'lowpass', frequency: 1400, Q: 0.8 });
    this.ripple = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3, modulationIndex: 6,
      envelope: { attack: 0.008, decay: 1.4, sustain: 0, release: 1.8 },
      volume: -15,
    });
    this.ripple.connect(this.rippleTone);
    this.rippleTone.connect(this.rippleBus);
    this.rippleBus.connect(this.chorus);
```

In `handle()`'s `switch`, add a case:

```ts
        case 'ring-cross': this.tryRipple(e, now); break;
```

Add the handler method:

```ts
  private tryRipple(e: RingCrossEvent, now: number) {
    if (now - this.lastRippleAt < this.rippleMinInterval) return;
    this.lastRippleAt = now;
    const brightness = (VOICE_TIMBRE[e.voiceA] + VOICE_TIMBRE[e.voiceB]) * 0.5;
    this.rippleTone.frequency.rampTo(600 + brightness * 3200, 0.05);
    const time = this.transport.nextSubdivision('4n');
    this.ripple.triggerAttackRelease(this.freq(this.midiFor(e)), '4n', time);
  }
```

In `dispose()`, add `this.rippleBus, this.rippleTone, this.ripple` to the array of nodes disposed.

- [ ] **Step 4: Run tests — expect PASS** (`pnpm test`).

- [ ] **Step 5: Typecheck** — `pnpm exec tsc --noEmit` → no errors.

- [ ] **Step 6: Commit**

```bash
git add src/engine/AudioEngine.ts src/engine/AudioEngine.test.ts
git commit -m "feat(engine): ripple synth with voice-blended timbre"
```

---

## Task 6: Renderer — ripple rings, sweeping nodes, trigger flashes

Draw simulation-owned rings + overlap nodes + note flashes. Rename the existing decorative `rings` to `bloomRings` for clarity. Append optional params so existing callers/tests are unaffected.

**Files:**
- Modify: `src/engine/Renderer.ts`
- Modify: `src/engine/Renderer.test.ts`

- [ ] **Step 1: Add the failing test — `src/engine/Renderer.test.ts`**

Add imports at the top:

```ts
import type { RippleRing, RippleOverlap } from './ripple';
```

Add a test:

```ts
  it('draws ripple rings and sweeping overlap nodes when provided', () => {
    const { ctx, canvas } = fakeCanvas();
    const r = new Renderer(canvas, false);
    r.setRippleParams(3, 100);
    const ripples: RippleRing[] = [{ id: 1, x: 10, y: 10, size: 20, voice: 'peach', age: 1 }];
    const overlaps: RippleOverlap[] = [{ x: 5, y: 5, voiceA: 'peach', voiceB: 'aqua' }];
    r.draw([], 800, 600, 0, ripples, overlaps);
    expect(ctx.arc).toHaveBeenCalled(); // ring outline + node
  });
```

- [ ] **Step 2: Run it — expect FAIL** (`setRippleParams` / extra draw args don't exist).

- [ ] **Step 3: Implement the Renderer changes — `src/engine/Renderer.ts`**

Update imports:

```ts
import { lifePhase, type Particle } from './Particle';
import { VOICE_RGB, blendVoiceRgb } from './palette';
import { ringRadius, type RippleRing, type RippleOverlap } from './ripple';
```

Rename the bloom-ring field and add ripple state + params:

```ts
  private bloomRings: { x: number; y: number; age: number }[] = [];
  private rippleFlashes: { x: number; y: number; r: number; g: number; b: number; age: number }[] = [];
  private ringLifespan = 3;
  private ringMaxRadius = 200;
```

Update `addRing` to push to `bloomRings` (body unchanged otherwise). Add two methods:

```ts
  setRippleParams(lifespan: number, maxRadius: number) {
    this.ringLifespan = lifespan;
    this.ringMaxRadius = maxRadius;
  }

  addRippleFlash(x: number, y: number, voiceA: VoiceType, voiceB: VoiceType) {
    if (this.reducedMotion) return;
    const [r, g, b] = blendVoiceRgb(voiceA, voiceB);
    this.rippleFlashes.push({ x, y, r, g, b, age: 0 });
  }
```

(Add `import type { VoiceType } from './types';` — group with the other type import.)

Change the `draw` signature to append optional ripple inputs:

```ts
  draw(
    particles: Particle[], width: number, height: number, tint: number,
    ripples: RippleRing[] = [], overlaps: RippleOverlap[] = [],
  ) {
```

In the body, rename the existing bloom-ring loop variable from `this.rings` to `this.bloomRings`. Then, inside the `globalCompositeOperation = 'lighter'` section (after the particle glow loop, before/after the bloom-ring loop), add three loops:

```ts
    // ripple rings (expanding outlines, colored by emitter voice)
    for (const ring of ripples) {
      const [r, g, b] = VOICE_RGB[ring.voice];
      const t = Math.min(1, ring.age / this.ringLifespan);
      const radius = ringRadius(ring, this.ringLifespan, this.ringMaxRadius);
      const alpha = (1 - t) * (this.reducedMotion ? 0.12 : 0.3);
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // sweeping crossing nodes (continuous, while rings overlap)
    for (const o of overlaps) {
      const [r, g, b] = blendVoiceRgb(o.voiceA, o.voiceB);
      const nodeR = this.reducedMotion ? 2 : 4;
      const grad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, nodeR * 2);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${this.reducedMotion ? 0.4 : 0.8})`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(o.x, o.y, nodeR * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // note-trigger flashes (one bright bloom per fired crossing)
    for (let i = this.rippleFlashes.length - 1; i >= 0; i--) {
      const f = this.rippleFlashes[i];
      f.age += 1 / 60;
      const t = f.age / 0.4;
      if (t >= 1) { this.rippleFlashes.splice(i, 1); continue; }
      const radius = 6 + t * 26;
      const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, radius);
      grad.addColorStop(0, `rgba(${f.r}, ${f.g}, ${f.b}, ${(1 - t) * 0.85})`);
      grad.addColorStop(1, `rgba(${f.r}, ${f.g}, ${f.b}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(f.x, f.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
```

> Keep the existing bloom-ring loop (now `this.bloomRings`) exactly as-is — it is the separate "wink at Ripple" one-shot.

- [ ] **Step 4: Run tests — expect PASS** (`pnpm test`). The original Renderer test (4-arg `draw`) still passes via the optional params.

- [ ] **Step 5: Typecheck** — `pnpm exec tsc --noEmit` → no errors.

- [ ] **Step 6: Commit**

```bash
git add src/engine/Renderer.ts src/engine/Renderer.test.ts
git commit -m "feat(engine): render ripple rings, sweeping nodes, trigger flashes"
```

---

## Task 7: MoteApp wiring

Config defaults, `setRipple`, flash wiring from events, resize-aware max radius, and the new draw call.

**Files:**
- Modify: `src/engine/MoteApp.ts`

- [ ] **Step 1: Add ripple config + renderer params in the constructor**

Compute the max radius and extend the `SimConfig` literal:

```ts
    const ringMaxRadius = 0.35 * Math.min(this.width, this.height);
    const cfg: SimConfig = {
      width: this.width, height: this.height,
      maxParticles: 160, sporeIntervalSec: 6, speedMul: 1, sporesEnabled: true,
      rippleEnabled: false, rippleEmitIntervalSec: 5.5, ringLifespanSec: 3, ringMaxRadius, maxRings: 28,
    };
```

After `this.renderer = new Renderer(...)` and resize, add:

```ts
    this.renderer.setRippleParams(3, ringMaxRadius);
```

- [ ] **Step 2: Wire flashes + the new draw call in `loop`**

Replace the fixed-step body and draw call:

```ts
    while (this.acc >= this.STEP) {
      const events = this.sim.step(this.STEP);
      this.audio.handle(events);
      for (const e of events) if (e.type === 'ring-cross') this.renderer.addRippleFlash(e.x, e.y, e.voiceA, e.voiceB);
      this.acc -= this.STEP;
    }
    this.renderer.draw(this.sim.particles, this.width, this.height, this.dayTint(), this.sim.ripples, this.sim.rippleOverlaps);
```

- [ ] **Step 3: Add `setRipple` and update `resize`**

```ts
  setRipple(on: boolean) { this.sim.setConfig({ rippleEnabled: on }); }
```

In `resize()`, after computing width/height, recompute and propagate the max radius:

```ts
    const ringMaxRadius = 0.35 * Math.min(this.width, this.height);
    this.sim.setConfig({ width: this.width, height: this.height, ringMaxRadius });
    this.audio.setHeight(this.height);
    this.renderer.setRippleParams(3, ringMaxRadius);
    this.renderer.resize(this.width, this.height, window.devicePixelRatio || 1);
```

- [ ] **Step 4: Typecheck** — `pnpm exec tsc --noEmit` → no errors.

- [ ] **Step 5: Tests still green** — `pnpm test`.

- [ ] **Step 6: Commit**

```bash
git add src/engine/MoteApp.ts
git commit -m "feat(engine): wire ripple config, flashes, and draw into MoteApp"
```

---

## Task 8: UI — setting, persistence, and toggle

**Files:**
- Modify: `src/ui/storage.ts`, `src/ui/useMoteApp.ts`, `src/ui/ControlStrip.tsx`

- [ ] **Step 1: Add the `ripple` setting — `src/ui/storage.ts`**

Add `ripple: boolean;` to the `Settings` interface and `ripple: false,` to `DEFAULTS`. (Old persisted blobs without the key fall back via the existing `{ ...DEFAULTS, ...JSON.parse(raw) }` merge.)

- [ ] **Step 2: Push + persist — `src/ui/useMoteApp.ts`**

In the settings effect, add `app.setRipple(settings.ripple);` alongside the other setters. In `unlock()`, add `appRef.current.setRipple(settings.ripple);` alongside the others.

- [ ] **Step 3: Add the toggle — `src/ui/ControlStrip.tsx`**

Next to the spores toggle button, add a ripple toggle (concentric-rings icon), following the existing button styling:

```tsx
          <button onClick={() => onChange({ ripple: !settings.ripple })} aria-pressed={settings.ripple}
            aria-label={settings.ripple ? 'disable ripple mode' : 'enable ripple mode'}
            className={`flex h-8 w-8 items-center justify-center rounded-full border text-[#b9b2cf] hover:text-[#f3eefe] ${
              settings.ripple ? 'border-[#cdbcff]/60 text-[#f3eefe]' : 'border-white/15'}`}>
            <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1">
              <circle cx="7" cy="7" r="2" /><circle cx="7" cy="7" r="4" /><circle cx="7" cy="7" r="6" />
            </svg>
          </button>
```

Place it just before the spores `<button>` inside the right-hand control group.

- [ ] **Step 4: Typecheck** — `pnpm exec tsc --noEmit` → no errors.

- [ ] **Step 5: Commit**

```bash
git add src/ui/storage.ts src/ui/useMoteApp.ts src/ui/ControlStrip.tsx
git commit -m "feat(ui): ripple mode toggle, persistence, plumbing"
```

---

## Task 9: Browser verification, performance, reduced motion

**Files:** none (verification; small fixes if needed)

- [ ] **Step 1: Run the app** — `pnpm dev`, open the local URL.

- [ ] **Step 2: Core ripple behavior** — toggle **ripple** on. Confirm:
  - Soft rings expand from motes and fade; centers stay put as motes drift.
  - When two rings cross, a single bell note sounds **in key**, with a bright flash at the touch point.
  - As rings grow, two glowing nodes sweep apart along the outlines (continuous highlight).
  - Ripple layers over pads/plucks/both (try each mode); turning ripple off silences and clears rings.

- [ ] **Step 3: Scale-lock + blend** — switch moods; confirm ripple notes stay consonant (no wrong notes). Confirm crossings between different-colored motes look/sound blended (averaged node color).

- [ ] **Step 4: Performance at the cap** — mash clicks/keys to ~160 motes with ripple on; confirm smooth frame rate and that the global ring budget keeps rings/notes calm (no flood). Check the console: **no errors/warnings** (especially Tone audio-context).

- [ ] **Step 5: Reduced motion** — emulate `prefers-reduced-motion: reduce`; confirm rings/nodes are dim and flashes suppressed, but ripple **audio still works**.

- [ ] **Step 6: Commit** any tuning fixes (`maxRings`, intervals, levels, alphas) made for feel/perf.

```bash
git add -A
git commit -m "chore: tune ripple feel and performance"
```

---

## Task 10: Final verification + finish the branch

**Files:** none

- [ ] **Step 1: Full gate** — run:

```bash
pnpm exec tsc --noEmit && pnpm test && pnpm build
```
Expected: no type errors; all suites pass; `dist/` builds clean.

- [ ] **Step 2: Spec cross-check** — re-read the spec (§3 behavior, §9 testing) and confirm each acceptance point is met; note any gaps.

- [ ] **Step 3: Finish the branch** — use @superpowers:finishing-a-development-branch to open the PR (base: the finished-build branch, since `main` has no engine — confirm the base with the user). PR body should summarize the feature, the new `ring-cross` seam, and the verification done.

---

## Notes for the implementer

- **Tune by ear/eye** (spec §10): `rippleEmitIntervalSec` (5.5 ± jitter), `ringLifespanSec` (3), `ringMaxRadius` factor (0.35), `maxRings` (28), `rippleMinInterval` (0.08), the `4n` quantize, the ripple bus/synth `volume`, and the brightness→cutoff map (`600 + brightness*3200`) are all starting points.
- **Determinism:** ripple emission/jitter draw from the injected RNG, so seeded simulations are reproducible; the live app seeds from the clock.
- **Do NOT** alter pads/plucks/both, the existing bloom rings (`bloomRings`), or the double-click/type-"mote" eggs. Ripple is strictly additive.
- **The seam:** the only cross-module contract added is the `ring-cross` event. If something feels like it needs a second new event type or a Simulation→Renderer back-channel, re-check the design before adding it.
