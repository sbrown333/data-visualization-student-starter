import { useState } from 'react';
import type { ReactNode } from 'react';
import { scaleLinear } from 'd3-scale';
import { COLORS } from './households';

// Chart pieces shared by the two Week 8 tabs: a tooltip frame, a bar split into
// segments, and grouped horizontal bars. Same look as the Week 7 charts.

const W = 760;
const BAR_H = 24;
const GAP = 2;

interface Tip {
  x: number;
  y: number;
  head: string;
  lines: string[];
}

export type ShowTip = (e: React.PointerEvent, head: string, lines: string[]) => void;

// Wraps a chart, owns the hover tooltip, and hands `show` and `hide` to the chart.
export function TipFrame({ children }: { children: (show: ShowTip, hide: () => void) => ReactNode }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const show: ShowTip = (e, head, lines) => {
    const wrap = (e.currentTarget as Element).closest('[data-tipwrap]');
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, head, lines });
  };
  return (
    <div data-tipwrap className="relative border border-gray-200 rounded-xl p-3 bg-white">
      {children(show, () => setTip(null))}
      {tip && (
        <div
          className="absolute pointer-events-none bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg z-10"
          style={{ left: tip.x + 14, top: tip.y + 10 }}
        >
          <div className="text-sm font-semibold">{tip.head}</div>
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

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">{title}</h2>
      {children}
    </section>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700 mb-2">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

// ---------- a bar split into segments ----------

export interface Seg {
  key: string;
  value: number;
  color: string;
  head: string;
  lines: string[];
}

export function SegBar({
  x0,
  y,
  w,
  segs,
  clipId,
  show,
}: {
  x0: number;
  y: number;
  w: number;
  segs: Seg[];
  clipId: string;
  show: ShowTip;
}) {
  const sum = segs.reduce((a, s) => a + s.value, 0);
  const widths = segs.map((s) => (sum > 0 ? (s.value / sum) * w : 0));
  const starts: number[] = [];
  let cursor = x0;
  for (const sw of widths) {
    starts.push(cursor);
    cursor += sw;
  }
  const laid = segs.map((s, i) => ({ ...s, x: starts[i], w: widths[i] })).filter((s) => s.w > 0);

  return (
    <g>
      <clipPath id={clipId}>
        <rect x={x0} y={y} width={w} height={BAR_H} rx={4} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        {laid.map((s, k) => {
          const first = k === 0;
          const last = k === laid.length - 1;
          const gx = s.x + (first ? 0 : GAP / 2);
          const gw = s.w - (first ? 0 : GAP / 2) - (last ? 0 : GAP / 2);
          if (gw <= 0) return null;
          return <rect key={s.key} x={gx} y={y} width={gw} height={BAR_H} fill={s.color} />;
        })}
      </g>
      {laid.map((s) => {
        const hitW = Math.max(s.w, 20);
        return (
          <rect
            key={`hit-${s.key}`}
            x={s.x + s.w / 2 - hitW / 2}
            y={y - 4}
            width={hitW}
            height={BAR_H + 8}
            fill="transparent"
            onPointerMove={(e) => show(e, s.head, s.lines)}
          />
        );
      })}
    </g>
  );
}

// ---------- grouped horizontal bars ----------

export interface HBar {
  label: string;
  value: number;
  color: string;
  lines: string[];
}
export interface HGroup {
  title: string;
  bars: HBar[];
}

const GROUP_HEAD = 22;
const ROW = 24;
const HBAR_H = 16;
const GROUP_GAP = 14;

function rightRounded(x: number, y: number, w: number, h: number, r0: number) {
  const r = Math.min(r0, w / 2, h / 2);
  return `M${x},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x} Z`;
}

export function HBars({
  groups,
  max,
  ticks,
  labelW,
  ariaLabel,
}: {
  groups: HGroup[];
  max: number;
  ticks: number[];
  labelW: number;
  ariaLabel: string;
}) {
  const plotW = W - labelW - 64;
  const x = scaleLinear().domain([0, max]).range([0, plotW]);

  const tops: number[] = [];
  let acc = 6;
  for (const g of groups) {
    tops.push(acc);
    acc += GROUP_HEAD + g.bars.length * ROW + GROUP_GAP;
  }
  const bottom = acc - GROUP_GAP;
  const H = bottom + 26;

  return (
    <TipFrame>
      {(show, hide) => (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={ariaLabel} onPointerLeave={hide}>
          {ticks.map((t) => (
            <g key={t} transform={`translate(${labelW + x(t)},0)`}>
              <line y1={0} y2={bottom} stroke={COLORS.grid} strokeWidth={1} />
              <text y={bottom + 18} textAnchor="middle" fontSize={11} fill={COLORS.ink2}>
                {t}%
              </text>
            </g>
          ))}
          {groups.map((g, gi) => {
            const top = tops[gi];
            return (
              <g key={g.title}>
                <text x={0} y={top + 14} fontSize={12} fontWeight={600} fill={COLORS.ink}>
                  {g.title}
                </text>
                {g.bars.map((b, bi) => {
                  const y = top + GROUP_HEAD + bi * ROW;
                  const w = Math.max(x(b.value), 0);
                  return (
                    <g key={b.label}>
                      <text x={0} y={y + 12} fontSize={12} fill={COLORS.ink2}>
                        {b.label}
                      </text>
                      {w > 0 && <path d={rightRounded(labelW, y, w, HBAR_H, 4)} fill={b.color} />}
                      <text x={labelW + w + 8} y={y + 12} fontSize={12} fill={COLORS.ink}>
                        {b.value.toFixed(1)}%
                      </text>
                      <rect
                        x={0}
                        y={y - 4}
                        width={W}
                        height={ROW}
                        fill="transparent"
                        onPointerMove={(e) => show(e, `${b.value.toFixed(1)}%`, [b.label, ...b.lines])}
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      )}
    </TipFrame>
  );
}
