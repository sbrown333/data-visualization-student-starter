// Week 8: the rebuilt household file and the arithmetic for weighted rates.
// The file public/data/digital-payments/households_2023.csv has one row per
// household that answered the FDIC banking supplement, with the FDIC household
// weight. How it was built and checked is described in README.md in this folder.

import { STATUSES } from './audit';
import type { Status } from './audit';

export const HOUSEHOLDS_URL = `${import.meta.env.BASE_URL}data/digital-payments/households_2023.csv`;

// Colors. Banking status keeps the colors used in Weeks 4 to 7. When two or
// three series are compared, the old sample is blue, the rebuilt file is aqua
// and the FDIC's published figure is orange.
export const COLORS = {
  status: { Unbanked: '#d03b3b', Underbanked: '#fab219', 'Fully Banked': '#0ca30c' } as Record<Status, string>,
  oldSample: '#2a78d6',
  accent: '#2a78d6',
  muted: '#b8b7b0',
  rebuilt: '#1baf7a',
  fdic: '#eb6834',
  noAccount: '#cfcec7',
  missing: '#6b6a65',
  ink: '#0b0b0b',
  ink2: '#52514e',
  grid: '#e8e7e2',
  track: '#f0efeb',
  surface: '#ffffff',
};

// Counts taken from the raw FDIC file (hh2023_analys.csv, 69,484 person rows)
// while diagnosing the old sample. They are not computed on this page.
export const RAW_FACTS = {
  oldFilterRows: 26638, // rows the old build started from (reference person coded "with relatives")
  oldFilterNeverAnswered: 8221, // of those, rows with no banking answers at all
  respondingHouseholds: 29483,
  droppedByOldFilter: 11066, // responding households the old build left out
  livingAlone: 9058, // one-person responding households (all of them were dropped)
};

export const COLUMN_NAMES = [
  'weight', 'state', 'age', 'age_group', 'sex', 'race_ethnicity', 'education', 'income_group', 'income_bracket',
  'employment', 'home_tenure', 'household_size', 'household_type', 'disability', 'banking_status', 'access_method',
  'online_payment_services', 'prepaid_card', 'money_order', 'check_cashing', 'money_transfer', 'smartphone',
  'credit_card', 'bnpl', 'crypto', 'behind_on_bills', 'unbanked_main_reason', 'cited_min_balance', 'cited_distrust',
] as const;

export interface Households {
  n: number;
  w: Float64Array;
  col: Record<string, string[]>;
}

export function parseHouseholds(text: string): Households {
  const lines = text.trim().split(/\r?\n/);
  const header = (lines[0] ?? '').split(',');
  const index: Record<string, number> = {};
  for (const name of COLUMN_NAMES) {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`The household file is missing the "${name}" column.`);
    index[name] = i;
  }
  const rows = lines.length - 1;
  const w = new Float64Array(rows);
  const col: Record<string, string[]> = {};
  for (const name of COLUMN_NAMES) col[name] = new Array<string>(rows);
  let n = 0;
  for (let r = 1; r < lines.length; r++) {
    const line = lines[r] ?? '';
    if (line.trim() === '') continue;
    const cells = line.split(',');
    const weight = Number(cells[index.weight]);
    if (Number.isNaN(weight) || weight <= 0) continue;
    w[n] = weight;
    for (const name of COLUMN_NAMES) col[name][n] = cells[index[name]] ?? '';
    n += 1;
  }
  if (n === 0) throw new Error('The household file has no usable rows.');
  for (const name of COLUMN_NAMES) col[name].length = n;
  return { n, w: w.subarray(0, n), col };
}

// Weighted percentage of households that meet `num` among those that meet `den`.
export function weightedShare(h: Households, num: (i: number) => boolean, den: (i: number) => boolean): number {
  let top = 0;
  let bottom = 0;
  for (let i = 0; i < h.n; i++) {
    if (!den(i)) continue;
    bottom += h.w[i];
    if (num(i)) top += h.w[i];
  }
  return bottom > 0 ? (100 * top) / bottom : 0;
}

export function countWhere(h: Households, test: (i: number) => boolean): number {
  let c = 0;
  for (let i = 0; i < h.n; i++) if (test(i)) c += 1;
  return c;
}

export const isBanked = (h: Households, i: number) => h.col.banking_status[i] !== 'Unbanked';

// ---------- digital participation measures ----------

const yn = (v: string): boolean | null => (v === 'Yes' ? true : v === 'No' ? false : null);

export interface Measure {
  key: string;
  label: string;
  detail: string;
  // Finishes the sentence "... of fully banked households ___".
  phrase: string;
  // true or false for households the question applies to, null for the rest.
  test: (h: Households, i: number) => boolean | null;
}

export const MEASURES: Measure[] = [
  {
    key: 'online',
    label: 'Online payment services',
    phrase: 'used nonbank online payment services in the past year',
    detail: 'Used nonbank online payment services in the past 12 months',
    test: (h, i) => yn(h.col.online_payment_services[i]),
  },
  {
    key: 'mobile',
    label: 'Mobile banking',
    phrase: 'mainly use mobile banking to reach their account',
    detail: 'Mobile banking is the main way the household accesses its account (banked households that answered)',
    test: (h, i) => {
      const a = h.col.access_method[i];
      return a === '' || a === 'Not reported' ? null : a === 'Mobile app';
    },
  },
  {
    key: 'smartphone',
    label: 'Smartphone',
    phrase: 'have a smartphone',
    detail: 'Household has a smartphone',
    test: (h, i) => yn(h.col.smartphone[i]),
  },
  {
    key: 'credit',
    label: 'Credit card',
    phrase: 'used a credit card in the past year',
    detail: 'Used a credit card in the past 12 months',
    test: (h, i) => yn(h.col.credit_card[i]),
  },
  {
    key: 'prepaid',
    label: 'Prepaid card',
    phrase: 'used a prepaid card in the past year',
    detail: 'Used a prepaid card in the past 12 months',
    test: (h, i) => yn(h.col.prepaid_card[i]),
  },
  {
    key: 'moneyorder',
    label: 'Money orders',
    phrase: 'bought a nonbank money order in the past year',
    detail: 'Bought a nonbank money order in the past 12 months',
    test: (h, i) => yn(h.col.money_order[i]),
  },
];

export interface GroupBy {
  key: string;
  label: string;
  column: string;
  order: string[];
}

export const GROUPS: GroupBy[] = [
  {
    key: 'income',
    label: 'Household income',
    column: 'income_group',
    order: ['Under $15k', '$15k-$30k', '$30k-$50k', '$50k-$75k', '$75k+'],
  },
  {
    key: 'age',
    label: 'Age of householder',
    column: 'age_group',
    order: ['15-24', '25-34', '35-44', '45-54', '55-64', '65+'],
  },
  {
    key: 'education',
    label: 'Education',
    column: 'education',
    order: ['No high school diploma', 'High school diploma', 'Some college', 'College degree'],
  },
  {
    key: 'employment',
    label: 'Employment',
    column: 'employment',
    order: ['Employed', 'Unemployed', 'Not in labor force'],
  },
  {
    key: 'tenure',
    label: 'Home ownership',
    column: 'home_tenure',
    order: ['Owner', 'Renter or other'],
  },
];

export const STATUS_GROUP: GroupBy = {
  key: 'status',
  label: 'Banking status',
  column: 'banking_status',
  order: [...STATUSES],
};

export const SMALL_N = 30;

export interface RateCell {
  group: string;
  status: Status;
  n: number; // households in the survey
  p: number; // weighted share, 0 to 1
  lo: number; // approximate 95% range, 0 to 1
  hi: number;
  households: number; // weighted households this cell represents
  small: boolean;
}

// Wilson interval using the effective sample size implied by the weights. It
// allows for unequal weights but not for the survey's clustering, so the ranges
// are a little narrower than the FDIC's own.
export function wilson(p: number, neff: number): [number, number] {
  const z = 1.96;
  const denom = 1 + (z * z) / neff;
  const center = (p + (z * z) / (2 * neff)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / neff + (z * z) / (4 * neff * neff))) / denom;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

export function computeRates(h: Households, m: Measure, g: GroupBy): RateCell[] {
  interface Acc {
    n: number;
    sw: number;
    sw2: number;
    swy: number;
  }
  const acc = new Map<string, Acc>();
  const statusCol = h.col.banking_status;
  const groupCol = h.col[g.column];
  for (let i = 0; i < h.n; i++) {
    const answer = m.test(h, i);
    if (answer === null) continue;
    const key = `${statusCol[i]}|${groupCol[i]}`;
    let a = acc.get(key);
    if (!a) {
      a = { n: 0, sw: 0, sw2: 0, swy: 0 };
      acc.set(key, a);
    }
    const w = h.w[i];
    a.n += 1;
    a.sw += w;
    a.sw2 += w * w;
    if (answer) a.swy += w;
  }
  const cells: RateCell[] = [];
  for (const group of g.order) {
    for (const status of STATUSES) {
      const a = acc.get(`${status}|${group}`);
      if (!a || a.n === 0) continue;
      const p = a.swy / a.sw;
      const neff = (a.sw * a.sw) / a.sw2;
      const [lo, hi] = wilson(p, neff);
      cells.push({ group, status, n: a.n, p, lo, hi, households: a.sw, small: a.n < SMALL_N });
    }
  }
  return cells;
}

// ---------- the same rate for many groups and many measures ----------

export interface MatrixCell {
  group: string;
  measure: string;
  n: number;
  p: number;
  lo: number;
  hi: number;
  small: boolean;
}

// Weighted rate for every group x measure, optionally for one banking status only.
export function computeMatrix(h: Households, g: GroupBy, measures: Measure[], status: Status | null): MatrixCell[] {
  interface Acc {
    n: number;
    sw: number;
    sw2: number;
    swy: number;
  }
  const acc = new Map<string, Acc>();
  const groupCol = h.col[g.column];
  const statusCol = h.col.banking_status;
  for (let i = 0; i < h.n; i++) {
    if (status && statusCol[i] !== status) continue;
    for (const m of measures) {
      const answer = m.test(h, i);
      if (answer === null) continue;
      const key = `${groupCol[i]}|${m.key}`;
      let a = acc.get(key);
      if (!a) {
        a = { n: 0, sw: 0, sw2: 0, swy: 0 };
        acc.set(key, a);
      }
      const w = h.w[i];
      a.n += 1;
      a.sw += w;
      a.sw2 += w * w;
      if (answer) a.swy += w;
    }
  }
  const out: MatrixCell[] = [];
  for (const group of g.order) {
    for (const m of measures) {
      const a = acc.get(`${group}|${m.key}`);
      if (!a || a.n === 0) continue;
      const p = a.swy / a.sw;
      const [lo, hi] = wilson(p, (a.sw * a.sw) / a.sw2);
      out.push({ group, measure: m.key, n: a.n, p, lo, hi, small: a.n < SMALL_N });
    }
  }
  return out;
}

export interface GroupMean {
  group: string;
  n: number;
  mean: number; // weighted mean, same units as the values
  lo: number;
  hi: number;
  households: number; // weighted households
}

// Weighted mean of a per-household value (0 to 1) for each group. Binary values
// get a Wilson range; other values get a normal range from the weighted variance.
export function groupMeans(
  h: Households,
  groupCol: string,
  value: (i: number) => number | null,
  binary: boolean,
): Map<string, GroupMean> {
  interface Acc {
    n: number;
    sw: number;
    sw2: number;
    swx: number;
    rows: number[];
  }
  const acc = new Map<string, Acc>();
  const col = h.col[groupCol];
  for (let i = 0; i < h.n; i++) {
    const v = value(i);
    if (v === null || Number.isNaN(v)) continue;
    let a = acc.get(col[i]);
    if (!a) {
      a = { n: 0, sw: 0, sw2: 0, swx: 0, rows: [] };
      acc.set(col[i], a);
    }
    const w = h.w[i];
    a.n += 1;
    a.sw += w;
    a.sw2 += w * w;
    a.swx += w * v;
    a.rows.push(i);
  }
  const out = new Map<string, GroupMean>();
  for (const [group, a] of acc) {
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
    out.set(group, { group, n: a.n, mean, lo, hi, households: a.sw });
  }
  return out;
}
