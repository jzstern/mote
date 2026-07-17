import type * as Tone from 'tone';

export type PluckPreset = 'glass' | 'kalimba' | 'string' | 'bell';

export interface VariantAudioSpec {
  /** Scale intervals in semitones from the root (e.g. major pentatonic [0,2,4,7,9]). */
  intervals: number[];
  rootMidi: number;
  /** Octaves the degree ladder spans. */
  octaves: number;
  bpm: number;
  pluck: { preset: PluckPreset; volume?: number };
  pad?: { volume?: number; attack?: number; release?: number; voices?: number };
  fx: {
    reverbDecay: number;
    reverbWet: number;
    delayTime?: number;
    delayFeedback?: number;
    delayWet?: number;
    filterBase?: number;
    filterSpan?: number;
    chorus?: boolean;
  };
}

export interface PluckOptions {
  vel?: number;
  dur?: string;
  /** Snap to the next transport subdivision instead of sounding immediately. */
  quantize?: '4n' | '8n' | '8t' | '16n';
  /** Extra seconds added to the trigger time (for strums/arpeggios). */
  delaySec?: number;
}

const PLUCK_SYNTHS: Record<PluckPreset, (t: typeof Tone) => Tone.PolySynth | Tone.PluckSynth> = {
  glass: t =>
    new t.PolySynth(t.FMSynth, {
      harmonicity: 3.01,
      modulationIndex: 6,
      envelope: { attack: 0.002, decay: 0.35, sustain: 0, release: 1.1 },
      modulationEnvelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.4 },
    }),
  kalimba: t =>
    new t.PolySynth(t.FMSynth, {
      harmonicity: 8,
      modulationIndex: 2,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 1.0, sustain: 0, release: 1.4 },
      modulationEnvelope: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.3 },
    }),
  string: t => new t.PluckSynth({ attackNoise: 0.9, dampening: 3200, resonance: 0.96 }),
  bell: t =>
    new t.PolySynth(t.FMSynth, {
      harmonicity: 5.07,
      modulationIndex: 3,
      envelope: { attack: 0.004, decay: 1.6, sustain: 0, release: 2.4 },
      modulationEnvelope: { attack: 0.004, decay: 0.6, sustain: 0, release: 0.8 },
    }),
};

interface PadVoice {
  synth: Tone.Synth;
  slot: number | null;
}

/**
 * Shared per-variant instrument: lazy Tone.js graph with a proven-gentle
 * master chain (chorus -> filter -> delay -> reverb -> limiter). Every note
 * is scale-locked via the spec, so variants can't play a wrong note.
 */
export class VariantAudio {
  ready = false;
  private tone!: typeof Tone;
  private spec: VariantAudioSpec;
  private master!: Tone.Gain;
  private pluckSynth!: Tone.PolySynth | Tone.PluckSynth;
  private padVoices: PadVoice[] = [];
  private nodes: { dispose(): void }[] = [];
  private lastPluckAt = -1;
  private readonly pluckMinInterval = 0.05;
  private scheduled = new Set<string>();

  constructor(spec: VariantAudioSpec) {
    this.spec = spec;
  }

  get degreeCount(): number {
    return this.spec.intervals.length * this.spec.octaves;
  }

  /** Scale-locked midi for a normalized position (0 = lowest degree, 1 = highest). */
  midiAt(pos: number): number {
    const p = pos < 0 ? 0 : pos > 1 ? 1 : pos;
    return this.degree(Math.round(p * (this.degreeCount - 1)));
  }

  /** Scale-locked midi for a degree index; wraps octaves beyond the span. */
  degree(i: number): number {
    const n = this.spec.intervals.length;
    const idx = ((i % this.degreeCount) + this.degreeCount) % this.degreeCount;
    const octave = Math.floor(idx / n);
    return this.spec.rootMidi + octave * 12 + this.spec.intervals[idx % n];
  }

  async init(): Promise<void> {
    if (this.ready) return;
    const t = await import('tone');
    this.tone = t;
    await t.start();

    const { fx, pluck, pad } = this.spec;
    this.master = new t.Gain(0.9);
    const limiter = new t.Limiter(-1);
    const reverb = new t.Reverb({ decay: fx.reverbDecay, preDelay: 0.03, wet: fx.reverbWet });
    await reverb.generate();
    const delay = new t.FeedbackDelay({
      delayTime: fx.delayTime ?? 0.38,
      feedback: fx.delayFeedback ?? 0.3,
      wet: fx.delayWet ?? 0.16,
    });
    const filter = new t.Filter({ type: 'lowpass', frequency: fx.filterBase ?? 1400, Q: 0.5 });
    let head: Tone.ToneAudioNode = filter;
    if (fx.chorus !== false) {
      const chorus = new t.Chorus({ frequency: 0.5, delayTime: 4, depth: 0.35, wet: 0.35 }).start();
      chorus.connect(filter);
      head = chorus;
      this.nodes.push(chorus);
    }
    filter.connect(delay);
    delay.connect(reverb);
    reverb.connect(limiter);
    limiter.connect(this.master);
    this.master.toDestination();
    this.nodes.push(this.master, limiter, reverb, delay, filter);
    this.filterNode = filter;

    this.pluckSynth = PLUCK_SYNTHS[pluck.preset](t);
    this.pluckSynth.volume.value = pluck.volume ?? -12;
    this.pluckSynth.connect(head);
    this.nodes.push(this.pluckSynth);

    const padCount = pad?.voices ?? 8;
    const padBus = new t.Gain(0.5);
    padBus.connect(head);
    this.nodes.push(padBus);
    for (let i = 0; i < padCount; i++) {
      const synth = new t.Synth({
        oscillator: { type: 'sine' },
        envelope: {
          attack: pad?.attack ?? 2.5,
          decay: 1,
          sustain: 0.7,
          release: pad?.release ?? 4,
        },
        volume: pad?.volume ?? -18,
      });
      synth.detune.value = i % 2 === 0 ? 4 : -4;
      synth.connect(padBus);
      this.padVoices.push({ synth, slot: null });
    }

    const transport = t.getTransport();
    transport.bpm.value = this.spec.bpm;
    transport.start();
    this.ready = true;
  }

  private filterNode?: Tone.Filter;

  setVolume(v: number): void {
    if (this.ready) this.master.gain.rampTo(v, 0.2);
  }

  /** Macro brightness control (0 = mellow, 1 = open). */
  setBrightness(pos: number): void {
    if (!this.ready || !this.filterNode) return;
    const { filterBase = 1400, filterSpan = 1800 } = this.spec.fx;
    const p = pos < 0 ? 0 : pos > 1 ? 1 : pos;
    this.filterNode.frequency.rampTo(filterBase * 0.5 + p * filterSpan, 0.5);
  }

  pluck(midi: number, opts: PluckOptions = {}): void {
    if (!this.ready) return;
    const now = this.tone.now();
    if (now - this.lastPluckAt < this.pluckMinInterval && !opts.quantize) return;
    this.lastPluckAt = now;
    let time = now + (opts.delaySec ?? 0);
    if (opts.quantize) {
      time = this.tone.getTransport().nextSubdivision(opts.quantize) + (opts.delaySec ?? 0);
      const key = `${midi}@${time.toFixed(3)}`;
      if (this.scheduled.has(key)) return;
      this.scheduled.add(key);
      if (this.scheduled.size > 64) this.scheduled.clear();
    }
    const freq = this.tone.Frequency(midi, 'midi').toFrequency();
    const vel = opts.vel ?? 0.8;
    if (this.pluckSynth instanceof this.tone.PluckSynth) {
      this.pluckSynth.triggerAttack(freq, time);
    } else {
      this.pluckSynth.triggerAttackRelease(freq, opts.dur ?? '8n', time, vel);
    }
  }

  /** Latch a sustained pad in a numbered slot; pass null midi to release. */
  padSet(slot: number, midi: number | null, vel = 0.6): void {
    if (!this.ready) return;
    const existing = this.padVoices.find(v => v.slot === slot);
    if (midi == null) {
      if (existing) {
        existing.synth.triggerRelease();
        existing.slot = null;
      }
      return;
    }
    const freq = this.tone.Frequency(midi, 'midi').toFrequency();
    if (existing) {
      existing.synth.frequency.rampTo(freq, 0.4);
      return;
    }
    const free = this.padVoices.find(v => v.slot === null);
    if (!free) return;
    free.slot = slot;
    free.synth.triggerAttack(freq, this.tone.now(), vel);
  }

  /** Gentle strummed chord, low->high. */
  bloom(midis: number[], spacingSec = 0.06): void {
    if (!this.ready) return;
    midis.forEach((m, i) => this.pluck(m, { dur: '4n', delaySec: i * spacingSec, vel: 0.7 }));
  }

  dispose(): void {
    if (!this.ready) return;
    this.tone.getTransport().stop();
    for (const v of this.padVoices) v.synth.dispose();
    for (const n of this.nodes) n.dispose();
    this.padVoices = [];
    this.nodes = [];
    this.ready = false;
  }
}
