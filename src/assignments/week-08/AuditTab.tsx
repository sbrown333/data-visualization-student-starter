import { useMemo } from 'react';
import { scaleLinear } from 'd3-scale';
import { FDIC_2023, FDIC_SOURCE_URL, STATUSES, accessSum, pct } from './audit';
import type { Audit, Status } from './audit';
import { COLORS, RAW_FACTS, countWhere, weightedShare } from './households';
import type { Households } from './households';
import { Card, HBars, Legend, SegBar, TipFrame } from './parts';
import type { HGroup, Seg } from './parts';

// Week 8, tab 1: what was wrong with the 10,000-household sample, why, and how
// the rebuilt file compares. Old-sample numbers are computed from
// banking_sample_10000.csv and rebuilt-file numbers from households_2023.csv,
// so the page re-checks itself if either file changes.

const W = 760;
const BAR_X = 190;
const BAR_W = W - BAR_X - 24;

const fmt = (n: number) => n.toLocaleString();
const one = (n: number) => n.toFixed(1);

// ---------- check 1: banking status ----------

function StatusChart({
  audit,
  oldSegs,
  rebuiltSegs,
  rebuiltN,
}: {
  audit: Audit;
  oldSegs: Seg[];
  rebuiltSegs: Seg[];
  rebuiltN: number;
}) {
  const fdicSegs: Seg[] = STATUSES.map((s) => ({
    key: s,
    value: FDIC_2023.status[s],
    color: COLORS.status[s],
    head: `${one(FDIC_2023.status[s])}%`,
    lines: [`${s}, FDIC 2023`, `about ${FDIC_2023.households[s]} households`],
  }));
  const rows = [
    { y: 16, label: 'Old sample', sub: `${fmt(audit.total)} households, unweighted`, segs: oldSegs, id: 'w8-status-old' },
    { y: 64, label: 'Rebuilt file', sub: `${fmt(rebuiltN)} households, weighted`, segs: rebuiltSegs, id: 'w8-status-new' },
    { y: 112, label: 'FDIC 2023', sub: 'published, all U.S. households', segs: fdicSegs, id: 'w8-status-fdic' },
  ];
  return (
    <TipFrame>
      {(show, hide) => (
        <svg
          viewBox={`0 0 ${W} 156`}
          width="100%"
          role="img"
          aria-label="Banking status in my old sample, in the rebuilt file and in the FDIC 2023 results, as three bars split into unbanked, underbanked and fully banked."
          onPointerLeave={hide}
        >
          {rows.map((row) => (
            <g key={row.id}>
              <text x={0} y={row.y + 11} fontSize={12} fill={COLORS.ink}>
                {row.label}
              </text>
              <text x={0} y={row.y + 26} fontSize={11} fill={COLORS.ink2}>
                {row.sub}
              </text>
              <SegBar x0={BAR_X} y={row.y} w={BAR_W} segs={row.segs} clipId={row.id} show={show} />
            </g>
          ))}
        </svg>
      )}
    </TipFrame>
  );
}

// ---------- check 2: missing answers ----------

function MissingChart({ audit }: { audit: Audit }) {
  const parts = [
    { key: 'none', label: 'Unbanked (no account)', count: audit.status.Unbanked, color: COLORS.noAccount },
    { key: 'recorded', label: 'Banked, access method recorded', count: audit.accessRecorded, color: COLORS.oldSample },
    { key: 'missing', label: 'Banked, access method missing', count: audit.accessMissing, color: COLORS.missing },
  ];
  const segs: Seg[] = parts.map((p) => ({
    key: p.key,
    value: p.count,
    color: p.color,
    head: `${one(pct(p.count, audit.total))}%`,
    lines: [p.label, `${fmt(p.count)} of ${fmt(audit.total)} households`],
  }));
  return (
    <div>
      <TipFrame>
        {(show, hide) => (
          <svg
            viewBox={`0 0 ${W} 44`}
            width="100%"
            role="img"
            aria-label="All households in the old sample split into unbanked, banked with a recorded access method, and banked with a missing access method."
            onPointerLeave={hide}
          >
            <SegBar x0={0} y={10} w={W - 24} segs={segs} clipId="w8-missing" show={show} />
          </svg>
        )}
      </TipFrame>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
        {parts.map((p) => (
          <div key={p.key} className="border border-gray-200 rounded-xl p-3 bg-white">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
              {p.label}
            </div>
            <div className="text-2xl font-semibold text-gray-900 mt-1">{fmt(p.count)}</div>
            <div className="text-xs text-gray-500">{one(pct(p.count, audit.total))}% of households</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- check 4: household size in the old sample ----------

const SM = { top: 22, right: 24, bottom: 46, left: 56 };
const SH = 270;
const SIW = W - SM.left - SM.right;
const SIH = SH - SM.top - SM.bottom;

function topRounded(x: number, y: number, w: number, h: number, r0: number) {
  const r = Math.min(r0, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

function SizeChart({ audit }: { audit: Audit }) {
  const maxK = Math.max(14, audit.maxSize);
  const ks = Array.from({ length: maxK }, (_, i) => i + 1);
  const counts = ks.map((k) => audit.sizeCounts[k] ?? 0);
  const peak = Math.max(...counts, 1);
  const y = scaleLinear().domain([0, peak]).nice().range([SIH, 0]);
  const bw = SIW / ks.length;
  const peakIndex = counts.indexOf(peak);

  return (
    <TipFrame>
      {(show, hide) => (
        <svg
          viewBox={`0 0 ${W} ${SH}`}
          width="100%"
          role="img"
          aria-label="Number of households in my old sample by household size, from 1 to 14 people. There are no one-person households."
          onPointerLeave={hide}
        >
          <g transform={`translate(${SM.left},${SM.top})`}>
            {y.ticks(5).map((t) => (
              <g key={t} transform={`translate(0,${y(t)})`}>
                <line x2={SIW} stroke={COLORS.grid} strokeWidth={1} />
                <text x={-10} dy="0.32em" textAnchor="end" fontSize={12} fill={COLORS.ink2}>
                  {t.toLocaleString()}
                </text>
              </g>
            ))}
            {ks.map((k, i) => {
              const c = counts[i];
              const bx = i * bw + 4;
              const w = bw - 8;
              const h = SIH - y(c);
              return (
                <g key={k}>
                  {c === 0 ? (
                    <>
                      <rect x={bx} y={0} width={w} height={SIH} rx={4} fill={COLORS.track} />
                      {k === 1 && (
                        <text
                          transform={`translate(${bx + w / 2},${SIH / 2}) rotate(-90)`}
                          textAnchor="middle"
                          dy="0.32em"
                          fontSize={12}
                          fill={COLORS.ink2}
                        >
                          No one-person households
                        </text>
                      )}
                    </>
                  ) : (
                    <path d={topRounded(bx, y(c), w, h, 4)} fill={COLORS.oldSample} />
                  )}
                  {i === peakIndex && (
                    <text x={bx + w / 2} y={y(c) - 6} textAnchor="middle" fontSize={12} fill={COLORS.ink}>
                      {fmt(c)}
                    </text>
                  )}
                  <text x={bx + w / 2} y={SIH + 20} textAnchor="middle" fontSize={12} fill={COLORS.ink2}>
                    {k}
                  </text>
                  <rect
                    x={i * bw}
                    y={0}
                    width={bw}
                    height={SIH}
                    fill="transparent"
                    onPointerMove={(e) =>
                      show(e, `${fmt(c)} households`, [
                        `${k} ${k === 1 ? 'person' : 'people'}`,
                        `${one(pct(c, audit.total))}% of the old sample`,
                      ])
                    }
                  />
                </g>
              );
            })}
          </g>
          <text x={SM.left} y={12} fontSize={12} fill={COLORS.ink2}>
            ↑ Households in the old sample
          </text>
          <text x={W - SM.right} y={SH - 6} textAnchor="end" fontSize={12} fill={COLORS.ink2}>
            Household size (people) →
          </text>
        </svg>
      )}
    </TipFrame>
  );
}

// ---------- the tab ----------

export function AuditTab({ audit, rebuilt }: { audit: Audit; rebuilt: Households }) {
  const re = useMemo(() => {
    const S = rebuilt.col.banking_status;
    const A = rebuilt.col.access_method;
    const R = rebuilt.col.race_ethnicity;
    const Z = rebuilt.col.household_size;
    const all = () => true;
    const unbanked = (i: number) => S[i] === 'Unbanked';
    const status = {} as Record<Status, number>;
    const households = {} as Record<Status, number>;
    for (const s of STATUSES) {
      status[s] = weightedShare(rebuilt, (i) => S[i] === s, all);
      let sum = 0;
      for (let i = 0; i < rebuilt.n; i++) if (S[i] === s) sum += rebuilt.w[i];
      households[s] = sum;
    }
    const reported = (i: number) => S[i] !== 'Unbanked' && A[i] !== '' && A[i] !== 'Not reported';
    const share = (methods: string[]) => weightedShare(rebuilt, (i) => methods.includes(A[i]), reported);
    const alone = (i: number) => Z[i] === '1';
    return {
      status,
      households,
      unbankedAll: status.Unbanked,
      unbankedBlack: weightedShare(rebuilt, unbanked, (i) => R[i] === 'Black'),
      unbankedHispanic: weightedShare(rebuilt, unbanked, (i) => R[i] === 'Hispanic'),
      mobile: share(['Mobile app']),
      online: share(['Online']),
      offsite: share(['Telephone', 'Online', 'Mobile app']),
      inPerson: share(['Bank teller', 'ATM/kiosk']),
      notReported: countWhere(rebuilt, (i) => S[i] !== 'Unbanked' && A[i] === 'Not reported'),
      banked: countWhere(rebuilt, (i) => S[i] !== 'Unbanked'),
      aloneCount: countWhere(rebuilt, alone),
      aloneShare: weightedShare(rebuilt, alone, all),
      aloneUnbanked: weightedShare(rebuilt, unbanked, alone),
      othersUnbanked: weightedShare(rebuilt, unbanked, (i) => !alone(i)),
    };
  }, [rebuilt]);

  const oldSegs: Seg[] = STATUSES.map((s) => ({
    key: s,
    value: pct(audit.status[s], audit.total),
    color: COLORS.status[s],
    head: `${one(pct(audit.status[s], audit.total))}%`,
    lines: [`${s}, old sample`, `${fmt(audit.status[s])} of ${fmt(audit.total)} households`],
  }));
  const rebuiltSegs: Seg[] = STATUSES.map((s) => ({
    key: s,
    value: re.status[s],
    color: COLORS.status[s],
    head: `${one(re.status[s])}%`,
    lines: [`${s}, rebuilt file`, `about ${(re.households[s] / 1e6).toFixed(1)} million households`],
  }));

  const fdicGroupRate = [FDIC_2023.status.Unbanked, FDIC_2023.unbankedBlack, FDIC_2023.unbankedHispanic];
  const rebuiltGroupRate = [re.unbankedAll, re.unbankedBlack, re.unbankedHispanic];
  const groupBars: HGroup[] = audit.groups.map((g, i) => ({
    title: g.label,
    bars: [
      {
        label: 'Old sample',
        value: pct(g.unbanked, g.n),
        color: COLORS.oldSample,
        lines: [`${fmt(g.unbanked)} of ${fmt(g.n)} households are unbanked`],
      },
      { label: 'Rebuilt file', value: rebuiltGroupRate[i], color: COLORS.rebuilt, lines: ['Weighted'] },
      { label: 'FDIC 2023', value: fdicGroupRate[i], color: COLORS.fdic, lines: ['Published national rate, weighted'] },
    ],
  }));

  const rec = audit.accessRecorded;
  const oldMobile = pct(audit.accessCounts['Mobile Banking App'] ?? 0, rec);
  const oldOnline = pct(audit.accessCounts['Online Banking'] ?? 0, rec);
  const oldOffsite = pct(accessSum(audit, ['Mobile Banking App', 'Online Banking', 'Telephone Banking']), rec);
  const oldInPerson = pct(accessSum(audit, ['Bank Teller', 'ATM/Kiosk']), rec);
  const oldBasis = `Share of banked households with a recorded method (${fmt(rec)})`;
  const newBasis = 'Weighted share of banked households that answered';
  const fdicBasis = 'Share of banked households, weighted';

  const accessGroups: HGroup[] = [
    {
      title: 'Mobile banking as the main way to use the account',
      bars: [
        { label: 'FDIC 2023: mobile banking', value: FDIC_2023.mobile, color: COLORS.fdic, lines: [fdicBasis] },
        { label: 'Rebuilt file: mobile app', value: re.mobile, color: COLORS.rebuilt, lines: [newBasis] },
        { label: 'Old sample label "Mobile Banking App"', value: oldMobile, color: COLORS.oldSample, lines: [oldBasis] },
        { label: 'Old sample label "Online Banking"', value: oldOnline, color: COLORS.oldSample, lines: [oldBasis] },
      ],
    },
    {
      title: 'Off-site: mobile, online or telephone',
      bars: [
        { label: 'FDIC 2023: off-site', value: FDIC_2023.offsite, color: COLORS.fdic, lines: [fdicBasis] },
        { label: 'Rebuilt file', value: re.offsite, color: COLORS.rebuilt, lines: [newBasis] },
        { label: 'Old sample', value: oldOffsite, color: COLORS.oldSample, lines: [oldBasis] },
      ],
    },
    {
      title: 'In person: bank teller or ATM',
      bars: [
        { label: 'FDIC 2023: in person', value: FDIC_2023.inPerson, color: COLORS.fdic, lines: [fdicBasis] },
        { label: 'Rebuilt file', value: re.inPerson, color: COLORS.rebuilt, lines: [newBasis] },
        { label: 'Old sample', value: oldInPerson, color: COLORS.oldSample, lines: [oldBasis] },
      ],
    },
  ];

  const droppedShare = (100 * RAW_FACTS.droppedByOldFilter) / RAW_FACTS.respondingHouseholds;
  const neverShare = (100 * RAW_FACTS.oldFilterNeverAnswered) / RAW_FACTS.oldFilterRows;
  const legend3 = [
    { label: 'Old sample', color: COLORS.oldSample },
    { label: 'Rebuilt file', color: COLORS.rebuilt },
    { label: 'FDIC 2023', color: COLORS.fdic },
  ];

  return (
    <div>
      <Card title="What I found">
        <p className="text-sm text-gray-600 mb-3">
          I traced my 10,000-household sample back to the FDIC&apos;s full 2023 file. Three mistakes in how I built it
          explain everything below:
        </p>
        <ol className="list-decimal pl-5 text-sm text-gray-700 space-y-1 mb-3">
          <li>
            <span className="font-semibold">I left out people who live alone.</span> I kept only households whose
            reference person lives with relatives. That dropped {fmt(RAW_FACTS.droppedByOldFilter)} households that
            answered the survey ({one(droppedShare)}%), including all {fmt(RAW_FACTS.livingAlone)} one-person households.
          </li>
          <li>
            <span className="font-semibold">I kept households that never answered.</span> {fmt(RAW_FACTS.oldFilterNeverAnswered)}{' '}
            of the {fmt(RAW_FACTS.oldFilterRows)} rows I started from ({one(neverShare)}%) have no banking answers. The file
            gives them a default &quot;fully banked&quot; code, so they looked like fully banked households with missing
            answers.
          </li>
          <li>
            <span className="font-semibold">I ignored the survey weights.</span> The FDIC weights each household so the
            results represent all U.S. households.
          </li>
        </ol>
        <p className="text-sm text-gray-600">
          I rebuilt the file from every household that answered ({fmt(rebuilt.n)}), with the FDIC&apos;s household weight.
          It reproduces 37 figures the FDIC publishes, listed in this folder&apos;s README.
        </p>
      </Card>

      <Card title="1. Unbanked households were under-represented by about half">
        <p className="text-sm text-gray-600 mb-3">
          The old sample had {one(pct(audit.status.Unbanked, audit.total))}% unbanked households and the FDIC reports{' '}
          {one(FDIC_2023.status.Unbanked)}%. The rebuilt file has {one(re.unbankedAll)}%. Leaving out people who live alone
          mattered: in the rebuilt file, one-person households are unbanked {one(re.aloneUnbanked)}% of the time, against{' '}
          {one(re.othersUnbanked)}% for everyone else.
        </p>
        <StatusChart audit={audit} oldSegs={oldSegs} rebuiltSegs={rebuiltSegs} rebuiltN={rebuilt.n} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          {STATUSES.map((s) => (
            <div key={s} className="border border-gray-200 rounded-xl p-3 bg-white">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.status[s] }} />
                {s}
              </div>
              <div className="text-2xl font-semibold text-gray-900 mt-1">{one(re.status[s])}%</div>
              <div className="text-xs text-gray-500">
                rebuilt file · FDIC 2023: {one(FDIC_2023.status[s])}% · old sample: {one(pct(audit.status[s], audit.total))}%
              </div>
            </div>
          ))}
        </div>
        <h3 className="text-sm font-semibold text-gray-900 mt-6 mb-2">Unbanked rate, by group</h3>
        <Legend items={legend3} />
        <HBars
          groups={groupBars}
          max={12}
          ticks={[0, 4, 8, 12]}
          labelW={110}
          ariaLabel="Unbanked rate for all households, Black households and Hispanic households, in my old sample, the rebuilt file and the FDIC 2023 results."
        />
        <p className="text-xs text-gray-500 mt-2">
          The rebuilt rates for Black and Hispanic households ({one(re.unbankedBlack)}% and {one(re.unbankedHispanic)}%) are
          close to the FDIC&apos;s, not identical. The FDIC may define these groups slightly differently.
        </p>
      </Card>

      <Card title="2. About 3 in 10 households had no recorded access method">
        <p className="text-sm text-gray-600 mb-3">
          {fmt(audit.accessMissing)} banked households ({one(pct(audit.accessMissing, audit.total))}% of the old sample) show
          &quot;N/A (Unbanked)&quot; as their access method, and {fmt(audit.accountMissingBanked)} of them also have no answer to
          the account question. These are the households that never answered, not unbanked households. In the rebuilt file
          only {fmt(re.notReported)} of {fmt(re.banked)} banked households ({one(pct(re.notReported, re.banked))}%) lack an
          access answer, and they are labeled &quot;Not reported&quot;.
        </p>
        <MissingChart audit={audit} />
      </Card>

      <Card title="3. The mobile and online labels were swapped">
        <p className="text-sm text-gray-600 mb-3">
          In the FDIC file, the code for mobile banking gives {one(re.mobile)}% of banked households, matching the FDIC&apos;s{' '}
          {one(FDIC_2023.mobile)}%. My old &quot;Online Banking&quot; share ({one(oldOnline)}%) was really mobile banking, and
          my old &quot;Mobile Banking App&quot; share ({one(oldMobile)}%) was really online banking. The off-site and in-person
          totals match the FDIC&apos;s in both versions, so only the split between mobile and online was wrong.
        </p>
        <Legend items={legend3} />
        <HBars
          groups={accessGroups}
          max={80}
          ticks={[0, 20, 40, 60, 80]}
          labelW={250}
          ariaLabel="How banked households mainly access their account: mobile banking, off-site channels together, and in-person channels, in the FDIC 2023 results, the rebuilt file and my old sample."
        />
        <p className="text-xs text-gray-500 mt-2">
          Percentages cover banked households that reported a method. The split between bank teller and ATM is not checked
          against a published figure, only their total.
        </p>
      </Card>

      <Card title="4. There were no one-person households">
        <p className="text-sm text-gray-600 mb-3">
          Household sizes in the old sample ran from {audit.minSize} to {audit.maxSize}. In the rebuilt file,{' '}
          {fmt(re.aloneCount)} households ({one(100 * re.aloneCount / rebuilt.n)}% of those surveyed, {one(re.aloneShare)}% of
          U.S. households once weighted) live alone.
        </p>
        <SizeChart audit={audit} />
      </Card>

      <Card title="What I do next">
        <ol className="list-decimal pl-5 text-sm text-gray-700 space-y-1">
          <li>Switch the earlier charts to the rebuilt file, so every rate is weighted and matches the FDIC&apos;s.</li>
          <li>Get the FDIC&apos;s earlier survey years to show change over time, which one year of data cannot do.</li>
          <li>Find a source for how the share of payments made in cash has changed, because the FDIC survey does not measure it.</li>
          <li>Map state-level rates with a warning for states with few surveyed households.</li>
          <li>Build a payment-readiness score from banking access, smartphone, online payments, credit and income, and explain how it is built.</li>
        </ol>
      </Card>

      <p className="text-xs text-gray-500">
        FDIC figures:{' '}
        <a className="underline" href={FDIC_SOURCE_URL} target="_blank" rel="noreferrer">
          2023 FDIC National Survey of Unbanked and Underbanked Households, executive summary
        </a>
        . Full sources and caveats are in this folder&apos;s README.
      </p>
    </div>
  );
}
