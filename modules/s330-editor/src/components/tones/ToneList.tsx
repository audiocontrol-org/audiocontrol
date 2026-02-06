/**
 * Tone list component - displays tones with loading states
 */

import type { S330Tone } from '@/core/midi/S330Client';
import { cn } from '@/lib/utils';

interface ToneListProps {
  /** Sparse array of tones - undefined = not loaded */
  tones: (S330Tone | undefined)[];
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
}

/**
 * Check if a tone name indicates it's empty/unused
 */
function isToneEmpty(tone: S330Tone): boolean {
  const name = tone.name;
  return name === '' || name === '        ' || name.trim() === '';
}

/**
 * Format tone display number (T11-T48)
 * S-330 uses bank.tone notation: T11-T18 (bank 1), T21-T28 (bank 2), etc.
 */
function formatToneNumber(index: number): string {
  const bank = Math.floor(index / 8) + 1;
  const toneInBank = (index % 8) + 1;
  return `T${bank}${toneInBank}`;
}

export function ToneList({ tones, selectedIndex, onSelect }: ToneListProps) {
  // Count loaded and non-empty tones
  const loadedTones = tones.filter((t): t is S330Tone => t !== undefined);
  const nonEmptyCount = loadedTones.filter((t) => !isToneEmpty(t)).length;

  return (
    <div className="card p-2">
      <div className="flex items-center justify-between px-2 py-1 mb-2">
        <span className="text-sm font-medium text-s330-text">
          Tones ({nonEmptyCount} of {loadedTones.length} with names)
        </span>
      </div>
      <div className="max-h-[500px] overflow-y-auto space-y-1">
        {tones.map((tone, index) => {
          const isLoaded = tone !== undefined;
          const isEmpty = isLoaded && isToneEmpty(tone);
          const isSelected = index === selectedIndex;

          return (
            <button
              key={index}
              onClick={() => isLoaded && onSelect(isSelected ? null : index)}
              disabled={!isLoaded}
              className={cn(
                'w-full px-3 py-2 rounded text-left text-sm transition-colors',
                isLoaded ? 'hover:bg-s330-accent/50' : 'cursor-wait',
                isSelected
                  ? 'bg-s330-highlight text-white'
                  : !isLoaded
                    ? 'text-s330-muted/30 bg-s330-panel/50'
                    : isEmpty
                      ? 'text-s330-muted/50'
                      : 'text-s330-text'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-s330-muted">
                  {formatToneNumber(index)}
                </span>
                <span
                  className={cn(
                    'flex-1 mx-3 truncate',
                    (!isLoaded || isEmpty) && 'italic'
                  )}
                >
                  {!isLoaded
                    ? '(loading...)'
                    : isEmpty
                      ? '(unnamed)'
                      : tone.name}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
