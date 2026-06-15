import { useEffect, useRef, useState } from 'react';
import { MoteApp } from '../engine/MoteApp';
import { loadSettings, saveSettings, type Settings } from './storage';

export function useMoteApp(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const appRef = useRef<MoteApp | null>(null);
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const app = new MoteApp(canvasRef.current, { reducedMotion: reduced });
    appRef.current = app;
    app.start(); // visuals run immediately; audio waits for unlock
    const onResize = () => app.resize();
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); app.dispose(); appRef.current = null; };
  }, [canvasRef]);

  // push settings to engine + persist
  useEffect(() => {
    const app = appRef.current; if (!app) return;
    app.setMode(settings.mode); app.setMood(settings.mood);
    app.setKnob(settings.knobs); app.setVolume(settings.volume); app.setSpores(settings.spores);
    saveSettings(settings);
  }, [settings]);

  async function unlock() {
    if (unlocked || !appRef.current) return;
    await appRef.current.unlockAudio();
    appRef.current.setMode(settings.mode); appRef.current.setMood(settings.mood);
    appRef.current.setKnob(settings.knobs); appRef.current.setVolume(settings.volume);
    setUnlocked(true);
  }

  return { app: appRef, settings, setSettings, unlocked, unlock };
}
