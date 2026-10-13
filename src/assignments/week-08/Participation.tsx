import { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { STATUSES } from './audit';
import type { Status } from './audit';
import { COLORS, GROUPS, MEASURES, SMALL_N, computeRates, weightedShare } from './households';
import type { Households } from './households';
import { Card, Legend, TipFrame } from './parts';

// Week 8, tab 2: how digital payment tools are used, by banking status and by
// income, age or education. Every rate is weighted with the FDIC household
// weight. Whiskers are approximate 95% ranges (they ignore the survey's
// clustering, so the true ranges are a little wider).

const W = 760;
const M = { top: 12, right: 64, bottom: 40, left: 150 };
const BAND = 64;
const DODGE: Record<Status, number> = { Unbanked: -16, Underbanked: 0, 'Fully Banked': 16 };

const fmt = (n: number) => n.toLocaleString();
const pc = (p: number) => `${(100 * p).toFixed(1)}%`;

function Pills<T extends { key: string; label: string }>({
  items,
  value,
  onChange,
  name,
}: {
  items: T[];
  value: string;
  onChange: (k: string) => void;
  name: string;
}) {
  return (
    <div role="group" aria-label={name} className="flex flex-wrap gap-2">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          aria-pressed={value === it.key}
          onClick={() => onChange(it.key)}
          className={`px-3 py-1 rounded-full text-sm border ${
            value === it.key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Participation({ data }: { data: Households }) {
  const [measureKey, setMeasureKey] = useState('online');
  const [groupKey, setGroupKey] = useState('income');
  const [asTable, setAsTable] = useState(false);

  const measure = MEASURES.find((m) => m.key === measureKey) ?? MEASURES[0];
  const group = GROUPS.find((g) => g.key === groupKey) ?? GROUPS[0];

  const cells = useMemo(() => computeRates(data, measure, group), [data, measure, group]);
  const overall = useMemo(() => {
    const S = data.col.banking_status;
    const out = {} as Record<Status, number | null>;
    for (const s of STATUSES) {
      let any = false;
      const p = weightedShare(
        data,
        (i) => measure.test(data, i) === true,
        (i) => {
          const ok = S[i] === s && measure.test(data, i) !== null;
          if (ok) any = true;
          return ok;
        },
      );
      out[s] = any ? p : null;
    }
    return out;
  }, [data, measure]);

  const groups = group.order.filter((g) => cells.some((c) => c.group === g));
  const statuses = STATUSES.filter((s) => cells.some((c) => c.status === s));
  const H = M.top + groups.length * BAND + M.bottom;
  const iw = W - M.left - M.right;
  const x = scaleLinear().domain([0, 1]).range([0, iw]);

  const hi = overall['Fully Banked'];
  const lowStatus: Status = overall.Unbanked !== null ? 'Unbanked' : 'Underbanked';
  const lo = overall[lowStatus];
  const smallCount = cells.filter((c) => c.small).length;

  return (
    <div>
      <Card title="Who uses digital payment tools?">
        <p className="text-sm text-gray-600 mb-3">
          Each dot is the share of households in a group that use the tool, split by banking status. Pick a tool and a way
          to group households.
        </p>
        <div className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tool</div>
        <Pills items={MEASURES} value={measureKey} onChange={setMeasureKey} name="Payment tool" />
        <div className="mt-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Group households by</div>
        <Pills items={GROUPS} value={groupKey} onChange={setGroupKey} name="Group by" />
        <p className="text-xs text-gray-500 mt-3 mb-3">{measure.detail}.</p>

        {hi !== null && lo !== null && (
          <p className="text-sm text-gray-800 mb-3" aria-live="polite">
            Overall, {hi.toFixed(1)}% of fully banked households {measure.key === 'mobile' ? 'use mobile banking as their main way in' : 'report this'}
            , against {lo.toFixed(1)}% of {lowStatus.toLowerCase()} households.
          </p>
        )}

        <div className="flex items-center justify-between mb-2">
          <Legend
            items={statuses.map((s) => ({ label: s, color: COLORS.status[s] }))}
          />
          <button
            type="button"
            className="text-sm underline text-gray-700"
            onClick={() => setAsTable((v) => !v)}
          >
            {asTable ? 'Show chart' : 'Show as table'}
          </button>
        </div>

        {asTable ? (
          <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="p-2">{group.label}</th>
                  <th className="p-2">Banking status</th>
                  <th className="p-2 text-right">Households surveyed</th>
                  <th className="p-2 text-right">Rate</th>
                  <th className="p-2 text-right">Approx. 95% range</th>
                </tr>
              </thead>
              <tbody>
                {cells.map((c) => (
                  <tr key={`${c.group}|${c.status}`} className="border-b border-gray-100">
                    <td className="p-2">{c.group}</td>
                    <td className="p-2">{c.status}</td>
                    <td className="p-2 text-right">{fmt(c.n)}{c.small ? ' (few)' : ''}</td>
                    <td className="p-2 text-right">{pc(c.p)}</td>
                    <td className="p-2 text-right">{pc(c.lo)} to {pc(c.hi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <TipFrame>
            {(show, hide) => (
              <svg
                viewBox={`0 0 ${W} ${H}`}
                width="100%"
                role="img"
                aria-label={`${measure.label} by ${group.label.toLowerCase()} and banking status. A table view is available.`}
                onPointerLeave={hide}
              >
                <g transform={`translate(${M.left},${M.top})`}>
                  {[0, 0.25, 0.5, 0.75, 1].map((t) => (
                    <g key={t} transform={`translate(${x(t)},0)`}>
                      <line y2={groups.length * BAND} stroke={COLORS.grid} />
                      <text y={groups.length * BAND + 18} textAnchor="middle" fontSize={11} fill={COLORS.ink2}>
                        {100 * t}%
                      </text>
                    </g>
                  ))}
                  {groups.map((g, gi) => {
                    const cy = gi * BAND + BAND / 2;
                    const row = cells.filter((c) => c.group === g);
                    const xs = row.map((c) => x(c.p));
                    return (
                      <g key={g}>
                        <text x={-12} y={cy} dy="0.32em" textAnchor="end" fontSize={12} fill={COLORS.ink}>
                          {g}
                        </text>
                        {row.length > 1 && (
                          <line
                            x1={Math.min(...xs)}
                            x2={Math.max(...xs)}
                            y1={cy}
                            y2={cy}
                            stroke={COLORS.grid}
                            strokeWidth={2}
                          />
                        )}
                        {row.map((c) => {
                          const cyy = cy + DODGE[c.status];
                          const color = COLORS.status[c.status];
                          return (
                            <g key={c.status}>
                              <line x1={x(c.lo)} x2={x(c.hi)} y1={cyy} y2={cyy} stroke={color} strokeWidth={2} opacity={0.5} />
                              <circle
                                cx={x(c.p)}
                                cy={cyy}
                                r={5}
                                fill={c.small ? COLORS.surface : color}
                                stroke={color}
                                strokeWidth={2}
                              />
                              <text x={x(c.hi) + 6} y={cyy} dy="0.32em" fontSize={11} fill={COLORS.ink2}>
                                {(100 * c.p).toFixed(0)}%
                              </text>
                            </g>
                          );
                        })}
                        <rect
                          x={-M.left}
                          y={gi * BAND}
                          width={W}
                          height={BAND}
                          fill="transparent"
                          onPointerMove={(e) =>
                            show(
                              e,
                              g,
                              row.map(
                                (c) =>
                                  `${c.status}: ${pc(c.p)} (${pc(c.lo)} to ${pc(c.hi)}), ${fmt(c.n)} surveyed${c.small ? ', few' : ''}`,
                              ),
                            )
                          }
                        />
                      </g>
                    );
                  })}
                </g>
                <text x={W - M.right} y={H - 4} textAnchor="end" fontSize={12} fill={COLORS.ink2}>
                  Share of households →
                </text>
              </svg>
            )}
          </TipFrame>
        )}
        <p className="text-xs text-gray-500 mt-2">
          Lines show an approximate 95% range. Hollow dots mean fewer than {SMALL_N} surveyed households
          {smallCount > 0 ? ` (${smallCount} here)` : ''}, so treat them as rough. The FDIC survey has no measure of how much
          people pay in cash, so this page shows who has and uses digital tools, not how payments changed over time.
        </p>
      </Card>
    </div>
  );
}
