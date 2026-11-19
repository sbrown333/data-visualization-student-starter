// Week 13: the over-time data. One small file built from the FDIC multi-year household
// file (surveys from 2009 to 2023). Each row is one rate for one group in one survey year.

export const TRENDS_URL = `${import.meta.env.BASE_URL}data/digital-payments/trends_2009_2023.csv`;

export interface TrendRow {
  measure: string;
  dimension: string;
  group: string;
  year: number;
  rate: number;
  lo: number;
  hi: number;
  n: number;
}

export function parseTrends(text: string): TrendRow[] {
  const lines = text.trim().split(/\r?\n/);
  const out: TrendRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    // Group names never contain commas, so a plain split is safe for this file.
    const c = lines[i].split(',');
    if (c.length < 8) continue;
    out.push({ measure: c[0], dimension: c[1], group: c[2], year: +c[3], rate: +c[4], lo: +c[5], hi: +c[6], n: +c[7] });
  }
  return out;
}

export interface TrendMeasure {
  key: string;
  label: string;
  what: string;
}

export const TREND_MEASURES: TrendMeasure[] = [
  { key: 'unbanked', label: 'Unbanked rate', what: 'households with no checking or savings account (every survey, 2009 to 2023)' },
  { key: 'mobile', label: 'Mainly mobile app', what: 'banked households whose most common way into their account is a mobile app (asked since 2013)' },
  { key: 'online', label: 'Mainly online banking', what: 'banked households whose most common way into their account is online banking on a computer (asked since 2013)' },
  { key: 'branch', label: 'Mainly teller or ATM', what: 'banked households whose most common way into their account is a bank teller or an ATM (asked since 2013)' },
  { key: 'smartphone', label: 'Smartphone', what: 'households with a smartphone (asked in 2013 to 2019 and 2023, not in 2021)' },
];

export const REGIONS = ['Northeast', 'Midwest', 'South', 'West'];
