import type { Theme } from './types';

const AMBER: [number, number, number] = [255, 176, 0];

export const terminal: Theme = {
  id: 'terminal',
  name: 'terminal',
  scheme: 'dark',
  chromeVariant: 'terminal',
  render: {
    mode: 'ascii',
    background: [10, 7, 2],
    fade: 1,
    ascii: { cell: 14, mono: AMBER },
    palette: {
      peach: AMBER,
      gold: AMBER,
      rose: AMBER,
      lilac: AMBER,
      aqua: AMBER,
      sky: AMBER,
    },
    ring: { rgb: AMBER, mode: 'none' },
    ringOnBounce: false,
  },
  chrome: {
    '--mote-bg': '#0a0702',
    '--mote-text': '#ffb000',
    '--mote-text-dim': '#b07700',
    '--mote-text-faint': '#7a5200',
    '--mote-panel': 'rgba(18,12,2,0.78)',
    '--mote-border': '#5a3d00',
    '--mote-accent': '#ffb000',
    '--mote-knob-face': 'radial-gradient(circle at 50% 38%, #241800, #0a0702)',
    '--mote-knob-glow': 'rgba(255,176,0,0.30)',
    '--mote-knob-indicator': '#ffd479',
    '--mote-control-bg': 'rgba(255,176,0,0.08)',
    '--mote-control-active': 'rgba(255,176,0,0.18)',
    '--mote-radius': '3px',
    '--mote-radius-box': '2px',
  },
  copy: { hint: 'AWAIT INPUT_' },
  font: {
    family: 'VT323',
    cssStack: "'VT323', 'IBM Plex Mono', monospace",
    googleHref: 'https://fonts.googleapis.com/css2?family=VT323&display=swap',
    wordmarkSpacing: '0.08em',
    wordmarkWeight: 400,
  },
  favicon: '/favicons/terminal.svg',
  og: {
    image: '/og/terminal.png',
    title: 'mote · terminal',
    description:
      'A generative ambient music toy as a government/sci-fi console. Amber phosphor, scanlines, ASCII field; soft in-key tones evolve forever.',
    themeColor: '#0a0702',
  },
};
