import { floatToInt16, interleave, encodeWav } from './wav';

interface AudioSource {
  connect(destination: AudioNode): unknown;
  disconnect(destination: AudioNode): unknown;
}

/**
 * Minimal slice of Tone's Context. Tone builds its graph inside a
 * `standardized-audio-context` wrapper, so worklet nodes must be created via
 * these Tone-provided factories — the global `AudioWorkletNode` constructor and
 * `createScriptProcessor` both reject the wrapped context.
 */
export interface CaptureContext {
  readonly rawContext: { readonly sampleRate: number; readonly destination: AudioNode };
  addAudioWorkletModule(url: string): Promise<void>;
  createAudioWorkletNode(name: string): AudioWorkletNode;
}

export interface RecorderOptions {
  maxSeconds: number;
  onAutoStop: () => void;
}

const RENDER_QUANTUM = 128;
const DEFAULT_CHANNELS = 2;

const WORKLET_NAME = 'mote-recorder';
// A silent upstream makes Chrome hand `process` a zero-channel input; emit an
// explicit block of zeros in that case so recorded silence keeps real-time
// duration instead of being dropped.
const WORKLET_SOURCE = `
class MoteRecorder extends AudioWorkletProcessor {
  constructor() { super(); this._chans = ${DEFAULT_CHANNELS}; }
  process(inputs) {
    const input = inputs[0];
    if (input && input.length) {
      this._chans = input.length;
      this.port.postMessage(input.map((ch) => ch.slice()));
    } else {
      const silent = [];
      for (let c = 0; c < this._chans; c++) silent.push(new Float32Array(${RENDER_QUANTUM}));
      this.port.postMessage(silent);
    }
    return true;
  }
}
registerProcessor('${WORKLET_NAME}', MoteRecorder);
`;

const moduleReady = new WeakSet<CaptureContext>();

async function ensureWorklet(context: CaptureContext): Promise<void> {
  if (moduleReady.has(context)) return;
  const url = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'application/javascript' }));
  try {
    await context.addAudioWorkletModule(url);
    moduleReady.add(context);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Taps a live audio node and captures it to a WAV blob in real time. Each block
 * is converted to 16-bit PCM on arrival so peak memory stays near the final file
 * size rather than double it.
 */
export class Recorder {
  private node: AudioWorkletNode | null = null;
  private chunks: Int16Array[] = [];
  private channels = 2;
  private frames = 0;
  private maxFrames = 0;
  private recording = false;
  private onCap: (() => void) | null = null;

  constructor(
    private readonly context: CaptureContext,
    private readonly source: AudioSource,
  ) {}

  get seconds(): number {
    return this.frames / this.context.rawContext.sampleRate;
  }

  get isRecording(): boolean {
    return this.recording;
  }

  async start(opts: RecorderOptions): Promise<void> {
    this.maxFrames = Math.floor(opts.maxSeconds * this.context.rawContext.sampleRate);
    this.onCap = opts.onAutoStop;
    this.chunks = [];
    this.frames = 0;
    this.recording = true;

    await ensureWorklet(this.context);
    if (!this.recording) return; // disposed mid-setup

    const node = this.context.createAudioWorkletNode(WORKLET_NAME);
    node.port.onmessage = (e: MessageEvent<Float32Array[]>) => this.appendBlock(e.data);
    this.node = node;

    this.source.connect(node);
    node.connect(this.context.rawContext.destination);
  }

  /** Stop capturing and encode everything collected into a WAV blob. */
  stop(): Blob | null {
    this.stopCapture();
    if (this.chunks.length === 0) return null;
    const total = this.chunks.reduce((n, c) => n + c.length, 0);
    const pcm = new Int16Array(total);
    let offset = 0;
    for (const chunk of this.chunks) {
      pcm.set(chunk, offset);
      offset += chunk.length;
    }
    this.chunks = [];
    return encodeWav(pcm, this.context.rawContext.sampleRate, this.channels);
  }

  dispose(): void {
    this.stopCapture();
    this.chunks = [];
    this.node = null;
  }

  private appendBlock(channels: Float32Array[]): void {
    if (!this.recording || channels.length === 0) return;
    this.channels = channels.length;
    this.chunks.push(floatToInt16(interleave(channels)));
    this.frames += channels[0].length;
    if (this.maxFrames > 0 && this.frames >= this.maxFrames) {
      this.stopCapture();
      const cap = this.onCap;
      this.onCap = null;
      cap?.();
    }
  }

  private stopCapture(): void {
    if (!this.recording) return;
    this.recording = false;
    if (!this.node) return;
    this.node.port.onmessage = null;
    try {
      this.source.disconnect(this.node);
    } catch {
      /* already disconnected */
    }
    try {
      this.node.disconnect();
    } catch {
      /* already disconnected */
    }
  }
}
