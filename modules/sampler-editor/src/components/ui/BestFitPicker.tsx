/**
 * BestFitPicker
 *
 * Renders a list of selectable placement options. Clicking an option
 * calls onSelect with its index — the parent dialog applies the values
 * and the memory map updates reactively.
 */

import type { FitOption } from '@/lib/best-fit';
import { cn } from '@/lib/utils';

interface BestFitPickerProps {
  options: FitOption<unknown>[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onClose: () => void;
  disabled?: boolean;
}

function collisionBadge(tone: number, wave: number): JSX.Element {
  const total = tone + wave;
  const color = total === 0
    ? 'text-green-400'
    : total <= 2
      ? 'text-yellow-400'
      : 'text-red-400';

  return (
    <span className={cn('text-[10px] font-medium', color)}>
      {total === 0 ? 'no conflicts' : `${total} conflict${total !== 1 ? 's' : ''}`}
    </span>
  );
}

export function BestFitPicker({
  options,
  selectedIndex,
  onSelect,
  onClose,
  disabled,
}: BestFitPickerProps): JSX.Element {
  return (
    <div className="bg-s330-bg border border-s330-accent/40 rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-s330-muted uppercase tracking-wide">
          Best Fit Options
        </span>
        <button
          onClick={onClose}
          className="text-s330-muted hover:text-s330-text text-xs"
          aria-label="Close best fit picker"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-1">
        {options.map((option, i) => {
          const isSelected = selectedIndex === i;
          return (
            <button
              key={i}
              onClick={() => onSelect(i)}
              disabled={disabled}
              className={cn(
                'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left transition-colors',
                isSelected
                  ? 'bg-s330-highlight/20 ring-1 ring-s330-highlight'
                  : 'hover:bg-s330-accent/20',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div
                className={cn(
                  'w-2.5 h-2.5 rounded-full border-2 flex-shrink-0',
                  isSelected
                    ? 'border-s330-highlight bg-s330-highlight'
                    : 'border-s330-accent/60'
                )}
              />
              <span className="text-xs text-s330-text flex-1 min-w-0 truncate">
                {option.label}
              </span>
              {collisionBadge(option.toneCollisions, option.waveCollisions)}
            </button>
          );
        })}
      </div>

      {options.length === 0 && (
        <p className="text-xs text-s330-muted text-center py-2">
          No placement options available.
        </p>
      )}
    </div>
  );
}
