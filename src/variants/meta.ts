import type { VariantId, VariantMeta } from './types';

declare global {
  interface Window {
    __MOTE_VARIANT__?: string;
  }
}

export const pulse: VariantMeta = {
  id: 'pulse',
  name: 'pulse',
  tagline: 'a synaptic storm that never settles — Brian’s Brain cellular automaton',
  hint: 'drag to spark',
  scheme: 'dark',
  chrome: {
    '--mote-bg': '#050510',
    '--mote-text': '#d9f6ff',
    '--mote-text-dim': '#6d86a8',
    '--mote-text-faint': '#47597a',
    '--mote-border': 'rgba(77,243,255,0.18)',
    '--mote-accent': '#4df3ff',
  },
  font: {
    family: 'Chakra Petch',
    cssStack: "'Chakra Petch', 'Avenir Next', sans-serif",
    googleHref: 'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;600&display=swap',
    wordmarkSpacing: '0.08em',
    wordmarkWeight: 600,
  },
  favicon: '/favicons/pulse.svg',
  og: {
    image: '/og/pulse.png',
    title: 'mote · pulse',
    description:
      'A generative ambient music toy. A neon cellular automaton fires and refracts forever; every spark is a glassy in-key tone.',
    themeColor: '#050510',
  },
};

export const ember: VariantMeta = {
  id: 'ember',
  name: 'ember',
  tagline: 'fireflies drifting into synchrony — pulse-coupled oscillators in a dark meadow',
  hint: 'tap to release a firefly · hold to gather them',
  scheme: 'dark',
  chrome: {
    '--mote-bg': '#0a0f0a',
    '--mote-text': '#f5e6c8',
    '--mote-text-dim': '#9a916f',
    '--mote-text-faint': '#6b6650',
    '--mote-border': 'rgba(255,198,107,0.16)',
    '--mote-accent': '#ffc66b',
  },
  font: {
    family: 'Cormorant Garamond',
    cssStack: "'Cormorant Garamond', Georgia, serif",
    googleHref:
      'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&display=swap',
    wordmarkSpacing: '0.04em',
    wordmarkWeight: 600,
  },
  favicon: '/favicons/ember.svg',
  og: {
    image: '/og/ember.png',
    title: 'mote · ember',
    description:
      'A generative ambient music toy. Fireflies blink their own time until they find each other; every flash is a soft kalimba note.',
    themeColor: '#0a0f0a',
  },
};

export const terrace: VariantMeta = {
  id: 'terrace',
  name: 'terrace',
  tagline: 'sand grains topple into mandalas — the Abelian sandpile at the edge of criticality',
  hint: 'tap to drop sand',
  scheme: 'light',
  chrome: {
    '--mote-bg': '#f4eee2',
    '--mote-text': '#3b3a36',
    '--mote-text-dim': '#8a8474',
    '--mote-text-faint': '#aba793',
    '--mote-border': 'rgba(59,58,54,0.18)',
    '--mote-accent': '#c4643b',
  },
  font: {
    family: 'Shippori Mincho',
    cssStack: "'Shippori Mincho', 'Hiragino Mincho ProN', Georgia, serif",
    googleHref: 'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500&display=swap',
    wordmarkSpacing: '0.1em',
    wordmarkWeight: 500,
  },
  favicon: '/favicons/terrace.svg',
  og: {
    image: '/og/terrace.png',
    title: 'mote · terrace',
    description:
      'A generative ambient music toy. Grains of sand pile and cascade into living mandalas; every avalanche runs a gentle scale.',
    themeColor: '#f4eee2',
  },
};

export const loom: VariantMeta = {
  id: 'loom',
  name: 'loom',
  tagline: 'an elementary cellular automaton woven row by row — the cloth plays itself',
  hint: 'tap a thread to weave it in',
  scheme: 'dark',
  chrome: {
    '--mote-bg': '#1b2340',
    '--mote-text': '#ede4d0',
    '--mote-text-dim': '#8f93ab',
    '--mote-text-faint': '#666c8a',
    '--mote-border': 'rgba(237,228,208,0.16)',
    '--mote-accent': '#e2a93b',
  },
  font: {
    family: 'Zilla Slab',
    cssStack: "'Zilla Slab', 'Iowan Old Style', serif",
    googleHref: 'https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@400;500&display=swap',
    wordmarkSpacing: '0.03em',
    wordmarkWeight: 500,
  },
  favicon: '/favicons/loom.svg',
  og: {
    image: '/og/loom.png',
    title: 'mote · loom',
    description:
      'A generative ambient music toy. Rule 90 and its cousins weave an endless cloth; the newest row is plucked like a music box.',
    themeColor: '#1b2340',
  },
};

export const hypha: VariantMeta = {
  id: 'hypha',
  name: 'hypha',
  tagline: 'a slime-mold network finding its own paths — physarum agents in bioluminescent dark',
  hint: 'tap to drop a nutrient',
  scheme: 'dark',
  chrome: {
    '--mote-bg': '#04070c',
    '--mote-text': '#d2f5ea',
    '--mote-text-dim': '#5f8a80',
    '--mote-text-faint': '#41615c',
    '--mote-border': 'rgba(63,232,200,0.16)',
    '--mote-accent': '#3fe8c8',
  },
  font: {
    family: 'Marcellus',
    cssStack: "'Marcellus', 'Optima', serif",
    googleHref: 'https://fonts.googleapis.com/css2?family=Marcellus&display=swap',
    wordmarkSpacing: '0.12em',
    wordmarkWeight: 400,
  },
  favicon: '/favicons/hypha.svg',
  og: {
    image: '/og/hypha.png',
    title: 'mote · hypha',
    description:
      'A generative ambient music toy. A million-footed mold weaves glowing threads toward food; its network hums slow in-key chords.',
    themeColor: '#04070c',
  },
};

export const VARIANT_LIST: readonly VariantMeta[] = [pulse, ember, terrace, loom, hypha];

function isVariantId(v: unknown): v is VariantId {
  return typeof v === 'string' && VARIANT_LIST.some(m => m.id === v);
}

export function resolveVariantId(search?: string, injected?: string): VariantId {
  const qs = search ?? (typeof location !== 'undefined' ? location.search : '');
  const q = new URLSearchParams(qs).get('variant');
  if (isVariantId(q)) return q;
  const inj = injected ?? (typeof window !== 'undefined' ? window.__MOTE_VARIANT__ : undefined);
  if (isVariantId(inj)) return inj;
  return 'pulse';
}
