import { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { COLORS, GROUPS, SMALL_N, STATUS_GROUP } from './households';
import type { GroupBy, Households } from './households';
import { COMPONENTS, componentMean, density, shareBetween } from './readiness';
import type { ComponentValues } from './readiness';
import { Card, Pills, TipFrame } from './parts';
import { ComponentSwitches } from './ComponentSwitches';

// Distributions: the score as ridgelines (one curve per group), and the score's
// components as parallel lines (one line per group).

const W = 760;
const ALL_GROUPS: GroupBy[] = [...GROUPS, STATUS_GROUP];
const ORDERED = new Set(['income', 'age', 'education']);
const CATEGORICAL = ['#2a78d6', '#eb6834', '#1baf7a', '#8a63d2'];
// Light to dark blues for groups that have a natural order.
const RAMP = scaleLinear<string>().domain([0, 1]).range(['#9cc2f0', '#123f80']);

function colorFor(g: GroupBy, k: number, n: number) {
  if (g.key === 'status') return COLORS.status[g.order[k] as keyof typeof COLORS.status];
  if (ORDERED.has(g.key)) return RAMP(n <= 1 ? 1 : k / (n - 1));
  return CATEGORICAL[k % CATEGORICAL.length];
}

export function Distributions({
  data,
  comps,
  scores,
  active,
  onToggle,
}: {
  data: Households;
  comps: ComponentValues;
  scores: Float32Array;
  active: ReadonlySet<string>;
  onToggle: (k: string) => void;
}) {
  const [groupKey, setGroupKey] = useState('income');
  const [view, setView] = useState('ridge');
  const [hover, setHover] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const group = ALL_GROUPS.find((g) => g.key === groupKey) ?? ALL_GROUPS[0];
  const col = data.col[group.column];

  const stats = useMemo(() => {
    const out = group.order.map((label) => {
      const keep = (i: number) => col[i] === label;
      const d = density(data, scores, keep);
      let n = 0;
      for (let i = 0; i < data.n; i++) if (col[i] === label) n += 1;
      return {
        label,
        n,
        d: d.d,
        mean: d.mean,
        low: shareBetween(data, scores, keep, 0, 40),
        high: shareBetween(data, scores, keep, 70, 101),
        comps: COMPONENTS.map((c) => ({ key: c.key, v: componentMean(data, comps[c.key], keep) })),
      };
    });
    return out.filter((r) => r.n > 0);
  }, [data, scores, comps, group, col]);

  const keys = COMPONENTS.filter((c) => active.has(c.key));
  const toggleLine = (label: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  // ---------- ridgeline geometry ----------
  const RM = { top: 16, right: 150, bottom: 40, left: 150 };
  const ROW = stats.length > 8 ? 36 : 56;
  const OVER = 2.2; // how far a curve may rise above its row
  const RH = RM.top + ROW * stats.length + ROW * (OVER - 1) + RM.bottom;
  const riw = W - RM.left - RM.right;
  const rx = scaleLinear().domain([0, 100]).range([0, riw]);
  // Scale to a typical group's peak so one tall spike (many households scoring
  // exactly 100) does not flatten every other curve; taller curves are cut off.
  const maxima = stats.map((r) => Math.max(...r.d)).sort((a, b) => a - b);
  const peak = Math.max(maxima[Math.floor(maxima.length * 0.5)] ?? 0.001, 0.001) * 1.25;
  const ry = scaleLinear().domain([0, peak]).range([0, ROW * OVER]).clamp(true);

  // ---------- parallel-lines geometry ----------
  const PM = { top: 30, right: 150, bottom: 56, left: 56 };
  const PH = 380;
  const piw = W - PM.left - PM.right;
  const pih = PH - PM.top - PM.bottom;
  const px = scaleLinear().domain([0, Math.max(keys.length - 1, 1)]).range([0, piw]);
  const py = scaleLinear().domain([0, 100]).range([pih, 0]);

  return (
    <Card title="How the score is spread across groups">
      <div className="mb-3">
        <ComponentSwitches active={active} onToggle={onToggle} />
      </div>
      <div className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Group households by</div>
      <Pills
        items={ALL_GROUPS}
        value={groupKey}
        onChange={(k) => {
          setGroupKey(k);
          setHidden(new Set());
        }}
        name="Group by"
      />
      <div className="mt-3 mb-3">
        <Pills
          items={[
            { key: 'ridge', label: 'Score distribution' },
            { key: 'lines', label: 'Components, group by group' },
          ]}
          value={view}
          onChange={setView}
          name="View"
        />
      </div>

      {view === 'ridge' ? (
        <TipFrame>
          {(show, hide) => (
            <svg
              viewBox={`0 0 ${W} ${RH}`}
              width="100%"
              role="img"
              aria-label="Ridgeline plot: one curve per group showing how readiness scores are spread, from 0 to 100."
              onPointerLeave={hide}
            >
              <g transform={`translate(${RM.left},${RM.top + ROW * (OVER - 1)})`}>
                {[0, 20, 40, 60, 80, 100].map((t) => (
                  <g key={t} transform={`translate(${rx(t)},0)`}>
                    <line y2={ROW * stats.length} stroke={COLORS.grid} />
                    <text y={ROW * stats.length + 18} textAnchor="middle" fontSize={12} fill={COLORS.ink2}>
                      {t}
                    </text>
                  </g>
                ))}
                {stats.map((r, k) => {
                  const base = (k + 1) * ROW;
                  const c = colorFor(group, group.order.indexOf(r.label), group.order.length);
                  let line = '';
                  for (let j = 0; j <= 100; j++) line += `${j === 0 ? 'M' : 'L'}${rx(j).toFixed(1)},${(base - ry(r.d[j])).toFixed(1)}`;
                  return (
                    <g key={r.label}>
                      <line x1={0} x2={riw} y1={base} y2={base} stroke={COLORS.grid} />
                      <path d={`${line}L${rx(100)},${base}L${rx(0)},${base}Z`} fill={c} fillOpacity={0.75} />
                      <path d={line} fill="none" stroke={COLORS.surface} strokeWidth={1.5} />
                      <line x1={rx(r.mean)} x2={rx(r.mean)} y1={base - 10} y2={base + 4} stroke={COLORS.ink} strokeWidth={2} />
                      <text x={-12} y={base - 4} textAnchor="end" fontSize={12} fill={COLORS.ink}>
                        {r.label}
                      </text>
                      <text x={riw + 12} y={base - 4} fontSize={12} fill={COLORS.ink2}>
                        avg {r.mean.toFixed(0)}
                        {r.n < SMALL_N ? ' (few)' : ''}
                      </text>
                      <rect
                        x={-RM.left}
                        y={base - ROW}
                        width={W}
                        height={ROW}
                        fill="transparent"
                        onPointerMove={(e) =>
                          show(e, r.label, [
                            `Average score ${r.mean.toFixed(1)}`,
                            `${r.low.toFixed(0)}% score under 40, ${r.high.toFixed(0)}% score 70 or more`,
                            `${r.n.toLocaleString()} households surveyed`,
                          ])
                        }
                      />
                    </g>
                  );
                })}
              </g>
              <text x={W - RM.right} y={RH - 4} textAnchor="end" fontSize={12} fill={COLORS.ink2}>
                Readiness score (0 to 100) →
              </text>
            </svg>
          )}
        </TipFrame>
      ) : (
        <div>
          <div role="group" aria-label="Show or hide groups" className="flex flex-wrap gap-2 mb-2">
            {stats.map((r) => {
              const c = colorFor(group, group.order.indexOf(r.label), group.order.length);
              return (
                <button
                  key={r.label}
                  type="button"
                  aria-pressed={!hidden.has(r.label)}
                  onClick={() => toggleLine(r.label)}
                  onPointerEnter={() => setHover(r.label)}
                  onPointerLeave={() => setHover(null)}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm text-gray-800"
                  style={{ borderColor: c, opacity: hidden.has(r.label) ? 0.4 : 1 }}
                >
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: c }} />
                  {r.label}
                </button>
              );
            })}
          </div>
          <TipFrame>
            {(show, hide) => (
              <svg
                viewBox={`0 0 ${W} ${PH}`}
                width="100%"
                role="img"
                aria-label="One line per group across the score components, showing each group's average on every component."
                onPointerLeave={() => {
                  hide();
                  setHover(null);
                }}
              >
                <g transform={`translate(${PM.left},${PM.top})`}>
                  {[0, 25, 50, 75, 100].map((t) => (
                    <g key={t} transform={`translate(0,${py(t)})`}>
                      <line x2={piw} stroke={COLORS.grid} />
                      <text x={-10} dy="0.32em" textAnchor="end" fontSize={11} fill={COLORS.ink2}>
                        {t}%
                      </text>
                    </g>
                  ))}
                  {keys.map((c, i) => (
                    <g key={c.key} transform={`translate(${px(i)},0)`}>
                      <line y2={pih} stroke={COLORS.muted} />
                      <text y={pih + 20} textAnchor="middle" fontSize={12} fill={COLORS.ink}>
                        {c.label}
                      </text>
                    </g>
                  ))}
                  {stats
                    .filter((r) => !hidden.has(r.label))
                    .map((r) => {
                      const c = colorFor(group, group.order.indexOf(r.label), group.order.length);
                      const pts = keys
                        .map((k, i) => ({ i, v: r.comps.find((x) => x.key === k.key)?.v ?? Number.NaN }))
                        .filter((p) => Number.isFinite(p.v));
                      const dim = hover !== null && hover !== r.label;
                      const d = pts.map((p, j) => `${j === 0 ? 'M' : 'L'}${px(p.i)},${py(p.v)}`).join('');
                      return (
                        <g key={r.label} opacity={dim ? 0.15 : 1}>
                          <path d={d} fill="none" stroke={c} strokeWidth={hover === r.label ? 4 : 2.5} />
                          {pts.map((p) => (
                            <circle key={p.i} cx={px(p.i)} cy={py(p.v)} r={4} fill={c} stroke={COLORS.surface} strokeWidth={2} />
                          ))}
                          {pts.length > 0 && (
                            <text x={piw + 10} y={py(pts[pts.length - 1].v)} dy="0.32em" fontSize={11} fill={COLORS.ink2}>
                              {r.label}
                            </text>
                          )}
                          <path
                            d={d}
                            fill="none"
                            stroke="transparent"
                            strokeWidth={14}
                            onPointerMove={(e) => {
                              setHover(r.label);
                              show(
                                e,
                                r.label,
                                r.comps
                                  .filter((x) => active.has(x.key) && Number.isFinite(x.v))
                                  .map((x) => `${COMPONENTS.find((c2) => c2.key === x.key)?.label}: ${x.v.toFixed(0)}%`),
                              );
                            }}
                          />
                        </g>
                      );
                    })}
                </g>
                <text x={PM.left} y={14} fontSize={12} fill={COLORS.ink2}>
                  ↑ Group average on each component
                </text>
              </svg>
            )}
          </TipFrame>
        </div>
      )}
      <p className="text-xs text-gray-500 mt-2">
        {view === 'ridge'
          ? 'Each curve is a group; the black tick marks its average. Taller means more households at that score. Very tall peaks are cut off.'
          : 'Click a group to hide its line. Hover a line to pick it out.'}
      </p>
    </Card>
  );
}
