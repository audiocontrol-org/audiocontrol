/**
 * Patch list component
 */

import type { PatchNameInfo } from '@/core/midi/S330Client';
import { cn } from '@/lib/utils';

interface PatchListProps {
  patchNames: PatchNameInfo[];
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
}

export function PatchList({ patchNames, selectedIndex, onSelect }: PatchListProps) {
  const namedCount = patchNames.filter((p) => !p.isEmpty).length;

  return (
    <div className="card p-2">
      <div className="flex items-center justify-between px-2 py-1 mb-2">
        <span className="text-sm font-medium text-s330-text">
          Patches ({namedCount} of {patchNames.length} used)
        </span>
      </div>
      <div className="max-h-[500px] overflow-y-auto space-y-1">
        {patchNames.map((patch) => (
          <button
            key={patch.index}
            onClick={() => onSelect(patch.index === selectedIndex ? null : patch.index)}
            className={cn(
              'w-full px-3 py-2 rounded text-left text-sm transition-colors',
              'hover:bg-s330-accent/50',
              patch.index === selectedIndex
                ? 'bg-s330-highlight text-white'
                : patch.isEmpty
                  ? 'text-s330-muted/50'
                  : 'text-s330-text'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono">
                P{String(patch.index + 11).padStart(2, '0')}
              </span>
              <span className={cn(
                'flex-1 mx-3 truncate',
                patch.isEmpty && 'italic'
              )}>
                {patch.isEmpty ? '(empty)' : patch.name}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
