/**
 * Part selector component for choosing which part to edit
 *
 * The D-110 has 8 parts, each with its own tone assignment.
 */

import { useD110Store } from '@/stores';
import { cn } from '@/lib/utils';

export function PartSelector(): JSX.Element {
  const selectedPart = useD110Store((state) => state.selectedPart);
  const tones = useD110Store((state) => state.tones);
  const selectPart = useD110Store((state) => state.selectPart);
  const dirtyParts = useD110Store((state) => state.dirtyParts);

  return (
    <div className="flex gap-1">
      {Array.from({ length: 8 }, (_, i) => {
        const hasTone = tones.has(i);
        const isDirty = dirtyParts.has(i);
        const isSelected = selectedPart === i;
        const toneName = tones.get(i)?.common.name || '';

        return (
          <button
            key={i}
            onClick={() => selectPart(i)}
            className={cn(
              'relative flex flex-col items-center justify-center min-w-[60px] px-3 py-2 rounded-md transition-colors',
              isSelected
                ? 'bg-d110-accent text-white'
                : hasTone
                  ? 'bg-d110-surface text-d110-text hover:bg-d110-panel'
                  : 'bg-d110-bg text-d110-muted hover:bg-d110-surface',
              'border',
              isSelected ? 'border-d110-highlight' : 'border-d110-border'
            )}
            title={toneName || `Part ${i + 1}`}
          >
            <span className="text-xs font-medium">Part {i + 1}</span>
            {hasTone && (
              <span className="text-[10px] truncate max-w-[50px] opacity-75">
                {toneName}
              </span>
            )}
            {isDirty && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-yellow-500" />
            )}
          </button>
        );
      })}
    </div>
  );
}
