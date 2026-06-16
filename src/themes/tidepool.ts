import type { Theme } from './types';

export const tidepool: Theme = {
  id: 'tidepool',
  name: 'tide pool',
  scheme: 'dark',
  render: {
    mode: 'glow',
    background: [4, 33, 42],
    fade: 0.14,
    palette: {
      peach: [255, 196, 140],
      gold: [255, 224, 150],
      rose: [120, 200, 255],
      lilac: [182, 163, 255],
      aqua: [105, 230, 208],
      sky: [127, 208, 255],
    },
    ring: { rgb: [150, 225, 235], mode: 'expand' },
    ringOnBounce: true,
  },
  chrome: {
    '--mote-bg': '#04212a',
    '--mote-text': '#d6fbf3',
    '--mote-text-dim': '#8fc9c2',
    '--mote-text-faint': '#5c8a86',
    '--mote-panel': 'rgba(6,40,46,0.55)',
    '--mote-border': 'rgba(150,225,220,0.14)',
    '--mote-accent': '#69e6d0',
    '--mote-knob-face': 'radial-gradient(circle at 50% 38%, #0c3a40, #062227)',
    '--mote-knob-glow': 'rgba(105,230,208,0.28)',
    '--mote-knob-indicator': '#d6fbf3',
    '--mote-control-bg': 'rgba(150,225,220,0.06)',
    '--mote-control-active': 'rgba(150,225,220,0.12)',
  },
  copy: { hint: 'drop a light' },
  font: {
    family: 'Quicksand',
    cssStack: "'Quicksand', system-ui, sans-serif",
    googleHref: 'https://fonts.googleapis.com/css2?family=Quicksand:wght@500;600&display=swap',
    wordmarkSpacing: '0.15em',
    wordmarkWeight: 600,
  },
  favicon: '/favicons/tidepool.svg',
  og: {
    image: '/og/tidepool.png',
    title: 'mote · tide pool',
    description:
      'A generative ambient music toy. Drop glowing plankton into deep water; every drift and bounce sounds soft in-key tones that evolve forever.',
    themeColor: '#04212a',
  },
};
