import { useEffect, useMemo, useRef, useState } from 'react';
import { select } from 'd3-selection';
import { scaleBand, scaleLinear } from 'd3-scale';

const DATA_URL = `${import.meta.env.BASE_URL}data/digital-payments/banking_sample_10000.csv`;

interface HouseholdRow {
  state: string;
  employment_status: string;
  primary_access_method: string;
}

function parseCSV(text: string): HouseholdRow[] {
  // The source file uses CRLF line endings; splitting on \n alone leaves a
  // trailing \r on the last column of the header and of every row.
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(',');
  const idx = {
    state: header.indexOf('state'),
    employment_status: header.indexOf('employment_status'),
    primary_access_method: header.indexOf('primary_access_method'),
  };
  const rows: HouseholdRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length <= idx.primary_access_method) continue;
    rows.push({
      state: cols[idx.state],
      employment_status: cols[idx.employment_status],
      primary_access_method: cols[idx.primary_access_method],
    });
  }
  return rows;
}

// Collapse the raw employment_status values into 4 readable rows.
const EMPLOYMENT_MAP: Record<string, string> = {
  Employed: 'Employed',
  'Employed - absent from work': 'Employed',
  'Unemployed - looking': 'Unemployed',
  'Unemployed - on layoff': 'Unemployed',
  'Not in labor force - retired': 'Retired',
  'Not in labor force - disabled': 'Not in Labor Force',
  'Not in labor force - other': 'Not in Labor Force',
};
const EMPLOYMENT_ORDER = ['Employed', 'Unemployed', 'Not in Labor Force', 'Retired'];

// Access method columns, ordered least-digital -> most-digital, with
// "Unbanked" first since it's the most important single fact per row.
const ACCESS_ORDER = [
  'N/A (Unbanked)',
  'Bank Teller',
  'ATM/Kiosk',
  'Telephone Banking',
  'Online Banking',
  'Mobile Banking App',
  'Other',
];
const ACCESS_LABELS: Record<string, string> = {
  'N/A (Unbanked)': 'No Method Listed',
  'Bank Teller': 'Teller',
  'ATM/Kiosk': 'ATM/Kiosk',
  'Telephone Banking': 'Phone',
  'Online Banking': 'Online',
  'Mobile Banking App': 'Mobile App',
  Other: 'Other',
};

// US Census regions, by state postal abbreviation.
const REGION_MAP: Record<string, string> = {
  CT: 'Northeast', ME: 'Northeast', MA: 'Northeast', NH: 'Northeast', RI: 'Northeast',
  VT: 'Northeast', NJ: 'Northeast', NY: 'Northeast', PA: 'Northeast',
  IL: 'Midwest', IN: 'Midwest', MI: 'Midwest', OH: 'Midwest', WI: 'Midwest',
  IA: 'Midwest', KS: 'Midwest', MN: 'Midwest', MO: 'Midwest', NE: 'Midwest', ND: 'Midwest', SD: 'Midwest',
  DE: 'South', FL: 'South', GA: 'South', MD: 'South', NC: 'South', SC: 'South', VA: 'South',
  DC: 'South', WV: 'South', AL: 'South', KY: 'South', MS: 'South', TN: 'South',
  AR: 'South', LA: 'South', OK: 'South', TX: 'South',
  AZ: 'West', CO: 'West', ID: 'West', MT: 'West', NV: 'West', NM: 'West', UT: 'West', WY: 'West',
  AK: 'West', CA: 'West', HI: 'West', OR: 'West', WA: 'West',
};
const REGION_ORDER = ['All Regions', 'Northeast', 'Midwest', 'South', 'West'];

interface Cell {
  row: string;
  col: string;
  count: number;
  rowTotal: number;
  pct: number; // share of this row's households that fall in this column
}

function computeMatrix(rows: HouseholdRow[], region: string): Cell[] {
  const filtered = region === 'All Regions' ? rows : rows.filter((r) => REGION_MAP[r.state] === region);

  const rowTotals: Record<string, number> = {};
  const counts: Record<string, Record<string, number>> = {};
  for (const empRow of EMPLOYMENT_ORDER) {
    rowTotals[empRow] = 0;
    counts[empRow] = {};
    for (const col of ACCESS_ORDER) counts[empRow][col] = 0;
  }

  for (const r of filtered) {
    const empRow = EMPLOYMENT_MAP[r.employment_status];
    if (!empRow) continue;
    rowTotals[empRow] += 1;
    counts[empRow][r.primary_access_method] = (counts[empRow][r.primary_access_method] ?? 0) + 1;
  }

  const cells: Cell[] = [];
  for (const empRow of EMPLOYMENT_ORDER) {
    for (const col of ACCESS_ORDER) {
      const count = counts[empRow][col] ?? 0;
      const rowTotal = rowTotals[empRow];
      cells.push({ row: empRow, col, count, rowTotal, pct: rowTotal > 0 ? count / rowTotal : 0 });
    }
  }
  return cells;
}

// Single-hue sequential ramp (navy), light -> dark, matching the site's
// status-palette convention: magnitude gets one hue, never a rainbow.
const CELL_COLOR = scaleLinear<string>().domain([0, 1]).range(['#eef2ff', '#1e3a8a']).clamp(true);

interface TooltipState {
  x: number;
  y: number;
  row: string;
  col: string;
  count: number;
  pct: number;
}

function HeatmapChart({ cells, onHover }: { cells: Cell[]; onHover: (t: TooltipState | null) => void }) {
  const ref = useRef<SVGSVGElement>(null);
  const width = 640;
  const margin = { top: 34, right: 16, bottom: 16, left: 150 };
  const cellGap = 3;

  useEffect(() => {
    if (!ref.current) return;
    const rowHeight = 52;
    const height = margin.top + EMPLOYMENT_ORDER.length * rowHeight + margin.bottom;

    const svg = select(ref.current);
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    svg.selectAll('*').remove();

    const x = scaleBand()
      .domain(ACCESS_ORDER)
      .range([margin.left, width - margin.right])
      .paddingInner(0.08);
    const y = scaleBand()
      .domain(EMPLOYMENT_ORDER)
      .range([margin.top, height - margin.bottom])
      .paddingInner(0.1);

    // Column labels
    svg
      .append('g')
      .selectAll('text')
      .data(ACCESS_ORDER)
      .join('text')
      .attr('x', (d) => (x(d) ?? 0) + x.bandwidth() / 2)
      .attr('y', margin.top - 12)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .attr('font-weight', 600)
      .attr('fill', '#374151')
      .text((d) => ACCESS_LABELS[d]);

    // Row labels
    svg
      .append('g')
      .selectAll('text')
      .data(EMPLOYMENT_ORDER)
      .join('text')
      .attr('x', margin.left - 12)
      .attr('y', (d) => (y(d) ?? 0) + y.bandwidth() / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', 12)
      .attr('font-weight', 600)
      .attr('fill', '#111827')
      .text((d) => d);

    // Cells
    const cellGroup = svg.append('g');
    cellGroup
      .selectAll('rect')
      .data(cells)
      .join('rect')
      .attr('x', (d) => (x(d.col) ?? 0) + cellGap / 2)
      .attr('y', (d) => (y(d.row) ?? 0) + cellGap / 2)
      .attr('width', Math.max(0, x.bandwidth() - cellGap))
      .attr('height', Math.max(0, y.bandwidth() - cellGap))
      .attr('rx', 4)
      .attr('fill', (d) => (d.rowTotal > 0 ? CELL_COLOR(d.pct) : '#f3f4f6'))
      .style('cursor', 'default')
      .on('mousemove', (event, d) => {
        if (d.rowTotal === 0) return;
        const [mx, my] = [event.offsetX, event.offsetY];
        onHover({ x: mx, y: my, row: d.row, col: ACCESS_LABELS[d.col], count: d.count, pct: d.pct });
      })
      .on('mouseleave', () => onHover(null));

    // Direct labels (percentage) inside each cell, colored for contrast
    // against the cell's own fill rather than relying on color alone.
    cellGroup
      .selectAll('text')
      .data(cells)
      .join('text')
      .attr('x', (d) => (x(d.col) ?? 0) + x.bandwidth() / 2)
      .attr('y', (d) => (y(d.row) ?? 0) + y.bandwidth() / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', 12)
      .attr('font-weight', 700)
      .attr('pointer-events', 'none')
      .attr('fill', (d) => (d.rowTotal > 0 && d.pct > 0.42 ? '#f9fafb' : '#111827'))
      .text((d) => (d.rowTotal > 0 && d.pct > 0 ? `${Math.round(d.pct * 100)}%` : ''));
  }, [cells]);

  return <svg ref={ref} width="100%" style={{ maxWidth: width, height: 'auto' }} />;
}

export function AccessHeatmapSection() {
  const [rows, setRows] = useState<HouseholdRow[] | null>(null);
  const [region, setRegion] = useState<string>('All Regions');
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    fetch(DATA_URL)
      .then((res) => res.text())
      .then((text) => setRows(parseCSV(text)));
  }, []);

  const cells = useMemo(() => (rows ? computeMatrix(rows, region) : []), [rows, region]);

  if (!rows) {
    return <div className="text-gray-500">Loading...</div>;
  }

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {REGION_ORDER.map((r) => (
          <button
            key={r}
            onClick={() => setRegion(r)}
            className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
              region === r
                ? 'bg-[#1e3a8a] text-white border-[#1e3a8a]'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="relative border border-gray-200 rounded-xl p-4 bg-white">
        <HeatmapChart cells={cells} onHover={setTooltip} />
        {tooltip && (
          <div
            className="absolute pointer-events-none bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg z-10"
            style={{ left: tooltip.x + 16, top: tooltip.y + 8 }}
          >
            <div className="font-semibold mb-0.5">
              {tooltip.row} - {tooltip.col}
            </div>
            <div>
              {tooltip.count.toLocaleString()} households ({Math.round(tooltip.pct * 100)}% of this row)
            </div>
          </div>
        )}
      </div>

      {/* Sequential scale legend */}
      <div className="flex items-center gap-2 mt-4 text-xs text-gray-500">
        <span>Lower share</span>
        <div
          className="h-3 w-40 rounded-full"
          style={{ background: `linear-gradient(to right, ${CELL_COLOR(0)}, ${CELL_COLOR(1)})` }}
        />
        <span>Higher share</span>
      </div>
    </div>
  );
}

