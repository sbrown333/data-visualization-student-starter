import { useEffect, useMemo, useRef, useState } from 'react';
import { select } from 'd3-selection';
import { scaleLinear } from 'd3-scale';
import { geoAlbersUsa, geoPath } from 'd3-geo';
import type { FeatureCollection, Geometry } from 'geojson';

const DATA_URL = `${import.meta.env.BASE_URL}data/digital-payments/banking_sample_10000.csv`;
const GEO_URL = `${import.meta.env.BASE_URL}data/geo/us-states.json`;

interface HouseholdRow {
  state: string;
  banking_status: string;
}

function parseCSV(text: string): HouseholdRow[] {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(',');
  const idx = {
    state: header.indexOf('state'),
    banking_status: header.indexOf('banking_status'),
  };
  const rows: HouseholdRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length <= idx.banking_status) continue;
    rows.push({ state: cols[idx.state], banking_status: cols[idx.banking_status] });
  }
  return rows;
}

const STATUS_ORDER = ['Unbanked', 'Underbanked', 'Fully Banked'];

// Each status gets its own light->dark single-hue ramp (matching that
// status's accent color elsewhere on the page), so only one hue is ever on
// screen at once - just tied to whichever status is currently selected.
const STATUS_RAMPS: Record<string, [string, string]> = {
  Unbanked: ['#fde8e8', '#d03b3b'],
  Underbanked: ['#fef3d9', '#fab219'],
  'Fully Banked': ['#e3f7e3', '#0ca30c'],
};

function computeStateStats(rows: HouseholdRow[], status: string): Map<string, { total: number; count: number }> {
  const map = new Map<string, { total: number; count: number }>();
  for (const r of rows) {
    const entry = map.get(r.state) ?? { total: 0, count: 0 };
    entry.total += 1;
    if (r.banking_status === status) entry.count += 1;
    map.set(r.state, entry);
  }
  return map;
}

interface TooltipState {
  x: number;
  y: number;
  name: string;
  status: string;
  count: number;
  total: number;
  pct: number;
}

function Map2D({
  geo,
  stats,
  status,
  onHover,
}: {
  geo: FeatureCollection<Geometry, { name: string; abbr: string }>;
  stats: Map<string, { total: number; count: number }>;
  status: string;
  onHover: (t: TooltipState | null) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const width = 960;
  const height = 600;

  const maxPct = useMemo(() => {
    let max = 0;
    for (const { total, count } of stats.values()) {
      if (total === 0) continue;
      const pct = (100 * count) / total;
      if (pct > max) max = pct;
    }
    return max || 1;
  }, [stats]);

  const color = useMemo(() => {
    const [light, dark] = STATUS_RAMPS[status];
    return scaleLinear<string>().domain([0, maxPct]).range([light, dark]).clamp(true);
  }, [status, maxPct]);

  useEffect(() => {
    if (!ref.current) return;
    const svg = select(ref.current);
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    svg.selectAll('*').remove();

    // Fit against the contiguous states only. This source's Alaska geometry
    // uses longitudes that continue past -180 for the Aleutians, which
    // throws off fitSize's bounding box and squashes the whole map. AK/HI
    // still render correctly afterward via geoAlbersUsa's fixed insets -
    // their own extent isn't needed to size those insets.
    const conus: FeatureCollection<Geometry, { name: string; abbr: string }> = {
      type: 'FeatureCollection',
      features: geo.features.filter((f) => f.properties.abbr !== 'AK' && f.properties.abbr !== 'HI'),
    };
    const projection = geoAlbersUsa().fitSize([width, height], conus);
    const path = geoPath(projection);

    svg
      .append('g')
      .selectAll('path')
      .data(geo.features)
      .join('path')
      .attr('d', (d) => path(d) ?? '')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1)
      .attr('fill', (d) => {
        const s = stats.get(d.properties.abbr);
        if (!s || s.total === 0) return '#f3f4f6';
        return color((100 * s.count) / s.total);
      })
      .style('cursor', 'default')
      .on('mousemove', (event, d) => {
        const s = stats.get(d.properties.abbr);
        if (!s || s.total === 0) return;
        const [mx, my] = [event.offsetX, event.offsetY];
        onHover({
          x: mx,
          y: my,
          name: d.properties.name,
          status,
          count: s.count,
          total: s.total,
          pct: (100 * s.count) / s.total,
        });
      })
      .on('mouseleave', () => onHover(null));
  }, [geo, stats, status, color, onHover]);

  return <svg ref={ref} width="100%" style={{ maxWidth: width, height: 'auto' }} />;
}

export function StateMap() {
  const [rows, setRows] = useState<HouseholdRow[] | null>(null);
  const [geo, setGeo] = useState<FeatureCollection<Geometry, { name: string; abbr: string }> | null>(null);
  const [status, setStatus] = useState<string>('Unbanked');
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    fetch(DATA_URL)
      .then((res) => res.text())
      .then((text) => setRows(parseCSV(text)));
    fetch(GEO_URL)
      .then((res) => res.json())
      .then((data) => setGeo(data));
  }, []);

  const stats = useMemo(() => (rows ? computeStateStats(rows, status) : new Map()), [rows, status]);

  if (!rows || !geo) {
    return <div className="text-gray-500">Loading...</div>;
  }

  const maxPct = Math.max(
    ...Array.from(stats.values())
      .filter((s) => s.total > 0)
      .map((s) => (100 * s.count) / s.total),
  );

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4" role="group" aria-label="Choose banking status to map">
        {STATUS_ORDER.map((s) => {
          const active = s === status;
          const [, dark] = STATUS_RAMPS[s];
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-opacity"
              style={{
                borderColor: dark,
                opacity: active ? 1 : 0.4,
                backgroundColor: active ? `${dark}15` : 'transparent',
              }}
              aria-pressed={active}
            >
              <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: dark }} />
              <span className="text-gray-800">{s}</span>
            </button>
          );
        })}
      </div>

      <div className="relative border border-gray-200 rounded-xl p-4 bg-white">
        <Map2D geo={geo} stats={stats} status={status} onHover={setTooltip} />
        {tooltip && (
          <div
            className="absolute pointer-events-none bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg z-10"
            style={{ left: tooltip.x + 16, top: tooltip.y + 8 }}
          >
            <div className="font-semibold mb-0.5">{tooltip.name}</div>
            <div>
              {tooltip.count.toLocaleString()} of {tooltip.total.toLocaleString()} households {tooltip.status}{' '}
              ({tooltip.pct.toFixed(1)}%)
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mt-4 text-xs text-gray-500">
        <span>0%</span>
        <div
          className="h-3 w-40 rounded-full"
          style={{ background: `linear-gradient(to right, ${STATUS_RAMPS[status][0]}, ${STATUS_RAMPS[status][1]})` }}
        />
        <span>{maxPct.toFixed(0)}%+</span>
      </div>
    </div>
  );
}
