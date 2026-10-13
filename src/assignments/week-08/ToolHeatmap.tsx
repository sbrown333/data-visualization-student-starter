import { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { STATUSES } from './audit';
import type { Status } from './audit';
import { COLORS, GROUPS, MEASURES, SMALL_N, computeMatrix } from './households';
import type { Households } from './households';
import { Card, Pills, TipFrame } from './parts';

// Tool heatmap: rows are groups, columns are payment tools, colour is the share
// of households using the tool. A banking-status filter narrows who is counted.

const W = 760;
const M = { top: 54, right: 16, bottom: 12, left: 150 };
const COLOR = scaleLinear<string>().domain([0, 1]).range(['#eaf1fb', '#1b4f9c']).clamp(true);

export function ToolHeatmap({ data }: { data: Households }) {
  const [groupKey, setGroupKey] = useState('income');
  const [statusKey, setStatusKey] = useState('all');
  const [asTable, setAsTable] = useState(false);
  const group = GROUPS.find((g) => g.key === groupKey) ?? GROUPS[0];
  const status: Status | null = statusKey === 'all' ? null : (statusKey as Status);

  const cells = useMemo(() => computeMatrix(data, group, MEASURES, status), [data, group, status]);
  const rows = group.order.filter((g) => cells.some((c) => c.group === g));
  const CW = (W - M.left - M.right) / MEASURES.length;
  const CH = 40;
  const H = M.top + rows.length * CH + M.bottom;
  const get = (g: string, m: string) => cells.find((c) => c.group === g && c.measure === m);

  return (
    <Card title="Which tools do different groups use?">
      <div className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Group households by</div>
      <Pills items={GROUPS} value={groupKey} onChange={setGroupKey} name="Group by" />
      <div className="mt-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Count only</div>
      <Pills
        items={[{ key: 'all', label: 'All households' }, ...STATUSES.map((s) => ({ key: s, label: s }))]}
        value={statusKey}
        onChange={setStatusKey}
        name="Banking status filter"
      />
      <div className="flex items-center justify-between mt-3 mb-2">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>0%</span>
          <div className="h-3 w-40 rounded-full" style={{ background: 'linear-gradient(to right, #eaf1fb, #1b4f9c)' }} />
          <span>100% of households use it</span>
        </div>
        <button type="button" className="text-sm underline text-gray-700" onClick={() => setAsTable((v) => !v)}>
          {asTable ? 'Show chart' : 'Show as table'}
        </button>
      </div>

      {asTable ? (
        <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="p-2">{group.label}</th>
                {MEASURES.map((m) => (
                  <th key={m.key} className="p-2 text-right">
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g} className="border-b border-gray-100">
                  <td className="p-2">{g}</td>
                  {MEASURES.map((m) => {
                    const c = get(g, m.key);
                    return (
                      <td key={m.key} className="p-2 text-right">
                        {c ? `${(100 * c.p).toFixed(1)}%${c.small ? ' (few)' : ''}` : 'n/a'}
                      </td>
                    );
                  })}
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
              aria-label="Heatmap of the share of households using each payment tool, by group. A table view is available."
              onPointerLeave={hide}
            >
              {MEASURES.map((m, j) => (
                <text
                  key={m.key}
                  transform={`translate(${M.left + j * CW + CW / 2},${M.top - 8})`}
                  textAnchor="middle"
                  fontSize={12}
                  fill={COLORS.ink}
                >
                  {m.label.split(' ').length > 2 ? m.label.replace(' services', '') : m.label}
                </text>
              ))}
              {rows.map((g, i) => (
                <g key={g}>
                  <text x={M.left - 10} y={M.top + i * CH + CH / 2} dy="0.32em" textAnchor="end" fontSize={12} fill={COLORS.ink}>
                    {g}
                  </text>
                  {MEASURES.map((m, j) => {
                    const c = get(g, m.key);
                    const x = M.left + j * CW;
                    const y = M.top + i * CH;
                    if (!c) {
                      return (
                        <g key={m.key}>
                          <rect x={x + 1.5} y={y + 1.5} width={CW - 3} height={CH - 3} rx={4} fill={COLORS.track} />
                          <text x={x + CW / 2} y={y + CH / 2} dy="0.32em" textAnchor="middle" fontSize={11} fill={COLORS.ink2}>
                            n/a
                          </text>
                        </g>
                      );
                    }
                    const dark = c.p > 0.55;
                    return (
                      <g key={m.key}>
                        <rect
                          x={x + 1.5}
                          y={y + 1.5}
                          width={CW - 3}
                          height={CH - 3}
                          rx={4}
                          fill={COLOR(c.p)}
                          stroke={c.small ? COLORS.ink2 : 'none'}
                          strokeDasharray={c.small ? '3 2' : undefined}
                        />
                        <text
                          x={x + CW / 2}
                          y={y + CH / 2}
                          dy="0.32em"
                          textAnchor="middle"
                          fontSize={12}
                          fill={dark ? '#ffffff' : COLORS.ink}
                        >
                          {(100 * c.p).toFixed(0)}%
                        </text>
                        <rect
                          x={x}
                          y={y}
                          width={CW}
                          height={CH}
                          fill="transparent"
                          onPointerMove={(e) =>
                            show(e, `${(100 * c.p).toFixed(1)}%`, [
                              `${g}: ${m.label}`,
                              `Approx. 95% range ${(100 * c.lo).toFixed(1)}% to ${(100 * c.hi).toFixed(1)}%`,
                              `${c.n.toLocaleString()} households surveyed${c.small ? ' (few, rough)' : ''}`,
                            ])
                          }
                        />
                      </g>
                    );
                  })}
                </g>
              ))}
            </svg>
          )}
        </TipFrame>
      )}
      <p className="text-xs text-gray-500 mt-2">
        {status === 'Unbanked'
          ? 'Mobile banking does not apply to households with no account.'
          : `Dashed cells have fewer than ${SMALL_N} surveyed households.`}
      </p>
    </Card>
  );
}
