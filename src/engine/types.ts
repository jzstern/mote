export type Vec2 = { x: number; y: number };
export type VoiceType = 'peach' | 'gold' | 'rose' | 'lilac' | 'aqua' | 'sky';
export type Mode = 'pads' | 'plucks' | 'both';
export type Mood = 'warm' | 'dream' | 'dusk' | 'mist';
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

export interface KnobValues { space: number; echo: number; tone: number; drift: number; speed: number; }
