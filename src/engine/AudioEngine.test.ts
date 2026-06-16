import { describe, it, expect, vi } from 'vitest';

vi.mock('tone', () => {
  const ramp = () => ({ rampTo: vi.fn(), value: 0 });
  class Synth { detune = ramp(); connect = vi.fn(); triggerAttack = vi.fn(); triggerRelease = vi.fn(); dispose = vi.fn(); }
  class PolySynth { connect = vi.fn(); triggerAttackRelease = vi.fn(); dispose = vi.fn(); }
  class Reverb { wet = ramp(); connect = vi.fn(); generate = vi.fn(async () => {}); dispose = vi.fn(); }
  class FeedbackDelay { wet = ramp(); feedback = ramp(); connect = vi.fn(); dispose = vi.fn(); }
  class Chorus { wet = ramp(); connect = vi.fn(); start = vi.fn(function (this: unknown) { return this; }); dispose = vi.fn(); }
  class Filter { frequency = ramp(); connect = vi.fn(); dispose = vi.fn(); }
  class Panner { pan = ramp(); connect = vi.fn(); dispose = vi.fn(); }
  class LFO { min = 0; max = 0; connect = vi.fn(); start = vi.fn(function (this: unknown) { return this; }); dispose = vi.fn(); }
  class Gain { gain = ramp(); connect = vi.fn(); toDestination = vi.fn(); dispose = vi.fn(); }
  class Limiter { connect = vi.fn(); dispose = vi.fn(); }
  return {
    Synth, PolySynth, Reverb, FeedbackDelay, Chorus, Filter, LFO, Gain, Limiter, Panner, FMSynth: class {},
    start: vi.fn(async () => {}),
    now: () => 0,
    getTransport: () => ({ bpm: { value: 0, rampTo: vi.fn() }, start: vi.fn(), stop: vi.fn(), nextSubdivision: () => 0 }),
    Frequency: () => ({ toFrequency: () => 440 }),
  };
});

import { AudioEngine } from './AudioEngine';
import type { LifeEvent } from './types';

const ev = (over: Partial<LifeEvent> = {}): LifeEvent => ({
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
  it('init is idempotent — a second unlock does not rebuild the graph (no doubled voices)', async () => {
    const a = new AudioEngine(); await a.init(); await a.init();
    expect((a as unknown as { padVoices: unknown[] }).padVoices.length).toBe(10);
  });

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
});
