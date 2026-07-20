import { useCallback, useEffect, useRef, useState } from 'react';
import { MoteApp } from '../engine/MoteApp';
import { loadSettings, saveSettings, type Settings } from './storage';
import { downloadBlob, recordingFilename } from './download';

export const RECORD_MAX_SECONDS = 5 * 60;

export function useMoteApp(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const appRef = useRef<MoteApp | null>(null);
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [unlocked, setUnlocked] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const startingRecording = useRef(false);

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

  // the engine's frame count is the source of truth; React just samples it
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setRecordingSeconds(appRef.current?.recordingSeconds ?? 0), 250);
    return () => clearInterval(id);
  }, [recording]);

  const finishRecording = useCallback(async () => {
    const app = appRef.current;
    const blob = app ? await app.stopRecording() : null;
    setRecording(false);
    setRecordingSeconds(0);
    if (blob) downloadBlob(blob, recordingFilename(new Date()));
  }, []);

  const toggleRecording = useCallback(async () => {
    const app = appRef.current;
    if (!app || !unlocked || startingRecording.current) return;
    if (app.isRecording) { await finishRecording(); return; }
    startingRecording.current = true;
    try {
      await app.startRecording({ maxSeconds: RECORD_MAX_SECONDS, onAutoStop: finishRecording });
      setRecordingSeconds(0);
      setRecording(app.isRecording);
    } catch (err) {
      console.error('recording failed to start', err);
      setRecording(false);
    } finally {
      startingRecording.current = false;
    }
  }, [unlocked, finishRecording]);

  return {
    app: appRef, settings, setSettings, unlocked, unlock,
    recording, recordingSeconds, recordMaxSeconds: RECORD_MAX_SECONDS, toggleRecording,
  };
}
