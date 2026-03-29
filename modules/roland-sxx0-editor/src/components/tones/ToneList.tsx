/**
 * Tone list component - displays tones with loading states
 */

import type { SamplerTone } from '@/core/midi/SamplerClient';
import { cn } from '@/lib/utils';
import { formatToneSlot } from '@/lib/s330-format';

interface ToneListProps {
  /** Sparse array of tones - undefined = not loaded */
  tones: (SamplerTone | undefined)[];
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  /** Which banks have been loaded */
  loadedBanks: number[];
  /** Number of tones per bank */
  tonesPerBank: number;
  /** Bank index currently being loaded (null if none) */
  loadingBank?: number | null;
  /** Called when user clicks an unloaded tone to load its bank */
  onLoadBank?: (bankIndex: number) => void;
}

/**
 * Check if a tone name indicates it's empty/unused
 */
function isToneEmpty(tone: SamplerTone): boolean {
  const name = tone.name;
  return name === '' || name === '        ' || name.trim() === '';
}

export function ToneList({ tones, selectedIndex, onSelect, loadedBanks: _loadedBanks, tonesPerBank, loadingBank, onLoadBank }: ToneListProps) {
  // Count loaded and non-empty tones
  const loadedTones = tones.filter((t): t is SamplerTone => t !== undefined);
  const nonEmptyCount = loadedTones.filter((t) => !isToneEmpty(t)).length;

  return (
    <div className="card p-2">
      <div className="flex items-center justify-between px-2 py-1 mb-2">
        <span className="text-sm font-medium text-s330-text">
          Tones ({nonEmptyCount} of {loadedTones.length} with names)
        </span>
      </div>
      <div className="ac-scroll-list space-y-1">
        {tones.map((tone, index) => {
          const isLoaded = tone !== undefined;
          const isEmpty = isLoaded && isToneEmpty(tone);
          const isSelected = index === selectedIndex;
          const bankIndex = Math.floor(index / tonesPerBank);

          const isBankLoading = loadingBank === bankIndex;

          const handleClick = () => {
            if (isLoaded) {
              onSelect(isSelected ? null : index);
            } else if (!isBankLoading && onLoadBank) {
              onLoadBank(bankIndex);
            }
          };

          return (
            <button
              key={index}
              data-testid={`tone-item-${index}`}
              onClick={handleClick}
              disabled={isBankLoading}
              className={cn(
                'w-full px-3 py-2 rounded text-left text-sm transition-colors',
                isLoaded ? 'hover:bg-s330-accent/50' : 'hover:bg-s330-accent/20 cursor-pointer',
                isBankLoading && 'cursor-wait',
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
                  {formatToneSlot(index)}
                </span>
                <span
                  className={cn(
                    'flex-1 mx-3 truncate',
                    (!isLoaded || isEmpty) && 'italic'
                  )}
                >
                  {isBankLoading
                    ? '(loading...)'
                    : !isLoaded
                      ? '(not loaded)'
                      : isEmpty
                        ? '(unnamed)'
                        : tone.name}
                </span>
                {!isLoaded && !isBankLoading && (
                  <span className="text-xs text-s330-muted/50">click to load</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
