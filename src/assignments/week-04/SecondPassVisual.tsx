import { useEffect, useRef, useState } from 'react';
import { select } from 'd3-selection';
import { scaleBand, scaleLinear } from 'd3-scale';
import { max } from 'd3-array';

// Reuses the same dataset loaded in Week 2 and Week 3.
const DATA_URL = `${import.meta.env.BASE_URL}data/digital-payments/banking_sample_10000.csv`;

interface HouseholdRow {
  banking_status: string;
}

// A minimal CSV parser -- this dataset has no quoted fields or embedded
// commas, so a simple split is enough (no extra library needed).
function parseCSV(text: string): HouseholdRow[] {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map((h) => h.trim());
  const statusIndex = headers.indexOf('banking_status');
  return lines.slice(1).map((line) => {
    const values = line.split(',');
    return { banking_status: values[statusIndex]?.trim() };
  });
}

const STATUS_ORDER = ['Unbanked', 'Underbanked', 'Fully Banked'];
const STATUS_COLORS: Record<string, string> = {
  Unbanked: '#dc2626',
  Underbanked: '#f59e0b',
  'Fully Banked': '#16a34a',
};

function BarChart({ data, total }: { data: { status: string; count: number }[]; total: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const width = 620;
  const height = 440;
  const margin = { top: 60, right: 30, bottom: 90, left: 90 };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || data.length === 0) return;

    const xScale = scaleBand()
      .domain(data.map((d) => d.status))
      .range([margin.left, width - margin.right])
      .padding(0.35);

    const yScale = scaleLinear()
      .domain([0, max(data, (d) => d.count) ?? 0])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const svgSel = select(svg);
    svgSel.selectAll('*').remove();

    // ---- Chart title (drawn directly on the SVG so it travels with any
    // exported/screenshotted image, per the legibility goal this week) ----
    svgSel
      .append('text')
      .attr('x', width / 2)
      .attr('y', 26)
      .attr('text-anchor', 'middle')
      .attr('font-size', 18)
      .attr('font-weight', 'bold')
      .attr('fill', '#111827')
      .text('Banking Status of U.S. Households (2023)');

    svgSel
      .append('text')
      .attr('x', width / 2)
      .attr('y', 46)
      .attr('text-anchor', 'middle')
      .attr('font-size', 12)
      .attr('fill', '#6b7280')
      .text(`n = ${total.toLocaleString()} households sampled from the 2023 FDIC survey`);

    // ---- Y axis: line, ticks, and label ----
    svgSel
      .append('line')
      .attr('x1', margin.left)
      .attr('x2', margin.left)
      .attr('y1', margin.top)
      .attr('y2', height - margin.bottom)
      .attr('stroke', '#374151')
      .attr('stroke-width', 1);

    const yTicks = yScale.ticks(5);
    svgSel
      .selectAll('line.grid')
      .data(yTicks)
      .join('line')
      .attr('class', 'grid')
      .attr('x1', margin.left)
      .attr('x2', width - margin.right)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', '#e5e7eb');

    svgSel
      .selectAll('text.ytick')
      .data(yTicks)
      .join('text')
      .attr('class', 'ytick')
      .attr('x', margin.left - 10)
      .attr('y', (d) => yScale(d))
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', 12)
      .attr('fill', '#374151')
      .text((d) => d.toLocaleString());

    svgSel
      .append('text')
      .attr('transform', `translate(${margin.left - 60}, ${(margin.top + height - margin.bottom) / 2}) rotate(-90)`)
      .attr('text-anchor', 'middle')
      .attr('font-size', 13)
      .attr('font-weight', 'bold')
      .attr('fill', '#111827')
      .text('Number of Households');

    // ---- X axis: line and label ----
    svgSel
      .append('line')
      .attr('x1', margin.left)
      .attr('x2', width - margin.right)
      .attr('y1', height - margin.bottom)
      .attr('y2', height - margin.bottom)
      .attr('stroke', '#374151')
      .attr('stroke-width', 1);

    svgSel
      .append('text')
      .attr('x', (margin.left + width - margin.right) / 2)
      .attr('y', height - 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', 13)
      .attr('font-weight', 'bold')
      .attr('fill', '#111827')
      .text('Banking Status');

    // ---- Bars ----
    svgSel
      .selectAll('rect')
      .data(data)
      .join('rect')
      .attr('x', (d) => xScale(d.status) ?? 0)
      .attr('y', (d) => yScale(d.count))
      .attr('width', xScale.bandwidth())
      .attr('height', (d) => height - margin.bottom - yScale(d.count))
      .attr('fill', (d) => STATUS_COLORS[d.status] ?? '#888');

    // ---- Value + percent labels on top of bars ----
    svgSel
      .selectAll('text.value')
      .data(data)
      .join('text')
      .attr('class', 'value')
      .attr('x', (d) => (xScale(d.status) ?? 0) + xScale.bandwidth() / 2)
      .attr('y', (d) => yScale(d.count) - 24)
      .attr('text-anchor', 'middle')
      .attr('font-size', 14)
      .attr('font-weight', 'bold')
      .attr('fill', '#111827')
      .text((d) => d.count.toLocaleString());

    svgSel
      .selectAll('text.percent')
      .data(data)
      .join('text')
      .attr('class', 'percent')
      .attr('x', (d) => (xScale(d.status) ?? 0) + xScale.bandwidth() / 2)
      .attr('y', (d) => yScale(d.count) - 8)
      .attr('text-anchor', 'middle')
      .attr('font-size', 12)
      .attr('fill', '#4b5563')
      .text((d) => `${((100 * d.count) / total).toFixed(1)}%`);

    // ---- X tick labels ----
    svgSel
      .selectAll('text.xlabel')
      .data(data)
      .join('text')
      .attr('class', 'xlabel')
      .attr('x', (d) => (xScale(d.status) ?? 0) + xScale.bandwidth() / 2)
      .attr('y', height - margin.bottom + 22)
      .attr('text-anchor', 'middle')
      .attr('font-size', 13)
      .attr('fill', '#111827')
      .text((d) => d.status);
  }, [data, total]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      role="img"
      aria-label="Bar chart of banking status counts among sampled U.S. households"
    />
  );
}

export function SecondPassVisual() {
  const [rows, setRows] = useState<HouseholdRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(DATA_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load dataset: ${res.status}`);
        return res.text();
      })
      .then((text) => setRows(parseCSV(text)))
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return <div className="p-6 text-red-600">Error loading dataset: {error}</div>;
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
      <h1 className="text-2xl font-bold mb-1">Second Pass: Improving Legibility</h1>
      <p className="text-gray-600 mb-6">
        Same data as Week 3, but with a title, axis labels, percentages, and a data source note added directly to
        the chart so it stands on its own as an image.
      </p>
      <BarChart data={counts} total={rows.length} />
      <p className="text-xs text-gray-400 mt-3">
        Source: 2023 FDIC National Survey of Unbanked and Underbanked Households.
      </p>
    </div>
  );
}
