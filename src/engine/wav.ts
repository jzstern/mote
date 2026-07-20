const HEADER_BYTES = 44;
const INT16_MAX = 0x7fff;
const INT16_MIN_MAG = 0x8000;

export function floatToInt16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    out[i] = Math.round(s < 0 ? s * INT16_MIN_MAG : s * INT16_MAX);
  }
  return out;
}

export function interleave(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  if (channels.length === 1) return channels[0];
  const frames = channels[0].length;
  const chCount = channels.length;
  const out = new Float32Array(frames * chCount);
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < chCount; c++) out[i * chCount + c] = channels[c][i];
  }
  return out;
}

export function encodeWavBuffer(pcm: Int16Array, sampleRate: number, channels: number): ArrayBuffer {
  const dataBytes = pcm.length * 2;
  const buffer = new ArrayBuffer(HEADER_BYTES + dataBytes);
  const view = new DataView(buffer);
  const writeString = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < pcm.length; i++) view.setInt16(HEADER_BYTES + i * 2, pcm[i], true);

  return buffer;
}

export function encodeWav(pcm: Int16Array, sampleRate: number, channels: number): Blob {
  return new Blob([encodeWavBuffer(pcm, sampleRate, channels)], { type: 'audio/wav' });
}
