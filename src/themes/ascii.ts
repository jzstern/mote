import type { Theme } from './types';

export const ascii: Theme = {
  id: 'ascii',
  name: 'ascii',
  scheme: 'dark',
  render: {
    mode: 'ascii',
    background: [6, 8, 13],
    fade: 1,
    ascii: { cell: 13 },
    palette: {
      peach: [255, 170, 90],
      gold: [240, 230, 120],
      rose: [255, 120, 200],
      lilac: [170, 130, 255],
      aqua: [110, 255, 180],
      sky: [120, 190, 255],
    },
    ring: { rgb: [124, 255, 178], mode: 'none' },
    ringOnBounce: false,
  },
  chrome: {
    '--mote-bg': '#06080d',
    '--mote-text': '#d6e8df',
    '--mote-text-dim': '#7f9a8b',
    '--mote-text-faint': '#4d6357',
    '--mote-panel': 'rgba(10,16,14,0.6)',
    '--mote-border': 'rgba(124,255,178,0.16)',
    '--mote-accent': '#7cffb2',
    '--mote-knob-face': 'radial-gradient(circle at 50% 38%, #11201a, #06080d)',
    '--mote-knob-glow': 'rgba(124,255,178,0.26)',
    '--mote-knob-indicator': '#d6e8df',
    '--mote-control-bg': 'rgba(124,255,178,0.06)',
    '--mote-control-active': 'rgba(124,255,178,0.14)',
  },
  copy: { hint: 'press any key' },
  font: {
    family: 'IBM Plex Mono',
    cssStack: "'IBM Plex Mono', ui-monospace, monospace",
    googleHref: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap',
    wordmarkSpacing: '0.12em',
    wordmarkWeight: 500,
  },
  favicon: '/favicons/ascii.svg',
  og: {
    image: '/og/ascii.png',
    title: 'mote · ascii',
    description:
      'A generative ambient music toy. The field resolves into drifting ASCII glyphs; soft in-key tones evolve forever and never quite repeat.',
    themeColor: '#06080d',
  },
};
