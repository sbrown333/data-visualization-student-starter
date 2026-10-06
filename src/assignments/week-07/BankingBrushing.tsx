import { useEffect, useMemo, useRef, useState } from 'react';
import { select } from 'd3-selection';
import { scaleLinear, scaleSqrt } from 'd3-scale';
import { brush as d3Brush } from 'd3-brush';
import type { BrushBehavior, D3BrushEvent } from 'd3-brush';

// Week 7, tab 1: the linked brushing idea from Allison Horst's Observable
// article, applied to the banking survey sample. Drag a box over age and
// household size, and the bars below compare the banking status of those
// households with all 10,000. See README.md in this folder for sources.

const DATA_URL = `${import.meta.env.BASE_URL}data/digital-payments/banking_sample_10000.csv`;

const STATUS_ORDER = ['Unbanked', 'Underbanked', 'Fully Banked'] as const;
type Status = (typeof STATUS_ORDER)[number];
type StatusCounts = Record<Status, number>;

// Same status colors as Weeks 4 to 6.
const STATUS_COLORS: Record<Status, string> = {
  Unbanked: '#d03b3b',
  Underbanked: '#fab219',
  'Fully Banked': '#0ca30c',
};

const SURFACE = '#ffffff';
const INK = '#0b0b0b';
const INK_2 = '#52514e';
const GRID = '#e8e7e2';
const TRACK = '#f0efeb';
const BUBBLE = '#2a78d6';
const DIMMED = '#d9d8d2';

function emptyCounts(): StatusCounts {
  return { Unbanked: 0, Underbanked: 0, 'Fully Banked': 0 };
}

// One cell per distinct (age, household size) pair. 10,000 households would
// pile up as overlapping dots, so each cell is drawn as one bubble sized by
// how many households share it.
interface Cell {
  age: number;
  size: number;
  count: number;
  byStatus: StatusCounts;
}

interface Dataset {
  cells: Cell[];
  total: number;
  totals: StatusCounts;
  maxCount: number;
  ageMin: number;
  ageMax: number;
  sizeMin: number;
  sizeMax: number;
}

function parseDataset(text: string): Dataset {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(',');
  const iAge = header.indexOf('age');
  const iSize = header.indexOf('household_size');
  const iStatus = header.indexOf('banking_status');
  if (iAge < 0 || iSize < 0 || iStatus < 0) {
    throw new Error('The banking data file is missing an expected column.');
  }

  const cellMap = new Map<string, Cell>();
  const totals = emptyCounts();
  let total = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols[iAge]?.trim() === '' || cols[iSize]?.trim() === '') continue;
    const age = Number(cols[iAge]);
    const size = Number(cols[iSize]);
    const status = cols[iStatus] as Status;
    if (Number.isNaN(age) || Number.isNaN(size) || !STATUS_ORDER.includes(status)) continue;
    const key = `${age}-${size}`;
    let cell = cellMap.get(key);
    if (!cell) {
      cell = { age, size, count: 0, byStatus: emptyCounts() };
      cellMap.set(key, cell);
    }
    cell.count += 1;
    cell.byStatus[status] += 1;
    totals[status] += 1;
    total += 1;
  }

  const cells = Array.from(cellMap.values());
  if (cells.length === 0) throw new Error('The banking data file has no usable rows.');
  let maxCount = 0;
  let ageMin = Infinity;
  let ageMax = -Infinity;
  let sizeMin = Infinity;
  let sizeMax = -Infinity;
  for (const c of cells) {
    maxCount = Math.max(maxCount, c.count);
    ageMin = Math.min(ageMin, c.age);
    ageMax = Math.max(ageMax, c.age);
    sizeMin = Math.min(sizeMin, c.size);
    sizeMax = Math.max(sizeMax, c.size);
  }
  return { cells, total, totals, maxCount, ageMin, ageMax, sizeMin, sizeMax };
}

// Brushable bubble chart geometry.
const W = 760;
const MARGIN = { top: 20, right: 24, bottom: 52, left: 56 };
const IW = W - MARGIN.left - MARGIN.right;
const H = 400;
const IH = H - MARGIN.top - MARGIN.bottom;
const X = scaleLinear().domain([14, 86]).range([0, IW]);
const Y = scaleLinear().domain([1, 15]).range([IH, 0]);
const X_TICKS = [20, 30, 40, 50, 60, 70, 80];
const Y_TICKS = [2, 4, 6, 8, 10, 12, 14];

// Composition bars geometry.
const BAR_H = 24;
const BAR_X = 150;
const BAR_W = W - BAR_X - 24;
const ROW_ALL_Y = 16;
const ROW_SEL_Y = 64;
const BARS_H = 108;
const GAP = 2;

interface Segment {
  status: Status;
  x: number;
  w: number;
  count: number;
}

function segmentsFor(counts: StatusCounts, n: number): Segment[] {
  let x = BAR_X;
  return STATUS_ORDER.map((status) => {
    const w = n > 0 ? (counts[status] / n) * BAR_W : 0;
    const seg = { status, x, w, count: counts[status] };
    x += w;
    return seg;
  });
}

interface Tip {
  x: number;
  y: number;
  status: Status;
  rowLabel: string;
  count: number;
  n: number;
}

function BarRow({
  y,
  segments,
  clipId,
  rowLabel,
  subLabel,
  n,
  onTip,
}: {
  y: number;
  segments: Segment[];
  clipId: string;
  rowLabel: string;
  subLabel: string;
  n: number;
  onTip: (e: React.PointerEvent, seg: Segment, rowLabel: string, n: number) => void;
}) {
  const visible = segments.filter((s) => s.w > 0);
  return (
    <g>
      <text x={0} y={y + 11} fontSize={12} fill={INK}>
        {rowLabel}
      </text>
      <text x={0} y={y + 26} fontSize={11} fill={INK_2}>
        {subLabel}
      </text>
      <clipPath id={clipId}>
        <rect x={BAR_X} y={y} width={BAR_W} height={BAR_H} rx={4} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        {visible.map((seg, k) => {
          const first = k === 0;
          const last = k === visible.length - 1;
          const gx = seg.x + (first ? 0 : GAP / 2);
          const gw = seg.w - (first ? 0 : GAP / 2) - (last ? 0 : GAP / 2);
          if (gw <= 0) return null;
          return <rect key={seg.status} x={gx} y={y} width={gw} height={BAR_H} fill={STATUS_COLORS[seg.status]} />;
        })}
      </g>
      {visible.map((seg) => {
        const hitW = Math.max(seg.w, 20);
        return (
          <rect
            key={`hit-${seg.status}`}
            x={seg.x + seg.w / 2 - hitW / 2}
            y={y - 4}
            width={hitW}
            height={BAR_H + 8}
            fill="transparent"
            onPointerMove={(e) => onTip(e, seg, rowLabel, n)}
          />
        );
      })}
    </g>
  );
}

function BrushView({ data }: { data: Dataset }) {
  const { cells, total, totals, maxCount, ageMin, ageMax, sizeMin, sizeMax } = data;
  const [selected, setSelected] = useState<Set<number> | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const brushRef = useRef<SVGGElement | null>(null);
  const behaviorRef = useRef<BrushBehavior<unknown> | null>(null);
  const barsWrapRef = useRef<HTMLDivElement | null>(null);

  const radius = useMemo(() => scaleSqrt().domain([1, maxCount]).range([2.5, 6.5]), [maxCount]);

  // d3-brush owns the drag box; React owns everything else. The cleanup
  // removes the brush's elements so React's double-run of effects in
  // development does not stack two brushes.
  useEffect(() => {
    const g = brushRef.current;
    if (!g) return;
    const behavior = d3Brush()
      .extent([
        [0, 0],
        [IW, IH],
      ])
      .on('start brush end', (event: D3BrushEvent<unknown>) => {
        const box = event.selection as [[number, number], [number, number]] | null;
        if (!box) {
          setSelected(null);
          return;
        }
        const [[x0, y0], [x1, y1]] = box;
        const picked = new Set<number>();
        cells.forEach((c, i) => {
          const px = X(c.age);
          const py = Y(c.size);
          if (px >= x0 && px <= x1 && py >= y0 && py <= y1) picked.add(i);
        });
        setSelected(picked);
      });
    behaviorRef.current = behavior;
    const sel = select(g);
    sel.call(behavior);
    return () => {
      sel.on('.brush', null);
      sel.selectAll('*').remove();
      behaviorRef.current = null;
    };
  }, [cells]);

  function clearSelection() {
    const g = brushRef.current;
    const behavior = behaviorRef.current;
    if (g && behavior) select(g).call(behavior.move, null);
  }

  // Programmatic selections for the preset buttons. Cells sit on whole-number
  // ages and sizes, so the box runs half a step past each end.
  function applyBox(a0: number, a1: number, s0: number, s1: number) {
    const g = brushRef.current;
    const behavior = behaviorRef.current;
    if (!g || !behavior) return;
    const box: [[number, number], [number, number]] = [
      [X(a0 - 0.5), Y(s1 + 0.5)],
      [X(a1 + 0.5), Y(s0 - 0.5)],
    ];
    select(g).call(behavior.move, box);
  }

  // Draw selected bubbles last so they sit on top of the dimmed ones.
  const drawOrder = useMemo(() => {
    const all = cells.map((_, i) => i);
    if (!selected) return all;
    return all.sort((a, b) => Number(selected.has(a)) - Number(selected.has(b)));
  }, [cells, selected]);

  const sel = useMemo(() => {
    if (!selected) return null;
    const byStatus = emptyCounts();
    let n = 0;
    let a0 = Infinity;
    let a1 = -Infinity;
    let s0 = Infinity;
    let s1 = -Infinity;
    selected.forEach((ci) => {
      const c = cells[ci];
      n += c.count;
      STATUS_ORDER.forEach((s) => {
        byStatus[s] += c.byStatus[s];
      });
      a0 = Math.min(a0, c.age);
      a1 = Math.max(a1, c.age);
      s0 = Math.min(s0, c.size);
      s1 = Math.max(s1, c.size);
    });
    return { n, byStatus, a0, a1, s0, s1 };
  }, [cells, selected]);

  const hasSelection = sel !== null && sel.n > 0;

  const allSegments = useMemo(() => segmentsFor(totals, total), [totals, total]);
  const selSegments = useMemo(() => (sel && sel.n > 0 ? segmentsFor(sel.byStatus, sel.n) : []), [sel]);

  function onTip(e: React.PointerEvent, seg: Segment, rowLabel: string, n: number) {
    const wrap = barsWrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, status: seg.status, rowLabel, count: seg.count, n });
  }

  const range = (lo: number, hi: number, unit: string) => (lo === hi ? `${unit} ${lo}` : `${unit}s ${lo} to ${hi}`);

  const presets: { label: string; ages: [number, number]; sizes: [number, number] }[] = [
    { label: 'Under 25', ages: [ageMin, 24], sizes: [sizeMin, sizeMax] },
    { label: '65 and over', ages: [65, ageMax], sizes: [sizeMin, sizeMax] },
    { label: 'Households of 5 or more', ages: [ageMin, ageMax], sizes: [5, sizeMax] },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3">
        <span className="text-sm text-gray-500">Try a selection:</span>
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyBox(p.ages[0], p.ages[1], p.sizes[0], p.sizes[1])}
            className="px-3 py-1 rounded-full border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="border border-gray-200 rounded-xl p-3 bg-white">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label="Bubble chart of households by age of the reference person and household size. Bubble area shows how many households share that combination. Drag to select households."
        >
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {X_TICKS.map((t) => (
              <g key={`x${t}`} transform={`translate(${X(t)},0)`}>
                <line y2={IH} stroke={GRID} strokeWidth={1} />
                <text y={IH + 20} textAnchor="middle" fontSize={12} fill={INK_2}>
                  {t}
                </text>
              </g>
            ))}
            {Y_TICKS.map((t) => (
              <g key={`y${t}`} transform={`translate(0,${Y(t)})`}>
                <line x2={IW} stroke={GRID} strokeWidth={1} />
                <text x={-10} dy="0.32em" textAnchor="end" fontSize={12} fill={INK_2}>
                  {t}
                </text>
              </g>
            ))}
            {drawOrder.map((i) => {
              const c = cells[i];
              const active = !selected || selected.has(i);
              return (
                <circle
                  key={i}
                  cx={X(c.age)}
                  cy={Y(c.size)}
                  r={radius(c.count)}
                  fill={active ? BUBBLE : DIMMED}
                  fillOpacity={active ? 0.85 : 1}
                  stroke={SURFACE}
                  strokeWidth={3}
                  style={{ paintOrder: 'stroke' }}
                />
              );
            })}
            <g ref={brushRef} />
          </g>
          <text x={MARGIN.left} y={12} fontSize={12} fill={INK_2}>
            ↑ Household size (people)
          </text>
          <text x={W - MARGIN.right} y={H - 8} textAnchor="end" fontSize={12} fill={INK_2}>
            Age of household reference person (years) →
          </text>
        </svg>
        <p className="mt-1 text-xs text-gray-500">Bubble area shows how many households share that age and household size.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 my-4 min-h-8">
        <p className="text-sm text-gray-700" aria-live="polite">
          {hasSelection && sel ? (
            <>
              <span className="font-semibold text-gray-900">{sel.n.toLocaleString()}</span> of {total.toLocaleString()}{' '}
              households selected ({range(sel.a0, sel.a1, 'age')}, {range(sel.s0, sel.s1, 'household size')})
            </>
          ) : selected ? (
            'No households in that box. Try a larger one.'
          ) : (
            'Drag a box on the chart to select households.'
          )}
        </p>
        {selected && (
          <button
            type="button"
            onClick={clearSelection}
            className="px-3 py-1 rounded-full border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
          >
            Clear selection
          </button>
        )}
      </div>

      <div ref={barsWrapRef} className="relative border border-gray-200 rounded-xl p-3 bg-white">
        <svg
          viewBox={`0 0 ${W} ${BARS_H}`}
          width="100%"
          role="img"
          aria-label="Banking status of all households compared with the selected households, as two bars split into unbanked, underbanked and fully banked."
          onPointerLeave={() => setTip(null)}
        >
          <BarRow
            y={ROW_ALL_Y}
            segments={allSegments}
            clipId="banking-bar-all"
            rowLabel="All households"
            subLabel={total.toLocaleString()}
            n={total}
            onTip={onTip}
          />
          {hasSelection && sel ? (
            <BarRow
              y={ROW_SEL_Y}
              segments={selSegments}
              clipId="banking-bar-selected"
              rowLabel="Selected households"
              subLabel={sel.n.toLocaleString()}
              n={sel.n}
              onTip={onTip}
            />
          ) : (
            <g>
              <text x={0} y={ROW_SEL_Y + 11} fontSize={12} fill={INK}>
                Selected households
              </text>
              <rect x={BAR_X} y={ROW_SEL_Y} width={BAR_W} height={BAR_H} rx={4} fill={TRACK} />
              <text x={BAR_X + 12} y={ROW_SEL_Y + 16} fontSize={12} fill={INK_2}>
                Drag a box on the chart above to compare
              </text>
            </g>
          )}
        </svg>
        {tip && (
          <div
            className="absolute pointer-events-none bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg z-10"
            style={{ left: tip.x + 14, top: tip.y + 10 }}
          >
            <div className="text-sm font-semibold">{((100 * tip.count) / tip.n).toFixed(1)}%</div>
            <div className="text-gray-300">
              {tip.status}, {tip.rowLabel.toLowerCase()}
            </div>
            <div className="text-gray-300">
              {tip.count.toLocaleString()} of {tip.n.toLocaleString()} households
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
        {STATUS_ORDER.map((s) => {
          const overall = (100 * totals[s]) / total;
          const selPct = hasSelection && sel ? (100 * sel.byStatus[s]) / sel.n : null;
          const ratio = selPct !== null && overall > 0 ? selPct / overall : null;
          let note = 'of all households';
          if (selPct !== null) {
            const phrase =
              ratio === null
                ? ''
                : ratio >= 0.95 && ratio <= 1.05
                  ? ' · about the overall rate'
                  : ` · ${ratio.toFixed(1)}x the overall rate`;
            note = `${overall.toFixed(1)}% overall${phrase}`;
          }
          return (
            <div key={s} className="border border-gray-200 rounded-xl p-3 bg-white">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
                {s}
              </div>
              <div className="text-2xl font-semibold text-gray-900 mt-1">{(selPct ?? overall).toFixed(1)}%</div>
              <div className="text-xs text-gray-500">{note}</div>
            </div>
          );
        })}
      </div>

      {hasSelection && sel && sel.n < 30 && (
        <p className="mt-3 text-sm text-gray-600">
          Only {sel.n} {sel.n === 1 ? 'household is' : 'households are'} in this box, so these percentages can swing a lot.
        </p>
      )}

      <details className="mt-4 text-sm text-gray-700">
        <summary className="cursor-pointer text-gray-600">
          View as a table ({hasSelection ? 'selected vs all households' : 'all households'})
        </summary>
        <table className="mt-2 w-full text-left">
          <thead className="text-gray-500">
            <tr>
              <th className="py-1 pr-3 font-medium">Banking status</th>
              <th className="py-1 pr-3 font-medium">All households</th>
              <th className="py-1 font-medium">Selected households</th>
            </tr>
          </thead>
          <tbody>
            {STATUS_ORDER.map((s) => (
              <tr key={s} className="border-t border-gray-100">
                <td className="py-1 pr-3">{s}</td>
                <td className="py-1 pr-3">
                  {totals[s].toLocaleString()} ({((100 * totals[s]) / total).toFixed(1)}%)
                </td>
                <td className="py-1">
                  {hasSelection && sel
                    ? `${sel.byStatus[s].toLocaleString()} (${((100 * sel.byStatus[s]) / sel.n).toFixed(1)}%)`
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

export function BankingBrushing() {
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(DATA_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load the banking data (HTTP ${res.status}).`);
        return res.text();
      })
      .then((text) => {
        if (!cancelled) setData(parseDataset(text));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the banking data.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <div className="text-sm text-red-700">{error}</div>;
  if (!data) return <div className="text-gray-500">Loading...</div>;
  return <BrushView data={data} />;
}
