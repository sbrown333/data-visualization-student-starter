import { useEffect, useRef, useState } from 'react';
import { select } from 'd3-selection';
import { scaleBand, scaleLinear, scaleOrdinal } from 'd3-scale';

// Path to the dataset, relative to the public/ folder.
// import.meta.env.BASE_URL makes this work both locally and on GitHub Pages.
const DATA_URL = `${import.meta.env.BASE_URL}data/digital-payments/banking_sample_10000.csv`;

interface HouseholdRow {
  age: number;
  age_group: string;
  sex: string;
  race: string;
  hispanic_origin: string;
  state: string;
  education_level: string;
  household_size: number;
  employment_status: string;
  marital_status: string;
  housing_tenure: string;
  income_bracket: string;
  has_bank_account: string;
  banking_status: string;
  primary_access_method: string;
}

// A minimal CSV parser. This dataset has no quoted fields or embedded
// commas, so a simple split is enough (no extra library needed).
function parseCSV(text: string): HouseholdRow[] {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(',');
    const row = {} as Record<string, string>;
    headers.forEach((h, i) => (row[h] = values[i]?.trim()));
    return {
      ...row,
      age: Number(row.age),
      household_size: Number(row.household_size),
    } as unknown as HouseholdRow;
  });
}

const AGE_ORDER = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const STATUS_ORDER = ['Unbanked', 'Underbanked', 'Fully Banked'];
const STATUS_COLORS = scaleOrdinal<string>().domain(STATUS_ORDER).range(['#dc2626', '#f59e0b', '#16a34a']);

function StackedBarChart({ rows }: { rows: HouseholdRow[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const width = 560;
  const height = 320;
  const margin = { top: 20, right: 140, bottom: 40, left: 50 };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || rows.length === 0) return;

    // Compute percentage of each banking status within each age group.
    const percentages = new Map<string, Map<string, number>>();
    for (const ageGroup of AGE_ORDER) {
      const inGroup = rows.filter((r) => r.age_group === ageGroup);
      const byStatus = new Map<string, number>();
      for (const status of STATUS_ORDER) {
        const count = inGroup.filter((r) => r.banking_status === status).length;
        byStatus.set(status, inGroup.length ? (100 * count) / inGroup.length : 0);
      }
      percentages.set(ageGroup, byStatus);
    }

    const xScale = scaleBand()
      .domain(AGE_ORDER)
      .range([margin.left, width - margin.right])
      .padding(0.25);

    const yScale = scaleLinear().domain([0, 100]).range([height - margin.bottom, margin.top]);

    const svgSel = select(svg);
    svgSel.selectAll('*').remove();

    for (const ageGroup of AGE_ORDER) {
      let cumulative = 0;
      for (const status of STATUS_ORDER) {
        const pct = percentages.get(ageGroup)?.get(status) ?? 0;
        svgSel
          .append('rect')
          .attr('x', xScale(ageGroup) ?? 0)
          .attr('y', yScale(cumulative + pct))
          .attr('width', xScale.bandwidth())
          .attr('height', yScale(cumulative) - yScale(cumulative + pct))
          .attr('fill', STATUS_COLORS(status));
        cumulative += pct;
      }

      svgSel
        .append('text')
        .attr('x', (xScale(ageGroup) ?? 0) + xScale.bandwidth() / 2)
        .attr('y', height - margin.bottom + 16)
        .attr('text-anchor', 'middle')
        .attr('font-size', 12)
        .text(ageGroup);
    }

    STATUS_ORDER.forEach((status, i) => {
      const legendY = margin.top + i * 22;
      svgSel
        .append('rect')
        .attr('x', width - margin.right + 20)
        .attr('y', legendY)
        .attr('width', 14)
        .attr('height', 14)
        .attr('fill', STATUS_COLORS(status));
      svgSel
        .append('text')
        .attr('x', width - margin.right + 40)
        .attr('y', legendY + 11)
        .attr('font-size', 12)
        .text(status);
    });
  }, [rows]);

  return <svg ref={svgRef} width={width} height={height} role="img" aria-label="Banking status by age group" />;
}

export function DigitalPaymentsSummary() {
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

  const columnCount = Object.keys(rows[0]).length;
  const unbankedCount = rows.filter((r) => r.banking_status === 'Unbanked').length;

  return (
    <div className="p-6 max-w-3xl w-full overflow-y-auto h-full">
      <h1 className="text-2xl font-bold mb-1">Digital Payments in America: Household Banking Sample</h1>
      <p className="text-gray-600 mb-6">
        A 10,000-household sample from the 2023 FDIC National Survey of Unbanked and Underbanked Households
      </p>

      <div className="flex gap-6 mb-8">
        <div className="bg-gray-50 border border-gray-200 rounded px-4 py-3">
          <div className="text-2xl font-bold">{rows.length.toLocaleString()}</div>
          <div className="text-sm text-gray-500">Rows (households)</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded px-4 py-3">
          <div className="text-2xl font-bold">{columnCount}</div>
          <div className="text-sm text-gray-500">Columns</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded px-4 py-3">
          <div className="text-2xl font-bold">{((100 * unbankedCount) / rows.length).toFixed(1)}%</div>
          <div className="text-sm text-gray-500">Unbanked</div>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-2">Banking Status by Age Group (%)</h2>
      <StackedBarChart rows={rows} />
    </div>
  );
}
