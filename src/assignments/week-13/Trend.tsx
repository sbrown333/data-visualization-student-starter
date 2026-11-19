import { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { GROUPS } from '../week-08/households';
import { Tip } from '../week-11/tip';
import { REGIONS, TREND_MEASURES } from './trends';
import type { TrendRow } from './trends';

// Over-time view: pick a measure and a way of grouping, and see one line per group across
// the survey years. It uses the pre-computed trends file, so it shows one grouping at a
// time and is not narrowed by the other filters. Groups picked on the dashboard are
// drawn thicker, and states clicked on the map can be compared directly.

const INK = '#37424f';
const GRID = '#dde3e8';
const SERIES = ['#3a6a92', '#c0803a', '#3f9e8f', '#a8384f', '#6b7b3a', '#7b8794'];
const W = 760;
const H = 440;
const M = { l: 52, r: 170, t: 16, b: 34 };

const DIMS = [
  { key: 'all', label: 'Everyone' },
  ...GROUPS.map((g) => ({ key: g.key, label: g.label })),
  { key: 'region', label: 'Region' },
  { key: 'state', label: 'States I clicked on the map' },
];

const pct = (v: number) => `${(100 * v).toFixed(1)}%`;

// Break a line where a survey did not ask the question (a gap of more than one wave).
function splitSegments(points: TrendRow[]): TrendRow[][] {
  const segments: TrendRow[][] = [];
  for (const p of points) {
    const last = segments.length - 1;
    if (last >= 0 && p.year - segments[last][segments[last].length - 1].year <= 2) segments[last] = [...segments[last], p];
    else segments.push([p]);
  }
  return segments;
}

interface Series {
  name: string;
  points: TrendRow[];
  color: string;
  dashed: boolean;
}

export function TrendPanel({
  rows,
  states,
  filters,
  names,
}: {
  rows: TrendRow[];
  states: ReadonlySet<string>;
  filters: Record<string, string | null>;
  names: Map<string, string>;
}) {
  const [measure, setMeasure] = useState('unbanked');
  const [dim, setDim] = useState('income');
  const [hoverYear, setHoverYear] = useState<number | null>(null);
  const meas = TREND_MEASURES.find((m) => m.key === measure) ?? TREND_MEASURES[0];
  const stateMode = dim === 'state';
  // Per-state rates are only built for the unbanked rate (the other questions have too few households per state).
  const stateOk = measure === 'unbanked';

  const index = useMemo(() => {
    const m = new Map<string, TrendRow[]>();
    for (const r of rows) {
      const k = `${r.measure}|${r.dimension}|${r.group}`;
      const list = m.get(k);
      if (list) list.push(r);
      else m.set(k, [r]);
    }
    for (const list of m.values()) list.sort((a, b) => a.year - b.year);
    return m;
  }, [rows]);

  const series = useMemo(() => {
    const get = (dimension: string, group: string) => index.get(`${measure}|${dimension}|${group}`) ?? [];
    const out: Series[] = [];
    let names2: string[] = [];
    if (dim === 'all') names2 = [];
    else if (dim === 'region') names2 = REGIONS;
    else if (dim === 'state') names2 = stateOk ? [...states].sort().slice(0, 6) : [];
    else names2 = GROUPS.find((g) => g.key === dim)?.order ?? [];
    names2.forEach((g, i) => {
      const points = get(dim, g);
      if (points.length) out.push({ name: g, points, color: SERIES[i % SERIES.length], dashed: false });
    });
    const all = get('all', 'All households');
    if (all.length) out.push({ name: 'All households', points: all, color: INK, dashed: dim !== 'all' });
    return out;
  }, [index, measure, dim, states, stateOk]);

  const allSeries = series.find((s) => s.name === 'All households');
  const chosen = dim === 'all' || dim === 'state' || dim === 'region' ? null : filters[dim] ?? null;
  const years = allSeries ? allSeries.points.map((p) => p.year) : [];
  const x = scaleLinear().domain([2009, 2023]).range([M.l, W - M.r]);
  const top = Math.max(0.02, ...series.flatMap((s) => s.points.map((p) => p.rate))) * 1.12;
  const y = scaleLinear().domain([0, top]).range([H - M.b, M.t]).nice();

  // Line ends get a direct label; spread them out so they do not overlap.
  const labels = useMemo(() => {
    const ends = series.map((s) => ({ s, y: y(s.points[s.points.length - 1].rate) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 16) ends[i].y = ends[i - 1].y + 16;
    return ends;
  }, [series, y]);

  const first = allSeries?.points[0];
  const last = allSeries?.points[allSeries.points.length - 1];
  const chosenSeries = chosen ? series.find((s) => s.name === chosen) : undefined;
  let finding = '';
  if (first && last) {
    finding = `${meas.label} for all households: ${pct(first.rate)} in ${first.year} to ${pct(last.rate)} in ${last.year}.`;
    if (chosenSeries) {
      const a = chosenSeries.points[0];
      const b = chosenSeries.points[chosenSeries.points.length - 1];
      finding += ` For ${chosen}: ${pct(a.rate)} to ${pct(b.rate)}.`;
    }
  }

  const select = 'rounded-lg px-2 py-1 text-sm font-semibold';
  const selectStyle = { background: '#fafbfc', color: INK, border: `2px solid ${INK}` };

  return (
    <div className="flex flex-col gap-2 flex-1 min-h-0">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-[11px] font-bold flex flex-col">
          Measure
          <select className={`mt-0.5 ${select}`} style={selectStyle} value={measure} onChange={(e) => setMeasure(e.target.value)}>
            {TREND_MEASURES.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] font-bold flex flex-col">
          Compare
          <select className={`mt-0.5 ${select}`} style={selectStyle} value={dim} onChange={(e) => setDim(e.target.value)}>
            {DIMS.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs font-semibold flex-1 min-w-[200px]" aria-live="polite">
          {finding}
        </p>
      </div>
      <p className="text-[11px]" style={{ opacity: 0.8 }}>
        Share of {meas.what}.
      </p>

      {stateMode && !stateOk && <p className="text-sm p-2 rounded-lg" style={{ background: GRID }}>State lines are only available for the unbanked rate. Switch the measure to Unbanked rate.</p>}
      {stateMode && stateOk && states.size === 0 && <p className="text-sm p-2 rounded-lg" style={{ background: GRID }}>Click a few states on the map first, then come back here to compare them over time.</p>}

      <Tip className="flex-1 min-h-[300px]">
        {(show, hide) => (
          <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full" role="img" aria-label={`Lines of ${meas.label.toLowerCase()} over time`} onPointerLeave={() => { hide(); setHoverYear(null); }}>
            {y.ticks(5).map((t) => (
              <g key={t}>
                <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke={GRID} />
                <text x={M.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={13} fill={INK}>
                  {`${(100 * t).toFixed(0)}%`}
                </text>
              </g>
            ))}
            {[2009, 2011, 2013, 2015, 2017, 2019, 2021, 2023].map((yr) => (
              <text key={yr} x={x(yr)} y={H - 10} textAnchor="middle" fontSize={13} fill={INK}>
                {yr}
              </text>
            ))}
            {hoverYear !== null && <line x1={x(hoverYear)} x2={x(hoverYear)} y1={M.t} y2={H - M.b} stroke={INK} strokeOpacity={0.35} />}
            {series.map((s) => {
              const dim2 = chosen !== null && s.name !== chosen && s.name !== 'All households';
              const strong = chosen === s.name;
              const segments = splitSegments(s.points);
              return (
                <g key={s.name} opacity={dim2 ? 0.5 : 1}>
                  {segments.map((seg, i) => (
                    <polyline key={i} fill="none" stroke={s.color} strokeWidth={strong ? 4 : 2.5} strokeDasharray={s.dashed ? '5 4' : undefined} strokeLinejoin="round" strokeLinecap="round" points={seg.map((p) => `${x(p.year)},${y(p.rate)}`).join(' ')} />
                  ))}
                  {s.points.map((p) => (
                    <circle key={p.year} cx={x(p.year)} cy={y(p.rate)} r={strong ? 5 : 3.5} fill={s.color} stroke="#fafbfc" strokeWidth={1.5} />
                  ))}
                </g>
              );
            })}
            {labels.map(({ s, y: ly }) => (
              <text key={s.name} x={W - M.r + 10} y={ly} dy="0.32em" fontSize={13} fontWeight={chosen === s.name ? 800 : 600} fill={INK}>
                <tspan fill={s.color}>● </tspan>
                {(stateMode ? names.get(s.name) ?? s.name : s.name).slice(0, 20)}
              </text>
            ))}
            {years.map((yr) => (
              <rect
                key={yr}
                x={x(yr) - 22}
                y={M.t}
                width={44}
                height={H - M.t - M.b}
                fill="transparent"
                onPointerMove={(e) => {
                  setHoverYear(yr);
                  show(
                    e,
                    `${yr}`,
                    series.map((s) => {
                      const p = s.points.find((q) => q.year === yr);
                      return p ? `${stateMode ? names.get(s.name) ?? s.name : s.name}: ${pct(p.rate)} (range ${pct(p.lo)} to ${pct(p.hi)}, ${p.n.toLocaleString()} surveyed)` : `${s.name}: not asked`;
                    }),
                  );
                }}
              />
            ))}
          </svg>
        )}
      </Tip>
      <p className="text-[11px] leading-snug" style={{ opacity: 0.8 }}>
        Dashed line = all households. Thick line = the group you picked in the filters. A gap in a line means the survey did not ask that question that year. Survey
        wording and sampling changed slightly over the years, so compare trends, not tiny year-to-year moves.
      </p>
    </div>
  );
}
