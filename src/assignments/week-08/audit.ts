// Week 8: checks that compare the 10,000-household sample with the FDIC's
// published 2023 results. This file holds the numbers and the arithmetic, and
// Week8.tsx draws them. Sources are listed in README.md in this folder.

export const STATUSES = ['Unbanked', 'Underbanked', 'Fully Banked'] as const;
export type Status = (typeof STATUSES)[number];

// Published results from the FDIC 2023 National Survey of Unbanked and
// Underbanked Households. These are weighted to represent all U.S. households.
// Fully banked is what is left after unbanked and underbanked (100 - 4.2 - 14.2).
// The off-site and in-person shares come from the executive summary text.
export const FDIC_2023 = {
  status: { Unbanked: 4.2, Underbanked: 14.2, 'Fully Banked': 81.6 } as Record<Status, number>,
  households: { Unbanked: '5.6 million', Underbanked: '19.0 million', 'Fully Banked': '109.1 million' } as Record<
    Status,
    string
  >,
  unbankedBlack: 10.6,
  unbankedHispanic: 9.5,
  mobile: 48.3,
  offsite: 70.5,
  inPerson: 28.9,
};

export const FDIC_SOURCE_URL =
  'https://fdic.gov/household-survey/2023-fdic-national-survey-unbanked-and-underbanked-households-executive-summary';

export interface GroupRate {
  label: string;
  n: number;
  unbanked: number;
}

export interface Audit {
  total: number;
  status: Record<Status, number>;
  groups: GroupRate[];
  banked: number;
  // Households whose account question is N/A, and how many of them are
  // labeled Fully Banked or Underbanked anyway.
  accountMissing: number;
  accountMissingBanked: number;
  // Banked households with and without a recorded way of accessing the account.
  accessRecorded: number;
  accessMissing: number;
  accessCounts: Record<string, number>;
  // sizeCounts[k] is the number of households with k people.
  sizeCounts: number[];
  minSize: number;
  maxSize: number;
}

const isNA = (v: string) => v.trim().toUpperCase().startsWith('N/A');

export function parseAudit(text: string): Audit {
  const lines = text.trim().split(/\r?\n/);
  const header = (lines[0] ?? '').split(',');
  const col = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`The banking data file is missing the "${name}" column.`);
    return i;
  };
  const iStatus = col('banking_status');
  const iAccount = col('has_bank_account');
  const iAccess = col('primary_access_method');
  const iSize = col('household_size');
  const iRace = col('race');
  const iHispanic = col('hispanic_origin');

  const status: Record<Status, number> = { Unbanked: 0, Underbanked: 0, 'Fully Banked': 0 };
  const groups: GroupRate[] = [
    { label: 'All households', n: 0, unbanked: 0 },
    { label: 'Black households', n: 0, unbanked: 0 },
    { label: 'Hispanic households', n: 0, unbanked: 0 },
  ];
  const accessCounts: Record<string, number> = {};
  const sizeMap = new Map<number, number>();
  let total = 0;
  let banked = 0;
  let accountMissing = 0;
  let accountMissingBanked = 0;
  let accessRecorded = 0;
  let accessMissing = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (line.trim() === '') continue;
    const cols = line.split(',');
    const st = (cols[iStatus] ?? '') as Status;
    if (!STATUSES.includes(st)) continue;

    total += 1;
    status[st] += 1;
    const isUnbanked = st === 'Unbanked';

    groups[0].n += 1;
    if (isUnbanked) groups[0].unbanked += 1;
    if ((cols[iRace] ?? '') === 'Black') {
      groups[1].n += 1;
      if (isUnbanked) groups[1].unbanked += 1;
    }
    if ((cols[iHispanic] ?? '') === 'Hispanic') {
      groups[2].n += 1;
      if (isUnbanked) groups[2].unbanked += 1;
    }

    const account = cols[iAccount] ?? '';
    if (isNA(account)) {
      accountMissing += 1;
      if (!isUnbanked) accountMissingBanked += 1;
    }

    if (!isUnbanked) {
      banked += 1;
      const access = (cols[iAccess] ?? '').trim();
      if (access === '' || isNA(access)) {
        accessMissing += 1;
      } else {
        accessRecorded += 1;
        accessCounts[access] = (accessCounts[access] ?? 0) + 1;
      }
    }

    const size = Number(cols[iSize]);
    if (!Number.isNaN(size) && Number.isInteger(size) && size >= 0) {
      sizeMap.set(size, (sizeMap.get(size) ?? 0) + 1);
    }
  }

  if (total === 0) throw new Error('The banking data file has no usable rows.');

  const sizes = Array.from(sizeMap.keys());
  const minSize = sizes.length ? Math.min(...sizes) : 0;
  const maxSize = sizes.length ? Math.max(...sizes) : 0;
  const sizeCounts: number[] = [];
  for (let k = 0; k <= maxSize; k++) sizeCounts.push(sizeMap.get(k) ?? 0);

  return {
    total,
    status,
    groups,
    banked,
    accountMissing,
    accountMissingBanked,
    accessRecorded,
    accessMissing,
    accessCounts,
    sizeCounts,
    minSize,
    maxSize,
  };
}

export const pct = (n: number, d: number) => (d > 0 ? (100 * n) / d : 0);

// Sum of the access-method counts for the named methods.
export function accessSum(audit: Audit, methods: string[]): number {
  return methods.reduce((a, m) => a + (audit.accessCounts[m] ?? 0), 0);
}
