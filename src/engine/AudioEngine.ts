import type * as Tone from 'tone';
import type { KnobValues, Mode, Mood, MusicalEvent } from './types';
import { pitchFor } from './scale';
import { Recorder, type CaptureContext, type RecorderOptions } from './Recorder';

interface PadVoice { synth: Tone.Synth; particleId: number | null; startedAt: number; }

export class AudioEngine {
  private ready = false;
  private mode: Mode = 'both';
  private mood: Mood = 'warm';
  private height = 1;
  private lastReverbWet = 0.5;
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
  private tone!: typeof import('tone');
  private recorder: Recorder | null = null;

  async init() {
    if (this.ready) return;
    this.tone = await import('tone');
    await this.tone.start();
    this.master = new this.tone.Gain(0.9);
    this.limiter = new this.tone.Limiter(-1);
    this.reverb = new this.tone.Reverb({ decay: 9, preDelay: 0.03, wet: 0.5 });
    await this.reverb.generate();
    this.delay = new this.tone.FeedbackDelay({ delayTime: 0.38, feedback: 0.32, wet: 0.18 });
    this.chorus = new this.tone.Chorus({ frequency: 0.6, delayTime: 4, depth: 0.4, wet: 0.4 }).start();
    this.filter = new this.tone.Filter({ type: 'lowpass', frequency: 1200, Q: 0.6 });
    this.lfo = new this.tone.LFO({ frequency: 0.05, min: 700, max: 1500 }).start();
    this.lfo.connect(this.filter.frequency);

    this.padBus = new this.tone.Gain(0.5);
    this.pluck = new this.tone.PolySynth(this.tone.FMSynth, {
      harmonicity: 2, modulationIndex: 4,
      envelope: { attack: 0.005, decay: 0.5, sustain: 0, release: 1.2 },
      volume: -11,
    });

    this.padBus.connect(this.chorus);
    this.pluck.connect(this.chorus);
    this.chorus.connect(this.filter);
    this.filter.connect(this.delay);
    this.delay.connect(this.reverb);
    this.reverb.connect(this.limiter);
    this.limiter.connect(this.master);
    this.master.toDestination();

    this.transport = this.tone.getTransport();
    this.transport.bpm.value = 70;
    this.transport.start();

    for (let i = 0; i < this.PAD_VOICES; i++) {
      const synth = new this.tone.Synth({
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
    if (k.space != null) { this.lastReverbWet = 0.15 + k.space * 0.65; this.reverb.wet.rampTo(this.lastReverbWet, 0.3); }
    if (k.echo != null) { this.delay.wet.rampTo(k.echo * 0.5, 0.3); this.delay.feedback.rampTo(0.15 + k.echo * 0.45, 0.3); }
    if (k.tone != null) { const f = 400 + k.tone * 2600; this.lfo.min = Math.max(250, f * 0.6); this.lfo.max = f; }
    if (k.speed != null) this.transport.bpm.rampTo(40 + k.speed * 80, 0.3);
  }

  setVolume(v: number) { if (this.ready) this.master.gain.rampTo(v, 0.2); }

  shimmer() {
    if (!this.ready) return;
    this.reverb.wet.rampTo(0.9, 0.3);
    setTimeout(() => { if (this.ready) this.reverb.wet.rampTo(this.lastReverbWet, 1.5); }, 700);
  }

  handle(events: MusicalEvent[]) {
    if (!this.ready) return;
    const now = this.tone.now();
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
  private freq(midi: number) { return this.tone.Frequency(midi, 'midi').toFrequency(); }

  private allocatePad(e: MusicalEvent) {
    let v = this.padVoices.find(v => v.particleId === null);
    if (!v) { v = this.padVoices.reduce((a, b) => (a.startedAt <= b.startedAt ? a : b)); v.synth.triggerRelease(); }
    v.particleId = e.particleId; v.startedAt = this.tone.now();
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

  get canRecord() { return this.ready; }
  get isRecording() { return this.recorder?.isRecording ?? false; }
  get recordingSeconds() { return this.recorder?.seconds ?? 0; }

  async startRecording(opts: RecorderOptions) {
    if (!this.ready) throw new Error('audio not ready');
    if (this.recorder?.isRecording) return;
    const recorder = new Recorder(this.tone.getContext() as unknown as CaptureContext, this.master);
    this.recorder = recorder;
    try {
      await recorder.start(opts);
    } catch (err) {
      recorder.dispose();
      if (this.recorder === recorder) this.recorder = null;
      throw err;
    }
  }

  async stopRecording(): Promise<Blob | null> {
    const recorder = this.recorder;
    if (!recorder) return null;
    const blob = await recorder.stop();
    recorder.dispose();
    if (this.recorder === recorder) this.recorder = null;
    return blob;
  }

  dispose() {
    this.recorder?.dispose();
    this.recorder = null;
    this.transport?.stop();
    [this.padBus, this.master, this.limiter, this.reverb, this.delay, this.chorus, this.filter, this.lfo, this.pluck]
      .forEach(n => n?.dispose?.());
    this.padVoices.forEach(v => v.synth.dispose());
    this.ready = false;
  }
}
