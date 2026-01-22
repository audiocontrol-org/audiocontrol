/**
 * Patch list component
 */

import type { S330Patch } from '@/core/midi/S330Client';
import { cn } from '@/lib/utils';

interface PatchListProps {
  patches: S330Patch[];
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
}

export function PatchList({ patches, selectedIndex, onSelect }: PatchListProps) {
  return (
    <div className="card p-2">
      <div className="flex items-center justify-between px-2 py-1 mb-2">
        <span className="text-sm font-medium text-s330-text">
          Patches ({patches.length})
        </span>
      </div>
      <div className="max-h-[500px] overflow-y-auto space-y-1">
        {patches.map((patch, index) => (
          <button
            key={index}
            onClick={() => onSelect(index === selectedIndex ? null : index)}
            className={cn(
              'w-full px-3 py-2 rounded text-left text-sm transition-colors',
              'hover:bg-s330-accent/50',
              index === selectedIndex
                ? 'bg-s330-highlight text-white'
                : 'text-s330-text'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="flex-1 mx-3 truncate">
                {patch.common.name || '(unnamed)'}
              </span>
              <span className="text-xs opacity-60">
                {patch.partials.length}p
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
