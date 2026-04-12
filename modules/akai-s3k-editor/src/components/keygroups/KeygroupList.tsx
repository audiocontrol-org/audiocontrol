import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import { formatMidiNote } from '@/lib/midi-note-parser';

interface KeygroupListProps {
  keygroups: (KeygroupHeader | undefined)[];
  keygroupCount: number;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  isLoading: boolean;
}

export function KeygroupList({
  keygroups,
  keygroupCount,
  selectedIndex,
  onSelect,
  isLoading,
}: KeygroupListProps): JSX.Element {
  if (keygroupCount === 0) {
    return (
      <div className="p-4 text-gray-400 text-sm">
        No keygroups available. Select a program first.
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-800">
      {Array.from({ length: keygroupCount }, (_, i) => {
        const kg = keygroups[i];
        const isSelected = selectedIndex === i;

        return (
          <button
            key={i}
            onClick={() => onSelect(i)}
            disabled={isLoading}
            className={`w-full text-left px-3 py-2 text-sm transition-colors ${
              isSelected
                ? 'bg-blue-900/40 text-blue-200'
                : 'text-gray-300 hover:bg-gray-800'
            } ${isLoading ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono">KG {i + 1}</span>
              {kg ? (
                <span className="text-xs text-gray-400">
                  {formatMidiNote(kg.LONOTE)}–{formatMidiNote(kg.HINOTE)}
                </span>
              ) : (
                <span className="text-xs text-gray-600">...</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
