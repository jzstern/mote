export type Rng = () => number;

export interface Firefly {
  id: number;
  x: number;
  y: number;
  heading: number;
  speed: number;
  /** Oscillator phase; flashes when it crosses 1. May dip slightly below 0 from reset jitter. */
  phase: number;
  period: number;
  /** Seconds since the last flash began; Infinity until the first flash. */
  flashAge: number;
  degree: number;
  sprite: number;
}

export interface EmberConfig {
  count: number;
  cap: number;
  speedMin: number;
  speedMax: number;
  periodMin: number;
  periodMax: number;
  couplingRadius: number;
  nudgeBase: number;
  nudgeSlope: number;
  nudgeCap: number;
  /** Flies this early in their cycle ignore nudges — without it bursts smear and sync never locks. */
  nudgeRefractory: number;
  phaseJitter: number;
  flashDuration: number;
  turnRate: number;
  edgeMargin: number;
  attractRadius: number;
  attractPull: number;
  holdPhaseRate: number;
  degreeCount: number;
}

export interface SimState {
  width: number;
  height: number;
  flies: Firefly[];
  nextId: number;
}

export interface FlashEvent {
  x: number;
  y: number;
  degree: number;
}

export function makeConfig(reducedMotion: boolean, degreeCount: number): EmberConfig {
  return {
    count: 80,
    cap: 140,
    speedMin: reducedMotion ? 4 : 8,
    speedMax: reducedMotion ? 8 : 16,
    periodMin: 3.2,
    periodMax: 4.8,
    couplingRadius: 130,
    nudgeBase: 0.04,
    nudgeSlope: 0.1,
    // Cap just below 1 so a nudge never fires a fly within the same step;
    // it flashes on the next step, which is what makes bursts read as one.
    nudgeCap: 0.999,
    nudgeRefractory: 0.15,
    phaseJitter: 0.01,
    flashDuration: reducedMotion ? 0.7 : 0.45,
    turnRate: 1.6,
    edgeMargin: 48,
    attractRadius: 180,
    attractPull: 42,
    holdPhaseRate: 0.06,
    degreeCount,
  };
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSim(width: number, height: number): SimState {
  return { width, height, flies: [], nextId: 0 };
}

/**
 * Density tuning: on large screens the default flock is too sparse for
 * pockets to find each other, so population and coupling reach scale up.
 */
export function tuneForBounds(cfg: EmberConfig, width: number, height: number): void {
  const area = width * height;
  cfg.count = Math.max(50, Math.min(120, Math.round(45 + area / 16000)));
  cfg.couplingRadius = Math.max(130, Math.min(170, Math.hypot(width, height) / 8));
}

/** Weighted toward mid-low degrees with the occasional high sparkle. */
export function pickDegree(rng: Rng, degreeCount: number): number {
  return Math.min(degreeCount - 1, Math.floor(Math.pow(rng(), 1.6) * degreeCount));
}

export function createFirefly(
  rng: Rng,
  cfg: EmberConfig,
  state: SimState,
  x?: number,
  y?: number,
): Firefly {
  return {
    id: state.nextId++,
    x: x ?? rng() * state.width,
    y: y ?? rng() * state.height,
    heading: rng() * Math.PI * 2,
    speed: cfg.speedMin + rng() * (cfg.speedMax - cfg.speedMin),
    phase: rng(),
    period: cfg.periodMin + rng() * (cfg.periodMax - cfg.periodMin),
    flashAge: Number.POSITIVE_INFINITY,
    degree: pickDegree(rng, cfg.degreeCount),
    sprite: rng() < 0.25 ? 1 : 0,
  };
}

export function populate(state: SimState, rng: Rng, cfg: EmberConfig): void {
  while (state.flies.length < cfg.count) state.flies.push(createFirefly(rng, cfg, state));
}

/** Mirollo–Strogatz style: the nudge grows with phase, so late flies jump further. */
export function nudgedPhase(phase: number, cfg: EmberConfig): number {
  return Math.min(cfg.nudgeCap, phase + cfg.nudgeBase + cfg.nudgeSlope * phase);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function angleDelta(from: number, to: number): number {
  const tau = Math.PI * 2;
  let d = (to - from) % tau;
  if (d > Math.PI) d -= tau;
  if (d < -Math.PI) d += tau;
  return d;
}

export function stepSim(state: SimState, dt: number, rng: Rng, cfg: EmberConfig): FlashEvent[] {
  const { flies, width, height } = state;
  const cx = width / 2;
  const cy = height / 2;

  for (const f of flies) {
    f.heading += (rng() - 0.5) * cfg.turnRate * dt;
    const nearEdge =
      f.x < cfg.edgeMargin ||
      f.y < cfg.edgeMargin ||
      f.x > width - cfg.edgeMargin ||
      f.y > height - cfg.edgeMargin;
    if (nearEdge) {
      f.heading += angleDelta(f.heading, Math.atan2(cy - f.y, cx - f.x)) * Math.min(1, 3 * dt);
    }
    f.x = clamp(f.x + Math.cos(f.heading) * f.speed * dt, 0, width);
    f.y = clamp(f.y + Math.sin(f.heading) * f.speed * dt, 0, height);
    f.phase += dt / f.period;
    f.flashAge += dt;
  }

  const flashers = flies.filter(f => f.phase >= 1);
  const events: FlashEvent[] = [];
  const flasherSet = new Set(flashers);
  for (const f of flashers) {
    f.phase = (rng() * 2 - 1) * cfg.phaseJitter;
    f.flashAge = 0;
    events.push({ x: f.x, y: f.y, degree: f.degree });
  }
  const r2 = cfg.couplingRadius * cfg.couplingRadius;
  for (const f of flashers) {
    for (const n of flies) {
      // Concurrent flashers are excluded so one burst can't un-flash another.
      if (flasherSet.has(n) || n.phase < cfg.nudgeRefractory) continue;
      const dx = n.x - f.x;
      const dy = n.y - f.y;
      if (dx * dx + dy * dy <= r2) n.phase = nudgedPhase(n.phase, cfg);
    }
  }
  return events;
}

/** Press-and-hold: draw nearby flies toward the pointer and hurry their phases. */
export function holdInfluence(
  state: SimState,
  px: number,
  py: number,
  dt: number,
  cfg: EmberConfig,
): void {
  const r2 = cfg.attractRadius * cfg.attractRadius;
  for (const f of state.flies) {
    const dx = px - f.x;
    const dy = py - f.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2 || d2 === 0) continue;
    const d = Math.sqrt(d2);
    const falloff = 1 - d / cfg.attractRadius;
    const pull = cfg.attractPull * falloff * dt;
    f.x += (dx / d) * pull;
    f.y += (dy / d) * pull;
    f.phase += cfg.holdPhaseRate * falloff * dt;
  }
}

/** Spawn a firefly that flashes immediately, replacing the oldest when at cap. */
export function spawnAt(
  state: SimState,
  rng: Rng,
  cfg: EmberConfig,
  x: number,
  y: number,
): FlashEvent {
  if (state.flies.length >= cfg.cap) {
    let oldest = 0;
    for (let i = 1; i < state.flies.length; i++) {
      if (state.flies[i].id < state.flies[oldest].id) oldest = i;
    }
    state.flies.splice(oldest, 1);
  }
  const f = createFirefly(rng, cfg, state, x, y);
  f.phase = 0;
  f.flashAge = 0;
  state.flies.push(f);
  const r2 = cfg.couplingRadius * cfg.couplingRadius;
  for (const n of state.flies) {
    if (n === f || n.phase < cfg.nudgeRefractory) continue;
    const dx = n.x - x;
    const dy = n.y - y;
    if (dx * dx + dy * dy <= r2) n.phase = nudgedPhase(n.phase, cfg);
  }
  return { x, y, degree: f.degree };
}

export function clampToBounds(state: SimState, width: number, height: number): void {
  state.width = width;
  state.height = height;
  for (const f of state.flies) {
    f.x = clamp(f.x, 0, width);
    f.y = clamp(f.y, 0, height);
  }
}

/**
 * Synchrony order parameter in [0,1]. Flashes in the trailing window are
 * grouped into clusters anchored at each cluster's first flash; the rms
 * cluster mass is 1 when every flash shares one 120ms window and tends to
 * 1/sqrt(n) when flashes are spread evenly.
 */
export function syncMeasure(
  flashTimes: readonly number[],
  now: number,
  windowSec = 4,
  clusterSec = 0.12,
): number {
  const recent = flashTimes.filter(t => t <= now && now - t <= windowSec).sort((a, b) => a - b);
  if (recent.length < 2) return 0;
  let sumSq = 0;
  let i = 0;
  while (i < recent.length) {
    const anchor = recent[i];
    let size = 0;
    while (i < recent.length && recent[i] - anchor <= clusterSec) {
      size++;
      i++;
    }
    sumSq += size * size;
  }
  return Math.sqrt(sumSq) / recent.length;
}
