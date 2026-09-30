import { useEffect, useMemo, useRef, useState } from 'react';
import { select } from 'd3-selection';
import { scaleBand, scaleLinear } from 'd3-scale';

const DATA_URL = `${import.meta.env.BASE_URL}data/digital-payments/banking_sample_10000.csv`;

interface HouseholdRow {
  age_group: string;
  income_bracket: string;
  education_level: string;
  banking_status: string;
}

function parseCSV(text: string): HouseholdRow[] {
  const lines = text.trim().split('\n');
  const header = lines[0].split(',');
  const idx = {
    age_group: header.indexOf('age_group'),
    income_bracket: header.indexOf('income_bracket'),
    education_level: header.indexOf('education_level'),
    banking_status: header.indexOf('banking_status'),
  };
  const rows: HouseholdRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length <= idx.banking_status) continue;
    rows.push({
      age_group: cols[idx.age_group],
      income_bracket: cols[idx.income_bracket],
      education_level: cols[idx.education_level],
      banking_status: cols[idx.banking_status],
    });
  }
  return rows;
}

const STATUS_ORDER = ['Unbanked', 'Underbanked', 'Fully Banked'];
const STATUS_COLORS: Record<string, string> = {
  Unbanked: '#d03b3b',
  Underbanked: '#fab219',
  'Fully Banked': '#0ca30c',
};
const STATUS_DEFINITIONS: Record<string, string> = {
  Unbanked: 'No checking or savings account at a bank or credit union.',
  Underbanked:
    'Has a bank account, but also relies on alternative services like prepaid cards, check cashing, or payday loans.',
  'Fully Banked': 'Has a bank account and does not rely on alternative financial services.',
};

const AGE_ORDER = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];

const INCOME_TIER_MAP: Record<string, string> = {
  'Under $5k': 'Under $25k',
  '$5k-$7.5k': 'Under $25k',
  '$7.5k-$10k': 'Under $25k',
  '$10k-$12.5k': 'Under $25k',
  '$12.5k-$15k': 'Under $25k',
  '$15k-$20k': 'Under $25k',
  '$20k-$25k': 'Under $25k',
  '$25k-$30k': '$25k-$50k',
  '$30k-$35k': '$25k-$50k',
  '$35k-$40k': '$25k-$50k',
  '$40k-$50k': '$25k-$50k',
  '$50k-$60k': '$50k-$100k',
  '$60k-$75k': '$50k-$100k',
  '$75k-$100k': '$50k-$100k',
  '$100k-$150k': '$100k+',
  '$150k+': '$100k+',
};
const INCOME_ORDER = ['Under $25k', '$25k-$50k', '$50k-$100k', '$100k+'];

const EDUCATION_TIER_MAP: Record<string, string> = {
  'Less than 1st grade': 'No HS diploma',
  '1st-4th grade': 'No HS diploma',
  '5th-6th grade': 'No HS diploma',
  '7th-8th grade': 'No HS diploma',
  '9th grade': 'No HS diploma',
  '10th grade': 'No HS diploma',
  '11th grade': 'No HS diploma',
  '12th grade no diploma': 'No HS diploma',
  'High school graduate': 'HS graduate',
  'Some college no degree': 'Some college / associate',
  'Associate degree academic': 'Some college / associate',
  'Associate degree occupational': 'Some college / associate',
  "Bachelor's degree": "Bachelor's or higher",
  "Master's degree": "Bachelor's or higher",
  'Professional degree': "Bachelor's or higher",
  'Doctorate degree': "Bachelor's or higher",
};
const EDUCATION_ORDER = ['No HS diploma', 'HS graduate', 'Some college / associate', "Bachelor's or higher"];

interface CategoryBreakdown {
  category: string;
  total: number;
  counts: Record<string, number>;
}

interface TooltipState {
  factorLabel: string;
  category: string;
  status: string;
  count: number;
  pct: number;
  x: number;
  y: number;
}

function computeBreakdown(
  rows: HouseholdRow[],
  getCategory: (r: HouseholdRow) => string,
  order: string[],
): CategoryBreakdown[] {
  const map = new Map<string, Record<string, number>>();
  for (const cat of order) {
    map.set(cat, { Unbanked: 0, Underbanked: 0, 'Fully Banked': 0 });
  }
  for (const r of rows) {
    const cat = getCategory(r);
    if (!map.has(cat)) continue;
    const counts = map.get(cat)!;
    if (r.banking_status in counts) {
      counts[r.banking_status] += 1;
    }
  }
  return order.map((category) => {
    const counts = map.get(category)!;
    const total = STATUS_ORDER.reduce((sum, s) => sum + counts[s], 0);
    return { category, total, counts };
  });
}

function SmallMultiplePanel({
  title,
  data,
  activeStatuses,
  onHover,
}: {
  title: string;
  data: CategoryBreakdown[];
  activeStatuses: Set<string>;
  onHover: (t: TooltipState | null) => void;
}) {
  const ref = useRef<SVGSVGElement | null>(null);
  const width = 600;
  const rowHeight = 40;
  const margin = { top: 34, right: 64, bottom: 24, left: 190 };
  const height = margin.top + margin.bottom + data.length * rowHeight;

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const svgSel = select(svg);
    svgSel.selectAll('*').remove();

    const innerWidth = width - margin.left - margin.right;

    const x = scaleLinear().domain([0, 100]).range([0, innerWidth]);
    const y = scaleBand()
      .domain(data.map((d) => d.category))
      .range([0, data.length * rowHeight])
      .padding(0.3);

    const g = svgSel.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // gridlines at 0/25/50/75/100%
    g.append('g')
      .selectAll('line')
      .data([0, 25, 50, 75, 100])
      .join('line')
      .attr('x1', (d) => x(d))
      .attr('x2', (d) => x(d))
      .attr('y1', -8)
      .attr('y2', data.length * rowHeight)
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 1);

    g.append('g')
      .selectAll('text.pcttick')
      .data([0, 25, 50, 75, 100])
      .join('text')
      .attr('class', 'pcttick')
      .attr('x', (d) => x(d))
      .attr('y', -14)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10)
      .attr('fill', '#9ca3af')
      .text((d) => `${d}%`);

    // category labels (left)
    g.append('g')
      .selectAll('text.catlabel')
      .data(data)
      .join('text')
      .attr('class', 'catlabel')
      .attr('x', -12)
      .attr('y', (d) => (y(d.category) ?? 0) + y.bandwidth() / 2)
      .attr('dy', '0.32em')
      .attr('text-anchor', 'end')
      .attr('font-size', 12)
      .attr('font-weight', 600)
      .attr('fill', '#111827')
      .text((d) => d.category);

    // n= label (right of bar)
    g.append('g')
      .selectAll('text.nlabel')
      .data(data)
      .join('text')
      .attr('class', 'nlabel')
      .attr('x', innerWidth + 8)
      .attr('y', (d) => (y(d.category) ?? 0) + y.bandwidth() / 2)
      .attr('dy', '0.32em')
      .attr('font-size', 10)
      .attr('fill', '#9ca3af')
      .text((d) => `n=${d.total.toLocaleString()}`);

    // stacked segments per category row
    for (const d of data) {
      let cursor = 0;
      const rowY = y(d.category) ?? 0;
      for (const status of STATUS_ORDER) {
        if (!activeStatuses.has(status)) continue;
        const pct = d.total > 0 ? (100 * d.counts[status]) / d.total : 0;
        const segX0 = cursor;
        const segX1 = cursor + pct;
        cursor = segX1;
        if (pct <= 0) continue;

        g.append('rect')
          .attr('x', x(segX0))
          .attr('y', rowY)
          .attr('width', Math.max(0, x(segX1) - x(segX0)))
          .attr('height', y.bandwidth())
          .attr('fill', STATUS_COLORS[status])
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1)
          .style('cursor', 'pointer')
          .on('mouseenter mousemove', function (event) {
            const rect = svg.getBoundingClientRect();
            onHover({
              factorLabel: title,
              category: d.category,
              status,
              count: d.counts[status],
              pct,
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
            });
          })
          .on('mouseleave', function () {
            onHover(null);
          });

        // inline percent label if segment wide enough
        if (x(segX1) - x(segX0) > 28) {
          g.append('text')
            .attr('x', (x(segX0) + x(segX1)) / 2)
            .attr('y', rowY + y.bandwidth() / 2)
            .attr('dy', '0.32em')
            .attr('text-anchor', 'middle')
            .attr('font-size', 10)
            .attr('font-weight', 700)
            .attr('fill', '#ffffff')
            .attr('pointer-events', 'none')
            .text(`${pct.toFixed(0)}%`);
        }
      }
    }
  }, [data, activeStatuses, title]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="text-sm font-bold text-gray-900 mb-1">{title}</h3>
      <svg ref={ref} width={width} height={height} />
    </div>
  );
}

const DIMENSIONS = ['Age Group', 'Income', 'Education'] as const;
type Dimension = (typeof DIMENSIONS)[number];

export function DisaggregatedView() {
  const [rows, setRows] = useState<HouseholdRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set(STATUS_ORDER));
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [dimension, setDimension] = useState<Dimension>('Age Group');

  useEffect(() => {
    fetch(DATA_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load dataset: ${res.status}`);
        return res.text();
      })
      .then((text) => setRows(parseCSV(text)))
      .catch((err) => setError(String(err)));
  }, []);

  const ageBreakdown = useMemo(
    () => (rows ? computeBreakdown(rows, (r) => r.age_group, AGE_ORDER) : []),
    [rows],
  );
  const incomeBreakdown = useMemo(
    () =>
      rows
        ? computeBreakdown(rows, (r) => INCOME_TIER_MAP[r.income_bracket] ?? 'Unknown', INCOME_ORDER)
        : [],
    [rows],
  );
  const educationBreakdown = useMemo(
    () =>
      rows
        ? computeBreakdown(rows, (r) => EDUCATION_TIER_MAP[r.education_level] ?? 'Unknown', EDUCATION_ORDER)
        : [],
    [rows],
  );

  if (error) {
    return <div className="p-6 text-red-600">Error loading data: {error}</div>;
  }
  if (!rows) {
    return <div className="p-6 text-gray-500">Loading dataset...</div>;
  }

  function toggleStatus(status: string) {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
    setTooltip(null);
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-3 mb-6" role="group" aria-label="Toggle banking status categories">
        {STATUS_ORDER.map((status) => {
          const active = activeStatuses.has(status);
          return (
            <button
              key={status}
              type="button"
              onClick={() => toggleStatus(status)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-opacity"
              style={{
                borderColor: STATUS_COLORS[status],
                opacity: active ? 1 : 0.4,
                backgroundColor: active ? `${STATUS_COLORS[status]}15` : 'transparent',
              }}
              aria-pressed={active}
            >
              <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
              <span className="text-gray-800">{status}</span>
            </button>
          );
        })}
        <span className="text-xs text-gray-400 self-center ml-2">
          Click a status to isolate it, for example hide Fully Banked to compare Unbanked and Underbanked rates
          directly across groups.
        </span>
      </div>

      <div className="flex gap-2 mb-4" role="group" aria-label="Choose demographic dimension">
        {DIMENSIONS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDimension(d)}
            className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
              dimension === d
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-5">
        {dimension === 'Age Group' && (
          <SmallMultiplePanel title="By Age Group" data={ageBreakdown} activeStatuses={activeStatuses} onHover={setTooltip} />
        )}
        {dimension === 'Income' && (
          <SmallMultiplePanel title="By Income" data={incomeBreakdown} activeStatuses={activeStatuses} onHover={setTooltip} />
        )}
        {dimension === 'Education' && (
          <SmallMultiplePanel
            title="By Education"
            data={educationBreakdown}
            activeStatuses={activeStatuses}
            onHover={setTooltip}
          />
        )}
      </div>

      {tooltip && (
        <div
          className="absolute pointer-events-none bg-gray-900 text-white text-sm rounded px-3 py-2 shadow-lg max-w-xs z-10"
          style={{ left: tooltip.x + 16, top: tooltip.y - 10 }}
        >
          <div className="font-bold mb-1">
            {tooltip.category} &middot; {tooltip.status}
          </div>
          <div className="mb-1">{STATUS_DEFINITIONS[tooltip.status]}</div>
          <div className="text-gray-300">
            {tooltip.count.toLocaleString()} of this {tooltip.factorLabel.toLowerCase()} group ({tooltip.pct.toFixed(1)}%)
          </div>
        </div>
      )}
    </div>
  );
}

