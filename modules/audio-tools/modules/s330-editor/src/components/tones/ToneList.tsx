/**
 * Tone list component
 */

import type { ToneNameInfo } from '@/core/midi/S330Client';
import { cn } from '@/lib/utils';

interface ToneListProps {
  toneNames: ToneNameInfo[];
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
}

export function ToneList({ toneNames, selectedIndex, onSelect }: ToneListProps) {
  return (
    <div className="card p-2">
      <div className="flex items-center justify-between px-2 py-1 mb-2">
        <span className="text-sm font-medium text-s330-text">
          Tones ({toneNames.length})
        </span>
      </div>
      <div className="max-h-[500px] overflow-y-auto space-y-1">
        {toneNames.map((tone) => (
          <button
            key={tone.index}
            onClick={() => onSelect(tone.index === selectedIndex ? null : tone.index)}
            className={cn(
              'w-full px-3 py-2 rounded text-left text-sm transition-colors',
              'hover:bg-s330-accent/50',
              tone.index === selectedIndex
                ? 'bg-s330-highlight text-white'
                : 'text-s330-text'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-s330-muted">
                T{tone.index + 11}
              </span>
              <span className="flex-1 mx-3 truncate">
                {tone.name || '(unnamed)'}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
