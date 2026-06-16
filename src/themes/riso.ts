import type { Theme } from './types';

export const riso: Theme = {
  id: 'riso',
  name: 'risograph mono',
  scheme: 'light',
  render: {
    mode: 'halftone',
    background: [243, 239, 228],
    fade: 1,
    duotone: [
      [255, 79, 157],
      [47, 109, 240],
    ],
    palette: {
      peach: [255, 79, 157],
      gold: [47, 109, 240],
      rose: [255, 79, 157],
      lilac: [47, 109, 240],
      aqua: [47, 109, 240],
      sky: [255, 79, 157],
    },
    ring: { rgb: [31, 29, 26], mode: 'expand' },
    ringOnBounce: false,
  },
  chrome: {
    '--mote-bg': '#f3efe4',
    '--mote-text': '#1f1d1a',
    '--mote-text-dim': '#57534c',
    '--mote-text-faint': '#8a857c',
    '--mote-panel': 'rgba(243,239,228,0.7)',
    '--mote-border': 'rgba(31,29,26,0.18)',
    '--mote-accent': '#ff4f9d',
    '--mote-knob-face': 'radial-gradient(circle at 50% 38%, #f3efe4, #e4dccb)',
    '--mote-knob-glow': 'rgba(47,109,240,0.20)',
    '--mote-knob-indicator': '#1f1d1a',
    '--mote-control-bg': 'rgba(31,29,26,0.06)',
    '--mote-control-active': 'rgba(31,29,26,0.12)',
  },
  copy: { hint: 'press to print' },
  font: {
    family: 'Space Mono',
    cssStack: "'Space Mono', ui-monospace, monospace",
    googleHref: 'https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap',
    wordmarkSpacing: '0.1em',
    wordmarkWeight: 400,
  },
  favicon: '/favicons/riso.svg',
  og: {
    image: '/og/riso.png',
    title: 'mote · risograph mono',
    description:
      'A generative ambient music toy. Print drifting two-ink dots on paper; each bounce sounds soft in-key tones that evolve forever and never quite repeat.',
    themeColor: '#f3efe4',
  },
};
