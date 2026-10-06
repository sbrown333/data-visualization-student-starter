import { useState } from 'react';
import { BankingBrushing } from './BankingBrushing';
import { PenguinBrushing } from './PenguinBrushing';

// Week 7 recreates the "linked brushing" technique from Allison Horst's
// Observable article. Tab 1 applies it to the banking survey sample from this
// project. Tab 2 is a close recreation of the article's penguin example.
// Only one view renders at a time, same tab pattern as Week 6.
// Sources and credits are in README.md in this folder.
const VIEWS = ['Banking households', 'Penguins (original)'] as const;
type View = (typeof VIEWS)[number];

export function Week7() {
  const [view, setView] = useState<View>('Banking households');

  return (
    <div className="p-6 max-w-4xl w-full overflow-y-auto h-full">
      <h1 className="text-2xl font-bold mb-1">Week 7: Linked Brushing</h1>
      <p className="text-sm text-gray-500 mb-6">
        {view === 'Banking households'
          ? 'Select households by age and household size. The bars below compare their banking status with all 10,000 households.'
          : 'Palmer penguins. Select penguins on the scatterplot and the histogram shows their body mass.'}
      </p>

      <div className="flex gap-2 mb-6" role="tablist" aria-label="Choose a view">
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

      {view === 'Banking households' && <BankingBrushing />}

      {view === 'Penguins (original)' && (
        <>
          <PenguinBrushing />
          <p className="mt-6 text-xs text-gray-400">
            Recreated from Allison Horst&apos;s linked brushing article on the Observable blog. Full credits in this
            folder&apos;s README.
          </p>
        </>
      )}
    </div>
  );
}

