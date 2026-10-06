import { useEffect, useMemo, useRef, useState } from 'react';
import { select } from 'd3-selection';
import { scaleLinear } from 'd3-scale';
import { bin, max, mean, range } from 'd3-array';
import { brush as d3Brush } from 'd3-brush';
import type { BrushBehavior, D3BrushEvent } from 'd3-brush';
import penguinsCsv from './penguins.csv?raw';

// Week 7, tab 2: recreation of the "linked brushing" example from Allison
// Horst's Observable article. Drag a box on the scatterplot and the histogram below
// highlights the body mass of just the selected penguins.
// Sources and credits are listed in README.md in this folder.

interface Penguin {
  species: string;
  billLength: number;
  billDepth: number;
  bodyMass: number;
}

function parsePenguins(text: string): { penguins: Penguin[]; skipped: number } {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(',');
  const idx = {
    species: header.indexOf('species'),
    billLength: header.indexOf('bill_length_mm'),
    billDepth: header.indexOf('bill_depth_mm'),
    bodyMass: header.indexOf('body_mass_g'),
  };
  const penguins: Penguin[] = [];
  let skipped = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const billLength = Number(cols[idx.billLength]);
    const billDepth = Number(cols[idx.billDepth]);
    const bodyMass = Number(cols[idx.bodyMass]);
    // Missing measurements are written as "NA" in the source file.
    if (Number.isNaN(billLength) || Number.isNaN(billDepth) || Number.isNaN(bodyMass)) {
      skipped += 1;
      continue;
    }
    penguins.push({ species: cols[idx.species], billLength, billDepth, bodyMass });
  }
  return { penguins, skipped };
}

const { penguins: PENGUINS, skipped: SKIPPED } = parsePenguins(penguinsCsv);

const SPECIES = ['Adelie', 'Chinstrap', 'Gentoo'];
// Blue / orange / aqua from the validated categorical palette. The original
// chart uses blue / orange / red, but red and orange are hard to tell apart
// for some color-blind readers, so aqua replaces red.
const SPECIES_COLORS: Record<string, string> = {
  Adelie: '#2a78d6',
  Chinstrap: '#eb6834',
  Gentoo: '#1baf7a',
};
const SURFACE = '#ffffff';
const INK = '#0b0b0b';
const INK_2 = '#52514e';
const GRID = '#e8e7e2';
const DIMMED_DOT = '#d9d8d2';
const BAR_ALL = '#bdbcb5';
const BAR_ALL_FADED = '#e2e1dc';

const W = 760;
const MARGIN = { top: 20, right: 24, bottom: 52, left: 56 };
const IW = W - MARGIN.left - MARGIN.right;

const SCATTER_H = 400;
const SCATTER_IH = SCATTER_H - MARGIN.top - MARGIN.bottom;
const X = scaleLinear().domain([30, 60]).range([0, IW]);
const Y = scaleLinear().domain([12, 22]).range([SCATTER_IH, 0]);
const X_TICKS = [30, 35, 40, 45, 50, 55, 60];
const Y_TICKS = [12, 14, 16, 18, 20, 22];

const HIST_H = 250;
const HIST_IH = HIST_H - MARGIN.top - MARGIN.bottom;
const MASS_X = scaleLinear().domain([2600, 6400]).range([0, IW]);
const MASS_TICKS = [3000, 3500, 4000, 4500, 5000, 5500, 6000];

// Bins hold penguin indexes (not penguins) so a selection, which is a set of
// indexes, can be counted per bin.
const BINS = bin<number, number>()
  .value((i) => PENGUINS[i].bodyMass)
  .domain([2600, 6400])
  .thresholds(range(2700, 6400, 100))(PENGUINS.map((_, i) => i));
const COUNT_MAX = Math.ceil((max(BINS, (b) => b.length) ?? 5) / 5) * 5;
const COUNT = scaleLinear().domain([0, COUNT_MAX]).range([HIST_IH, 0]);
const COUNT_TICKS = range(0, COUNT_MAX + 1, 5);

function topRoundedBar(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

interface TooltipState {
  x: number;
  y: number;
  bin: number;
}

export function PenguinBrushing() {
  const [selected, setSelected] = useState<Set<number> | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const brushRef = useRef<SVGGElement | null>(null);
  const behaviorRef = useRef<BrushBehavior<unknown> | null>(null);
  const histWrapRef = useRef<HTMLDivElement | null>(null);

  // d3-brush owns the drag box; React owns everything else. The brush adds its
  // own elements inside the empty <g>, and the cleanup removes them again so
  // React's double-run of effects in development does not stack two brushes.
  useEffect(() => {
    const g = brushRef.current;
    if (!g) return;
    const behavior = d3Brush()
      .extent([
        [0, 0],
        [IW, SCATTER_IH],
      ])
      .on('start brush end', (event: D3BrushEvent<unknown>) => {
        const box = event.selection as [[number, number], [number, number]] | null;
        if (!box) {
          setSelected(null);
          return;
        }
        const [[x0, y0], [x1, y1]] = box;
        const picked = new Set<number>();
        PENGUINS.forEach((p, i) => {
          const px = X(p.billLength);
          const py = Y(p.billDepth);
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
  }, []);

  function clearSelection() {
    const g = brushRef.current;
    const behavior = behaviorRef.current;
    if (g && behavior) select(g).call(behavior.move, null);
  }

  // Draw selected dots last so they sit on top of the dimmed ones.
  const dotOrder = useMemo(() => {
    const all = PENGUINS.map((_, i) => i);
    if (!selected) return all;
    return all.sort((a, b) => Number(selected.has(a)) - Number(selected.has(b)));
  }, [selected]);

  const speciesCounts = useMemo(
    () => SPECIES.map((s) => PENGUINS.filter((p) => p.species === s).length),
    [],
  );

  const summary = useMemo(() => {
    return SPECIES.map((s) => {
      const rows = PENGUINS.filter((p, i) => p.species === s && (!selected || selected.has(i)));
      return {
        species: s,
        n: rows.length,
        billLength: mean(rows, (p) => p.billLength),
        billDepth: mean(rows, (p) => p.billDepth),
        bodyMass: mean(rows, (p) => p.bodyMass),
      };
    });
  }, [selected]);

  const selectedCount = selected ? selected.size : 0;
  const hasSelection = selected !== null && selected.size > 0;

  function onHistPointer(e: React.PointerEvent, binIndex: number) {
    const wrap = histWrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, bin: binIndex });
  }

  const tipBin = tooltip ? BINS[tooltip.bin] : null;
  const tipSelected = tipBin && selected ? tipBin.filter((i) => selected.has(i)).length : 0;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-3" aria-label="Species legend">
        {SPECIES.map((s, k) => (
          <div key={s} className="flex items-center gap-2 text-sm text-gray-700">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: SPECIES_COLORS[s] }}
            />
            <span>
              {s} <span className="text-gray-400">({speciesCounts[k]})</span>
            </span>
          </div>
        ))}
      </div>

      <div className="border border-gray-200 rounded-xl p-3 bg-white">
        <svg
          viewBox={`0 0 ${W} ${SCATTER_H}`}
          width="100%"
          role="img"
          aria-label="Scatterplot of penguin bill length against bill depth, colored by species. Drag to select penguins."
        >
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {X_TICKS.map((t) => (
              <g key={`x${t}`} transform={`translate(${X(t)},0)`}>
                <line y2={SCATTER_IH} stroke={GRID} strokeWidth={1} />
                <text y={SCATTER_IH + 20} textAnchor="middle" fontSize={12} fill={INK_2}>
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
            {dotOrder.map((i) => {
              const p = PENGUINS[i];
              const active = !selected || selected.has(i);
              return (
                <circle
                  key={i}
                  cx={X(p.billLength)}
                  cy={Y(p.billDepth)}
                  r={5}
                  fill={active ? SPECIES_COLORS[p.species] : DIMMED_DOT}
                  stroke={SURFACE}
                  strokeWidth={4}
                  style={{ paintOrder: 'stroke' }}
                />
              );
            })}
            <g ref={brushRef} />
          </g>
          <text x={MARGIN.left} y={12} fontSize={12} fill={INK_2}>
            ↑ Bill depth (mm)
          </text>
          <text x={W - MARGIN.right} y={SCATTER_H - 8} textAnchor="end" fontSize={12} fill={INK_2}>
            Bill length (mm) →
          </text>
        </svg>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 my-4 min-h-8">
        <p className="text-sm text-gray-700" aria-live="polite">
          {hasSelection ? (
            <>
              <span className="font-semibold text-gray-900">{selectedCount}</span> of{' '}
              {PENGUINS.length} penguins selected
            </>
          ) : selected ? (
            'No penguins in that box. Try a larger one.'
          ) : (
            'Drag a box on the scatterplot to select penguins.'
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

      <div ref={histWrapRef} className="relative border border-gray-200 rounded-xl p-3 bg-white">
        <svg
          viewBox={`0 0 ${W} ${HIST_H}`}
          width="100%"
          role="img"
          aria-label="Histogram of penguin body mass. Bars for the selected penguins are drawn in black over the full distribution in gray."
          onPointerLeave={() => setTooltip(null)}
        >
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {COUNT_TICKS.map((t) => (
              <g key={`c${t}`} transform={`translate(0,${COUNT(t)})`}>
                <line x2={IW} stroke={GRID} strokeWidth={1} />
                <text x={-10} dy="0.32em" textAnchor="end" fontSize={12} fill={INK_2}>
                  {t}
                </text>
              </g>
            ))}
            {MASS_TICKS.map((t) => (
              <text
                key={`m${t}`}
                x={MASS_X(t)}
                y={HIST_IH + 20}
                textAnchor="middle"
                fontSize={12}
                fill={INK_2}
              >
                {t.toLocaleString()}
              </text>
            ))}
            {BINS.map((b, k) => {
              const x = MASS_X(b.x0 ?? 0) + 1;
              const w = MASS_X(b.x1 ?? 0) - MASS_X(b.x0 ?? 0) - 2;
              const h = HIST_IH - COUNT(b.length);
              return (
                <path
                  key={`all${k}`}
                  d={topRoundedBar(x, COUNT(b.length), w, h, 4)}
                  fill={hasSelection ? BAR_ALL_FADED : BAR_ALL}
                />
              );
            })}
            {hasSelection &&
              BINS.map((b, k) => {
                const n = b.filter((i) => selected.has(i)).length;
                if (n === 0) return null;
                const x = MASS_X(b.x0 ?? 0) + 1;
                const w = MASS_X(b.x1 ?? 0) - MASS_X(b.x0 ?? 0) - 2;
                return (
                  <path
                    key={`sel${k}`}
                    d={topRoundedBar(x, COUNT(n), w, HIST_IH - COUNT(n), 4)}
                    fill={INK}
                  />
                );
              })}
            {BINS.map((b, k) => (
              <rect
                key={`hit${k}`}
                x={MASS_X(b.x0 ?? 0)}
                y={0}
                width={MASS_X(b.x1 ?? 0) - MASS_X(b.x0 ?? 0)}
                height={HIST_IH}
                fill="transparent"
                onPointerMove={(e) => onHistPointer(e, k)}
              />
            ))}
          </g>
          <text x={MARGIN.left} y={12} fontSize={12} fill={INK_2}>
            ↑ Frequency (penguins)
          </text>
          <text x={W - MARGIN.right} y={HIST_H - 8} textAnchor="end" fontSize={12} fill={INK_2}>
            Body mass (g) →
          </text>
        </svg>
        {tooltip && tipBin && (
          <div
            className="absolute pointer-events-none bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg z-10"
            style={{ left: tooltip.x + 14, top: tooltip.y + 10 }}
          >
            <div className="text-sm font-semibold">
              {tipBin.length} {tipBin.length === 1 ? 'penguin' : 'penguins'}
            </div>
            <div className="text-gray-300">
              {(tipBin.x0 ?? 0).toLocaleString()} to {(tipBin.x1 ?? 0).toLocaleString()} g
            </div>
            {hasSelection && <div className="text-gray-300">{tipSelected} in selection</div>}
          </div>
        )}
      </div>

      <details className="mt-4 text-sm text-gray-700">
        <summary className="cursor-pointer text-gray-600">
          View as a table ({hasSelection ? 'selected penguins' : 'all penguins'})
        </summary>
        <table className="mt-2 w-full text-left">
          <thead className="text-gray-500">
            <tr>
              <th className="py-1 pr-3 font-medium">Species</th>
              <th className="py-1 pr-3 font-medium">Penguins</th>
              <th className="py-1 pr-3 font-medium">Avg bill length (mm)</th>
              <th className="py-1 pr-3 font-medium">Avg bill depth (mm)</th>
              <th className="py-1 font-medium">Avg body mass (g)</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((r) => (
              <tr key={r.species} className="border-t border-gray-100">
                <td className="py-1 pr-3">{r.species}</td>
                <td className="py-1 pr-3">{r.n}</td>
                <td className="py-1 pr-3">{r.billLength === undefined ? '-' : r.billLength.toFixed(1)}</td>
                <td className="py-1 pr-3">{r.billDepth === undefined ? '-' : r.billDepth.toFixed(1)}</td>
                <td className="py-1">{r.bodyMass === undefined ? '-' : Math.round(r.bodyMass).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <p className="mt-3 text-xs text-gray-400">
        {SKIPPED} of {PENGUINS.length + SKIPPED} penguins in the source file have no measurements and are left out.
      </p>
    </div>
  );
}
