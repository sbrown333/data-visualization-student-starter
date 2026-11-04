import { useEffect, useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { geoAlbersUsa, geoPath } from 'd3-geo';
import type { FeatureCollection, Geometry } from 'geojson';
import { COLORS, GROUPS, HOUSEHOLDS_URL, SMALL_N, parseHouseholds } from '../week-08/households';
import type { Households } from '../week-08/households';
import { ALL_KEYS, buildComponents, scoreAll } from '../week-08/readiness';
import { Pills, TipFrame } from '../week-08/parts';
import { ACCESS_METHODS, accessShares, countKept, overallStat, statsBy } from './dash';
import type { Stat } from './dash';

// Week 11: the project as one dashboard. A single set of filters (five menus plus
// clicking states on the map) drives every panel: the map, the dot plots by group,
// the summary tiles and the account-access heatmap. Clicking a row in a dot plot,
// a column in the heatmap or a state on the map sets that filter too.
// Data: the rebuilt, weighted FDIC 2023 household file. Notes are in README.md.

const GEO_URL = `${import.meta.env.BASE_URL}data/geo/us-states.json`;
type Geo = FeatureCollection<Geometry, { name: string; abbr: string }>;

interface Metric {
  key: string;
  label: string;
  value: (h: Households, scores: Float32Array) => (i: number) => number | null;
  binary: boolean;
  percent: boolean; // true: show as %, false: show as a 0 to 100 score
  ramp: [string, string];
  color: string;
  sentence: string;
}

const yn = (v: string) => (v === 'Yes' ? 1 : v === 'No' ? 0 : null);
const METRICS: Metric[] = [
  {
    key: 'unbanked',
    label: 'Unbanked rate',
    value: (h) => (i) => (h.col.banking_status[i] === 'Unbanked' ? 1 : 0),
    binary: true,
    percent: true,
    ramp: ['#fbd9d9', '#a82525'],
    color: COLORS.status.Unbanked,
    sentence: 'are unbanked',
  },
  {
    key: 'online',
    label: 'Online payment use',
    value: (h) => (i) => yn(h.col.online_payment_services[i]),
    binary: true,
    percent: true,
    ramp: ['#dbe9fa', '#1f5fae'],
    color: COLORS.accent,
    sentence: 'use online payment services',
  },
  {
    key: 'smartphone',
    label: 'Smartphone',
    value: (h) => (i) => yn(h.col.smartphone[i]),
    binary: true,
    percent: true,
    ramp: ['#dbe9fa', '#1f5fae'],
    color: COLORS.accent,
    sentence: 'have a smartphone',
  },
  {
    key: 'readiness',
    label: 'Readiness score',
    value: (_h, s) => (i) => (Number.isNaN(s[i]) ? null : s[i] / 100),
    binary: false,
    percent: false,
    ramp: ['#dbe9fa', '#1f5fae'],
    color: COLORS.accent,
    sentence: 'score on readiness',
  },
];

const fmt = (m: Metric, v: number, digits = 1) => (m.percent ? `${(100 * v).toFixed(digits)}%` : (100 * v).toFixed(digits));
const fmtM = (n: number) => (n < 1e6 ? `${Math.round(n / 1000).toLocaleString()} thousand` : `${(n / 1e6).toFixed(1)} million`);

type Filters = Record<string, string | null>;
const NO_FILTERS: Filters = Object.fromEntries(GROUPS.map((g) => [g.key, null]));

const W = 760;
const MAP_H = 440;

export function Week11() {
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
    <div className="p-6 max-w-5xl w-full overflow-y-auto h-full">
      <h1 className="text-2xl font-bold mb-1">Left Behind? Mapping America&apos;s Digital Payments Divide</h1>
      <p className="text-sm text-gray-500 mb-4">
        2023 FDIC survey of unbanked and underbanked households, weighted to represent all U.S. households.
      </p>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {!error && (!data || !geo) && <p className="text-sm text-gray-500">Loading data…</p>}
      {data && geo && <Dashboard data={data} geo={geo} />}
    </div>
  );
}

function Dashboard({ data, geo }: { data: Households; geo: Geo }) {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [states, setStates] = useState<ReadonlySet<string>>(new Set());
  const [metricKey, setMetricKey] = useState('unbanked');
  const metric = METRICS.find((m) => m.key === metricKey) ?? METRICS[0];

  const scores = useMemo(() => scoreAll(data, buildComponents(data), new Set(ALL_KEYS)), [data]);
  const names = useMemo(() => new Map(geo.features.map((f) => [f.properties.abbr, f.properties.name])), [geo]);

  // A row passes if it matches every filter except the one named in `skip`. Each panel
  // skips its own filter so you can still see the other choices in that panel.
  const keepFor = useMemo(
    () => (skip: string | null) => {
      const active = GROUPS.filter((g) => g.key !== skip && filters[g.key] !== null);
      const useStates = skip !== 'state' && states.size > 0;
      return (i: number) => {
        for (const g of active) if (data.col[g.column][i] !== filters[g.key]) return false;
        if (useStates && !states.has(data.col.state[i])) return false;
        return true;
      };
    },
    [data, filters, states],
  );

  const anyFilter = states.size > 0 || GROUPS.some((g) => filters[g.key] !== null);
  const setFilter = (key: string, v: string | null) => setFilters((f) => ({ ...f, [key]: v }));
  const toggleFilter = (key: string, v: string) => setFilters((f) => ({ ...f, [key]: f[key] === v ? null : v }));
  const toggleState = (abbr: string) =>
    setStates((prev) => {
      const next = new Set(prev);
      if (next.has(abbr)) next.delete(abbr);
      else next.add(abbr);
      return next;
    });
  const reset = () => {
    setFilters(NO_FILTERS);
    setStates(new Set());
  };

  // Summary tiles: the current selection against the whole nation, for three measures.
  const tiles = useMemo(() => {
    const keep = keepFor(null);
    const all = () => true;
    const rows = METRICS.filter((m) => m.key !== 'smartphone').map((m) => {
      const v = m.value(data, scores);
      return { m, sel: overallStat(data, keep, v, m.binary), nat: overallStat(data, all, v, m.binary) };
    });
    return { rows, counts: countKept(data, keep), total: countKept(data, all) };
  }, [data, scores, keepFor]);

  const natStat = useMemo(
    () => overallStat(data, () => true, metric.value(data, scores), metric.binary),
    [data, scores, metric],
  );
  const selStat = tiles.rows.find((r) => r.m.key === metric.key)?.sel ?? overallStat(data, keepFor(null), metric.value(data, scores), metric.binary);

  return (
    <div>
      {/* ---------- filter bar ---------- */}
      <div className="sticky top-0 z-20 -mx-6 px-6 py-3 mb-4 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          {GROUPS.map((g) => (
            <label key={g.key} className="text-xs text-gray-500 flex flex-col">
              {g.label}
              <select
                className="mt-0.5 border border-gray-300 rounded-lg px-2 py-1 text-sm text-gray-900 bg-white"
                value={filters[g.key] ?? ''}
                onChange={(e) => setFilter(g.key, e.target.value || null)}
              >
                <option value="">All</option>
                {g.order.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2 text-sm min-h-7">
          <button
            type="button"
            onClick={reset}
            disabled={!anyFilter}
            className="px-3 py-0.5 rounded-full border border-gray-300 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            Reset all
          </button>
          <span className="text-xs text-gray-500">States:</span>
          {states.size === 0 ? (
            <span className="text-gray-500 text-xs">all (click states on the map to pick some)</span>
          ) : (
            [...states].sort().map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleState(s)}
                aria-label={`Remove ${names.get(s) ?? s} from the filter`}
                className="px-2 py-0.5 rounded-full bg-gray-900 text-white text-xs"
              >
                {s} ✕
              </button>
            ))
          )}
        </div>
      </div>

      {/* ---------- headline ---------- */}
      <Headline tiles={tiles} anyFilter={anyFilter} />

      {/* ---------- summary tiles ---------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="border border-gray-200 rounded-xl p-3 bg-white">
          <div className="text-xs text-gray-500">Households in view</div>
          <div className="text-2xl font-bold">{fmtM(tiles.counts.households)}</div>
          <div className="text-xs text-gray-500">
            {tiles.counts.n.toLocaleString()} surveyed of {tiles.total.n.toLocaleString()}
          </div>
        </div>
        {tiles.rows.map(({ m, sel, nat }) => (
          <div key={m.key} className="border border-gray-200 rounded-xl p-3 bg-white">
            <div className="text-xs text-gray-500">{m.label}</div>
            <div className="text-2xl font-bold">{sel ? fmt(m, sel.mean) : 'n/a'}</div>
            <div className="text-xs text-gray-500">nation {nat ? fmt(m, nat.mean) : 'n/a'}</div>
          </div>
        ))}
      </div>

      {/* ---------- measure picker ---------- */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span className="text-sm font-semibold text-gray-900">Show on the map and charts:</span>
        <Pills items={METRICS.map((m) => ({ key: m.key, label: m.label }))} value={metricKey} onChange={setMetricKey} name="Choose a measure" />
      </div>

      <StateMap data={data} geo={geo} names={names} metric={metric} scores={scores} keepFor={keepFor} states={states} onToggle={toggleState} />

      <GroupPanels
        data={data}
        metric={metric}
        scores={scores}
        keepFor={keepFor}
        filters={filters}
        onToggle={toggleFilter}
        nat={natStat}
        sel={selStat}
      />

      <AccessHeatmap data={data} keepFor={keepFor} filters={filters} onToggle={toggleFilter} />

      <section className="mb-10 text-xs text-gray-500 leading-relaxed">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">About these numbers</h2>
        <p className="mb-1">
          Source: FDIC National Survey of Unbanked and Underbanked Households, 2023 (29,483 responding households). Every
          rate uses the FDIC household weight, so it stands for all U.S. households, not just those surveyed. Ranges are
          approximate 95% ranges that allow for unequal weights but not the survey&apos;s clustering, so they are a little
          narrower than the FDIC&apos;s own. Hollow dots and gray cells mean fewer than {SMALL_N} surveyed households, too few to trust.
        </p>
        <p>
          The readiness score is my own index, not an official measure: the average of banking status, smartphone, online
          payments, credit card, digital banking and income, scaled 0 to 100. Cash dependence and home internet are not in
          the 2023 file, so a smartphone stands in for internet access.
        </p>
      </section>
    </div>
  );
}

// ---------- headline sentence ----------

function Headline({
  tiles,
  anyFilter,
}: {
  tiles: { rows: { m: Metric; sel: Stat | null; nat: Stat | null }[]; counts: { n: number; households: number } };
  anyFilter: boolean;
}) {
  const un = tiles.rows.find((r) => r.m.key === 'unbanked');
  let text: string;
  if (!un || !un.nat) text = '';
  else if (!anyFilter) {
    text = `In 2023, ${fmt(un.m, un.nat.mean)} of U.S. households were unbanked, about ${fmtM(un.nat.households * un.nat.mean)} households. Use the menus above, or click states on the map, to see who is left behind.`;
  } else if (!un.sel || tiles.counts.n < SMALL_N) {
    text = `Only ${tiles.counts.n} surveyed households match these filters, too few to trust. Try fewer filters.`;
  } else {
    const ratio = un.sel.mean / un.nat.mean;
    const rel = ratio >= 1.2 ? `${ratio.toFixed(1)} times the national rate` : ratio <= 0.83 ? `${Math.round((1 - ratio) * 100)}% below the national rate` : 'close to the national rate';
    text = `Households matching your filters (${fmtM(tiles.counts.households)}) are ${fmt(un.m, un.sel.mean)} unbanked (nation ${fmt(un.m, un.nat.mean)}), ${rel}.`;
  }
  return (
    <p className="text-base text-gray-900 mb-4" aria-live="polite">
      {text}
    </p>
  );
}

// ---------- state map ----------

function StateMap({
  data,
  geo,
  names,
  metric,
  scores,
  keepFor,
  states,
  onToggle,
}: {
  data: Households;
  geo: Geo;
  names: Map<string, string>;
  metric: Metric;
  scores: Float32Array;
  keepFor: (skip: string | null) => (i: number) => boolean;
  states: ReadonlySet<string>;
  onToggle: (abbr: string) => void;
}) {
  const stats = useMemo(
    () => statsBy(data, keepFor('state'), (i) => data.col.state[i], metric.value(data, scores), metric.binary),
    [data, keepFor, metric, scores],
  );
  const paths = useMemo(() => {
    const conus: Geo = {
      type: 'FeatureCollection',
      features: geo.features.filter((f) => f.properties.abbr !== 'AK' && f.properties.abbr !== 'HI'),
    };
    const path = geoPath(geoAlbersUsa().fitSize([W, MAP_H], conus));
    return geo.features.map((f) => ({ abbr: f.properties.abbr, d: path(f) ?? '' }));
  }, [geo]);
  const solid = [...stats.values()].filter((s) => s.n >= SMALL_N).map((s) => s.mean);
  const lo = solid.length ? Math.min(...solid) : 0;
  const hi = solid.length ? Math.max(...solid) : 1;
  const shade = scaleLinear<string>().domain([lo, hi === lo ? lo + 0.01 : hi]).range(metric.ramp).clamp(true);
  const [hover, setHover] = useState<string | null>(null);
  const hoverStat = hover ? stats.get(hover) : undefined;

  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Where: {metric.label.toLowerCase()} by state</h2>
      <p className="text-sm text-gray-500 mb-2">
        Click states to add them to the filters. The map follows every other filter. Gray states have too few matching households.
      </p>
      <div className="min-h-10 mb-2 border border-gray-200 rounded-xl px-3 py-2 bg-white text-sm" aria-live="polite">
        {hover ? (
          <>
            <span className="font-semibold text-gray-900">{names.get(hover) ?? hover}</span>:{' '}
            {hoverStat && hoverStat.n >= SMALL_N
              ? `${fmt(metric, hoverStat.mean)} (range ${fmt(metric, hoverStat.lo)} to ${fmt(metric, hoverStat.hi)}), ${hoverStat.n.toLocaleString()} households surveyed.`
              : `only ${hoverStat?.n ?? 0} matching households surveyed, too few to show.`}
          </>
        ) : (
          <span className="text-gray-500">Hover a state to read it.</span>
        )}
      </div>
      <TipFrame>
        {(show, hide) => (
          <svg
            viewBox={`0 0 ${W} ${MAP_H}`}
            width="100%"
            role="group"
            aria-label={`Map of U.S. states shaded by ${metric.label.toLowerCase()}. Click a state to filter.`}
            onPointerLeave={() => {
              hide();
              setHover(null);
            }}
          >
            {paths.map((p) => {
              const s = stats.get(p.abbr);
              const ok = s !== undefined && s.n >= SMALL_N;
              const picked = states.has(p.abbr);
              const dim = states.size > 0 && !picked;
              return (
                <path
                  key={p.abbr}
                  d={p.d}
                  role="button"
                  tabIndex={0}
                  aria-pressed={picked}
                  aria-label={`${names.get(p.abbr) ?? p.abbr}${ok ? `, ${fmt(metric, s.mean)}` : ', too few households'}`}
                  fill={ok ? shade(s.mean) : '#e4e3de'}
                  fillOpacity={dim ? 0.4 : 1}
                  stroke={picked ? COLORS.ink : hover === p.abbr ? COLORS.ink2 : COLORS.surface}
                  strokeWidth={picked ? 2.5 : hover === p.abbr ? 2 : 1}
                  style={{ cursor: 'pointer', outline: 'none' }}
                  onClick={() => onToggle(p.abbr)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onToggle(p.abbr);
                    }
                  }}
                  onPointerMove={(e) => {
                    setHover(p.abbr);
                    show(
                      e,
                      names.get(p.abbr) ?? p.abbr,
                      ok ? [`${metric.label}: ${fmt(metric, s.mean)}`, `${s.n.toLocaleString()} households surveyed`] : ['Too few matching households'],
                    );
                  }}
                />
              );
            })}
          </svg>
        )}
      </TipFrame>
      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
        <span>{fmt(metric, lo)}</span>
        <div className="h-3 w-40 rounded-full" style={{ background: `linear-gradient(to right, ${metric.ramp[0]}, ${metric.ramp[1]})` }} />
        <span>{fmt(metric, hi)}</span>
      </div>
    </section>
  );
}

// ---------- dot plots by group ----------

const PW = 440;
const ROW = 28;
const LABEL_W = 160;

function GroupPanels({
  data,
  metric,
  scores,
  keepFor,
  filters,
  onToggle,
  nat,
  sel,
}: {
  data: Households;
  metric: Metric;
  scores: Float32Array;
  keepFor: (skip: string | null) => (i: number) => boolean;
  filters: Filters;
  onToggle: (key: string, v: string) => void;
  nat: Stat | null;
  sel: Stat | null;
}) {
  const panels = useMemo(() => {
    const value = metric.value(data, scores);
    return GROUPS.map((g) => ({
      g,
      stats: statsBy(data, keepFor(g.key), (i) => data.col[g.column][i], value, metric.binary),
    }));
  }, [data, metric, scores, keepFor]);
  const top = Math.max(0.01, ...panels.flatMap((p) => [...p.stats.values()].filter((s) => s.n >= SMALL_N).map((s) => s.hi))) * 1.05;
  const x = scaleLinear().domain([0, Math.min(1, top)]).range([LABEL_W, PW - 16]);

  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Who: {metric.label.toLowerCase()} by group</h2>
      <p className="text-sm text-gray-500 mb-2">
        Click a row to filter to that group. Each chart follows the other filters, so you can compare groups within your selection.
      </p>
      <div className="grid md:grid-cols-2 gap-3">
        {panels.map(({ g, stats }) => {
          const H = g.order.length * ROW + 30;
          return (
            <TipFrame key={g.key}>
              {(show, hide) => (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{g.label}</h3>
                  <svg viewBox={`0 0 ${PW} ${H}`} width="100%" role="group" aria-label={`${metric.label} by ${g.label.toLowerCase()}`} onPointerLeave={hide}>
                    {x.ticks(4).map((t) => (
                      <g key={t} transform={`translate(${x(t)},0)`}>
                        <line y1={4} y2={H - 22} stroke={COLORS.grid} />
                        <text y={H - 8} textAnchor="middle" fontSize={11} fill={COLORS.ink2}>
                          {metric.percent ? `${(100 * t).toFixed(0)}%` : (100 * t).toFixed(0)}
                        </text>
                      </g>
                    ))}
                    {nat && (
                      <line x1={x(nat.mean)} x2={x(nat.mean)} y1={4} y2={H - 22} stroke={COLORS.muted} strokeDasharray="4 3" strokeWidth={1.5} />
                    )}
                    {sel && (
                      <line x1={x(sel.mean)} x2={x(sel.mean)} y1={4} y2={H - 22} stroke={metric.color} strokeOpacity={0.35} strokeWidth={1.5} />
                    )}
                    {g.order.map((o, k) => {
                      const s = stats.get(o);
                      const y = 6 + k * ROW + ROW / 2;
                      const picked = filters[g.key] === o;
                      const ok = s !== undefined && s.n >= SMALL_N;
                      return (
                        <g
                          key={o}
                          role="button"
                          tabIndex={0}
                          aria-pressed={picked}
                          aria-label={`${o}${s ? `, ${fmt(metric, s.mean)}` : ', no data'}`}
                          style={{ cursor: 'pointer', outline: 'none' }}
                          onClick={() => onToggle(g.key, o)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onToggle(g.key, o);
                            }
                          }}
                          onPointerMove={(e) =>
                            show(
                              e,
                              o,
                              s
                                ? [`${metric.label}: ${fmt(metric, s.mean)}`, `Range ${fmt(metric, s.lo)} to ${fmt(metric, s.hi)}`, `${s.n.toLocaleString()} households surveyed${ok ? '' : ' (too few)'}`]
                                : ['No matching households'],
                            )
                          }
                        >
                          <rect x={0} y={y - ROW / 2} width={PW} height={ROW} fill={picked ? '#eef3fb' : 'transparent'} rx={6} />
                          <text x={6} y={y} dy="0.32em" fontSize={12} fontWeight={picked ? 700 : 400} fill={COLORS.ink}>
                            {o.length > 24 ? `${o.slice(0, 23)}…` : o}
                          </text>
                          {s && (
                            <>
                              <line x1={x(s.lo)} x2={x(s.hi)} y1={y} y2={y} stroke={metric.color} strokeOpacity={0.45} strokeWidth={3} strokeLinecap="round" />
                              <circle cx={x(s.mean)} cy={y} r={6} fill={ok ? metric.color : COLORS.surface} stroke={metric.color} strokeWidth={2} />
                            </>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}
            </TipFrame>
          );
        })}
        <div className="border border-gray-200 rounded-xl p-3 bg-white text-sm text-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">How to read these</h3>
          <ul className="space-y-1.5 text-xs">
            <li>Dot: the rate for that group. The line around it is the approximate 95% range.</li>
            <li>Dashed gray line: the national rate{nat ? ` (${fmt(metric, nat.mean)})` : ''}.</li>
            <li>Faint colored line: the rate for everything currently in view{sel ? ` (${fmt(metric, sel.mean)})` : ''}.</li>
            <li>Hollow dot: fewer than {SMALL_N} surveyed households, too few to trust.</li>
            <li>A highlighted row is an active filter. Click it again to remove it.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

// ---------- account access heatmap ----------

const AGES = GROUPS.find((g) => g.key === 'age')?.order ?? [];

function AccessHeatmap({
  data,
  keepFor,
  filters,
  onToggle,
}: {
  data: Households;
  keepFor: (skip: string | null) => (i: number) => boolean;
  filters: Filters;
  onToggle: (key: string, v: string) => void;
}) {
  const cells = useMemo(() => accessShares(data, keepFor('age'), 'age_group', AGES), [data, keepFor]);
  const byKey = new Map(cells.map((c) => [`${c.group}|${c.method}`, c]));
  const peak = Math.max(0.01, ...cells.filter((c) => c.groupN >= SMALL_N).map((c) => c.share));
  const shade = scaleLinear<string>().domain([0, peak]).range(['#f3f7fd', '#1f5fae']).clamp(true);
  const LW = 110;
  const CW = (W - LW) / AGES.length;
  const RH = 34;
  const H = ACCESS_METHODS.length * RH + 46;

  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">How: the main way banked households reach their account</h2>
      <p className="text-sm text-gray-500 mb-2">
        Each column adds to 100% of banked households in that age group. It follows the other filters. Click an age to filter to it.
      </p>
      <TipFrame>
        {(show, hide) => (
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="group" aria-label="Main way of accessing an account, by age group" onPointerLeave={hide}>
            {AGES.map((a, c) => {
              const picked = filters.age === a;
              return (
                <g
                  key={a}
                  role="button"
                  tabIndex={0}
                  aria-pressed={picked}
                  aria-label={`Age ${a}`}
                  style={{ cursor: 'pointer', outline: 'none' }}
                  onClick={() => onToggle('age', a)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onToggle('age', a);
                    }
                  }}
                >
                  <rect x={LW + c * CW + 2} y={2} width={CW - 4} height={24} rx={6} fill={picked ? '#0b0b0b' : '#f0efeb'} />
                  <text x={LW + c * CW + CW / 2} y={14} dy="0.32em" textAnchor="middle" fontSize={12} fill={picked ? '#fff' : COLORS.ink}>
                    {a}
                  </text>
                </g>
              );
            })}
            {ACCESS_METHODS.map((m, r) => (
              <g key={m}>
                <text x={LW - 8} y={34 + r * RH + RH / 2} dy="0.32em" textAnchor="end" fontSize={12} fill={COLORS.ink}>
                  {m}
                </text>
                {AGES.map((a, c) => {
                  const cell = byKey.get(`${a}|${m}`);
                  const ok = cell !== undefined && cell.groupN >= SMALL_N;
                  const v = cell?.share ?? 0;
                  return (
                    <g
                      key={a}
                      onPointerMove={(e) =>
                        show(
                          e,
                          `${m}, age ${a}`,
                          ok
                            ? [`${(100 * v).toFixed(1)}% of banked households in this age group`, `${cell.n.toLocaleString()} of ${cell.groupN.toLocaleString()} households surveyed`]
                            : ['Too few matching households'],
                        )
                      }
                    >
                      <rect x={LW + c * CW + 1} y={34 + r * RH + 1} width={CW - 2} height={RH - 2} rx={4} fill={ok ? shade(v) : '#e4e3de'} />
                      {ok && (
                        <text
                          x={LW + c * CW + CW / 2}
                          y={34 + r * RH + RH / 2}
                          dy="0.32em"
                          textAnchor="middle"
                          fontSize={12}
                          fill={v > peak * 0.55 ? '#fff' : COLORS.ink}
                          style={{ pointerEvents: 'none' }}
                        >
                          {(100 * v).toFixed(0)}%
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            ))}
          </svg>
        )}
      </TipFrame>
    </section>
  );
}
