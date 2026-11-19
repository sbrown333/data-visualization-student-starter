import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { scaleLinear } from 'd3-scale';
import { geoAlbersUsa, geoPath } from 'd3-geo';
import type { FeatureCollection, Geometry } from 'geojson';
import { COLORS, GROUPS, HOUSEHOLDS_URL, SMALL_N, parseHouseholds } from '../week-08/households';
import type { Households } from '../week-08/households';
import { ALL_KEYS, buildComponents, scoreAll } from '../week-08/readiness';
import { Tip } from '../week-11/tip';
import { ACCESS_METHODS, accessShares, countKept, overallStat, statsBy } from '../week-11/dash';
import type { Stat } from '../week-11/dash';
import { TrendPanel } from './Trend';
import { TRENDS_URL, parseTrends } from './trends';
import type { TrendRow } from './trends';

// Week 13: the Week 11 dashboard, improved after outside feedback, plus an over-time view.
// Week 11 (kept as it was): the project as one dashboard. A single set of filters (five menus plus
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
    ramp: ['#f1e2e4', '#a8384f'],
    color: '#a8384f',
    sentence: 'are unbanked',
  },
  {
    key: 'online',
    label: 'Online payment use',
    value: (h) => (i) => yn(h.col.online_payment_services[i]),
    binary: true,
    percent: true,
    ramp: ['#e0e8ee', '#3a6a92'],
    color: '#3a6a92',
    sentence: 'use online payment services',
  },
  {
    key: 'smartphone',
    label: 'Smartphone',
    value: (h) => (i) => yn(h.col.smartphone[i]),
    binary: true,
    percent: true,
    ramp: ['#e0e8ee', '#3a6a92'],
    color: '#3a6a92',
    sentence: 'have a smartphone',
  },
  {
    key: 'readiness',
    label: 'Readiness score',
    value: (_h, s) => (i) => (Number.isNaN(s[i]) ? null : s[i] / 100),
    binary: false,
    percent: false,
    ramp: ['#e0e8ee', '#3a6a92'],
    color: '#3a6a92',
    sentence: 'score on readiness',
  },
];

const fmt = (m: Metric, v: number, digits = 1) => (m.percent ? `${(100 * v).toFixed(digits)}%` : (100 * v).toFixed(digits));
const fmtM = (n: number) => (n < 1e6 ? `${Math.round(n / 1000).toLocaleString()} thousand` : `${(n / 1e6).toFixed(1)} million`);

type Filters = Record<string, string | null>;
const NO_FILTERS: Filters = Object.fromEntries(GROUPS.map((g) => [g.key, null]));

const W = 760;
const MAP_H = 440;
// Small northeastern states are too small to hold a label; hover or click them instead.
const TINY = new Set(['VT', 'NH', 'MA', 'RI', 'CT', 'NJ', 'DE', 'MD', 'DC']);

// Look: cool slate. Slate title bars, light gray page, soft teal for the active choice.
const INK = '#37424f';
const PAGE = '#e8ebee';
const PANEL = '#fafbfc';
const CHIP = '#dde3e8';
const PICK = '#cfe5e2';
const ACCENT = '#6aa5a0';
const FONT = "'Nunito', 'Trebuchet MS', 'Segoe UI', sans-serif";
const START: { label: string; key: string; value: string }[] = [
  { label: 'Income under $15k', key: 'income', value: 'Under $15k' },
  { label: 'Age 65+', key: 'age', value: '65+' },
  { label: 'Age 15-24', key: 'age', value: '15-24' },
  { label: 'Renters', key: 'tenure', value: 'Renter or other' },
  { label: 'Not in labor force', key: 'employment', value: 'Not in labor force' },
];
const DEFINITIONS = [
  { term: 'Unbanked', text: 'no one in the household has a checking or savings account.' },
  { term: 'Online payment use', text: 'someone in the household used an online or app-based payment service in the past year.' },
  { term: 'Smartphone', text: 'the household has a smartphone, used here as a stand-in for internet access.' },
  { term: 'Readiness score', text: 'my own 0 to 100 index of how well placed a household is to use digital payments. Higher is better.' },
];
const SHORT: Record<string, string> = {
  'No high school diploma': 'No HS diploma',
  'High school diploma': 'HS diploma',
  'Renter or other': 'Renter / other',
};

export function Week13() {
  const [data, setData] = useState<Households | null>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [trends, setTrends] = useState<TrendRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The font is loaded for this page only and removed when you leave it.
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap';
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, []);

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
      fetch(TRENDS_URL).then((r) => {
        if (!r.ok) throw new Error(`Could not load the over-time data (${r.status}).`);
        return r.text();
      }),
    ])
      .then(([text, g, t]) => {
        if (cancelled) return;
        setData(parseHouseholds(text));
        setGeo(g);
        setTrends(parseTrends(t));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Something went wrong loading the data.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="w-full h-full overflow-y-auto flex flex-col" style={{ background: PAGE, fontFamily: FONT, color: INK }}>
      {error && <p className="p-6 text-sm text-red-700">{error}</p>}
      {!error && (!data || !geo || !trends) && <p className="p-6 text-sm text-gray-600">Loading data…</p>}
      {data && geo && trends && <Dashboard data={data} geo={geo} trends={trends} />}
    </div>
  );
}

// ---------- shared look ----------

function Panel({ title, right, children, className = '', bg = PANEL }: { title?: string; right?: ReactNode; children: ReactNode; className?: string; bg?: string }) {
  return (
    <section className={`flex flex-col rounded-2xl overflow-hidden min-h-0 ${className}`} style={{ background: bg, border: `2px solid ${INK}` }}>
      {title && (
        <header className="px-3 py-1.5 text-center text-sm font-extrabold text-white relative" style={{ background: INK }}>
          {title}
          {right && <div className="absolute right-2 top-1/2 -translate-y-1/2">{right}</div>}
        </header>
      )}
      <div className="flex-1 min-h-0 flex flex-col p-2">{children}</div>
    </section>
  );
}

function Chip({ active, onClick, children, dark = false }: { active: boolean; onClick: () => void; children: ReactNode; dark?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="px-3 py-1 rounded-full text-xs font-bold"
      style={
        active
          ? { background: ACCENT, color: INK, border: `2px solid ${dark ? ACCENT : INK}` }
          : { background: dark ? 'transparent' : PANEL, color: dark ? '#fff' : INK, border: `2px solid ${dark ? 'rgba(255,255,255,0.55)' : INK}` }
      }
    >
      {children}
    </button>
  );
}

function Dashboard({ data, geo, trends }: { data: Households; geo: Geo; trends: TrendRow[] }) {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [states, setStates] = useState<ReadonlySet<string>>(new Set());
  const [metricKey, setMetricKey] = useState('unbanked');
  const [showAbout, setShowAbout] = useState(false);
  const [view, setView] = useState<'map' | 'time'>('map');
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
  const selStat = useMemo(
    () => overallStat(data, keepFor(null), metric.value(data, scores), metric.binary),
    [data, scores, metric, keepFor],
  );

  return (
    <div className="flex-1 flex flex-col gap-3 p-3">
      {/* ---------- top bar: title, filters, measure ---------- */}
      <header className="rounded-2xl px-4 py-2.5" style={{ background: INK, border: `2px solid ${INK}` }}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-2">
          <h1 className="text-base font-extrabold text-white leading-tight">Left Behind? Mapping America&apos;s Digital Payments Divide</h1>
          <div className="flex flex-wrap items-center gap-1.5 ml-auto" role="group" aria-label="Choose a measure">
            <span className="text-[11px] font-bold text-white/70 mr-1">Show:</span>
            {METRICS.map((m) => (
              <Chip dark key={m.key} active={m.key === metricKey} onClick={() => setMetricKey(m.key)}>
                {m.label}
              </Chip>
            ))}
          </div>
          <Chip dark active={false} onClick={() => setShowAbout(true)}>
            About the data
          </Chip>
        </div>
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
          {GROUPS.map((g) => (
            <label key={g.key} className="text-[11px] font-bold text-white/70 flex flex-col">
              {g.label}
              <select
                className="mt-0.5 rounded-lg px-2 py-1 text-sm font-semibold"
                style={{ background: PANEL, color: INK, border: `2px solid ${INK}` }}
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
          <div className="flex items-center gap-1.5 pb-1">
            <span className="text-[11px] font-bold text-white/70">States:</span>
            {states.size === 0 ? (
              <span className="text-[11px] text-white/70">all</span>
            ) : (
              [...states].sort().map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleState(s)}
                  aria-label={`Remove ${names.get(s) ?? s} from the filter`}
                  className="px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{ background: ACCENT, color: INK }}
                >
                  {s} ✕
                </button>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={reset}
            disabled={!anyFilter}
            className="px-3 py-1 mb-0.5 rounded-full text-xs font-bold text-white disabled:opacity-40"
            style={{ border: '2px solid rgba(255,255,255,0.55)' }}
          >
            Reset all
          </button>
        </div>
      </header>

      {/* ---------- summary strip ---------- */}
      <Panel>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex-1 min-w-[260px]">
            <Headline tiles={tiles} anyFilter={anyFilter} />
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span className="text-xs font-extrabold">Start here:</span>
              {START.map((p) => (
                <Chip key={p.label} active={filters[p.key] === p.value} onClick={() => toggleFilter(p.key, p.value)}>
                  {p.label}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 ml-auto">
            <Tile label="Households in view" value={fmtM(tiles.counts.households)} sub={`${tiles.counts.n.toLocaleString()} of ${tiles.total.n.toLocaleString()} surveyed`} />
            {tiles.rows.map(({ m, sel, nat }) => (
              <Tile key={m.key} label={m.label} value={sel ? fmt(m, sel.mean) : 'n/a'} sub={`nation ${nat ? fmt(m, nat.mean) : 'n/a'}`} />
            ))}
          </div>
        </div>
      </Panel>

      {/* ---------- plain-language definitions ---------- */}
      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 xl:grid-cols-4 px-1 text-xs leading-snug">
        {DEFINITIONS.map((d) => (
          <p key={d.term}>
            <b>{d.term}:</b> {d.text}
          </p>
        ))}
      </div>

      {/* ---------- dot plots and heatmap on the left, map or over-time chart on the right ---------- */}
      <div className="grid gap-3 xl:grid-cols-[1fr_1.1fr] xl:flex-1 xl:min-h-[600px]">
        <div className="grid gap-3 xl:grid-rows-[auto_1fr] min-h-0">
          <GroupPanels data={data} metric={metric} scores={scores} keepFor={keepFor} filters={filters} onToggle={toggleFilter} nat={natStat} sel={selStat} />
          <AccessHeatmap data={data} keepFor={keepFor} filters={filters} onToggle={toggleFilter} />
        </div>
        <div className="flex flex-col gap-2 min-h-0">
          <div className="flex items-center gap-2" role="group" aria-label="Choose a view">
            <span className="text-xs font-extrabold">View:</span>
            <Chip active={view === 'map'} onClick={() => setView('map')}>
              Map by state
            </Chip>
            <Chip active={view === 'time'} onClick={() => setView('time')}>
              Over time, 2009 to 2023
            </Chip>
          </div>
          {view === 'map' ? (
            <StateMap data={data} geo={geo} names={names} metric={metric} scores={scores} keepFor={keepFor} states={states} onToggle={toggleState} />
          ) : (
            <Panel bg="#ffffff" className="flex-1" title="When: how the divide has changed">
              <TrendPanel rows={trends} states={states} filters={filters} names={names} />
            </Panel>
          )}
        </div>
      </div>

      {showAbout && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-6" style={{ background: 'rgba(55,66,79,0.5)' }} onClick={() => setShowAbout(false)}>
          <div className="max-w-xl w-full" onClick={(e) => e.stopPropagation()}>
            <Panel title="About the data" right={<Chip active={false} onClick={() => setShowAbout(false)}>Close</Chip>}>
              <div className="text-sm leading-relaxed p-2">
                <p className="mb-2">
                  Source: FDIC National Survey of Unbanked and Underbanked Households. The map, group charts and heatmap use the 2023 survey (29,483 responding households). The over-time view uses the FDIC multi-year file, with surveys from 2009 to 2023 (about 570,000 households in all). Every
                  rate uses the FDIC household weight, so it stands for all U.S. households, not just those surveyed. Ranges are
                  approximate 95% ranges that allow for unequal weights but not the survey&apos;s clustering, so they are a little
                  narrower than the FDIC&apos;s own. Hollow dots and gray cells mean fewer than {SMALL_N} surveyed households, too few to trust.
                </p>
                <p className="mb-2">
                  Over time: each line is a weighted rate for one group in one survey year. The underbanked rate is left out because its definition changed between
                  surveys. The smartphone question was not asked in 2021, and the main-way-of-access question starts in 2013.
                </p>
                <p>
                  The readiness score is my own index, not an official measure: the average of banking status, smartphone, online
                  payments, credit card, digital banking and income, scaled 0 to 100. Cash dependence and home internet are not in
                  the 2023 file, so a smartphone stands in for internet access.
                </p>
              </div>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl px-2.5 py-1 min-w-[112px]" style={{ background: CHIP }}>
      <div className="text-[11px] font-bold" style={{ opacity: 0.7 }}>
        {label}
      </div>
      <div className="text-lg font-extrabold leading-tight">{value}</div>
      <div className="text-[11px]" style={{ opacity: 0.7 }}>
        {sub}
      </div>
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
    text = `In 2023, ${fmt(un.m, un.nat.mean)} of U.S. households were unbanked, about ${fmtM(un.nat.households * un.nat.mean)} households. Click a group below, a state on the map, or a button under this sentence to see who is left behind.`;
  } else if (!un.sel || tiles.counts.n < SMALL_N) {
    text = `Only ${tiles.counts.n} surveyed households match these filters, too few to trust. Try fewer filters.`;
  } else {
    const ratio = un.sel.mean / un.nat.mean;
    const rel = ratio >= 1.2 ? `${ratio.toFixed(1)} times the national rate` : ratio <= 0.83 ? `${Math.round((1 - ratio) * 100)}% below the national rate` : 'close to the national rate';
    text = `Households matching your filters (${fmtM(tiles.counts.households)}) are ${fmt(un.m, un.sel.mean)} unbanked (nation ${fmt(un.m, un.nat.mean)}), ${rel}.`;
  }
  return (
    <p className="text-sm font-semibold" aria-live="polite">
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
    return geo.features.map((f) => {
      const c = path.centroid(f);
      return { abbr: f.properties.abbr, d: path(f) ?? '', cx: c[0], cy: c[1] };
    });
  }, [geo]);
  const solid = [...stats.values()].filter((s) => s.n >= SMALL_N).map((s) => s.mean);
  const lo = solid.length ? Math.min(...solid) : 0;
  const hi = solid.length ? Math.max(...solid) : 1;
  const shade = scaleLinear<string>().domain([lo, hi === lo ? lo + 0.01 : hi]).range(metric.ramp).clamp(true);
  const [hover, setHover] = useState<string | null>(null);
  const hoverStat = hover ? stats.get(hover) : undefined;

  return (
    <Panel bg="#ffffff" className="flex-1" title={`Where: ${metric.label.toLowerCase()} by state`}>
      <Tip className="flex-1 min-h-[300px]">
        {(show, hide) => (
          <svg
            viewBox={`0 0 ${W} ${MAP_H}`}
            className="absolute inset-0 w-full h-full"
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
                  stroke={picked ? INK : hover === p.abbr ? COLORS.ink2 : PANEL}
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
            {paths.map((p) =>
              Number.isFinite(p.cx) && !TINY.has(p.abbr) ? (
                <text key={`l-${p.abbr}`} x={p.cx} y={p.cy} dy="0.32em" textAnchor="middle" fontSize={10} fontWeight={700} fill={INK} style={{ pointerEvents: 'none' }}>
                  {p.abbr}
                </text>
              ) : null,
            )}
          </svg>
        )}
      </Tip>
      {states.size > 0 && (
        <p className="pt-2 text-xs font-semibold">
          Picked: {[...states].sort().map((a) => names.get(a) ?? a).join(', ')}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-xs" aria-live="polite">
        <div className="flex items-center gap-1.5 font-semibold">
          <span>{fmt(metric, lo)}</span>
          <div className="h-2.5 w-28 rounded-full" style={{ background: `linear-gradient(to right, ${metric.ramp[0]}, ${metric.ramp[1]})` }} />
          <span>{fmt(metric, hi)}</span>
        </div>
        <span style={{ opacity: 0.75 }}>
          {hover ? (
            <>
              <b>{names.get(hover) ?? hover}</b>:{' '}
              {hoverStat && hoverStat.n >= SMALL_N
                ? `${fmt(metric, hoverStat.mean)} (range ${fmt(metric, hoverStat.lo)} to ${fmt(metric, hoverStat.hi)}), ${hoverStat.n.toLocaleString()} surveyed`
                : `only ${hoverStat?.n ?? 0} matching households, too few to show`}
            </>
          ) : (
            'Click states to filter. Gray states have too few matching households.'
          )}
        </span>
      </div>
    </Panel>
  );
}

// ---------- dot plots by group ----------

const PW = 205;
const ROW = 22;
const LABEL_W = 86;

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
  const x = scaleLinear().domain([0, Math.min(1, top)]).range([LABEL_W, PW - 12]);

  return (
    <Panel title={`Who: ${metric.label.toLowerCase()} by group`}>
      <div className="grid gap-x-2 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
        {panels.map(({ g, stats }) => {
          const H = g.order.length * ROW + 22;
          return (
            <Tip key={g.key}>
              {(show, hide) => (
                <div>
                  <h3 className="text-xs font-extrabold">{g.label}</h3>
                  <svg viewBox={`0 0 ${PW} ${H}`} width="100%" role="group" aria-label={`${metric.label} by ${g.label.toLowerCase()}`} onPointerLeave={hide}>
                    {x.ticks(3).map((t) => (
                      <g key={t} transform={`translate(${x(t)},0)`}>
                        <line y1={2} y2={H - 16} stroke="#dde3e8" />
                        <text y={H - 4} textAnchor="middle" fontSize={10} fill={COLORS.ink2}>
                          {metric.percent ? `${(100 * t).toFixed(0)}%` : (100 * t).toFixed(0)}
                        </text>
                      </g>
                    ))}
                    {nat && <line x1={x(nat.mean)} x2={x(nat.mean)} y1={2} y2={H - 16} stroke="#7b8794" strokeDasharray="4 3" strokeWidth={1.5} />}
                    {sel && <line x1={x(sel.mean)} x2={x(sel.mean)} y1={2} y2={H - 16} stroke={metric.color} strokeOpacity={0.4} strokeWidth={1.5} />}
                    {g.order.map((o, k) => {
                      const s = stats.get(o);
                      const y = 4 + k * ROW + ROW / 2;
                      const picked = filters[g.key] === o;
                      const ok = s !== undefined && s.n >= SMALL_N;
                      const label = SHORT[o] ?? o;
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
                          <rect x={0} y={y - ROW / 2} width={PW} height={ROW} fill={picked ? PICK : 'transparent'} rx={5} />
                          <text x={4} y={y} dy="0.32em" fontSize={10.5} fontWeight={picked ? 800 : 600} fill={INK}>
                            {label.length > 15 ? `${label.slice(0, 14)}…` : label}
                          </text>
                          {s && (
                            <>
                              <line x1={x(s.lo)} x2={x(s.hi)} y1={y} y2={y} stroke={metric.color} strokeOpacity={0.45} strokeWidth={3} strokeLinecap="round" />
                              <circle cx={x(s.mean)} cy={y} r={5} fill={ok ? metric.color : PANEL} stroke={metric.color} strokeWidth={2} />
                            </>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}
            </Tip>
          );
        })}
        <div className="text-xs leading-snug self-start rounded-xl p-2.5" style={{ background: CHIP }}>
          <div className="text-sm font-extrabold mb-1">How to read</div>
          <svg viewBox="0 0 150 30" width="130" aria-hidden="true" className="mb-1">
            <line x1={4} x2={146} y1={15} y2={15} stroke="#c5ced6" />
            <line x1={50} x2={50} y1={2} y2={28} stroke="#7b8794" strokeDasharray="4 3" strokeWidth={1.5} />
            <line x1={86} x2={134} y1={15} y2={15} stroke={metric.color} strokeOpacity={0.45} strokeWidth={3} strokeLinecap="round" />
            <circle cx={110} cy={15} r={5} fill={metric.color} />
          </svg>
          <p>
            <b>Dot</b> = group rate. <b>Faint bar</b> = likely range. <b>Dashed line</b> = nation{nat ? ` (${fmt(metric, nat.mean)})` : ''}. <b>Hollow dot</b> = under {SMALL_N}{' '}
            households. Click a row to filter.
          </p>
        </div>
      </div>
    </Panel>
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
  const shade = scaleLinear<string>().domain([0, peak]).range(['#e6edf3', '#3a6a92']).clamp(true);
  const HW = 600;
  const LW = 86;
  const CW = (HW - LW) / AGES.length;
  const RH = 24;
  const H = ACCESS_METHODS.length * RH + 34;

  return (
    <Panel title="How: main way banked households reach their account, by age">
      <Tip className="flex-1">
        {(show, hide) => (
          <svg viewBox={`0 0 ${HW} ${H}`} width="100%" role="group" aria-label="Main way of accessing an account, by age group" onPointerLeave={hide}>
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
                  <rect x={LW + c * CW + 2} y={2} width={CW - 4} height={22} rx={6} fill={picked ? ACCENT : CHIP} stroke={picked ? INK : 'none'} strokeWidth={2} />
                  <text x={LW + c * CW + CW / 2} y={13} dy="0.32em" textAnchor="middle" fontSize={12} fontWeight={700} fill={INK}>
                    {a}
                  </text>
                </g>
              );
            })}
            {ACCESS_METHODS.map((m, r) => (
              <g key={m}>
                <text x={LW - 8} y={30 + r * RH + RH / 2} dy="0.32em" textAnchor="end" fontSize={12} fontWeight={600} fill={INK}>
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
                      <rect x={LW + c * CW + 1} y={30 + r * RH + 1} width={CW - 2} height={RH - 2} rx={4} fill={ok ? shade(v) : '#e4e3de'} />
                      {!ok && (
                        <text x={LW + c * CW + CW / 2} y={30 + r * RH + RH / 2} dy="0.32em" textAnchor="middle" fontSize={10} fill="#6b7480" style={{ pointerEvents: 'none' }}>
                          too few
                        </text>
                      )}
                      {ok && (
                        <text
                          x={LW + c * CW + CW / 2}
                          y={30 + r * RH + RH / 2}
                          dy="0.32em"
                          textAnchor="middle"
                          fontSize={12}
                          fontWeight={600}
                          fill={v > peak * 0.55 ? '#fff' : INK}
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
      </Tip>
      <p className="text-[11px] pt-1" style={{ opacity: 0.8 }}>
        Each column adds to 100%. Gray cells say &quot;too few&quot;: fewer than {SMALL_N} surveyed households match, so the number is hidden, not missing.
      </p>
    </Panel>
  );
}
