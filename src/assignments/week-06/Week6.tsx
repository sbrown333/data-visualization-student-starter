import { useState } from 'react';
import { DisaggregatedView } from './ProjectV1';
import { AccessHeatmapSection } from './AccessHeatmap';
import { StateMap } from './StateMap';

// Week 6 / Project V1 combines three views that all respond to feedback on
// the earlier flat-total chart: disaggregating banking status by age/
// income/education, by employment status & access method, and by state.
//
// Peer feedback (Chris, participation review): the original layout stacked
// all views on one page at once - 5 panels total before the demographic
// views were combined into 1 - which risked overwhelming a first-time
// viewer. Fix: only one view renders at a time, chosen with these tabs,
// same pattern as the dimension toggle already used inside each view.
const VIEWS = ['Demographics', 'Access & Employment', 'By State'] as const;
type View = (typeof VIEWS)[number];

export function Week6() {
  const [view, setView] = useState<View>('Demographics');

  return (
    <div className="p-6 max-w-4xl w-full overflow-y-auto h-full">
      <h1 className="text-2xl font-bold mb-1">Project V1: Banking Status, Disaggregated</h1>
      <p className="text-xs text-gray-400 mb-6">
        Three views into the same question. Switch between them below rather than scrolling through all at
        once.
      </p>

      <div className="flex gap-2 mb-8" role="tablist" aria-label="Choose a view">
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
              view === v
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {view === 'Demographics' && (
        <section>
          <h2 className="text-lg font-bold mb-1">By Age, Income &amp; Education</h2>
          <DisaggregatedView />
        </section>
      )}

      {view === 'Access & Employment' && (
        <section>
          <h2 className="text-lg font-bold mb-1">By Employment Status &amp; Access Method</h2>
          <AccessHeatmapSection />
        </section>
      )}

      {view === 'By State' && (
        <section>
          <h2 className="text-lg font-bold mb-1">By State</h2>
          <StateMap />
        </section>
      )}
    </div>
  );
}
