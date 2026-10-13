import { useEffect, useMemo, useRef, useState } from 'react';
import { select } from 'd3-selection';
import { scaleLinear } from 'd3-scale';
import { brush as d3Brush } from 'd3-brush';
import type { BrushBehavior, D3BrushEvent } from 'd3-brush';
import { COLORS, SMALL_N } from './households';
import type { Households } from './households';
import { ageBinLabel, ageBinOf, AGE_BINS, COMPONENTS, INCOME_ORDER, componentMean, density } from './readiness';
import type { ComponentValues } from './readiness';
import { Card, TipFrame } from './parts';
import { localPoint } from './svgPoint';
import type { ShowTip } from './parts';
import { ComponentSwitches } from './ComponentSwitches';

// Readiness explorer: an age x income heatmap of the readiness score. Drag a box
// on it (linked brushing, as in Week 7) and the curve and the dumbbell chart
// compare the selected households with everyone.

const W = 760;
const M = { top: 22, right: 24, bottom: 50, left: 92 };
const NX = AGE_BINS.length;
const NY = INCOME_ORDER.length;
const CW = (W - M.left - M.right) / NX;
const CH = 21;
const IW = CW * NX;
const IH = CH * NY;
const H = M.top + IH + M.bottom;

interface Cell {
  id: number;
  xb: number; // age bin
  yb: number; // income bracket index (0 = lowest)
  n: number;
  w: number; // weighted households
  mean: number; // weighted mean score
}

const px = (xb: number) => xb * CW;
const py = (yb: number) => (NY - 1 - yb) * CH;

const HEAT = scaleLinear<string>().range(['#eaf1fb', '#1b4f9c']).clamp(true);

function Curve({
  all,
  sel,
  show,
  hide,
}: {
  all: { d: Float64Array; mean: number };
  sel: { d: Float64Array; mean: number; n: number } | null;
  show: ShowTip;
  hide: () => void;
}) {
  const CM = { top: 18, right: 24, bottom: 40, left: 40 };
  const CHh = 220;
  const iw = W - CM.left - CM.right;
  const ih = CHh - CM.top - CM.bottom;
  const x = scaleLinear().domain([0, 100]).range([0, iw]);
  const peak = Math.max(...all.d, ...(sel ? sel.d : [0]), 0.001);
  const y = scaleLinear().domain([0, peak * 1.1]).range([ih, 0]);
  const path = (d: Float64Array, close: boolean) => {
    let s = '';
    for (let j = 0; j <= 100; j++) s += `${j === 0 ? 'M' : 'L'}${x(j).toFixed(1)},${y(d[j]).toFixed(1)}`;
    return close ? `${s}L${x(100)},${ih}L${x(0)},${ih}Z` : s;
  };
  return (
    <svg
      viewBox={`0 0 ${W} ${CHh}`}
      width="100%"
      role="img"
      aria-label="Distribution of readiness scores for all households and for the selected households."
      onPointerLeave={hide}
    >
      <g transform={`translate(${CM.left},${CM.top})`}>
        {[0, 20, 40, 60, 80, 100].map((t) => (
          <g key={t} transform={`translate(${x(t)},0)`}>
            <line y2={ih} stroke={COLORS.grid} />
            <text y={ih + 18} textAnchor="middle" fontSize={12} fill={COLORS.ink2}>
              {t}
            </text>
          </g>
        ))}
        <line x2={iw} y1={ih} y2={ih} stroke={COLORS.muted} />
        <path d={path(all.d, true)} fill={COLORS.muted} fillOpacity={0.35} />
        <path d={path(all.d, false)} fill="none" stroke="#7d7c76" strokeWidth={2} />
        {sel && (
          <>
            <path d={path(sel.d, true)} fill={COLORS.accent} fillOpacity={0.3} />
            <path d={path(sel.d, false)} fill="none" stroke={COLORS.accent} strokeWidth={2} />
          </>
        )}
        {[{ m: all.mean, c: '#7d7c76', l: 'All' }, ...(sel ? [{ m: sel.mean, c: COLORS.accent, l: 'Selected' }] : [])].map(
          (k) => (
            <g key={k.l} transform={`translate(${x(k.m)},0)`}>
              <line y2={ih} stroke={k.c} strokeWidth={1.5} strokeDasharray="4 3" />
              <circle cy={0} r={4} fill={k.c} stroke={COLORS.surface} strokeWidth={2} />
            </g>
          ),
        )}
        <rect
          width={iw}
          height={ih}
          fill="transparent"
          onPointerMove={(e) =>
            show(e, 'Average readiness score', [
              `All households: ${all.mean.toFixed(1)}`,
              ...(sel ? [`Selected: ${sel.mean.toFixed(1)}`] : []),
            ])
          }
        />
      </g>
      <text x={W - CM.right} y={CHh - 4} textAnchor="end" fontSize={12} fill={COLORS.ink2}>
        Readiness score (0 to 100) →
      </text>
      <text x={CM.left} y={11} fontSize={12} fill={COLORS.ink2}>
        ↑ Share of households. Dots mark each average.
      </text>
    </svg>
  );
}

function Dumbbells({
  rows,
  hasSel,
  show,
  hide,
}: {
  rows: { key: string; label: string; all: number; sel: number }[];
  hasSel: boolean;
  show: ShowTip;
  hide: () => void;
}) {
  const DM = { top: 20, right: 40, bottom: 34, left: 130 };
  const RH = 30;
  const DH = DM.top + rows.length * RH + DM.bottom;
  const iw = W - DM.left - DM.right;
  const x = scaleLinear().domain([0, 100]).range([0, iw]);
  return (
    <svg
      viewBox={`0 0 ${W} ${DH}`}
      width="100%"
      role="img"
      aria-label="Average of each score component for all households and for the selected households."
      onPointerLeave={hide}
    >
      <g transform={`translate(${DM.left},${DM.top})`}>
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t} transform={`translate(${x(t)},0)`}>
            <line y2={rows.length * RH} stroke={COLORS.grid} />
            <text y={rows.length * RH + 18} textAnchor="middle" fontSize={11} fill={COLORS.ink2}>
              {t}%
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const cy = i * RH + RH / 2;
          return (
            <g key={r.key}>
              <text x={-12} y={cy} dy="0.32em" textAnchor="end" fontSize={12} fill={COLORS.ink}>
                {r.label}
              </text>
              {hasSel && Number.isFinite(r.sel) && Number.isFinite(r.all) && (
                <line x1={x(r.all)} x2={x(r.sel)} y1={cy} y2={cy} stroke={COLORS.muted} strokeWidth={3} />
              )}
              {Number.isFinite(r.all) && (
                <circle cx={x(r.all)} cy={cy} r={6} fill="#7d7c76" stroke={COLORS.surface} strokeWidth={2} />
              )}
              {hasSel && Number.isFinite(r.sel) && (
                <circle cx={x(r.sel)} cy={cy} r={6} fill={COLORS.accent} stroke={COLORS.surface} strokeWidth={2} />
              )}
              <rect
                x={-DM.left}
                y={i * RH}
                width={W}
                height={RH}
                fill="transparent"
                onPointerMove={(e) =>
                  show(e, r.label, [
                    `All households: ${Number.isFinite(r.all) ? r.all.toFixed(1) : 'n/a'}%`,
                    ...(hasSel ? [`Selected: ${Number.isFinite(r.sel) ? r.sel.toFixed(1) : 'n/a'}%`] : []),
                  ])
                }
              />
            </g>
          );
        })}
      </g>
      <text x={W - DM.right} y={DH - 4} textAnchor="end" fontSize={12} fill={COLORS.ink2}>
        Average component score →
      </text>
    </svg>
  );
}

export function Explorer({
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
  const [selected, setSelected] = useState<Set<number> | null>(null);
  const [asTable, setAsTable] = useState(false);
  const brushRef = useRef<SVGGElement | null>(null);
  const behaviorRef = useRef<BrushBehavior<unknown> | null>(null);

  // One heatmap cell per age bin and income bracket.
  const { cells, cellOf } = useMemo(() => {
    const incomeIndex = new Map(INCOME_ORDER.map((l, k) => [l, k]));
    const acc = new Map<number, { n: number; w: number; ws: number }>();
    const of = new Int32Array(data.n).fill(-1);
    for (let i = 0; i < data.n; i++) {
      const yb = incomeIndex.get(data.col.income_bracket[i]);
      if (yb === undefined) continue;
      const id = ageBinOf(Number(data.col.age[i])) * NY + yb;
      of[i] = id;
      const s = scores[i];
      if (Number.isNaN(s)) continue;
      const a = acc.get(id) ?? { n: 0, w: 0, ws: 0 };
      a.n += 1;
      a.w += data.w[i];
      a.ws += data.w[i] * s;
      acc.set(id, a);
    }
    const list: Cell[] = [];
    for (const [id, a] of acc) list.push({ id, xb: Math.floor(id / NY), yb: id % NY, n: a.n, w: a.w, mean: a.ws / a.w });
    return { cells: list, cellOf: of };
  }, [data, scores]);

  const byId = useMemo(() => new Map(cells.map((c) => [c.id, c])), [cells]);
  const [lo, hi] = useMemo(() => {
    const m = cells.filter((c) => c.n >= SMALL_N).map((c) => c.mean);
    return [Math.min(...m), Math.max(...m)];
  }, [cells]);
  const heat = useMemo(() => HEAT.copy().domain([lo, hi]), [lo, hi]);

  // d3-brush owns the drag box; React owns everything else.
  useEffect(() => {
    const g = brushRef.current;
    if (!g) return;
    const behavior = d3Brush()
      .extent([
        [0, 0],
        [IW, IH],
      ])
      .on('start brush end', (event: D3BrushEvent<unknown>) => {
        const box = event.selection as [[number, number], [number, number]] | null;
        if (!box) {
          setSelected(null);
          return;
        }
        const [[x0, y0], [x1, y1]] = box;
        const picked = new Set<number>();
        for (const c of cells) {
          const cx = px(c.xb) + CW / 2;
          const cy = py(c.yb) + CH / 2;
          if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) picked.add(c.id);
        }
        setSelected(picked);
      });
    behaviorRef.current = behavior;
    const sel = select(g);
    sel.call(behavior);
    return () => {
      sel.on('.brush', null);
      sel.selectAll('*').remove();
      behaviorRef.current = null;
    };
  }, [cells]);

  function clearSelection() {
    const g = brushRef.current;
    const b = behaviorRef.current;
    if (g && b) select(g).call(b.move, null);
  }
  function applyBox(a0: number, a1: number, i0: number, i1: number) {
    const g = brushRef.current;
    const b = behaviorRef.current;
    if (!g || !b) return;
    select(g).call(b.move, [
      [px(a0), py(i1)],
      [px(a1 + 1), py(i0 - 1)],
    ]);
  }
  const presets = [
    { label: 'Under 35, income under $30k', box: [0, 3, 0, 7] as const },
    { label: '65 and over', box: [10, 13, 0, 15] as const },
    { label: 'Income $100k or more', box: [0, 13, 14, 15] as const },
    { label: '65 and over, income under $30k', box: [10, 13, 0, 7] as const },
  ];

  const inSel = useMemo(() => {
    if (!selected) return null;
    return (i: number) => cellOf[i] >= 0 && selected.has(cellOf[i]);
  }, [selected, cellOf]);

  const all = useMemo(() => density(data, scores, () => true), [data, scores]);
  const sel = useMemo(() => (inSel ? density(data, scores, inSel) : null), [data, scores, inSel]);
  const hasSel = sel !== null && sel.n > 0;

  const rows = useMemo(
    () =>
      COMPONENTS.filter((c) => active.has(c.key)).map((c) => ({
        key: c.key,
        label: c.label,
        all: componentMean(data, comps[c.key], () => true),
        sel: inSel ? componentMean(data, comps[c.key], inSel) : Number.NaN,
      })),
    [data, comps, active, inSel],
  );

  const selSummary = useMemo(() => {
    if (!selected || selected.size === 0) return null;
    let a0 = 99;
    let a1 = -1;
    let i0 = 99;
    let i1 = -1;
    selected.forEach((id) => {
      const c = byId.get(id);
      if (!c) return;
      a0 = Math.min(a0, c.xb);
      a1 = Math.max(a1, c.xb);
      i0 = Math.min(i0, c.yb);
      i1 = Math.max(i1, c.yb);
    });
    const ageText = `ages ${AGE_BINS[a0]} to ${a1 === NX - 1 ? '85' : AGE_BINS[a1] + 4}`;
    const incText = `income ${INCOME_ORDER[i0]} to ${INCOME_ORDER[i1]}`;
    return `${ageText}, ${incText}`;
  }, [selected, byId]);

  return (
    <div>
      <Card title="Digital Payment Readiness Score">
        <p className="text-sm text-gray-600 mb-3">
          A 0 to 100 score I built for each household from the components switched on below. It is my own index, not an
          official measure.
        </p>
        <ComponentSwitches active={active} onToggle={onToggle} />
      </Card>

      <Card title="Where readiness is high and low">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3">
          <span className="text-sm text-gray-500">Try a selection:</span>
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyBox(p.box[0], p.box[1], p.box[2], p.box[3])}
              className="px-3 py-1 rounded-full border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
            >
              {p.label}
            </button>
          ))}
        </div>
        <TipFrame>
          {(show, hide) => (
            <svg
              viewBox={`0 0 ${W} ${H}`}
              width="100%"
              role="img"
              aria-label="Heatmap of the average readiness score by age group and household income. Drag to select cells."
              onPointerLeave={hide}
            >
              <g
                transform={`translate(${M.left},${M.top})`}
                onPointerMove={(e) => {
                  const p = localPoint(e, e.currentTarget);
                  if (!p) return;
                  const xb = Math.floor(p[0] / CW);
                  const yb = NY - 1 - Math.floor(p[1] / CH);
                  const c = xb >= 0 && xb < NX && yb >= 0 && yb < NY ? byId.get(xb * NY + yb) : undefined;
                  if (!c) return hide();
                  show(e, `Score ${c.mean.toFixed(1)}`, [
                    `Age ${ageBinLabel(c.xb)}, income ${INCOME_ORDER[c.yb]}`,
                    `${c.n.toLocaleString()} households surveyed${c.n < SMALL_N ? ' (few, rough)' : ''}`,
                    `about ${Math.round(c.w / 1000).toLocaleString()} thousand households`,
                  ]);
                }}
              >
                {cells.map((c) => {
                  const few = c.n < SMALL_N;
                  const inBox = !selected || selected.has(c.id);
                  return (
                    <rect
                      key={c.id}
                      x={px(c.xb) + 1}
                      y={py(c.yb) + 1}
                      width={CW - 2}
                      height={CH - 2}
                      rx={3}
                      fill={few ? COLORS.surface : heat(c.mean)}
                      stroke={few ? COLORS.muted : 'none'}
                      strokeDasharray={few ? '3 2' : undefined}
                      opacity={inBox ? 1 : 0.25}
                    />
                  );
                })}
                {AGE_BINS.map((_, b) => (
                  <text key={b} x={px(b) + CW / 2} y={IH + 18} textAnchor="middle" fontSize={11} fill={COLORS.ink2}>
                    {ageBinLabel(b)}
                  </text>
                ))}
                {INCOME_ORDER.map((l, k) => (
                  <text key={l} x={-8} y={py(k) + CH / 2} dy="0.32em" textAnchor="end" fontSize={11} fill={COLORS.ink2}>
                    {l}
                  </text>
                ))}
                <g ref={brushRef} />
              </g>
              <text x={M.left} y={12} fontSize={12} fill={COLORS.ink2}>
                ↑ Household income
              </text>
              <text x={W - M.right} y={H - 6} textAnchor="end" fontSize={12} fill={COLORS.ink2}>
                Age of householder (years) →
              </text>
            </svg>
          )}
        </TipFrame>
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
          <span>{lo.toFixed(0)}</span>
          <div className="h-3 w-40 rounded-full" style={{ background: `linear-gradient(to right, #eaf1fb, #1b4f9c)` }} />
          <span>{hi.toFixed(0)} average score. Dashed cells have fewer than {SMALL_N} surveyed households.</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 my-4 min-h-8">
          <p className="text-sm text-gray-700" aria-live="polite">
            {hasSel && sel ? (
              <>
                <span className="font-semibold text-gray-900">{sel.n.toLocaleString()}</span> surveyed households selected (
                {selSummary}). Their average score is{' '}
                <span className="font-semibold text-gray-900">{sel.mean.toFixed(1)}</span> against {all.mean.toFixed(1)} overall.
                {sel.n < SMALL_N && <span className="text-amber-700"> Few households, so treat this as rough.</span>}
              </>
            ) : selected ? (
              'No cells in that box. Try a larger one.'
            ) : (
              'Drag a box on the heatmap to select households.'
            )}
          </p>
          {selected && (
            <button
              type="button"
              onClick={clearSelection}
              className="px-3 py-1 rounded-full border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
            >
              Clear selection
            </button>
          )}
        </div>

        <div className="flex gap-4 text-sm text-gray-700 mb-2">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: '#7d7c76' }} />
            All households
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.accent }} />
            Selected
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <TipFrame>{(show, hide) => <Curve all={all} sel={hasSel ? sel : null} show={show} hide={hide} />}</TipFrame>
          <TipFrame>
            {(show, hide) => <Dumbbells rows={rows} hasSel={hasSel} show={show} hide={hide} />}
          </TipFrame>
        </div>
        <button type="button" className="text-sm underline text-gray-700 mt-3" onClick={() => setAsTable((v) => !v)}>
          {asTable ? 'Hide table' : 'View as a table'}
        </button>
        {asTable && (
          <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white mt-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="p-2">Component</th>
                  <th className="p-2 text-right">All households</th>
                  <th className="p-2 text-right">Selected</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-b border-gray-100">
                    <td className="p-2">{r.label}</td>
                    <td className="p-2 text-right">{Number.isFinite(r.all) ? `${r.all.toFixed(1)}%` : 'n/a'}</td>
                    <td className="p-2 text-right">{hasSel && Number.isFinite(r.sel) ? `${r.sel.toFixed(1)}%` : 'none'}</td>
                  </tr>
                ))}
                <tr>
                  <td className="p-2 font-semibold">Readiness score</td>
                  <td className="p-2 text-right font-semibold">{all.mean.toFixed(1)}</td>
                  <td className="p-2 text-right font-semibold">{hasSel && sel ? sel.mean.toFixed(1) : 'none'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
