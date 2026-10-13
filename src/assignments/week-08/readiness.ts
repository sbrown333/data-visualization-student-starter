import type { Households } from './households';

// Digital Payment Readiness Score. This is my own index, not an official
// measure. Each household gets 0 to 100: the average of the components that are
// switched on, each scored 0 to 1.
//
//   Banking access   fully banked 1, underbanked 0.5, unbanked 0
//   Smartphone       household has a smartphone
//   Online payments  used nonbank online payment services in the past year
//   Credit card      used a credit card in the past year
//   Digital banking  mainly uses mobile or online banking (unbanked count as 0;
//                    banked households that did not answer are left out)
//   Income           position of the household's income among the 16 FDIC brackets
//
// Cash dependence would belong here too, but the 2023 FDIC file does not ask
// about it, so it is shown greyed out and is not part of the score.

export interface Component {
  key: string;
  label: string;
  detail: string;
}

export const COMPONENTS: Component[] = [
  { key: 'banking', label: 'Banking access', detail: 'Fully banked 1, underbanked 0.5, unbanked 0' },
  { key: 'smartphone', label: 'Smartphone', detail: 'Household has a smartphone' },
  { key: 'online', label: 'Online payments', detail: 'Used nonbank online payment services' },
  { key: 'credit', label: 'Credit card', detail: 'Used a credit card in the past year' },
  { key: 'digital', label: 'Digital banking', detail: 'Mainly uses mobile or online banking' },
  { key: 'income', label: 'Income', detail: 'Rank of income among 16 brackets' },
];

export const ALL_KEYS = COMPONENTS.map((c) => c.key);

export const INCOME_ORDER = [
  'Under $5k', '$5k-$7.5k', '$7.5k-$10k', '$10k-$12.5k', '$12.5k-$15k', '$15k-$20k', '$20k-$25k', '$25k-$30k',
  '$30k-$35k', '$35k-$40k', '$40k-$50k', '$50k-$60k', '$60k-$75k', '$75k-$100k', '$100k-$150k', '$150k+',
];

export const AGE_BINS = [15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80];
export const ageBinOf = (age: number) => Math.min(AGE_BINS.length - 1, Math.max(0, Math.floor((age - 15) / 5)));
export const ageBinLabel = (b: number) => (b === AGE_BINS.length - 1 ? '80+' : `${AGE_BINS[b]}-${AGE_BINS[b] + 4}`);

export type ComponentValues = Record<string, Float32Array>;

// Component values per household, 0 to 1, NaN where unknown.
export function buildComponents(h: Households): ComponentValues {
  const out: ComponentValues = {};
  for (const c of COMPONENTS) out[c.key] = new Float32Array(h.n).fill(Number.NaN);
  const S = h.col.banking_status;
  const A = h.col.access_method;
  const yes = (col: string, i: number) => (h.col[col][i] === 'Yes' ? 1 : h.col[col][i] === 'No' ? 0 : Number.NaN);
  const incomeRank = new Map(INCOME_ORDER.map((l, k) => [l, k / (INCOME_ORDER.length - 1)]));
  for (let i = 0; i < h.n; i++) {
    out.banking[i] = S[i] === 'Fully Banked' ? 1 : S[i] === 'Underbanked' ? 0.5 : 0;
    out.smartphone[i] = yes('smartphone', i);
    out.online[i] = yes('online_payment_services', i);
    out.credit[i] = yes('credit_card', i);
    if (S[i] === 'Unbanked') out.digital[i] = 0;
    else if (A[i] !== 'Not reported' && A[i] !== '') out.digital[i] = A[i] === 'Mobile app' || A[i] === 'Online' ? 1 : 0;
    out.income[i] = incomeRank.get(h.col.income_bracket[i]) ?? Number.NaN;
  }
  return out;
}

// Score 0 to 100 per household using the components that are switched on.
export function scoreAll(h: Households, comps: ComponentValues, active: ReadonlySet<string>): Float32Array {
  const keys = ALL_KEYS.filter((k) => active.has(k));
  const out = new Float32Array(h.n).fill(Number.NaN);
  for (let i = 0; i < h.n; i++) {
    let sum = 0;
    let n = 0;
    for (const k of keys) {
      const v = comps[k][i];
      if (!Number.isNaN(v)) {
        sum += v;
        n += 1;
      }
    }
    if (n > 0) out[i] = (100 * sum) / n;
  }
  return out;
}

// Weighted, smoothed distribution of scores over 0..100 for households that pass
// `keep`. Returns density (share of households per score point) and the weighted mean.
export function density(
  h: Households,
  scores: Float32Array,
  keep: (i: number) => boolean,
): { d: Float64Array; mean: number; total: number; n: number } {
  const hist = new Float64Array(101);
  let total = 0;
  let sumScore = 0;
  let n = 0;
  for (let i = 0; i < h.n; i++) {
    const s = scores[i];
    if (Number.isNaN(s) || !keep(i)) continue;
    hist[Math.round(s)] += h.w[i];
    total += h.w[i];
    sumScore += h.w[i] * s;
    n += 1;
  }
  const d = new Float64Array(101);
  if (total === 0) return { d, mean: 0, total: 0, n: 0 };
  const sigma = 3;
  const half = 9;
  const kernel: number[] = [];
  let ksum = 0;
  for (let k = -half; k <= half; k++) {
    const v = Math.exp(-(k * k) / (2 * sigma * sigma));
    kernel.push(v);
    ksum += v;
  }
  const reflect = (j: number) => (j < 0 ? -j : j > 100 ? 200 - j : j);
  for (let j = 0; j <= 100; j++) {
    let acc = 0;
    for (let k = -half; k <= half; k++) acc += hist[reflect(j + k)] * kernel[k + half];
    d[j] = acc / ksum / total;
  }
  return { d, mean: sumScore / total, total, n };
}

// Weighted share of households scoring in [lo, hi).
export function shareBetween(h: Households, scores: Float32Array, keep: (i: number) => boolean, lo: number, hi: number) {
  let top = 0;
  let bottom = 0;
  for (let i = 0; i < h.n; i++) {
    const s = scores[i];
    if (Number.isNaN(s) || !keep(i)) continue;
    bottom += h.w[i];
    if (s >= lo && s < hi) top += h.w[i];
  }
  return bottom > 0 ? (100 * top) / bottom : 0;
}

// Weighted mean of one component (0 to 100) for households that pass `keep`.
export function componentMean(h: Households, values: Float32Array, keep: (i: number) => boolean) {
  let top = 0;
  let bottom = 0;
  for (let i = 0; i < h.n; i++) {
    const v = values[i];
    if (Number.isNaN(v) || !keep(i)) continue;
    top += h.w[i] * v;
    bottom += h.w[i];
  }
  return bottom > 0 ? (100 * top) / bottom : Number.NaN;
}
