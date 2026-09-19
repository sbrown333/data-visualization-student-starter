import { useEffect, useRef, useState } from 'react';
import { select } from 'd3-selection';
import { scaleBand, scaleLinear } from 'd3-scale';
import { max } from 'd3-array';

const DATA_URL = `${import.meta.env.BASE_URL}data/digital-payments/banking_sample_10000.csv`;

interface HouseholdRow {
  banking_status: string;
}

function parseCSV(text: string): HouseholdRow[] {
  const lines = text.trim().split('\n');
  const header = lines[0].split(',');
  const statusIndex = header.indexOf('banking_status');
  const rows: HouseholdRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length <= statusIndex) continue;
    rows.push({ banking_status: cols[statusIndex] });
  }
  return rows;
}

const STATUS_ORDER = ['Unbanked', 'Underbanked', 'Fully Banked'];
const STATUS_COLORS: Record<string, string> = {
  Unbanked: '#dc2626',
  Underbanked: '#f59e0b',
  'Fully Banked': '#16a34a',
};
const STATUS_DEFINITIONS: Record<string, string> = {
  Unbanked: 'No checking or savings account at a bank or credit union.',
  Underbanked:
    'Has a bank account, but also relies on alternative services like prepaid cards, check cashing, or payday loans.',
  'Fully Banked': 'Has a bank account and does not rely on alternative financial services.',
};

interface TooltipState {
  status: string;
  count: number;
  x: number;
  y: number;
}

function BarChart({
  data,
  total,
  onHover,
}: {
  data: { status: string; count: number }[];
  total: number;
  onHover: (t: TooltipState | null) => void;
}) {
  const ref = useRef<SVGSVGElement | null>(null);
  const width = 620;
  const height = 440;
  const margin = { top: 60, right: 30, bottom: 90, left: 90 };

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const svgSel = select(svg);
    svgSel.selectAll('*').remove();

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const x = scaleBand()
      .domain(data.map((d) => d.status))
      .range([0, innerWidth])
      .padding(0.35);

    const y = scaleLinear()
      .domain([0, (max(data, (d) => d.count) ?? 0) * 1.15])
      .range([innerHeight, 0]);

    const g = svgSel.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    svgSel
      .append('text')
      .attr('x', width / 2)
      .attr('y', 28)
      .attr('text-anchor', 'middle')
      .attr('font-size', 18)
      .attr('font-weight', 'bold')
      .attr('fill', '#111827')
      .text('Banking Status of U.S. Households (2023)');

    svgSel
      .append('text')
      .attr('x', width / 2)
      .attr('y', 48)
      .attr('text-anchor', 'middle')
      .attr('font-size', 12)
      .attr('fill', '#6b7280')
      .text(`n = ${total.toLocaleString()} households sampled from the 2023 FDIC survey`);

    g.append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data(y.ticks(5))
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => y(d))
      .attr('y2', (d) => y(d))
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 1);

    g.append('line').attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', innerHeight).attr('stroke', '#374151');
    g.append('g')
      .selectAll('text.ytick')
      .data(y.ticks(5))
      .join('text')
      .attr('class', 'ytick')
      .attr('x', -10)
      .attr('y', (d) => y(d))
      .attr('dy', '0.32em')
      .attr('text-anchor', 'end')
      .attr('font-size', 11)
      .attr('fill', '#374151')
      .text((d) => d.toLocaleString());

    g.append('text')
      .attr('transform', `translate(${-60},${innerHeight / 2}) rotate(-90)`)
      .attr('text-anchor', 'middle')
      .attr('font-size', 12)
      .attr('fill', '#374151')
      .text('Number of Households');

    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', innerHeight)
      .attr('y2', innerHeight)
      .attr('stroke', '#374151');
    g.append('g')
      .selectAll('text.xtick')
      .data(data)
      .join('text')
      .attr('class', 'xtick')
      .attr('x', (d) => (x(d.status) ?? 0) + x.bandwidth() / 2)
      .attr('y', innerHeight + 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', 12)
      .attr('fill', '#111827')
      .text((d) => d.status);

    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 60)
      .attr('text-anchor', 'middle')
      .attr('font-size', 12)
      .attr('fill', '#374151')
      .text('Banking Status');

    g.append('g')
      .selectAll('rect')
      .data(data)
      .join('rect')
      .attr('x', (d) => x(d.status) ?? 0)
      .attr('y', (d) => y(d.count))
      .attr('width', x.bandwidth())
      .attr('height', (d) => innerHeight - y(d.count))
      .attr('fill', (d) => STATUS_COLORS[d.status] ?? '#6b7280')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 3)
      .style('cursor', 'pointer')
      .on('mouseenter', function (event, d) {
        select(this).attr('stroke', '#111827');
        const rect = svg.getBoundingClientRect();
        onHover({ status: d.status, count: d.count, x: event.clientX - rect.left, y: event.clientY - rect.top });
      })
      .on('mousemove', function (event, d) {
        const rect = svg.getBoundingClientRect();
        onHover({ status: d.status, count: d.count, x: event.clientX - rect.left, y: event.clientY - rect.top });
      })
      .on('mouseleave', function () {
        select(this).attr('stroke', 'transparent');
        onHover(null);
      });

    g.append('g')
      .selectAll('text.value')
      .data(data)
      .join('text')
      .attr('class', 'value')
      .attr('x', (d) => (x(d.status) ?? 0) + x.bandwidth() / 2)
      .attr('y', (d) => y(d.count) - 22)
      .attr('text-anchor', 'middle')
      .attr('font-size', 13)
      .attr('font-weight', 'bold')
      .attr('fill', '#111827')
      .attr('pointer-events', 'none')
      .text((d) => d.count.toLocaleString());

    g.append('g')
      .selectAll('text.percent')
      .data(data)
      .join('text')
      .attr('class', 'percent')
      .attr('x', (d) => (x(d.status) ?? 0) + x.bandwidth() / 2)
      .attr('y', (d) => y(d.count) - 8)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .attr('fill', '#6b7280')
      .attr('pointer-events', 'none')
      .text((d) => `${((100 * d.count) / total).toFixed(1)}%`);
  }, [data, total]);

  return <svg ref={ref} width={width} height={height} />;
}

export function InteractiveVisual() {
  const [rows, setRows] = useState<HouseholdRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    fetch(DATA_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load dataset: ${res.status}`);
        return res.text();
      })
      .then((text) => setRows(parseCSV(text)))
      .catch((err) => setError(String(err)));
  }, []);

  if (error) {
    return <div className="p-6 text-red-600">Error loading data: {error}</div>;
  }

  if (!rows) {
    return <div className="p-6 text-gray-500">Loading dataset...</div>;
  }

  const counts = STATUS_ORDER.map((status) => ({
    status,
    count: rows.filter((r) => r.banking_status === status).length,
  }));

  return (
    <div className="p-6 max-w-3xl w-full overflow-y-auto h-full">
      <h1 className="text-2xl font-bold mb-1">Interaction: Hover for Definitions</h1>
      <p className="text-gray-600 mb-6">
        Same chart as Week 4, now with a hover interaction: mousing over a bar highlights it and shows a tooltip
        explaining what that banking status category actually means.
      </p>
      <div className="relative inline-block">
        <BarChart data={counts} total={rows.length} onHover={setTooltip} />
        {tooltip && (
          <div
            className="absolute pointer-events-none bg-gray-900 text-white text-sm rounded px-3 py-2 shadow-lg max-w-xs"
            style={{ left: tooltip.x + 16, top: tooltip.y - 10 }}
          >
            <div className="font-bold mb-1">{tooltip.status}</div>
            <div className="mb-1">{STATUS_DEFINITIONS[tooltip.status]}</div>
            <div className="text-gray-300">
              {tooltip.count.toLocaleString()} households ({((100 * tooltip.count) / rows.length).toFixed(1)}%)
            </div>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-3">
        Source: 2023 FDIC National Survey of Unbanked and Underbanked Households.
      </p>
    </div>
  );
}
