import { useState } from 'react';
import type { ReactNode } from 'react';

// A borderless tooltip frame for the dashboard panels. Same idea as TipFrame in Week 8
// (the chart calls `show` on pointer move and `hide` on leave), but it fills its parent
// so the panel can decide the size and the border.

interface Tip {
  x: number;
  y: number;
  head: string;
  lines: string[];
}

export type ShowTip = (e: React.PointerEvent, head: string, lines: string[]) => void;

export function Tip({
  children,
  className = '',
}: {
  children: (show: ShowTip, hide: () => void) => ReactNode;
  className?: string;
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const show: ShowTip = (e, head, lines) => {
    const wrap = (e.currentTarget as Element).closest('[data-tipwrap]');
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, head, lines });
  };
  return (
    <div data-tipwrap className={`relative ${className}`}>
      {children(show, () => setTip(null))}
      {tip && (
        <div
          className="absolute pointer-events-none text-white text-xs rounded-lg px-3 py-2 shadow-lg z-30"
          style={{ left: tip.x + 14, top: tip.y + 10, background: '#37424f' }}
        >
          <div className="text-sm font-bold">{tip.head}</div>
          {tip.lines.map((l, k) => (
            <div key={k} className="text-gray-300">
              {l}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
