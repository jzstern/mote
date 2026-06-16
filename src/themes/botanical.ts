import type { Theme } from './types';

export const botanical: Theme = {
  id: 'botanical',
  name: 'botanical',
  scheme: 'dark',
  render: {
    mode: 'glow',
    background: [14, 26, 16],
    fade: 0.16,
    fuzz: true,
    palette: {
      peach: [224, 213, 106],
      gold: [255, 216, 107],
      rose: [255, 158, 192],
      lilac: [198, 176, 235],
      aqua: [155, 224, 160],
      sky: [206, 224, 120],
    },
    ring: { rgb: [210, 235, 190], mode: 'expand' },
    ringOnBounce: false,
  },
  chrome: {
    '--mote-bg': '#0e1a10',
    '--mote-text': '#dff0c4',
    '--mote-text-dim': '#9bb589',
    '--mote-text-faint': '#6c8060',
    '--mote-panel': 'rgba(16,30,18,0.6)',
    '--mote-border': 'rgba(206,224,120,0.14)',
    '--mote-accent': '#cfe06a',
    '--mote-knob-face': 'radial-gradient(circle at 50% 38%, #1c2e1e, #0e1a10)',
    '--mote-knob-glow': 'rgba(206,224,120,0.25)',
    '--mote-knob-indicator': '#eef7d8',
    '--mote-control-bg': 'rgba(206,224,120,0.06)',
    '--mote-control-active': 'rgba(206,224,120,0.12)',
  },
  copy: { hint: 'plant a mote' },
  font: {
    family: 'Fraunces',
    cssStack: "'Fraunces', Georgia, serif",
    googleHref:
      'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500&display=swap',
    wordmarkSpacing: '0.02em',
    wordmarkWeight: 500,
  },
  favicon: '/favicons/botanical.svg',
  og: {
    image: '/og/botanical.png',
    title: 'mote · botanical',
    description:
      'A generative ambient music toy. Plant glowing pollen on a dark garden; it drifts and seeds itself, sounding soft in-key tones that evolve forever.',
    themeColor: '#0e1a10',
  },
};
