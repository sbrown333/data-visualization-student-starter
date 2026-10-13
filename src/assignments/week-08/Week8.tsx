import { useEffect, useState } from 'react';
import { parseAudit } from './audit';
import type { Audit } from './audit';
import { HOUSEHOLDS_URL, parseHouseholds } from './households';
import type { Households } from './households';
import { AuditTab } from './AuditTab';
import { Participation } from './Participation';

const OLD_URL = `${import.meta.env.BASE_URL}data/digital-payments/banking_sample_10000.csv`;

type Tab = 'audit' | 'participation';
const TABS: { key: Tab; label: string }[] = [
  { key: 'audit', label: 'What was wrong' },
  { key: 'participation', label: 'Digital participation' },
];

interface Loaded {
  audit: Audit;
  rebuilt: Households;
}

export function Week8() {
  const [tab, setTab] = useState<Tab>('audit');
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(OLD_URL).then((r) => {
        if (!r.ok) throw new Error(`Could not load the old sample (${r.status}).`);
        return r.text();
      }),
      fetch(HOUSEHOLDS_URL).then((r) => {
        if (!r.ok) throw new Error(`Could not load the rebuilt household file (${r.status}).`);
        return r.text();
      }),
    ])
      .then(([oldText, newText]) => {
        if (cancelled) return;
        setData({ audit: parseAudit(oldText), rebuilt: parseHouseholds(newText) });
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Something went wrong loading the data.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold text-gray-900">Digital payments and banking access</h1>
        <p className="text-sm text-gray-600 mt-1 mb-5">
          Week 8: I traced my sample back to the FDIC&apos;s 2023 survey, fixed it, and started on how digital payment tools
          are used by banking status, income, age and education.
        </p>
        <div role="tablist" className="flex gap-2 border-b border-gray-200 mb-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm -mb-px border-b-2 ${
                tab === t.key ? 'border-gray-900 text-gray-900 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        {!error && !data && <p className="text-sm text-gray-500">Loading data…</p>}
        {data && tab === 'audit' && <AuditTab audit={data.audit} rebuilt={data.rebuilt} />}
        {data && tab === 'participation' && <Participation data={data.rebuilt} />}
      </div>
    </div>
  );
}
