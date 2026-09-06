import { useEffect, useRef, useState } from 'react';
import { select } from 'd3-selection';
import { scaleBand, scaleLinear } from 'd3-scale';
import { max } from 'd3-array';

// Reuses the same dataset loaded in Week 2.
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

function BarChart({ data }: { data: { status: string; count: number }[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const width = 500;
  const height = 350;
  const margin = { top: 20, right: 20, bottom: 60, left: 60 };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || data.length === 0) return;

    const xScale = scaleBand()
      .domain(data.map((d) => d.status))
      .range([margin.left, width - margin.right])
      .padding(0.3);

    const yScale = scaleLinear()
      .domain([0, max(data, (d) => d.count) ?? 0])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const svgSel = select(svg);
    svgSel.selectAll('*').remove();

    // Y axis gridlines + labels
    const ticks = yScale.ticks(5);
    svgSel
      .selectAll('line.grid')
      .data(ticks)
      .join('line')
      .attr('class', 'grid')
      .attr('x1', margin.left)
      .attr('x2', width - margin.right)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', '#e5e7eb');

    svgSel
      .selectAll('text.ytick')
      .data(ticks)
      .join('text')
      .attr('class', 'ytick')
      .attr('x', margin.left - 10)
      .attr('y', (d) => yScale(d))
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', 12)
      .text((d) => d.toLocaleString());

    // Bars
    svgSel
      .selectAll('rect')
      .data(data)
      .join('rect')
      .attr('x', (d) => xScale(d.status) ?? 0)
      .attr('y', (d) => yScale(d.count))
      .attr('width', xScale.bandwidth())
      .attr('height', (d) => height - margin.bottom - yScale(d.count))
      .attr('fill', (d) => STATUS_COLORS[d.status] ?? '#888');

    // Value labels on top of bars
    svgSel
      .selectAll('text.value')
      .data(data)
      .join('text')
      .attr('class', 'value')
      .attr('x', (d) => (xScale(d.status) ?? 0) + xScale.bandwidth() / 2)
      .attr('y', (d) => yScale(d.count) - 8)
      .attr('text-anchor', 'middle')
      .attr('font-size', 13)
      .attr('font-weight', 'bold')
      .text((d) => d.count.toLocaleString());

    // X axis labels
    svgSel
      .selectAll('text.label')
      .data(data)
      .join('text')
      .attr('class', 'label')
      .attr('x', (d) => (xScale(d.status) ?? 0) + xScale.bandwidth() / 2)
      .attr('y', height - margin.bottom + 24)
      .attr('text-anchor', 'middle')
      .attr('font-size', 13)
      .text((d) => d.status);
  }, [data]);

  return <svg ref={svgRef} width={width} height={height} role="img" aria-label="Bar chart of banking status counts" />;
}

export function FirstVisual() {
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
    <div className="p-6 max-w-2xl w-full overflow-y-auto h-full">
      <h1 className="text-2xl font-bold mb-1">First Visual: Banking Status Counts</h1>
      <p className="text-gray-600 mb-6">
        A simple bar chart showing how many of the 10,000 sampled households fall into each banking status
        category.
      </p>
      <BarChart data={counts} />
    </div>
  );
}
