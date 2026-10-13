import { COMPONENTS } from './readiness';

// The score's building blocks as switches. Turning one off redraws everything
// that uses the score. Cash dependence is listed but disabled: the 2023 FDIC
// file has no question about it.
export function ComponentSwitches({ active, onToggle }: { active: ReadonlySet<string>; onToggle: (k: string) => void }) {
  return (
    <div role="group" aria-label="Score components" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {COMPONENTS.map((c) => {
        const on = active.has(c.key);
        return (
          <label
            key={c.key}
            className={`flex items-start gap-2 border rounded-xl p-2 text-sm cursor-pointer ${
              on ? 'border-gray-900 bg-white' : 'border-gray-200 bg-gray-50 text-gray-500'
            }`}
          >
            <input
              type="checkbox"
              checked={on}
              disabled={on && active.size === 1}
              onChange={() => onToggle(c.key)}
              className="mt-1"
            />
            <span>
              <span className="font-semibold text-gray-900">{c.label}</span>
              <span className="block text-xs text-gray-500">{c.detail}</span>
            </span>
          </label>
        );
      })}
      <div className="flex items-start gap-2 border border-dashed border-gray-300 rounded-xl p-2 text-sm text-gray-400">
        <input type="checkbox" disabled className="mt-1" />
        <span>
          <span className="font-semibold">Cash dependence</span>
          <span className="block text-xs">Not in the 2023 FDIC data, so it is not in the score</span>
        </span>
      </div>
    </div>
  );
}
