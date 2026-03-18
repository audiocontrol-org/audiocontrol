/**
 * Change History Panel
 *
 * Collapsible list of slice editing history entries.
 * Click an entry to restore that state.
 */

import { useState } from 'react';
import { cn } from '@/ui/utils.js';
import type { HistoryEntry } from '@/ui/hooks/useSliceHistory.js';

export interface ChangeHistoryProps {
  entries: HistoryEntry[];
  currentIndex: number;
  onRestore: (index: number) => void;
}

export function ChangeHistory({
  entries,
  currentIndex,
  onRestore,
}: ChangeHistoryProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-ac-bg rounded">
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-ac-muted hover:text-ac-text transition-colors"
      >
        <span className="uppercase tracking-wide">
          History ({entries.length})
        </span>
        <svg
          className={cn('w-3.5 h-3.5 transition-transform', expanded && 'rotate-180')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-3 pb-2 space-y-0.5 max-h-32 overflow-y-auto">
          {entries.map((entry, i) => {
            const isCurrent = i === currentIndex;
            const isFuture = i > currentIndex;
            return (
              <button
                key={`${i}-${entry.timestamp}`}
                onClick={() => onRestore(i)}
                className={cn(
                  'w-full text-left flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors',
                  isCurrent
                    ? 'bg-ac-highlight/20 text-ac-text'
                    : isFuture
                      ? 'text-ac-muted/50 hover:text-ac-muted hover:bg-ac-accent/10'
                      : 'text-ac-muted hover:text-ac-text hover:bg-ac-accent/20'
                )}
              >
                <span className={cn(
                  'inline-block w-1.5 h-1.5 rounded-full shrink-0',
                  isCurrent ? 'bg-ac-highlight' : isFuture ? 'bg-ac-muted/30' : 'bg-ac-muted/50'
                )} />
                <span className="flex-1 truncate">{entry.label}</span>
                <span className="text-[10px] text-ac-muted/60 tabular-nums shrink-0">
                  {entry.slices.length}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
