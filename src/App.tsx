import { useRef, useState } from 'react';
import { Canvas } from './ui/Canvas';
import { ControlStrip } from './ui/ControlStrip';
import { useMoteApp } from './ui/useMoteApp';
import type { Settings } from './ui/storage';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { app, settings, setSettings, unlocked, unlock } = useMoteApp(canvasRef);
  const [hint, setHint] = useState(true);
  const drag = useRef<{ x: number; y: number; t: number } | null>(null);
  const typed = useRef('');

  async function firstGesture() { if (!unlocked) await unlock(); setHint(false); }

  function onPointerDown(e: React.PointerEvent) { drag.current = { x: e.clientX, y: e.clientY, t: performance.now() }; void firstGesture(); }
  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current; drag.current = null;
    if (e.target !== canvasRef.current) return; // ignore control-strip interactions
    const dtm = d ? Math.max(16, performance.now() - d.t) : 16;
    const vx = d ? ((e.clientX - d.x) / dtm) * 1000 * 0.25 : 0;
    const vy = d ? ((e.clientY - d.y) / dtm) * 1000 * 0.25 : 0;
    app.current?.addMote(e.clientX, e.clientY, vx, vy);
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.repeat) return;
    void firstGesture();
    app.current?.addMote(Math.random() * window.innerWidth, Math.random() * window.innerHeight, 0, 0);
    typed.current = (typed.current + e.key).slice(-4);
    if (typed.current === 'mote') app.current?.bloomAll();
  }

  const patch = (p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p }));

  return (
    <div className="relative h-full w-full" tabIndex={0} onKeyDown={onKeyDown}
      onPointerDown={onPointerDown} onPointerUp={onPointerUp}
      onDoubleClick={(e) => app.current?.bloomAt(e.clientX, e.clientY)}>
      <Canvas canvasRef={canvasRef} />
      {hint && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-sm tracking-widest text-white/30">click anywhere</span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
        <ControlStrip settings={settings} onChange={patch} onClear={() => app.current?.clear()} />
      </div>
    </div>
  );
}
