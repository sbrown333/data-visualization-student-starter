import { useEffect, useMemo, useState } from 'react';
import { HOUSEHOLDS_URL, parseHouseholds } from './households';
import type { Households } from './households';
import { ALL_KEYS, buildComponents, scoreAll } from './readiness';
import { Pills } from './parts';
import { Participation } from './Participation';
import { Explorer } from './Explorer';
import { Distributions } from './Distributions';
import { StateTab } from './StateTab';
import { ToolHeatmap } from './ToolHeatmap';

// Week 8: the project on the rebuilt FDIC 2023 household file (29,483 households,
// weighted). Same one-view-at-a-time tabs as Week 6. The readiness score
// components are shared by every tab that uses the score.
const TABS = [
  { key: 'gap', label: 'Adoption gap' },
  { key: 'explore', label: 'Readiness explorer' },
  { key: 'spread', label: 'Distributions' },
  { key: 'state', label: 'By state' },
  { key: 'tools', label: 'Tool heatmap' },
];

export function Week8() {
  const [tab, setTab] = useState('gap');
  const [data, setData] = useState<Households | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<ReadonlySet<string>>(new Set(ALL_KEYS));

  useEffect(() => {
    let cancelled = false;
    fetch(HOUSEHOLDS_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load the household data (${r.status}).`);
        return r.text();
      })
      .then((text) => {
        if (!cancelled) setData(parseHouseholds(text));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Something went wrong loading the data.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const comps = useMemo(() => (data ? buildComponents(data) : null), [data]);
  const scores = useMemo(() => (data && comps ? scoreAll(data, comps, active) : null), [data, comps, active]);

  const toggle = (k: string) =>
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next.size === 0 ? prev : next;
    });

  return (
    <div className="p-6 max-w-4xl w-full overflow-y-auto h-full">
      <h1 className="text-2xl font-bold mb-1">Left Behind? Mapping America&apos;s Digital Payments Divide</h1>
      <p className="text-sm text-gray-500 mb-5">
        2023 FDIC survey of unbanked and underbanked households: {data ? data.n.toLocaleString() : '29,483'} households,
        weighted to represent all U.S. households.
      </p>
      <div className="mb-6">
        <Pills items={TABS} value={tab} onChange={setTab} name="Choose a view" />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {!error && !data && <p className="text-sm text-gray-500">Loading data…</p>}
      {data && comps && scores && (
        <>
          {tab === 'gap' && <Participation data={data} />}
          {tab === 'explore' && (
            <Explorer data={data} comps={comps} scores={scores} active={active} onToggle={toggle} />
          )}
          {tab === 'spread' && (
            <Distributions data={data} comps={comps} scores={scores} active={active} onToggle={toggle} />
          )}
          {tab === 'state' && <StateTab data={data} scores={scores} />}
          {tab === 'tools' && <ToolHeatmap data={data} />}
        </>
      )}
    </div>
  );
}
