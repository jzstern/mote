# Mote Ambient Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Mote — a 100%-client-side generative ambient music toy where glowing particles on a dark canvas drift, bounce, and age, sounding soft in-key pads and plucks that evolve forever.

**Architecture:** A framework-agnostic TypeScript engine (`Particle` → `Simulation` → `MusicalEvent`s → `AudioEngine`/`Renderer`, composed by `MoteApp` running its own `requestAnimationFrame` loop) with a thin React + Tailwind UI that only drives it through a small imperative API. All pitch selection is constrained to one scale so there are no wrong notes.

**Tech Stack:** Vite, React, TypeScript (strict), Tailwind CSS v4, Tone.js (audio), HTML Canvas 2D (rendering), Vitest (tests). Package manager: pnpm.

---

## Conventions for every task

- **Branch/worktree:** all work happens in a dedicated worktree on a `feat/*` branch (a repo hook blocks commits to `main`). Never commit to `main`.
- **Every commit message ends with this footer** (per project convention), so it is omitted from the short messages below:
  ```
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  ```
- **TDD where it pays:** the pure engine modules (`rng`, `scale`, `Particle`, `Simulation`) are unit-tested with Vitest and a seeded RNG. `AudioEngine`, `Renderer`, and React components are verified by construction smoke tests + manual checks (they are side-effecty; do not over-mock).
- **Reference skill:** @superpowers:test-driven-development for the red/green/commit rhythm.
- Run tests with `pnpm test` (Vitest, `--run` for one-shot). Run the app with `pnpm dev`.

## File structure (created across tasks)

```
mote/
  package.json, vite.config.ts, tsconfig.json, tsconfig.node.json, index.html
  src/
    main.tsx                 # React entry
    App.tsx                  # layout, audio-unlock gate, persistence wiring
    index.css                # Tailwind import + global rules (cursor, reduced-motion)
    engine/
      types.ts               # Vec2, Mode, Mood, VoiceType, MusicalEvent, KnobValues
      rng.ts                 # seeded RNG (mulberry32) + helpers — PURE, tested
      palette.ts             # VOICES + VOICE_RGB
      scale.ts               # scales/moods + pitchFor() — PURE, tested
      Particle.ts            # Particle type + helpers — PURE, tested
      Simulation.ts          # step(dt) -> MusicalEvent[]; physics/aging/spores — PURE, tested
      AudioEngine.ts         # Tone.js graph; handle(events); knob setters
      Renderer.ts            # Canvas2D draw(particles)
      MoteApp.ts             # composition root + rAF loop + imperative API
    ui/
      storage.ts             # localStorage load/save of settings
      useMoteApp.ts          # React hook owning a MoteApp instance
      Canvas.tsx             # canvas host; input forwarding; resize; audio unlock
      Knob.tsx               # custom circular drag knob
      Segmented.tsx          # segmented control (mode + mood)
      ControlStrip.tsx       # bottom control strip
  docs/superpowers/specs/2026-06-15-mote-ambient-generator-design.md  (exists)
  docs/superpowers/plans/2026-06-15-mote-ambient-generator.md         (this file)
```

Design reference: [`../specs/2026-06-15-mote-ambient-generator-design.md`](../specs/2026-06-15-mote-ambient-generator-design.md).

---

## Task 0: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`

- [ ] **Step 1: Scaffold Vite React+TS app into the existing repo**

Run (from repo root, which already contains `docs/` and `.git`):
```bash
pnpm create vite@latest . --template react-ts
# If prompted about a non-empty directory, choose "Ignore files and continue".
pnpm install
pnpm add tone
pnpm add -D vitest @tailwindcss/vite
```

- [ ] **Step 2: Configure Tailwind v4 + Vitest in `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
```
Add a `"test": "vitest run"` and `"test:watch": "vitest"` script to `package.json`.

- [ ] **Step 3: Global CSS — `src/index.css`**

```css
@import "tailwindcss";

:root { color-scheme: dark; }
html, body, #root { height: 100%; margin: 0; }
body { background: #0c0a12; overflow: hidden; }

button:not(:disabled),
[role="button"]:not([aria-disabled="true"]),
label[for],
summary { cursor: pointer; }

@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
}
```

- [ ] **Step 4: Minimal `src/App.tsx` placeholder + `src/main.tsx`**

`App.tsx` returns a full-screen `<div className="h-full w-full" />` for now. Keep `main.tsx` as the Vite default (renders `<App/>`).

- [ ] **Step 5: Verify dev server and test runner boot**

Run: `pnpm dev` → expect Vite to serve on localhost with no errors (Ctrl-C to stop).
Run: `pnpm test` → expect Vitest to run with "no test files found" (exit 0) — confirms config is valid.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: scaffold Vite + React + TS + Tailwind + Vitest"
```

---

## Task 1: Seeded RNG (`rng.ts`)

**Files:**
- Create: `src/engine/rng.ts`, `src/engine/types.ts`
- Test: `src/engine/rng.test.ts`

- [ ] **Step 1: Write `src/engine/types.ts`**

```ts
export type Vec2 = { x: number; y: number };
export type VoiceType = 'peach' | 'gold' | 'rose' | 'lilac' | 'aqua' | 'sky';
export type Mode = 'pads' | 'plucks' | 'both';
export type Mood = 'warm' | 'dream' | 'dusk' | 'mist';
export type MusicalEventType = 'born' | 'bounce' | 'death' | 'bloom';

export interface MusicalEvent {
  type: MusicalEventType;
  particleId: number;
  x: number; y: number;
  size: number; speed: number;
  voice: VoiceType;
}

export interface KnobValues { space: number; echo: number; tone: number; drift: number; speed: number; }
```

- [ ] **Step 2: Write the failing test — `src/engine/rng.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { mulberry32, randRange } from './rng';

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42); const b = mulberry32(42);
    const seqA = [a(), a(), a()]; const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });
  it('returns values in [0, 1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
  it('different seeds diverge', () => {
    expect(mulberry32(1)()).not.toEqual(mulberry32(2)());
  });
  it('randRange stays within bounds', () => {
    const r = mulberry32(99);
    for (let i = 0; i < 1000; i++) { const v = randRange(r, 5, 9); expect(v).toBeGreaterThanOrEqual(5); expect(v).toBeLessThan(9); }
  });
});
```

- [ ] **Step 3: Run it — expect FAIL** (`pnpm test` → cannot import `./rng`).

- [ ] **Step 4: Implement `src/engine/rng.ts`**

```ts
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng();
}
export function randInt(rng: Rng, min: number, maxInclusive: number): number {
  return Math.floor(randRange(rng, min, maxInclusive + 1));
}
export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
```

- [ ] **Step 5: Run tests — expect PASS.**
- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(engine): seeded RNG and shared types"
```

---

## Task 2: Scale & pitch mapping (`scale.ts`)

This module is the "no wrong notes" guarantee. Pitches are MIDI note numbers.

**Files:**
- Create: `src/engine/scale.ts`
- Test: `src/engine/scale.test.ts`

- [ ] **Step 1: Write the failing test — `src/engine/scale.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { pitchFor, scaleNotes, ROOT_MIDI, OCTAVE_SPAN } from './scale';
import type { Mood } from './types';

const MOODS: Mood[] = ['warm', 'dream', 'dusk', 'mist'];
const H = 600;
const pc = (midi: number) => (((midi - ROOT_MIDI) % 12) + 12) % 12;

describe('pitchFor', () => {
  it('only ever returns pitches whose pitch-class is in the active scale', () => {
    for (const mood of MOODS) {
      const allowed = new Set(scaleNotes(mood));
      for (let y = 0; y <= H; y += 10) {
        for (const size of [16, 40, 64]) {
          const midi = pitchFor(mood, { y, height: H, size, speed: 0 });
          expect(allowed.has(pc(midi))).toBe(true);
        }
      }
    }
  });
  it('maps higher-on-screen (smaller y) to >= pitch (monotonic), size fixed', () => {
    let prev = -Infinity;
    for (let y = H; y >= 0; y -= 5) {
      const midi = pitchFor('warm', { y, height: H, size: 40, speed: 0 });
      expect(midi).toBeGreaterThanOrEqual(prev);
      prev = midi;
    }
  });
  it('stays within the mapped octave range', () => {
    for (let y = 0; y <= H; y += 5) {
      const midi = pitchFor('dream', { y, height: H, size: 40, speed: 0 });
      expect(midi).toBeGreaterThanOrEqual(ROOT_MIDI);
      expect(midi).toBeLessThanOrEqual(ROOT_MIDI + OCTAVE_SPAN * 12);
    }
  });
  it('different moods can produce different pitch sets', () => {
    expect(scaleNotes('warm')).not.toEqual(scaleNotes('dusk'));
  });
});
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement `src/engine/scale.ts`**

```ts
import type { Mood } from './types';

export const ROOT_MIDI = 57;   // A3 — warm low root; tune by ear later
export const OCTAVE_SPAN = 3;  // octaves mapped across the vertical axis

const SCALES: Record<Mood, number[]> = {
  warm:  [0, 2, 4, 7, 9],          // major pentatonic
  dream: [0, 2, 4, 6, 7, 9, 11],   // lydian
  dusk:  [0, 3, 5, 7, 10],         // minor pentatonic
  mist:  [0, 1, 5, 7, 8],          // in-sen / hirajoshi flavour
};

export interface PitchInput { y: number; height: number; size: number; speed: number; }

export function scaleNotes(mood: Mood): number[] { return SCALES[mood]; }

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function pitchFor(mood: Mood, input: PitchInput): number {
  const offsets = SCALES[mood];
  const degrees = offsets.length * OCTAVE_SPAN;
  const vertical = clamp01(1 - input.y / input.height);          // top => 1 => high
  const sizeBias = clamp01(input.size / 120);                    // bigger => lower
  const pos = clamp01(vertical * 0.85 + (1 - sizeBias) * 0.15);
  const degreeIndex = Math.round(pos * (degrees - 1));
  const octave = Math.floor(degreeIndex / offsets.length);
  const within = degreeIndex % offsets.length;
  return ROOT_MIDI + octave * 12 + offsets[within];
}
```

> Note: the monotonic test holds size constant; the small size term only shifts the curve, it never inverts it.

- [ ] **Step 4: Run tests — expect PASS.**
- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(engine): scale + pitch mapping (no wrong notes)"
```

---

## Task 3: Particle + palette (`Particle.ts`, `palette.ts`)

**Files:**
- Create: `src/engine/palette.ts`, `src/engine/Particle.ts`
- Test: `src/engine/Particle.test.ts`

- [ ] **Step 1: Write `src/engine/palette.ts`**

```ts
import type { VoiceType } from './types';

export const VOICES: readonly VoiceType[] = ['peach', 'gold', 'rose', 'lilac', 'aqua', 'sky'];

export const VOICE_RGB: Record<VoiceType, [number, number, number]> = {
  peach: [255, 183, 138],
  gold:  [255, 214, 140],
  rose:  [255, 150, 170],
  lilac: [190, 170, 255],
  aqua:  [150, 225, 220],
  sky:   [150, 190, 255],
};
```

- [ ] **Step 2: Write the failing test — `src/engine/Particle.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { speedOf, lifePhase, type Particle } from './Particle';

const make = (over: Partial<Particle> = {}): Particle => ({
  id: 1, pos: { x: 0, y: 0 }, vel: { x: 3, y: 4 }, size: 30,
  age: 0, lifespan: 20, voice: 'peach', bounceCooldown: 0, ...over,
});

describe('Particle helpers', () => {
  it('speedOf returns vector magnitude', () => {
    expect(speedOf(make())).toBeCloseTo(5);
  });
  it('lifePhase goes 0 -> 1 and clamps', () => {
    expect(lifePhase(make({ age: 0 }))).toBe(0);
    expect(lifePhase(make({ age: 10, lifespan: 20 }))).toBeCloseTo(0.5);
    expect(lifePhase(make({ age: 99, lifespan: 20 }))).toBe(1);
  });
});
```

- [ ] **Step 3: Run it — expect FAIL.**

- [ ] **Step 4: Implement `src/engine/Particle.ts`**

```ts
import type { Vec2, VoiceType } from './types';

export interface Particle {
  id: number;
  pos: Vec2;
  vel: Vec2;          // px / second
  size: number;       // diameter
  age: number;        // seconds
  lifespan: number;   // seconds
  voice: VoiceType;
  bounceCooldown: number; // seconds until it may emit another bounce event
}

export function speedOf(p: Particle): number { return Math.hypot(p.vel.x, p.vel.y); }
export function lifePhase(p: Particle): number { return Math.min(1, p.age / p.lifespan); }
```

- [ ] **Step 5: Run tests — expect PASS.**
- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(engine): particle model and voice palette"
```

---

## Task 4: Simulation (`Simulation.ts`)

The heart of the toy: motion, wall + particle collisions, aging/death, spores, event emission. Pure and deterministic given an injected RNG.

**Files:**
- Create: `src/engine/Simulation.ts`
- Test: `src/engine/Simulation.test.ts`

- [ ] **Step 1: Write the failing tests — `src/engine/Simulation.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { Simulation, type SimConfig } from './Simulation';
import { mulberry32 } from './rng';

const cfg = (over: Partial<SimConfig> = {}): SimConfig => ({
  width: 800, height: 600, maxParticles: 50,
  sporeIntervalSec: 5, speedMul: 1, sporesEnabled: false, ...over,
});

describe('Simulation', () => {
  it('spawn adds a particle and returns a born event', () => {
    const s = new Simulation(cfg(), mulberry32(1));
    const ev = s.spawn(100, 100, 0, 0);
    expect(s.particles.length).toBe(1);
    expect(ev?.type).toBe('born');
  });

  it('integrates position by velocity * speedMul * dt (no walls hit)', () => {
    const s = new Simulation(cfg(), mulberry32(1));
    s.spawn(400, 300, 10, 0);
    s.step(1);
    expect(s.particles[0].pos.x).toBeCloseTo(410);
  });

  it('bounces off a wall, flipping velocity and emitting a bounce', () => {
    const s = new Simulation(cfg(), mulberry32(1));
    s.spawn(5, 300, -100, 0);   // heading into the left wall
    const events = s.step(0.5);
    expect(s.particles[0].vel.x).toBeGreaterThan(0);
    expect(events.some(e => e.type === 'bounce')).toBe(true);
  });

  it('removes a particle past its lifespan and emits death', () => {
    const s = new Simulation(cfg(), mulberry32(1));
    s.spawn(400, 300, 0, 0);
    s.particles[0].lifespan = 1;
    const events = s.step(2);
    expect(s.particles.length).toBe(0);
    expect(events.some(e => e.type === 'death')).toBe(true);
  });

  it('spawns spores when enabled, respecting maxParticles', () => {
    const s = new Simulation(cfg({ sporesEnabled: true, sporeIntervalSec: 0.1, maxParticles: 3 }), mulberry32(5));
    for (let i = 0; i < 50; i++) s.step(0.1);
    expect(s.particles.length).toBeLessThanOrEqual(3);
    expect(s.particles.length).toBeGreaterThan(0);
  });

  it('does not emit repeated bounces within the cooldown window', () => {
    const s = new Simulation(cfg(), mulberry32(1));
    s.spawn(5, 300, -100, 0);
    const first = s.step(0.05).filter(e => e.type === 'bounce').length;
    const second = s.step(0.05).filter(e => e.type === 'bounce').length; // still in cooldown
    expect(first).toBe(1);
    expect(second).toBe(0);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement `src/engine/Simulation.ts`**

```ts
import type { MusicalEvent } from './types';
import { speedOf, type Particle } from './Particle';
import { type Rng, randRange, pick } from './rng';
import { VOICES } from './palette';

export interface SimConfig {
  width: number;
  height: number;
  maxParticles: number;
  sporeIntervalSec: number;
  speedMul: number;       // driven by the "drift" knob
  sporesEnabled: boolean;
}

const BOUNCE_COOLDOWN = 0.12;

export class Simulation {
  particles: Particle[] = [];
  private nextId = 1;
  private sporeTimer = 0;

  constructor(private cfg: SimConfig, private rng: Rng) {}

  setConfig(patch: Partial<SimConfig>) { Object.assign(this.cfg, patch); }

  spawn(x: number, y: number, vx: number, vy: number): MusicalEvent | null {
    if (this.particles.length >= this.cfg.maxParticles) this.removeOldest();
    const p: Particle = {
      id: this.nextId++,
      pos: { x, y }, vel: { x: vx, y: vy },
      size: randRange(this.rng, 14, 64),
      age: 0,
      lifespan: randRange(this.rng, 18, 42),
      voice: pick(this.rng, VOICES),
      bounceCooldown: 0,
    };
    this.particles.push(p);
    return this.event('born', p);
  }

  step(dt: number): MusicalEvent[] {
    const events: MusicalEvent[] = [];
    const { width, height, speedMul } = this.cfg;

    if (this.cfg.sporesEnabled) {
      this.sporeTimer -= dt;
      if (this.sporeTimer <= 0) {
        this.sporeTimer = this.cfg.sporeIntervalSec * randRange(this.rng, 0.6, 1.4);
        if (this.particles.length < this.cfg.maxParticles) {
          const ang = randRange(this.rng, 0, Math.PI * 2);
          const sp = randRange(this.rng, 8, 26);
          const ev = this.spawn(
            randRange(this.rng, 40, width - 40),
            randRange(this.rng, 40, height - 40),
            Math.cos(ang) * sp, Math.sin(ang) * sp,
          );
          if (ev) events.push(ev);
        }
      }
    }

    for (const p of this.particles) {
      p.bounceCooldown = Math.max(0, p.bounceCooldown - dt);
      p.pos.x += p.vel.x * speedMul * dt;
      p.pos.y += p.vel.y * speedMul * dt;
      const r = p.size * 0.5;
      if (p.pos.x < r) { p.pos.x = r; p.vel.x = Math.abs(p.vel.x); this.maybeBounce(p, events); }
      else if (p.pos.x > width - r) { p.pos.x = width - r; p.vel.x = -Math.abs(p.vel.x); this.maybeBounce(p, events); }
      if (p.pos.y < r) { p.pos.y = r; p.vel.y = Math.abs(p.vel.y); this.maybeBounce(p, events); }
      else if (p.pos.y > height - r) { p.pos.y = height - r; p.vel.y = -Math.abs(p.vel.y); this.maybeBounce(p, events); }
    }

    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const a = this.particles[i], b = this.particles[j];
        const dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y;
        const dist = Math.hypot(dx, dy);
        const minD = (a.size + b.size) * 0.5;
        if (dist > 0 && dist < minD) {
          const nx = dx / dist, ny = dy / dist;
          const overlap = (minD - dist) * 0.5;
          a.pos.x -= nx * overlap; a.pos.y -= ny * overlap;
          b.pos.x += nx * overlap; b.pos.y += ny * overlap;
          const av = a.vel.x * nx + a.vel.y * ny;
          const bv = b.vel.x * nx + b.vel.y * ny;
          const diff = bv - av;
          a.vel.x += nx * diff; a.vel.y += ny * diff;
          b.vel.x -= nx * diff; b.vel.y -= ny * diff;
          this.maybeBounce(a, events); this.maybeBounce(b, events);
        }
      }
    }

    for (const p of this.particles) p.age += dt;

    const survivors: Particle[] = [];
    for (const p of this.particles) {
      if (p.age >= p.lifespan) events.push(this.event('death', p));
      else survivors.push(p);
    }
    this.particles = survivors;
    return events;
  }

  clear(): MusicalEvent[] {
    const evs = this.particles.map(p => this.event('death', p));
    this.particles = [];
    return evs;
  }

  private maybeBounce(p: Particle, events: MusicalEvent[]) {
    if (p.bounceCooldown > 0) return;
    p.bounceCooldown = BOUNCE_COOLDOWN;
    events.push(this.event('bounce', p));
  }

  private removeOldest() {
    let idx = 0, frac = -1;
    for (let i = 0; i < this.particles.length; i++) {
      const f = this.particles[i].age / this.particles[i].lifespan;
      if (f > frac) { frac = f; idx = i; }
    }
    this.particles.splice(idx, 1);
  }

  private event(type: MusicalEvent['type'], p: Particle): MusicalEvent {
    return { type, particleId: p.id, x: p.pos.x, y: p.pos.y, size: p.size, speed: speedOf(p), voice: p.voice };
  }
}
```

- [ ] **Step 4: Run tests — expect PASS.** If the spore test is flaky on count, confirm `sporeIntervalSec` jitter keeps it within `maxParticles`; it should because `spawn` calls `removeOldest` at the cap.
- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(engine): particle simulation with collisions, aging, spores"
```

---

## Task 5: Audio engine (`AudioEngine.ts`)

Tone.js graph. Pads = a pool of sustained voices (one per living mote, with stealing). Plucks = a polyphonic FM synth triggered by events, quantized to a global tempo (the **speed** control / BPM via `Tone.Transport`) and rate-limited. Shared reverb/delay/chorus/filter chain into a soft limiter.

**Files:**
- Create: `src/engine/AudioEngine.ts`
- Test: `src/engine/AudioEngine.test.ts`

- [ ] **Step 1: Write a construction/smoke test — `src/engine/AudioEngine.test.ts`**

Tone touches the Web Audio API, so mock it. The test verifies wiring logic, not sound.

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('tone', () => {
  const node = () => ({ connect: vi.fn(), toDestination: vi.fn(), start: vi.fn(() => node()), dispose: vi.fn() });
  const ramp = () => ({ rampTo: vi.fn(), value: 0 });
  class Synth { detune = ramp(); connect = vi.fn(); triggerAttack = vi.fn(); triggerRelease = vi.fn(); dispose = vi.fn(); }
  class PolySynth { connect = vi.fn(); triggerAttackRelease = vi.fn(); dispose = vi.fn(); }
  class Reverb { wet = ramp(); connect = vi.fn(); generate = vi.fn(async () => {}); dispose = vi.fn(); }
  class FeedbackDelay { wet = ramp(); feedback = ramp(); connect = vi.fn(); dispose = vi.fn(); }
  class Chorus { wet = ramp(); connect = vi.fn(); start = vi.fn(function (this: unknown) { return this; }); dispose = vi.fn(); }
  class Filter { frequency = { value: 0 }; connect = vi.fn(); dispose = vi.fn(); }
  class LFO { min = 0; max = 0; connect = vi.fn(); start = vi.fn(function (this: unknown) { return this; }); dispose = vi.fn(); }
  class Gain { gain = ramp(); connect = vi.fn(); toDestination = vi.fn(); dispose = vi.fn(); }
  class Limiter { connect = vi.fn(); dispose = vi.fn(); }
  return {
    Synth, PolySynth, Reverb, FeedbackDelay, Chorus, Filter, LFO, Gain, Limiter, FMSynth: class {},
    now: () => 0,
    getTransport: () => ({ bpm: { value: 0, rampTo: vi.fn() }, start: vi.fn(), stop: vi.fn(), nextSubdivision: () => 0 }),
    Frequency: () => ({ toFrequency: () => 440 }),
  };
});

import { AudioEngine } from './AudioEngine';
import type { MusicalEvent } from './types';

const ev = (over: Partial<MusicalEvent> = {}): MusicalEvent => ({
  type: 'born', particleId: 1, x: 0, y: 0, size: 30, speed: 0, voice: 'peach', ...over,
});

describe('AudioEngine', () => {
  it('initializes the graph without throwing', async () => {
    const a = new AudioEngine(); await a.init(); expect(a).toBeTruthy();
  });
  it('ignores events before init (no throw)', () => {
    const a = new AudioEngine(); expect(() => a.handle([ev()])).not.toThrow();
  });
  it('allocates and releases a pad voice across born/death', async () => {
    const a = new AudioEngine(); await a.init();
    a.setHeight(600); a.setMode('pads');
    expect(() => { a.handle([ev({ type: 'born', particleId: 7 })]); a.handle([ev({ type: 'death', particleId: 7 })]); }).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement `src/engine/AudioEngine.ts`**

```ts
import * as Tone from 'tone';
import type { KnobValues, Mode, Mood, MusicalEvent } from './types';
import { pitchFor } from './scale';

interface PadVoice { synth: Tone.Synth; particleId: number | null; startedAt: number; }

export class AudioEngine {
  private ready = false;
  private mode: Mode = 'both';
  private mood: Mood = 'warm';
  private height = 1;
  private lastPluckAt = -1;
  private readonly pluckMinInterval = 0.06;
  private readonly PAD_VOICES = 10;

  private padBus!: Tone.Gain;
  private master!: Tone.Gain;
  private limiter!: Tone.Limiter;
  private reverb!: Tone.Reverb;
  private delay!: Tone.FeedbackDelay;
  private chorus!: Tone.Chorus;
  private filter!: Tone.Filter;
  private lfo!: Tone.LFO;
  private pluck!: Tone.PolySynth;
  private transport!: ReturnType<typeof Tone.getTransport>;
  private padVoices: PadVoice[] = [];

  async init() {
    this.master = new Tone.Gain(0.9);
    this.limiter = new Tone.Limiter(-1);
    this.reverb = new Tone.Reverb({ decay: 9, preDelay: 0.03, wet: 0.5 });
    await this.reverb.generate();
    this.delay = new Tone.FeedbackDelay({ delayTime: 0.38, feedback: 0.32, wet: 0.18 });
    this.chorus = new Tone.Chorus({ frequency: 0.6, delayTime: 4, depth: 0.4, wet: 0.4 }).start();
    this.filter = new Tone.Filter({ type: 'lowpass', frequency: 1200, Q: 0.6 });
    this.lfo = new Tone.LFO({ frequency: 0.05, min: 700, max: 1500 }).start();
    this.lfo.connect(this.filter.frequency);

    this.padBus = new Tone.Gain(0.5);
    this.pluck = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2, modulationIndex: 4,
      envelope: { attack: 0.005, decay: 0.5, sustain: 0, release: 1.2 },
      volume: -11,
    } as ConstructorParameters<typeof Tone.PolySynth>[1]);

    this.padBus.connect(this.chorus);
    this.pluck.connect(this.chorus);
    this.chorus.connect(this.filter);
    this.filter.connect(this.delay);
    this.delay.connect(this.reverb);
    this.reverb.connect(this.limiter);
    this.limiter.connect(this.master);
    this.master.toDestination();

    this.transport = Tone.getTransport();
    this.transport.bpm.value = 70;
    this.transport.start();

    for (let i = 0; i < this.PAD_VOICES; i++) {
      const synth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 2.5, decay: 1, sustain: 0.7, release: 4 },
        volume: -16,
      });
      synth.detune.value = i % 2 === 0 ? 4 : -4;
      synth.connect(this.padBus);
      this.padVoices.push({ synth, particleId: null, startedAt: 0 });
    }
    this.ready = true;
  }

  setHeight(h: number) { this.height = h; }
  setMood(m: Mood) { this.mood = m; }
  setMode(m: Mode) { this.mode = m; if (m === 'plucks') this.releaseAllPads(); }

  setKnobs(k: Partial<KnobValues>) {
    if (!this.ready) return;
    if (k.space != null) this.reverb.wet.rampTo(0.15 + k.space * 0.65, 0.3);
    if (k.echo != null) { this.delay.wet.rampTo(k.echo * 0.5, 0.3); this.delay.feedback.rampTo(0.15 + k.echo * 0.45, 0.3); }
    if (k.tone != null) { const f = 400 + k.tone * 2600; this.lfo.min = Math.max(250, f * 0.6); this.lfo.max = f; }
    if (k.speed != null) this.transport.bpm.rampTo(40 + k.speed * 80, 0.3);
  }

  setVolume(v: number) { if (this.ready) this.master.gain.rampTo(v, 0.2); }

  handle(events: MusicalEvent[]) {
    if (!this.ready) return;
    const now = Tone.now();
    for (const e of events) {
      switch (e.type) {
        case 'born':
          if (this.mode !== 'plucks') this.allocatePad(e);
          if (this.mode !== 'pads') this.tryPluck(e, now);
          break;
        case 'bounce':
          if (this.mode !== 'pads') this.tryPluck(e, now);
          break;
        case 'death': this.releasePad(e.particleId); break;
        case 'bloom': this.bloom(e, now); break;
      }
    }
  }

  private midiFor(e: MusicalEvent) { return pitchFor(this.mood, { y: e.y, height: this.height, size: e.size, speed: e.speed }); }
  private freq(midi: number) { return Tone.Frequency(midi, 'midi').toFrequency(); }

  private allocatePad(e: MusicalEvent) {
    let v = this.padVoices.find(v => v.particleId === null);
    if (!v) { v = this.padVoices.reduce((a, b) => (a.startedAt <= b.startedAt ? a : b)); v.synth.triggerRelease(); }
    v.particleId = e.particleId; v.startedAt = Tone.now();
    v.synth.triggerAttack(this.freq(this.midiFor(e)));
  }
  private releasePad(pid: number) {
    const v = this.padVoices.find(v => v.particleId === pid);
    if (v) { v.synth.triggerRelease(); v.particleId = null; }
  }
  private releaseAllPads() { for (const v of this.padVoices) if (v.particleId != null) { v.synth.triggerRelease(); v.particleId = null; } }

  private tryPluck(e: MusicalEvent, now: number) {
    if (now - this.lastPluckAt < this.pluckMinInterval) return;
    this.lastPluckAt = now;
    const time = this.transport.nextSubdivision('8n');
    this.pluck.triggerAttackRelease(this.freq(this.midiFor(e)), '8n', time);
  }
  private bloom(e: MusicalEvent, now: number) {
    const base = this.midiFor(e);
    [0, 4, 7, 12].forEach((iv, i) => this.pluck.triggerAttackRelease(this.freq(base + iv), '4n', now + i * 0.06));
  }

  dispose() {
    this.transport?.stop();
    [this.padBus, this.master, this.limiter, this.reverb, this.delay, this.chorus, this.filter, this.lfo, this.pluck]
      .forEach(n => n?.dispose?.());
    this.padVoices.forEach(v => v.synth.dispose());
    this.ready = false;
  }
}
```

- [ ] **Step 4: Run tests — expect PASS.**
- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(engine): Tone.js audio engine (pads, plucks, effects)"
```

---

## Task 6: Renderer (`Renderer.ts`)

**Files:**
- Create: `src/engine/Renderer.ts`
- Test: `src/engine/Renderer.test.ts`

- [ ] **Step 1: Smoke test with a mock 2D context — `src/engine/Renderer.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import { Renderer } from './Renderer';
import type { Particle } from './Particle';

function fakeCanvas() {
  const ctx = {
    setTransform: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    globalCompositeOperation: '', fillStyle: '' as unknown,
  };
  return { canvas: { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement, ctx };
}
const p = (over: Partial<Particle> = {}): Particle => ({
  id: 1, pos: { x: 10, y: 10 }, vel: { x: 0, y: 0 }, size: 30, age: 5, lifespan: 20, voice: 'aqua', bounceCooldown: 0, ...over,
});

describe('Renderer', () => {
  it('draws a trail fill then a glow per particle', () => {
    const { canvas, ctx } = fakeCanvas();
    const r = new Renderer(canvas, false);
    r.draw([p(), p({ id: 2 })], 800, 600, 0);
    expect(ctx.fillRect).toHaveBeenCalled();        // trail fade
    expect(ctx.arc).toHaveBeenCalledTimes(2);       // one glow per particle
  });
});
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement `src/engine/Renderer.ts`**

```ts
import { lifePhase, type Particle } from './Particle';
import { VOICE_RGB } from './palette';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  constructor(private canvas: HTMLCanvasElement, private reducedMotion = false) {
    const c = canvas.getContext('2d');
    if (!c) throw new Error('2D canvas context unavailable');
    this.ctx = c;
  }

  resize(w: number, h: number, dpr: number) {
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  draw(particles: Particle[], width: number, height: number, _tint: number) {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(12, 10, 18, ${this.reducedMotion ? 1 : 0.18})`;
    ctx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      const [r, g, b] = VOICE_RGB[p.voice];
      const life = lifePhase(p);
      const fade = life < 0.1 ? life / 0.1 : life > 0.85 ? (1 - life) / 0.15 : 1;
      const radius = p.size * (0.8 + 0.6 * life);
      const grad = ctx.createRadialGradient(p.pos.x, p.pos.y, 0, p.pos.x, p.pos.y, radius);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.5 * fade})`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
```

- [ ] **Step 4: Run tests — expect PASS.**
- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(engine): canvas renderer with glow and trails"
```

---

## Task 7: Composition root (`MoteApp.ts`)

Wires the three subsystems, owns the fixed-timestep rAF loop, handles tab visibility, and exposes the imperative API the UI calls.

**Files:**
- Create: `src/engine/MoteApp.ts`

> Verification here is integration-level: covered by manual checks in Task 9 once UI exists. Keep this task's "test" a `tsc` typecheck (`pnpm exec tsc --noEmit`) so the API surface compiles against the engine.

- [ ] **Step 1: Implement `src/engine/MoteApp.ts`**

```ts
import { Simulation, type SimConfig } from './Simulation';
import { AudioEngine } from './AudioEngine';
import { Renderer } from './Renderer';
import { mulberry32, randRange, type Rng } from './rng';
import type { KnobValues, Mode, Mood } from './types';

export interface MoteAppOptions { seed?: number; reducedMotion?: boolean; }

export class MoteApp {
  private rng: Rng;
  private sim: Simulation;
  private audio: AudioEngine;
  private renderer: Renderer;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private readonly STEP = 1 / 120;
  private width: number;
  private height: number;
  private running = false;

  constructor(private canvas: HTMLCanvasElement, opts: MoteAppOptions = {}) {
    this.rng = mulberry32(opts.seed ?? (Date.now() >>> 0));
    this.width = canvas.clientWidth || 800;
    this.height = canvas.clientHeight || 600;
    const cfg: SimConfig = {
      width: this.width, height: this.height,
      maxParticles: 160, sporeIntervalSec: 6, speedMul: 1, sporesEnabled: true,
    };
    this.sim = new Simulation(cfg, this.rng);
    this.audio = new AudioEngine();
    this.renderer = new Renderer(canvas, opts.reducedMotion);
    this.renderer.resize(this.width, this.height, window.devicePixelRatio || 1);
    this.audio.setHeight(this.height);

    for (let i = 0; i < 4; i++) {
      this.sim.spawn(
        randRange(this.rng, 40, this.width - 40),
        randRange(this.rng, 40, this.height - 40),
        randRange(this.rng, -20, 20), randRange(this.rng, -20, 20),
      );
    }
  }

  /** Must be called from a user gesture. Starts Tone and the audio graph. */
  async unlockAudio() {
    const Tone = await import('tone');
    await Tone.start();
    await this.audio.init();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    document.addEventListener('visibilitychange', this.onVisibility);
    this.raf = requestAnimationFrame(this.loop);
  }
  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private onVisibility = () => { if (document.hidden) this.stop(); else this.start(); };

  private loop = (t: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    let dt = (t - this.last) / 1000;
    this.last = t;
    if (dt > 0.25) dt = 0.25;
    this.acc += dt;
    while (this.acc >= this.STEP) {
      this.audio.handle(this.sim.step(this.STEP));
      this.acc -= this.STEP;
    }
    this.renderer.draw(this.sim.particles, this.width, this.height, 0);
  };

  addMote(x: number, y: number, vx = 0, vy = 0) {
    const ev = this.sim.spawn(x, y, vx, vy);
    if (ev) this.audio.handle([ev]);
  }
  bloomAt(x: number, y: number) {
    // nearest particle blooms (easter egg hook; see Task 9)
    let best = null as null | { id: number; d: number };
    for (const p of this.sim.particles) {
      const d = Math.hypot(p.pos.x - x, p.pos.y - y);
      if (!best || d < best.d) best = { id: p.id, d };
    }
    const p = this.sim.particles.find(p => p.id === best?.id);
    if (p) this.audio.handle([{ type: 'bloom', particleId: p.id, x: p.pos.x, y: p.pos.y, size: p.size, speed: 0, voice: p.voice }]);
  }
  setMode(m: Mode) { this.audio.setMode(m); }
  setMood(m: Mood) { this.audio.setMood(m); }
  setKnob(k: Partial<KnobValues>) {
    this.audio.setKnobs(k);
    if (k.drift != null) this.sim.setConfig({ speedMul: 0.4 + k.drift * 1.6 });
  }
  setSpores(on: boolean) { this.sim.setConfig({ sporesEnabled: on }); }
  setVolume(v: number) { this.audio.setVolume(v); }
  clear() { this.audio.handle(this.sim.clear()); }

  resize() {
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.sim.setConfig({ width: this.width, height: this.height });
    this.audio.setHeight(this.height);
    this.renderer.resize(this.width, this.height, window.devicePixelRatio || 1);
  }
  dispose() {
    this.stop();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.audio.dispose();
  }
}
```

- [ ] **Step 2: Typecheck — `pnpm exec tsc --noEmit`** → expect no errors.
- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(engine): MoteApp composition root and rAF loop"
```

---

## Task 8: UI shell (`storage.ts`, `useMoteApp.ts`, `Canvas.tsx`, `Knob.tsx`, `Segmented.tsx`, `ControlStrip.tsx`, `App.tsx`)

Thin React shell. The canvas hosts the engine and forwards input; the control strip calls the imperative API. First interaction unlocks audio.

**Files:**
- Create: `src/ui/storage.ts`, `src/ui/useMoteApp.ts`, `src/ui/Canvas.tsx`, `src/ui/Knob.tsx`, `src/ui/Segmented.tsx`, `src/ui/ControlStrip.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: `src/ui/storage.ts`**

```ts
import type { KnobValues, Mode, Mood } from '../engine/types';

export interface Settings { mode: Mode; mood: Mood; knobs: KnobValues; volume: number; spores: boolean; }
const KEY = 'mote.settings.v1';
export const DEFAULTS: Settings = {
  mode: 'both', mood: 'warm',
  knobs: { space: 0.6, echo: 0.3, tone: 0.5, drift: 0.5, speed: 0.5 },
  volume: 0.9, spores: true,
};

export function loadSettings(): Settings {
  try { const raw = localStorage.getItem(KEY); return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS; }
  catch { return DEFAULTS; }
}
export function saveSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore quota/private-mode */ }
}
```

- [ ] **Step 2: `src/ui/useMoteApp.ts`** — own a `MoteApp` bound to a canvas ref, apply settings, persist.

```ts
import { useEffect, useRef, useState } from 'react';
import { MoteApp } from '../engine/MoteApp';
import { loadSettings, saveSettings, type Settings } from './storage';

export function useMoteApp(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const appRef = useRef<MoteApp | null>(null);
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const app = new MoteApp(canvasRef.current, { reducedMotion: reduced });
    appRef.current = app;
    app.start(); // visuals run immediately; audio waits for unlock
    const onResize = () => app.resize();
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); app.dispose(); appRef.current = null; };
  }, [canvasRef]);

  // push settings to engine + persist
  useEffect(() => {
    const app = appRef.current; if (!app) return;
    app.setMode(settings.mode); app.setMood(settings.mood);
    app.setKnob(settings.knobs); app.setVolume(settings.volume); app.setSpores(settings.spores);
    saveSettings(settings);
  }, [settings]);

  async function unlock() {
    if (unlocked || !appRef.current) return;
    await appRef.current.unlockAudio();
    appRef.current.setMode(settings.mode); appRef.current.setMood(settings.mood);
    appRef.current.setKnob(settings.knobs); appRef.current.setVolume(settings.volume);
    setUnlocked(true);
  }

  return { app: appRef, settings, setSettings, unlocked, unlock };
}
```

- [ ] **Step 3: `src/ui/Knob.tsx`** — pointer-drag knob (drag up = increase). Visual matches the approved mockup (dark circle, indicator line, soft colored glow).

```tsx
import { useRef } from 'react';

export function Knob({ label, value, onChange, glow }: {
  label: string; value: number; onChange: (v: number) => void; glow: string;
}) {
  const start = useRef<{ y: number; v: number } | null>(null);
  const angle = -135 + value * 270;

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    start.current = { y: e.clientY, v: value };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!start.current) return;
    const dv = (start.current.y - e.clientY) / 180; // 180px = full sweep
    onChange(Math.max(0, Math.min(1, start.current.v + dv)));
  }
  function onPointerUp() { start.current = null; }

  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      <div
        role="slider" aria-label={label} aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}
        tabIndex={0} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') onChange(Math.min(1, value + 0.05));
          if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') onChange(Math.max(0, value - 0.05));
        }}
        className="relative h-9 w-9 rounded-full border border-white/15 touch-none"
        style={{ background: 'radial-gradient(circle at 50% 38%, #2a2640, #15121f)', boxShadow: `0 0 16px ${glow}` }}
      >
        <span className="absolute left-1/2 top-1.5 h-2.5 w-0.5 rounded bg-[#f3eefe]"
          style={{ transform: `translateX(-50%) rotate(${angle}deg)`, transformOrigin: '50% 12px' }} />
      </div>
      <span className="text-[11px] tracking-wide text-[#7d7796]">{label}</span>
    </div>
  );
}
```

- [ ] **Step 4: `src/ui/Segmented.tsx`** — generic segmented control for mode and mood.

```tsx
export function Segmented<T extends string>({ options, value, onChange }: {
  options: readonly T[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-full bg-white/5 p-0.5">
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)}
          className={`rounded-full px-3.5 py-1.5 text-xs tracking-wide transition-colors ${
            value === o ? 'bg-white/10 text-[#f3eefe]' : 'text-[#b9b2cf] hover:text-[#f3eefe]'}`}>
          {o}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: `src/ui/Canvas.tsx`** — full-screen canvas host bound to the shared ref.

```tsx
export function Canvas({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  return <canvas ref={canvasRef} className="block h-full w-full touch-none" />;
}
```

> Use ONE shared `canvasRef`: `useMoteApp(canvasRef)` owns it and `Canvas` attaches it via `<canvas ref={canvasRef}>`. React assigns a ref during commit, before any effect runs, so `useMoteApp`'s effect always sees a populated `canvasRef.current` — no effect-ordering assumptions and no `onReady` callback. Keep `Canvas` a dumb host; pointer/keyboard input is handled in `App.tsx` (which has the engine + `unlock`).

- [ ] **Step 6: `src/ui/ControlStrip.tsx`** — the bottom strip from the mockup.

```tsx
import { Segmented } from './Segmented';
import { Knob } from './Knob';
import type { Settings } from './storage';
import type { Mode, Mood } from '../engine/types';

const MODES: readonly Mode[] = ['pads', 'plucks', 'both'];
const MOODS: readonly Mood[] = ['warm', 'dream', 'dusk', 'mist'];
const KNOBS: { key: keyof Settings['knobs']; glow: string }[] = [
  { key: 'space', glow: 'rgba(255,150,170,.25)' },
  { key: 'echo', glow: 'rgba(150,225,220,.22)' },
  { key: 'tone', glow: 'rgba(255,214,140,.22)' },
  { key: 'drift', glow: 'rgba(190,170,255,.25)' },
];

export function ControlStrip({ settings, onChange, onClear }: {
  settings: Settings; onChange: (patch: Partial<Settings>) => void; onClear: () => void;
}) {
  return (
    <div className="pointer-events-auto mx-4 mb-4 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#14111e]/60 px-4 py-2.5 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[#ffb78a] shadow-[0_0_10px_#ffb78a]" />
        <span className="text-lg tracking-[0.3em] text-[#efe9fb]">mote</span>
      </div>

      <div className="flex items-center gap-3">
        <Segmented options={MODES} value={settings.mode} onChange={(mode) => onChange({ mode })} />
        <Segmented options={MOODS} value={settings.mood} onChange={(mood) => onChange({ mood })} />
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-start gap-4">
          {KNOBS.map(({ key, glow }) => (
            <Knob key={key} label={key} glow={glow} value={settings.knobs[key]}
              onChange={(v) => onChange({ knobs: { ...settings.knobs, [key]: v } })} />
          ))}
        </div>

        <div className="flex items-center gap-3 self-center">
          <button onClick={() => onChange({ spores: !settings.spores })} aria-pressed={settings.spores}
            aria-label={settings.spores ? 'pause auto-spawn' : 'resume auto-spawn'}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-[#b9b2cf] hover:text-[#f3eefe]">
            {settings.spores ? (
              <svg width="11" height="11" viewBox="0 0 10 10" aria-hidden="true">
                <rect x="1" y="1" width="3" height="8" fill="currentColor" /><rect x="6" y="1" width="3" height="8" fill="currentColor" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 1l7 4-7 4z" fill="currentColor" /></svg>
            )}
          </button>

          <label className="flex flex-col items-center gap-1 text-[11px] tracking-wide text-[#7d7796]">
            <input type="range" min={0} max={1} step={0.01} value={settings.knobs.speed} aria-label="speed (tempo)"
              onChange={(e) => onChange({ knobs: { ...settings.knobs, speed: Number(e.target.value) } })}
              className="h-1 w-16 accent-[#ffd68c]" />
            speed
          </label>

          <label className="flex flex-col items-center gap-1 text-[11px] tracking-wide text-[#7d7796]">
            <input type="range" min={0} max={1} step={0.01} value={settings.volume} aria-label="volume"
              onChange={(e) => onChange({ volume: Number(e.target.value) })}
              className="h-1 w-16 accent-[#cdbcff]" />
            vol
          </label>

          <button onClick={onClear} aria-label="clear"
            className="self-start rounded-full border border-white/15 px-3 py-1.5 text-xs text-[#b9b2cf] hover:text-[#f3eefe]">clear</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: `src/App.tsx`** — compose canvas + strip, wire input + audio unlock.

```tsx
import { useRef, useState } from 'react';
import { Canvas } from './ui/Canvas';
import { ControlStrip } from './ui/ControlStrip';
import { useMoteApp } from './ui/useMoteApp';
import type { Settings } from './ui/storage';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { app, settings, setSettings, unlocked, unlock } = useMoteApp(canvasRef);
  const [hint, setHint] = useState(true);
  const drag = useRef<{ x: number; y: number; t: number } | null>(null);

  async function firstGesture() { if (!unlocked) await unlock(); setHint(false); }

  function onPointerDown(e: React.PointerEvent) { drag.current = { x: e.clientX, y: e.clientY, t: performance.now() }; void firstGesture(); }
  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current; drag.current = null;
    const dtm = d ? Math.max(16, performance.now() - d.t) : 16;
    const vx = d ? ((e.clientX - d.x) / dtm) * 1000 * 0.25 : 0;
    const vy = d ? ((e.clientY - d.y) / dtm) * 1000 * 0.25 : 0;
    app.current?.addMote(e.clientX, e.clientY, vx, vy);
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.repeat) return;
    void firstGesture();
    app.current?.addMote(Math.random() * window.innerWidth, Math.random() * window.innerHeight, 0, 0);
  }

  const patch = (p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p }));

  return (
    <div className="relative h-full w-full" tabIndex={0} onKeyDown={onKeyDown}
      onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      <Canvas canvasRef={canvasRef} />
      {hint && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-sm tracking-widest text-white/30">click anywhere</span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
        <ControlStrip settings={settings} onChange={patch} onClear={() => app.current?.clear()} />
      </div>
    </div>
  );
}
```

> Both `useMoteApp(canvasRef)` and `<Canvas canvasRef={canvasRef} />` share the single `canvasRef` declared here, so the engine binds to the live canvas with no `onReady` indirection (see Task 8 Step 5).

- [ ] **Step 8: Verify in the browser** — `pnpm dev`, then use the preview workflow:
  - Confirm motes drift and glow on a dark field; "click anywhere" hint shows.
  - Click → a mote appears and (after first click unlocks audio) a soft pad note swells. Drag → mote is thrown. Press keys → motes spawn.
  - Toggle mode pads/plucks/both; switch moods; turn knobs (space/echo/tone/drift audibly change reverb/delay/brightness/motion); move the **speed** slider in plucks/both mode and hear the tempo change; adjust **volume**; toggle **play/pause** (auto-spawn stops/starts); **clear** fades motes.
  - Check the browser console for errors (especially Tone audio-context warnings — there should be none after the first gesture).

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(ui): canvas host, control strip, knobs, input + audio unlock"
```

---

## Task 9: Delights / easter eggs

Add subtle extras. Each is independently committable; keep them skippable and respect reduced motion.

**Files:**
- Modify: `src/App.tsx`, `src/engine/MoteApp.ts`, `src/engine/Renderer.ts`

- [ ] **Step 1: Double-click blooms the nearest mote** — in `App.tsx`, add `onDoubleClick={(e) => app.current?.bloomAt(e.clientX, e.clientY)}`. (`bloomAt` already exists on `MoteApp`.) Verify a chord flourish + (Step 4) a visual ring.
- [ ] **Step 2: Type "mote" → bloom all + key shimmer** — track recent keystrokes in `App.tsx`; on matching `"mote"`, call a new `MoteApp.bloomAll()` that emits `bloom` for every particle and briefly raises reverb. Verify.
- [ ] **Step 3: Time-of-day tint** — in `MoteApp.loop`, compute a tint from `new Date().getHours()` (warmer 18:00–06:00, cooler midday) and pass to `renderer.draw`; in `Renderer`, blend the trail-fade color slightly toward warm/cool by tint. Keep it subtle.
- [ ] **Step 4: Bloom ring visual** — `Renderer` keeps a short list of active rings (center, radius, age); `draw` expands and fades them with additive blend. `MoteApp` pushes a ring on `bloom`. Honor `reducedMotion` (skip rings).
- [ ] **Step 5: Commit** (one commit per egg is fine)

```bash
git add -A && git commit -m "feat: easter eggs (bloom, type-to-bloom, day tint, rings)"
```

> Deferred to roadmap (do NOT build now): idle sunbeam sweep, magnetize-to-cursor. Listed in the spec §11/§7; leave hooks but skip implementation to keep v1 focused.

---

## Task 10: Polish, accessibility, and final verification

**Files:**
- Modify: `index.html` (title, theme-color, meta), `src/index.css`, others as needed

- [ ] **Step 1: Metadata** — set `<title>mote</title>`, a `<meta name="theme-color" content="#0c0a12">`, and a short description in `index.html`.
- [ ] **Step 2: Reduced-motion pass** — verify with the browser emulating `prefers-reduced-motion: reduce`: trails become opaque (no smear), rings/sunbeam suppressed, control transitions minimal. Fix any motion that ignores the flag.
- [ ] **Step 3: Performance guard** — stress with rapid clicks/keys to the cap (~160 motes); confirm frame rate stays smooth and audio never clutters (pluck rate-limit + pad voice cap hold). If needed, lower `maxParticles` or trail cost.
- [ ] **Step 4: Full typecheck + tests + build**

Run:
```bash
pnpm exec tsc --noEmit && pnpm test && pnpm build
```
Expected: no type errors; all Vitest suites pass; `dist/` builds clean.

- [ ] **Step 5: Spec cross-check** — re-read the spec's goals (§2) and confirm each is met: simple, always-pleasant, no theory, soft/warm, infinite/self-playing, full kit (pads/plucks/moods/knobs), easter eggs. Note any gaps.
- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: polish, a11y, perf guard, final verification"
```

- [ ] **Step 7: Finish the branch** — use @superpowers:finishing-a-development-branch to decide merge vs PR.

---

## Notes for the implementer

- **Tune by ear** (spec §12): `ROOT_MIDI`, `OCTAVE_SPAN`, spore rate, `maxParticles`, pad voice count (~8–12), reverb decay, the BPM range (`40 + speed * 80`) and pluck subdivision (`8n` vs `16n`), and the pluck rate-limit are all starting points — adjust until it feels soft, warm, and uncluttered.
- **Determinism caveat:** `MoteApp` seeds initial motes via the injected RNG, but live wall-clock seeding makes each session differ — intended. Tests inject a fixed seed.
- **Ripple mode (roadmap, do NOT build):** when added, it emits a new `ring-cross` `MusicalEvent` from `Simulation` and is handled in `AudioEngine` — no other module changes. This is the seam the architecture exists to protect.
