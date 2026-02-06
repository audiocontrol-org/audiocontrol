/**
 * Patch list component - displays patches with loading states
 */

import type { S330Patch } from '@/core/midi/S330Client';
import { cn } from '@/lib/utils';

interface PatchListProps {
  /** Sparse array of patches - undefined = not loaded */
  patches: (S330Patch | undefined)[];
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
}

/**
 * Check if a patch name indicates it's empty/unused
 */
function isPatchEmpty(patch: S330Patch): boolean {
  const name = patch.common.name;
  return name === '' || name === '            ' || name.trim() === '';
}

/**
 * Format patch display number (P11-P28)
 * S-330 uses bank.patch notation: P11-P18 (bank 1), P21-P28 (bank 2)
 */
function formatPatchNumber(index: number): string {
  const bank = Math.floor(index / 8) + 1;
  const patchInBank = (index % 8) + 1;
  return `P${bank}${patchInBank}`;
}

export function PatchList({ patches, selectedIndex, onSelect }: PatchListProps) {
  // Count loaded and non-empty patches
  const loadedPatches = patches.filter((p): p is S330Patch => p !== undefined);
  const nonEmptyCount = loadedPatches.filter(p => !isPatchEmpty(p)).length;

  return (
    <div className="card p-2">
      <div className="flex items-center justify-between px-2 py-1 mb-2">
        <span className="text-sm font-medium text-s330-text">
          Patches ({nonEmptyCount} of {loadedPatches.length} used)
        </span>
      </div>
      <div className="max-h-[500px] overflow-y-auto space-y-1">
        {patches.map((patch, index) => {
          const isLoaded = patch !== undefined;
          const isEmpty = isLoaded && isPatchEmpty(patch);
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
                <span className="font-mono">
                  {formatPatchNumber(index)}
                </span>
                <span className={cn(
                  'flex-1 mx-3 truncate',
                  (!isLoaded || isEmpty) && 'italic'
                )}>
                  {!isLoaded
                    ? '(loading...)'
                    : isEmpty
                      ? '(empty)'
                      : patch.common.name}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
