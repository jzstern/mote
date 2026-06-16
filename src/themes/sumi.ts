import type { Theme } from './types';

export const sumi: Theme = {
  id: 'sumi',
  name: 'sumi-e zen',
  scheme: 'light',
  render: {
    mode: 'ink',
    background: [239, 231, 214],
    fade: 0.5,
    palette: {
      peach: [58, 53, 46],
      gold: [107, 90, 46],
      rose: [140, 59, 59],
      lilac: [63, 58, 85],
      aqua: [60, 90, 82],
      sky: [47, 74, 107],
    },
    ring: { rgb: [34, 31, 28], mode: 'splat' },
    ringOnBounce: true,
  },
  chrome: {
    '--mote-bg': '#efe7d6',
    '--mote-text': '#221f1c',
    '--mote-text-dim': '#5a5550',
    '--mote-text-faint': '#8a847b',
    '--mote-panel': 'rgba(245,240,228,0.65)',
    '--mote-border': 'rgba(34,31,28,0.14)',
    '--mote-accent': '#b5462f',
    '--mote-knob-face': 'radial-gradient(circle at 50% 38%, #efe7d6, #ddd2bb)',
    '--mote-knob-glow': 'rgba(181,70,47,0.20)',
    '--mote-knob-indicator': '#221f1c',
    '--mote-control-bg': 'rgba(34,31,28,0.05)',
    '--mote-control-active': 'rgba(34,31,28,0.10)',
  },
  copy: { hint: 'touch the paper' },
  font: {
    family: 'Shippori Mincho',
    cssStack: "'Shippori Mincho', Georgia, serif",
    googleHref: 'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;700&display=swap',
    wordmarkSpacing: '0.08em',
    wordmarkWeight: 500,
  },
  favicon: '/favicons/sumi.svg',
  og: {
    image: '/og/sumi.png',
    title: 'mote · sumi-e zen',
    description:
      'A generative ambient music toy. Touch rice paper and ink blooms spread, sounding soft in-key tones that evolve forever and never quite repeat.',
    themeColor: '#efe7d6',
  },
};
