import { useRef } from 'react';

export function Knob({ label, value, onChange, glow }: {
  label: string; value: number; onChange: (v: number) => void; glow: string;
}) {
  const start = useRef<{ y: number; v: number } | null>(null);
  const angle = -135 + value * 270;

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    start.current = { y: e.clientY, v: value };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!start.current) return;
    const dv = (start.current.y - e.clientY) / 180; // 180px = full sweep
    onChange(Math.max(0, Math.min(1, start.current.v + dv)));
  }
  function onPointerUp() { start.current = null; }

  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      <div
        role="slider" aria-label={label} aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}
        tabIndex={0} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') onChange(Math.min(1, value + 0.05));
          if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') onChange(Math.max(0, value - 0.05));
        }}
        className="relative h-9 w-9 rounded-full border border-white/15 touch-none"
        style={{ background: 'radial-gradient(circle at 50% 38%, #2a2640, #15121f)', boxShadow: `0 0 16px ${glow}` }}
      >
        <span className="absolute left-1/2 top-1.5 h-2.5 w-0.5 rounded bg-[#f3eefe]"
          style={{ transform: `translateX(-50%) rotate(${angle}deg)`, transformOrigin: '50% 12px' }} />
      </div>
      <span className="text-[11px] tracking-wide text-[#7d7796]">{label}</span>
    </div>
  );
}
