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
