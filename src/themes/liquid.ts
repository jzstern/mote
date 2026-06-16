import type { Theme } from './types';

export const liquid: Theme = {
  id: 'liquid',
  name: 'liquid light',
  scheme: 'dark',
  render: {
    mode: 'shader',
    background: [8, 6, 16],
    fade: 1,
    shader: { maxMotes: 64 },
    palette: {
      peach: [255, 140, 90],
      gold: [255, 210, 120],
      rose: [255, 70, 160],
      lilac: [150, 80, 255],
      aqua: [30, 235, 205],
      sky: [70, 150, 255],
    },
    ring: { rgb: [255, 255, 255], mode: 'none' },
    ringOnBounce: false,
  },
  chrome: {
    '--mote-bg': '#080610',
    '--mote-text': '#e8eaff',
    '--mote-text-dim': '#9aa0c8',
    '--mote-text-faint': '#5c6088',
    '--mote-panel': 'rgba(16,12,28,0.55)',
    '--mote-border': 'rgba(150,140,255,0.16)',
    '--mote-accent': '#2fe8cd',
    '--mote-knob-face': 'radial-gradient(circle at 50% 38%, #1a1430, #0c0a18)',
    '--mote-knob-glow': 'rgba(47,232,205,0.30)',
    '--mote-knob-indicator': '#eef0ff',
    '--mote-control-bg': 'rgba(255,255,255,0.05)',
    '--mote-control-active': 'rgba(150,140,255,0.16)',
  },
  copy: { hint: 'spill some light' },
  font: {
    family: 'Sora',
    cssStack: "'Sora', system-ui, sans-serif",
    googleHref: 'https://fonts.googleapis.com/css2?family=Sora:wght@400;500&display=swap',
    wordmarkSpacing: '0.18em',
    wordmarkWeight: 500,
  },
  favicon: '/favicons/liquid.svg',
  og: {
    image: '/og/liquid.png',
    title: 'mote · liquid light',
    description:
      'A generative ambient music toy. Motes melt into a flowing field of liquid light; soft in-key tones evolve forever and never quite repeat.',
    themeColor: '#080610',
  },
};
