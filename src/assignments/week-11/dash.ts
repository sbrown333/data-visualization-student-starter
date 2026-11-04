// Week 11: the arithmetic behind the dashboard. Every panel asks the same question
// ("what is the weighted rate among households that pass these filters?"), so the
// filtering and the weighted statistics live here, apart from the drawing code.

import { wilson } from '../week-08/households';
import type { Households } from '../week-08/households';

export interface Stat {
  n: number; // households in the survey
  mean: number; // weighted mean, 0 to 1
  lo: number; // approximate 95% range
  hi: number;
  households: number; // weighted households
}

// Weighted mean of `value` (0 to 1) for each group among rows that pass `keep`.
// Binary values get a Wilson range using the effective sample size; other values
// get a normal range from the weighted variance.
export function statsBy(
  h: Households,
  keep: (i: number) => boolean,
  key: (i: number) => string,
  value: (i: number) => number | null,
  binary: boolean,
): Map<string, Stat> {
  interface Acc {
    n: number;
    sw: number;
    sw2: number;
    swx: number;
    rows: number[];
  }
  const acc = new Map<string, Acc>();
  for (let i = 0; i < h.n; i++) {
    if (!keep(i)) continue;
    const v = value(i);
    if (v === null || Number.isNaN(v)) continue;
    const k = key(i);
    let a = acc.get(k);
    if (!a) {
      a = { n: 0, sw: 0, sw2: 0, swx: 0, rows: [] };
      acc.set(k, a);
    }
    const w = h.w[i];
    a.n += 1;
    a.sw += w;
    a.sw2 += w * w;
    a.swx += w * v;
    if (!binary) a.rows.push(i);
  }
  const out = new Map<string, Stat>();
  for (const [k, a] of acc) {
    const mean = a.swx / a.sw;
    let lo: number;
    let hi: number;
    if (binary) {
      [lo, hi] = wilson(mean, (a.sw * a.sw) / a.sw2);
    } else {
      let ss = 0;
      for (const i of a.rows) {
        const d = (value(i) ?? mean) - mean;
        ss += h.w[i] * h.w[i] * d * d;
      }
      const se = Math.sqrt(ss) / a.sw;
      lo = Math.max(0, mean - 1.96 * se);
      hi = Math.min(1, mean + 1.96 * se);
    }
    out.set(k, { n: a.n, mean, lo, hi, households: a.sw });
  }
  return out;
}

export function overallStat(
  h: Households,
  keep: (i: number) => boolean,
  value: (i: number) => number | null,
  binary: boolean,
): Stat | null {
  return statsBy(h, keep, () => 'all', value, binary).get('all') ?? null;
}

// Weighted and unweighted counts of households that pass `keep`, whatever they answered.
export function countKept(h: Households, keep: (i: number) => boolean) {
  let n = 0;
  let households = 0;
  for (let i = 0; i < h.n; i++) {
    if (!keep(i)) continue;
    n += 1;
    households += h.w[i];
  }
  return { n, households };
}

export const ACCESS_METHODS = ['Mobile app', 'Online', 'Bank teller', 'ATM/kiosk', 'Telephone', 'Other'];

export interface AccessCell {
  group: string;
  method: string;
  share: number; // share of banked households in the group, 0 to 1
  n: number; // households in the survey in this cell
  groupN: number; // banked households in the group that named a method
}

// For each group (for example each age group), the share of banked households whose
// main way of reaching their account is each method. Households with no account or
// no answer are left out, so each group's shares add to 1.
export function accessShares(
  h: Households,
  keep: (i: number) => boolean,
  groupCol: string,
  groups: string[],
): AccessCell[] {
  const A = h.col.access_method;
  const G = h.col[groupCol];
  const cellW = new Map<string, number>();
  const cellN = new Map<string, number>();
  const totW = new Map<string, number>();
  const totN = new Map<string, number>();
  for (let i = 0; i < h.n; i++) {
    if (!keep(i)) continue;
    const m = A[i];
    if (!ACCESS_METHODS.includes(m)) continue;
    const g = G[i];
    const k = `${g}|${m}`;
    cellW.set(k, (cellW.get(k) ?? 0) + h.w[i]);
    cellN.set(k, (cellN.get(k) ?? 0) + 1);
    totW.set(g, (totW.get(g) ?? 0) + h.w[i]);
    totN.set(g, (totN.get(g) ?? 0) + 1);
  }
  const out: AccessCell[] = [];
  for (const g of groups) {
    const tw = totW.get(g) ?? 0;
    for (const m of ACCESS_METHODS) {
      const k = `${g}|${m}`;
      out.push({
        group: g,
        method: m,
        share: tw > 0 ? (cellW.get(k) ?? 0) / tw : 0,
        n: cellN.get(k) ?? 0,
        groupN: totN.get(g) ?? 0,
      });
    }
  }
  return out;
}
