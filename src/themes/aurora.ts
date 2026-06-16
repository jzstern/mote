import type { Theme } from './types';

export const aurora: Theme = {
  id: 'aurora',
  name: 'nocturne aurora',
  scheme: 'dark',
  render: {
    mode: 'glow',
    background: [11, 10, 20],
    fade: 0.1,
    palette: {
      peach: [255, 183, 138],
      gold: [255, 214, 140],
      rose: [255, 150, 170],
      lilac: [190, 170, 255],
      aqua: [150, 225, 220],
      sky: [150, 190, 255],
    },
    ring: { rgb: [255, 240, 220], mode: 'expand' },
    ringOnBounce: false,
  },
  chrome: {
    '--mote-bg': '#0b0a14',
    '--mote-text': '#efe9fb',
    '--mote-text-dim': '#b9b2cf',
    '--mote-text-faint': '#7d7796',
    '--mote-panel': 'rgba(20,17,30,0.6)',
    '--mote-border': 'rgba(255,255,255,0.10)',
    '--mote-accent': '#ffb78a',
    '--mote-knob-face': 'radial-gradient(circle at 50% 38%, #2a2640, #15121f)',
    '--mote-knob-glow': 'rgba(190,170,255,0.25)',
    '--mote-knob-indicator': '#f3eefe',
    '--mote-control-bg': 'rgba(255,255,255,0.05)',
    '--mote-control-active': 'rgba(255,255,255,0.10)',
  },
  copy: { hint: 'click anywhere' },
  font: {
    family: 'Space Grotesk',
    cssStack: "'Space Grotesk', system-ui, sans-serif",
    googleHref: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500&display=swap',
    wordmarkSpacing: '0.3em',
    wordmarkWeight: 500,
  },
  favicon: '/favicons/aurora.svg',
  og: {
    image: '/og/aurora.png',
    title: 'mote · nocturne aurora',
    description:
      'A generative ambient music toy. Scatter glowing motes across a midnight field; soft in-key pads drift and evolve forever, never quite repeating.',
    themeColor: '#0b0a14',
  },
};
