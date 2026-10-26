import { useEffect, useMemo, useRef, useState } from 'react';
import { select } from 'd3-selection';
import { scaleLinear, scaleSqrt } from 'd3-scale';
import { brush as d3Brush } from 'd3-brush';
import type { BrushBehavior, D3BrushEvent } from 'd3-brush';
import { geoAlbersUsa, geoPath } from 'd3-geo';
import type { FeatureCollection, Geometry } from 'geojson';
import { COLORS, HOUSEHOLDS_URL, groupMeans, parseHouseholds, weightedShare } from '../week-08/households';
import type { Households } from '../week-08/households';
import { Card, TipFrame } from '../week-08/parts';
import { localPoint } from '../week-08/svgPoint';

// Week 10: a new interaction on the Week 8 state view. Brushing: drag a box on
// the scatterplot of unbanked rate against online payment use, and the states
// inside it light up on the map and are summarized below. Hovering a state on
// the map or the scatterplot picks it out in the other one (linked highlighting).
// The data is the rebuilt FDIC 2023 household file, weighted. Sources and notes
// are in README.md in this folder.

const GEO_URL = `${import.meta.env.BASE_URL}data/geo/us-states.json`;
type Geo = FeatureCollection<Geometry, { name: string; abbr: string }>;

const W = 760;
const MAP_H = 440;
const SM = { top: 20, right: 24, bottom: 48, left: 56 };
const SH = 440;
const IW = W - SM.left - SM.right;
const IH = SH - SM.top - SM.bottom;

interface Pt {
  abbr: string;
  name: string;
  x: number; // unbanked share, 0 to 1
  y: number; // online payment services share, 0 to 1
  hh: number; // weighted households
  unbanked: number; // weighted unbanked households
  n: number; // surveyed households
}

const RAMP = scaleLinear<string>().range(['#fbd9d9', '#a82525']);
const GRAY = '#e4e3de';
const fmtM = (n: number) => `${(n / 1e6).toFixed(1)} million`;

export function Week10() {
  const [data, setData] = useState<Households | null>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(HOUSEHOLDS_URL).then((r) => {
        if (!r.ok) throw new Error(`Could not load the household data (${r.status}).`);
        return r.text();
      }),
      fetch(GEO_URL).then((r) => {
        if (!r.ok) throw new Error(`Could not load the state map (${r.status}).`);
        return r.json() as Promise<Geo>;
      }),
    ])
      .then(([text, g]) => {
        if (cancelled) return;
        setData(parseHouseholds(text));
        setGeo(g);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Something went wrong loading the data.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-6 max-w-4xl w-full overflow-y-auto h-full">
      <h1 className="text-2xl font-bold mb-1">Week 10: Brushing the States</h1>
      <p className="text-sm text-gray-500 mb-5">
        Which states have more unbanked households and less online payment use than the nation? Drag a box on the
        scatterplot to pick states. The map and the summary follow.
      </p>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {!error && (!data || !geo) && <p className="text-sm text-gray-500">Loading data…</p>}
      {data && geo && <StateBrushing data={data} geo={geo} />}
    </div>
  );
}

function StateBrushing({ data, geo }: { data: Households; geo: Geo }) {
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [asTable, setAsTable] = useState(false);
  const brushRef = useRef<SVGGElement | null>(null);
  const behaviorRef = useRef<BrushBehavior<unknown> | null>(null);

  const names = useMemo(() => new Map(geo.features.map((f) => [f.properties.abbr, f.properties.name])), [geo]);

  // One point per state: weighted unbanked rate and online payment use.
  const pts = useMemo<Pt[]>(() => {
    const S = data.col.banking_status;
    const O = data.col.online_payment_services;
    const un = groupMeans(data, 'state', (i) => (S[i] === 'Unbanked' ? 1 : 0), true);
    const on = groupMeans(data, 'state', (i) => (O[i] === 'Yes' ? 1 : 0), true);
    const state = data.col.state;
    const unbankedHh = new Map<string, number>();
    for (let i = 0; i < data.n; i++) if (S[i] === 'Unbanked') unbankedHh.set(state[i], (unbankedHh.get(state[i]) ?? 0) + data.w[i]);
    const out: Pt[] = [];
    for (const [abbr, u] of un) {
      const o = on.get(abbr);
      if (!o) continue;
      out.push({ abbr, name: names.get(abbr) ?? abbr, x: u.mean, y: o.mean, hh: u.households, unbanked: unbankedHh.get(abbr) ?? 0, n: u.n });
    }
    return out.sort((a, b) => b.x - a.x);
  }, [data, names]);

  const nat = useMemo(() => {
    const S = data.col.banking_status;
    const O = data.col.online_payment_services;
    let hh = 0;
    let unb = 0;
    for (let i = 0; i < data.n; i++) {
      hh += data.w[i];
      if (S[i] === 'Unbanked') unb += data.w[i];
    }
    return {
      hh,
      unbankedHh: unb,
      unbanked: weightedShare(data, (i) => S[i] === 'Unbanked', () => true) / 100,
      online: weightedShare(data, (i) => O[i] === 'Yes', () => true) / 100,
    };
  }, [data]);

  const sx = useMemo(() => scaleLinear().domain([0, Math.max(...pts.map((p) => p.x)) * 1.08]).range([0, IW]), [pts]);
  const sy = useMemo(() => {
    const lo = Math.min(...pts.map((p) => p.y)) * 0.94;
    const hi = Math.max(...pts.map((p) => p.y)) * 1.04;
    return scaleLinear().domain([lo, hi]).range([IH, 0]);
  }, [pts]);
  const sr = useMemo(() => scaleSqrt().domain([0, Math.max(...pts.map((p) => p.hh), 1)]).range([3, 13]), [pts]);

  // d3-brush owns the drag box; React owns everything else. The cleanup removes
  // the brush's elements so React's double-run of effects does not stack two.
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
        const picked = new Set<string>();
        for (const p of pts) {
          const px = sx(p.x);
          const py = sy(p.y);
          if (px >= x0 && px <= x1 && py >= y0 && py <= y1) picked.add(p.abbr);
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
  }, [pts, sx, sy]);

  function clearSelection() {
    const g = brushRef.current;
    const b = behaviorRef.current;
    if (g && b) select(g).call(b.move, null);
  }
  // Preset boxes, given in data units (x: unbanked share, y: online payment share).
  function applyBox(xa: number, xb: number, ya: number, yb: number) {
    const g = brushRef.current;
    const b = behaviorRef.current;
    if (!g || !b) return;
    const box: [[number, number], [number, number]] = [
      [Math.max(0, sx(xa)), Math.max(0, sy(yb))],
      [Math.min(IW, sx(xb)), Math.min(IH, sy(ya))],
    ];
    select(g).call(b.move, box);
  }
  const [xMax] = sx.domain().slice(1);
  const [yMin] = sy.domain();
  const yMax = sy.domain()[1];
  const presets = [
    { label: 'Higher exclusion, lower online use', box: [nat.unbanked, xMax, yMin, nat.online] as const },
    { label: 'Highest unbanked rates', box: [0.06, xMax, yMin, yMax] as const },
    { label: 'Lowest online payment use', box: [0, xMax, yMin, 0.45] as const },
  ];

  // Summary of the selected states, pooled across their households.
  const summary = useMemo(() => {
    if (!selected || selected.size === 0) return null;
    const S = data.col.banking_status;
    const O = data.col.online_payment_services;
    const state = data.col.state;
    const inSel = (i: number) => selected.has(state[i]);
    let hh = 0;
    let unb = 0;
    for (let i = 0; i < data.n; i++) {
      if (!inSel(i)) continue;
      hh += data.w[i];
      if (S[i] === 'Unbanked') unb += data.w[i];
    }
    return {
      count: selected.size,
      hh,
      unbankedHh: unb,
      unbanked: weightedShare(data, (i) => S[i] === 'Unbanked', inSel) / 100,
      online: weightedShare(data, (i) => O[i] === 'Yes', inSel) / 100,
      list: pts.filter((p) => selected.has(p.abbr)),
    };
  }, [data, pts, selected]);

  // Map geometry.
  const paths = useMemo(() => {
    const conus: Geo = {
      type: 'FeatureCollection',
      features: geo.features.filter((f) => f.properties.abbr !== 'AK' && f.properties.abbr !== 'HI'),
    };
    const path = geoPath(geoAlbersUsa().fitSize([W, MAP_H], conus));
    return geo.features.map((f) => ({ abbr: f.properties.abbr, name: f.properties.name, d: path(f) ?? '' }));
  }, [geo]);
  const byAbbr = useMemo(() => new Map(pts.map((p) => [p.abbr, p])), [pts]);
  const shade = useMemo(
    () => RAMP.copy().domain([Math.min(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.x))]),
    [pts],
  );

  const hovered = hover ? byAbbr.get(hover) : undefined;
  const rows = summary ? summary.list : pts;
  const labelStates = selected && selected.size > 0 && selected.size <= 18;

  return (
    <div>
      <Card title="Pick states on the scatterplot">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3">
          <span className="text-sm text-gray-500">Try a selection:</span>
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyBox(...p.box)}
              className="px-3 py-1 rounded-full border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
            >
              {p.label}
            </button>
          ))}
        </div>
        <TipFrame>
          {(show, hide) => (
            <svg
              viewBox={`0 0 ${W} ${SH}`}
              width="100%"
              role="img"
              aria-label="Scatterplot of each state's unbanked rate against its online payment services use. Drag a box to select states."
              onPointerLeave={() => {
                hide();
                setHover(null);
              }}
            >
              <g
                transform={`translate(${SM.left},${SM.top})`}
                onPointerMove={(e) => {
                  const p = localPoint(e, e.currentTarget);
                  if (!p) return;
                  let best: Pt | null = null;
                  let bestD = 16;
                  for (const q of pts) {
                    const d = Math.hypot(sx(q.x) - p[0], sy(q.y) - p[1]);
                    if (d < bestD) {
                      best = q;
                      bestD = d;
                    }
                  }
                  setHover(best ? best.abbr : null);
                  if (best) {
                    show(e, best.name, [
                      `Unbanked: ${(100 * best.x).toFixed(1)}%`,
                      `Online payment services: ${(100 * best.y).toFixed(1)}%`,
                      `${best.n.toLocaleString()} households surveyed`,
                    ]);
                  } else hide();
                }}
              >
                {sx.ticks(6).map((t) => (
                  <g key={`x${t}`} transform={`translate(${sx(t)},0)`}>
                    <line y2={IH} stroke={COLORS.grid} />
                    <text y={IH + 18} textAnchor="middle" fontSize={12} fill={COLORS.ink2}>
                      {(100 * t).toFixed(0)}%
                    </text>
                  </g>
                ))}
                {sy.ticks(6).map((t) => (
                  <g key={`y${t}`} transform={`translate(0,${sy(t)})`}>
                    <line x2={IW} stroke={COLORS.grid} />
                    <text x={-10} dy="0.32em" textAnchor="end" fontSize={12} fill={COLORS.ink2}>
                      {(100 * t).toFixed(0)}%
                    </text>
                  </g>
                ))}
                <line x1={sx(nat.unbanked)} x2={sx(nat.unbanked)} y2={IH} stroke={COLORS.muted} strokeDasharray="5 4" strokeWidth={1.5} />
                <line y1={sy(nat.online)} y2={sy(nat.online)} x2={IW} stroke={COLORS.muted} strokeDasharray="5 4" strokeWidth={1.5} />
                {pts.map((p) => {
                  const on = !selected || selected.has(p.abbr);
                  const isHover = hover === p.abbr;
                  return (
                    <g key={p.abbr}>
                      <circle
                        cx={sx(p.x)}
                        cy={sy(p.y)}
                        r={sr(p.hh)}
                        fill={on ? COLORS.status.Unbanked : GRAY}
                        fillOpacity={on ? 0.75 : 1}
                        stroke={isHover ? COLORS.ink : COLORS.surface}
                        strokeWidth={isHover ? 2.5 : 1.5}
                      />
                      {((labelStates && selected?.has(p.abbr)) || isHover) && (
                        <text x={sx(p.x) + sr(p.hh) + 3} y={sy(p.y)} dy="0.32em" fontSize={11} fill={COLORS.ink} style={{ pointerEvents: 'none' }}>
                          {p.abbr}
                        </text>
                      )}
                    </g>
                  );
                })}
                <g ref={brushRef} />
              </g>
              <text x={SM.left} y={12} fontSize={12} fill={COLORS.ink2}>
                ↑ Households using online payment services
              </text>
              <text x={W - SM.right} y={SH - 6} textAnchor="end" fontSize={12} fill={COLORS.ink2}>
                Unbanked households, share of state →
              </text>
            </svg>
          )}
        </TipFrame>
        <p className="text-xs text-gray-500 mt-2">
          Dashed lines are the national rates ({(100 * nat.unbanked).toFixed(1)}% unbanked, {(100 * nat.online).toFixed(1)}% online
          payment use). Dot size shows how many households a state represents.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3 my-4 min-h-8">
          <p className="text-sm text-gray-700" aria-live="polite">
            {summary ? (
              <>
                <span className="font-semibold text-gray-900">{summary.count}</span> of {pts.length} states selected, with{' '}
                {fmtM(summary.hh)} households ({(100 * summary.hh / nat.hh).toFixed(0)}% of the U.S.). Together they are{' '}
                <span className="font-semibold text-gray-900">{(100 * summary.unbanked).toFixed(1)}%</span> unbanked (nation{' '}
                {(100 * nat.unbanked).toFixed(1)}%) and {(100 * summary.online).toFixed(1)}% use online payment services (nation{' '}
                {(100 * nat.online).toFixed(1)}%). They hold {fmtM(summary.unbankedHh)} unbanked households, or{' '}
                {(100 * summary.unbankedHh / nat.unbankedHh).toFixed(0)}% of all of them.
              </>
            ) : selected ? (
              'No states in that box. Try a larger one.'
            ) : (
              'Drag a box on the scatterplot to select states.'
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
      </Card>

      <Card title="The same states on the map">
        <div className="min-h-12 mb-3 border border-gray-200 rounded-xl p-3 bg-white text-sm" aria-live="polite">
          {hovered ? (
            <>
              <span className="font-semibold text-gray-900">{hovered.name}</span>: {(100 * hovered.x).toFixed(1)}% unbanked,{' '}
              {(100 * hovered.y).toFixed(1)}% use online payment services, {fmtM(hovered.hh)} households.
            </>
          ) : (
            <span className="text-gray-500">Hover a state to read it. It is picked out on the scatterplot too.</span>
          )}
        </div>
        <TipFrame>
          {(show, hide) => (
            <svg
              viewBox={`0 0 ${W} ${MAP_H}`}
              width="100%"
              role="img"
              aria-label="Map of U.S. states. Selected states are shaded by unbanked rate and the rest are gray."
              onPointerLeave={() => {
                hide();
                setHover(null);
              }}
            >
              {paths.map((p) => {
                const s = byAbbr.get(p.abbr);
                const on = !selected || selected.has(p.abbr);
                const isHover = hover === p.abbr;
                return (
                  <path
                    key={p.abbr}
                    d={p.d}
                    fill={s && on ? shade(s.x) : GRAY}
                    stroke={isHover ? COLORS.ink : COLORS.surface}
                    strokeWidth={isHover ? 2.5 : 1}
                    onPointerMove={(e) => {
                      setHover(p.abbr);
                      if (s) show(e, p.name, [`Unbanked: ${(100 * s.x).toFixed(1)}%`, `Online payment services: ${(100 * s.y).toFixed(1)}%`]);
                    }}
                  />
                );
              })}
            </svg>
          )}
        </TipFrame>
        <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
          <span>{(100 * Math.min(...pts.map((p) => p.x))).toFixed(1)}%</span>
          <div className="h-3 w-40 rounded-full" style={{ background: 'linear-gradient(to right, #fbd9d9, #a82525)' }} />
          <span>{(100 * Math.max(...pts.map((p) => p.x))).toFixed(1)}% unbanked</span>
          <span className="ml-2">Gray states are outside the selection.</span>
        </div>
      </Card>

      <button type="button" className="text-sm underline text-gray-700" onClick={() => setAsTable((v) => !v)}>
        {asTable ? 'Hide table' : summary ? 'View selected states as a table' : 'View all states as a table'}
      </button>
      {asTable && (
        <div className="overflow-auto max-h-80 border border-gray-200 rounded-xl bg-white mt-2">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="p-2">State</th>
                <th className="p-2 text-right">Unbanked</th>
                <th className="p-2 text-right">Online payment services</th>
                <th className="p-2 text-right">Households</th>
                <th className="p-2 text-right">Surveyed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.abbr} className="border-b border-gray-100">
                  <td className="p-2">{p.name}</td>
                  <td className="p-2 text-right">{(100 * p.x).toFixed(1)}%</td>
                  <td className="p-2 text-right">{(100 * p.y).toFixed(1)}%</td>
                  <td className="p-2 text-right">{fmtM(p.hh)}</td>
                  <td className="p-2 text-right">{p.n.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

