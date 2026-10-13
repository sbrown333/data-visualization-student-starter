import { useEffect, useMemo, useState } from 'react';
import { scaleLinear, scaleSqrt } from 'd3-scale';
import { geoAlbersUsa, geoPath } from 'd3-geo';
import type { FeatureCollection, Geometry } from 'geojson';
import { COLORS, MEASURES, groupMeans, weightedShare } from './households';
import type { GroupMean, Households } from './households';
import { Card, Pills, TipFrame } from './parts';

// By state: a map of one measure (as in Week 6) linked to a scatterplot that puts
// each state's unbanked rate against its online payment use. States that are
// above the national unbanked rate and below the national online payment rate
// are the ones most exposed if payments keep going digital.

const GEO_URL = `${import.meta.env.BASE_URL}data/geo/us-states.json`;
type Geo = FeatureCollection<Geometry, { name: string; abbr: string }>;

const W = 760;
const MAP_H = 470;

interface Metric {
  key: string;
  label: string;
  ramp: [string, string];
  binary: boolean;
  value: (data: Households, scores: Float32Array) => (i: number) => number | null;
}

const BLUE: [string, string] = ['#eaf1fb', '#1b4f9c'];
const byKey = (k: string) => MEASURES.find((m) => m.key === k)!;
const fromMeasure = (k: string) => (data: Households) => {
  const m = byKey(k);
  return (i: number) => {
    const v = m.test(data, i);
    return v === null ? null : v ? 1 : 0;
  };
};

const METRICS: Metric[] = [
  {
    key: 'readiness',
    label: 'Readiness score',
    ramp: BLUE,
    binary: false,
    value: (_d, scores) => (i) => (Number.isNaN(scores[i]) ? null : scores[i] / 100),
  },
  {
    key: 'unbanked',
    label: 'Unbanked',
    ramp: ['#fde8e8', '#d03b3b'],
    binary: true,
    value: (d) => (i) => (d.col.banking_status[i] === 'Unbanked' ? 1 : 0),
  },
  { key: 'online', label: 'Online payment services', ramp: BLUE, binary: true, value: fromMeasure('online') },
  { key: 'smartphone', label: 'Smartphone', ramp: BLUE, binary: true, value: fromMeasure('smartphone') },
  { key: 'mobile', label: 'Mobile banking', ramp: BLUE, binary: true, value: fromMeasure('mobile') },
  { key: 'credit', label: 'Credit card', ramp: BLUE, binary: true, value: fromMeasure('credit') },
];

export function StateTab({ data, scores }: { data: Households; scores: Float32Array }) {
  const [geo, setGeo] = useState<Geo | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [metricKey, setMetricKey] = useState('readiness');
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [asTable, setAsTable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(GEO_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load the state map (${r.status}).`);
        return r.json() as Promise<Geo>;
      })
      .then((g) => {
        if (!cancelled) setGeo(g);
      })
      .catch((e: unknown) => {
        if (!cancelled) setGeoError(e instanceof Error ? e.message : 'Could not load the state map.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const metric = METRICS.find((m) => m.key === metricKey) ?? METRICS[0];
  const stats = useMemo(
    () => groupMeans(data, 'state', metric.value(data, scores), metric.binary),
    [data, scores, metric],
  );
  const unbanked = useMemo(() => groupMeans(data, 'state', METRICS[1].value(data, scores), true), [data, scores]);
  const online = useMemo(() => groupMeans(data, 'state', METRICS[2].value(data, scores), true), [data, scores]);
  const natUnbanked = useMemo(
    () => weightedShare(data, (i) => data.col.banking_status[i] === 'Unbanked', () => true) / 100,
    [data],
  );
  const natOnline = useMemo(
    () => weightedShare(data, (i) => data.col.online_payment_services[i] === 'Yes', () => true) / 100,
    [data],
  );

  const paths = useMemo(() => {
    if (!geo) return [];
    const conus: Geo = {
      type: 'FeatureCollection',
      features: geo.features.filter((f) => f.properties.abbr !== 'AK' && f.properties.abbr !== 'HI'),
    };
    const projection = geoAlbersUsa().fitSize([W, MAP_H], conus);
    const path = geoPath(projection);
    return geo.features.map((f) => ({ abbr: f.properties.abbr, name: f.properties.name, d: path(f) ?? '' }));
  }, [geo]);

  const values = [...stats.values()];
  const vmin = Math.min(...values.map((v) => v.mean));
  const vmax = Math.max(...values.map((v) => v.mean));
  const fill = useMemo(
    () => scaleLinear<string>().domain([vmin, vmax]).range(metric.ramp).clamp(true),
    [vmin, vmax, metric],
  );
  const fmtVal = (v: number) => (metric.key === 'readiness' ? (100 * v).toFixed(1) : `${(100 * v).toFixed(1)}%`);
  const names = useMemo(() => new Map(paths.map((p) => [p.abbr, p.name])), [paths]);
  const ranked = useMemo(() => [...stats.entries()].sort((a, b) => b[1].mean - a[1].mean), [stats]);
  const focus = pinned ?? hover;
  const focusStat: GroupMean | undefined = focus ? stats.get(focus) : undefined;
  const rank = focus ? ranked.findIndex(([k]) => k === focus) + 1 : 0;

  // ---------- scatter geometry ----------
  const SM = { top: 20, right: 24, bottom: 48, left: 56 };
  const SH = 430;
  const siw = W - SM.left - SM.right;
  const sih = SH - SM.top - SM.bottom;
  const pts = useMemo(() => {
    const out: { abbr: string; x: number; y: number; hh: number }[] = [];
    for (const [abbr, u] of unbanked) {
      const o = online.get(abbr);
      if (o) out.push({ abbr, x: u.mean, y: o.mean, hh: u.households });
    }
    return out;
  }, [unbanked, online]);
  const sx = scaleLinear()
    .domain([0, Math.max(...pts.map((p) => p.x), natUnbanked) * 1.08])
    .range([0, siw]);
  const yLo = Math.min(...pts.map((p) => p.y), natOnline) * 0.94;
  const yHi = Math.max(...pts.map((p) => p.y), natOnline) * 1.04;
  const sy = scaleLinear().domain([yLo, yHi]).range([sih, 0]);
  const sr = scaleSqrt()
    .domain([0, Math.max(...pts.map((p) => p.hh), 1)])
    .range([3, 14]);
  const exposed = (p: { x: number; y: number }) => p.x > natUnbanked && p.y < natOnline;

  if (geoError) return <p className="text-sm text-red-700">{geoError}</p>;
  if (!geo) return <p className="text-sm text-gray-500">Loading map…</p>;

  return (
    <div>
      <Card title="Readiness and exclusion by state">
        <div className="mb-3">
          <Pills items={METRICS} value={metricKey} onChange={setMetricKey} name="Map measure" />
        </div>
        <div className="min-h-14 mb-3 border border-gray-200 rounded-xl p-3 bg-white text-sm" aria-live="polite">
          {focus && focusStat ? (
            <>
              <span className="font-semibold text-gray-900">{names.get(focus) ?? focus}</span>
              {pinned && (
                <button type="button" className="ml-2 underline text-gray-600" onClick={() => setPinned(null)}>
                  unpin
                </button>
              )}
              <div className="text-gray-700">
                {metric.label}: <span className="font-semibold">{fmtVal(focusStat.mean)}</span> (approx. 95% range{' '}
                {fmtVal(focusStat.lo)} to {fmtVal(focusStat.hi)}). Rank {rank} of {ranked.length}, where 1 is highest.{' '}
                {focusStat.n.toLocaleString()} households surveyed.
              </div>
            </>
          ) : (
            <span className="text-gray-500">Hover a state to read it, or click one to keep it selected.</span>
          )}
        </div>

        <TipFrame>
          {(show, hide) => (
            <svg
              viewBox={`0 0 ${W} ${MAP_H}`}
              width="100%"
              role="img"
              aria-label={`Map of U.S. states shaded by ${metric.label.toLowerCase()}. A table view is available.`}
              onPointerLeave={() => {
                hide();
                setHover(null);
              }}
            >
              {paths.map((p) => {
                const s = stats.get(p.abbr);
                const isFocus = focus === p.abbr;
                return (
                  <path
                    key={p.abbr}
                    d={p.d}
                    fill={s ? fill(s.mean) : COLORS.track}
                    stroke={isFocus ? COLORS.ink : COLORS.surface}
                    strokeWidth={isFocus ? 2.5 : 1}
                    style={{ cursor: 'pointer' }}
                    onPointerMove={(e) => {
                      setHover(p.abbr);
                      if (s) show(e, p.name, [`${metric.label}: ${fmtVal(s.mean)}`, `${s.n.toLocaleString()} households surveyed`]);
                    }}
                    onClick={() => setPinned((cur) => (cur === p.abbr ? null : p.abbr))}
                  />
                );
              })}
            </svg>
          )}
        </TipFrame>
        <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
          <span>{fmtVal(vmin)}</span>
          <div className="h-3 w-40 rounded-full" style={{ background: `linear-gradient(to right, ${metric.ramp[0]}, ${metric.ramp[1]})` }} />
          <span>{fmtVal(vmax)}</span>
          <span className="ml-2">Every state has at least 250 surveyed households.</span>
        </div>
        <button type="button" className="text-sm underline text-gray-700 mt-2" onClick={() => setAsTable((v) => !v)}>
          {asTable ? 'Hide table' : 'View states as a table'}
        </button>
        {asTable && (
          <div className="overflow-auto max-h-80 border border-gray-200 rounded-xl bg-white mt-2">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="p-2">Rank</th>
                  <th className="p-2">State</th>
                  <th className="p-2 text-right">{metric.label}</th>
                  <th className="p-2 text-right">Approx. 95% range</th>
                  <th className="p-2 text-right">Surveyed</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map(([abbr, s], k) => (
                  <tr key={abbr} className="border-b border-gray-100">
                    <td className="p-2">{k + 1}</td>
                    <td className="p-2">{names.get(abbr) ?? abbr}</td>
                    <td className="p-2 text-right">{fmtVal(s.mean)}</td>
                    <td className="p-2 text-right">
                      {fmtVal(s.lo)} to {fmtVal(s.hi)}
                    </td>
                    <td className="p-2 text-right">{s.n.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Which states are most exposed?">
        <p className="text-sm text-gray-600 mb-3">
          Each dot is a state. Dots to the right have more unbanked households, dots lower down have fewer households using
          online payment services. Hover a dot to light up the state on the map above.
        </p>
        <TipFrame>
          {(show, hide) => (
            <svg
              viewBox={`0 0 ${W} ${SH}`}
              width="100%"
              role="img"
              aria-label="Scatterplot of each state's unbanked rate against its online payment services use, with lines at the national rates."
              onPointerLeave={() => {
                hide();
                setHover(null);
              }}
            >
              <g transform={`translate(${SM.left},${SM.top})`}>
                {sx.ticks(6).map((t) => (
                  <g key={`x${t}`} transform={`translate(${sx(t)},0)`}>
                    <line y2={sih} stroke={COLORS.grid} />
                    <text y={sih + 18} textAnchor="middle" fontSize={12} fill={COLORS.ink2}>
                      {(100 * t).toFixed(0)}%
                    </text>
                  </g>
                ))}
                {sy.ticks(6).map((t) => (
                  <g key={`y${t}`} transform={`translate(0,${sy(t)})`}>
                    <line x2={siw} stroke={COLORS.grid} />
                    <text x={-10} dy="0.32em" textAnchor="end" fontSize={12} fill={COLORS.ink2}>
                      {(100 * t).toFixed(0)}%
                    </text>
                  </g>
                ))}
                <rect x={sx(natUnbanked)} y={sy(natOnline)} width={siw - sx(natUnbanked)} height={sih - sy(natOnline)} fill={COLORS.status.Unbanked} fillOpacity={0.07} />
                <line x1={sx(natUnbanked)} x2={sx(natUnbanked)} y2={sih} stroke={COLORS.muted} strokeDasharray="5 4" strokeWidth={1.5} />
                <line y1={sy(natOnline)} y2={sy(natOnline)} x2={siw} stroke={COLORS.muted} strokeDasharray="5 4" strokeWidth={1.5} />
                <text x={siw - 6} y={sih - 8} textAnchor="end" fontSize={12} fill={COLORS.status.Unbanked} fontWeight={600}>
                  Higher exclusion, lower online use
                </text>
                <text x={6} y={12} fontSize={11} fill={COLORS.ink2}>
                  Lower exclusion, higher online use
                </text>
                {pts.map((p) => {
                  const ex = exposed(p);
                  const isFocus = focus === p.abbr;
                  return (
                    <g key={p.abbr} style={{ cursor: 'pointer' }}>
                      <circle
                        cx={sx(p.x)}
                        cy={sy(p.y)}
                        r={sr(p.hh)}
                        fill={ex ? COLORS.status.Unbanked : COLORS.accent}
                        fillOpacity={isFocus ? 0.95 : 0.5}
                        stroke={isFocus ? COLORS.ink : COLORS.surface}
                        strokeWidth={isFocus ? 2.5 : 1.5}
                        onPointerMove={(e) => {
                          setHover(p.abbr);
                          show(e, names.get(p.abbr) ?? p.abbr, [
                            `Unbanked: ${(100 * p.x).toFixed(1)}%`,
                            `Online payment services: ${(100 * p.y).toFixed(1)}%`,
                            ex ? 'Higher exclusion and lower online use than the nation' : 'Not in the exposed corner',
                          ]);
                        }}
                        onClick={() => setPinned((cur) => (cur === p.abbr ? null : p.abbr))}
                      />
                      {(ex || isFocus) && (
                        <text x={sx(p.x) + sr(p.hh) + 3} y={sy(p.y)} dy="0.32em" fontSize={11} fill={COLORS.ink} style={{ pointerEvents: 'none' }}>
                          {p.abbr}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
              <text x={W - SM.right} y={SH - 6} textAnchor="end" fontSize={12} fill={COLORS.ink2}>
                Unbanked households, share of state →
              </text>
              <text x={SM.left} y={12} fontSize={12} fill={COLORS.ink2}>
                ↑ Households using online payment services
              </text>
            </svg>
          )}
        </TipFrame>
        <p className="text-xs text-gray-500 mt-2">
          Dashed lines are the national rates ({(100 * natUnbanked).toFixed(1)}% unbanked, {(100 * natOnline).toFixed(1)}% online
          payment use). Dot size shows how many households the state represents.
        </p>
      </Card>
    </div>
  );
}
