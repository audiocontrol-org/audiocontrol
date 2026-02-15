/**
 * Partial Selector Component
 *
 * Tab-style selector for choosing which partial (1-4) to edit.
 * Shows mute state from tone common parameters.
 */

import { useD110Store, selectCurrentTone } from '@/stores';
import { cn } from '@/lib/utils';

export function PartialSelector(): JSX.Element {
  const selectedPartial = useD110Store((state) => state.selectedPartial);
  const selectPartial = useD110Store((state) => state.selectPartial);
  const tone = useD110Store(selectCurrentTone);

  const partialMutes = tone?.common.partialMutes ?? {
    partial1: false,
    partial2: false,
    partial3: false,
    partial4: false,
  };

  const partials = [
    { index: 0, label: 'P1', muted: partialMutes.partial1 },
    { index: 1, label: 'P2', muted: partialMutes.partial2 },
    { index: 2, label: 'P3', muted: partialMutes.partial3 },
    { index: 3, label: 'P4', muted: partialMutes.partial4 },
  ];

  return (
    <div className="flex gap-1">
      {partials.map(({ index, label, muted }) => {
        const isSelected = selectedPartial === index;
        return (
          <button
            key={index}
            onClick={() => selectPartial(index)}
            className={cn(
              'px-4 py-2 rounded-md font-medium text-sm transition-colors',
              isSelected
                ? 'bg-d110-accent text-white'
                : 'bg-d110-surface text-d110-text hover:bg-d110-border',
              muted && 'opacity-50'
            )}
            title={muted ? `${label}: Muted` : `${label}: Active`}
          >
            <span className="flex items-center gap-1.5">
              {label}
              {muted && (
                <span className="text-[10px] uppercase tracking-wide opacity-75">
                  (M)
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
