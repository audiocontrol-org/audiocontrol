import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3000xl-browser';

interface KeygroupListProps {
  keygroups: (KeygroupHeader | undefined)[];
  keygroupCount: number;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  isLoading: boolean;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Convert a MIDI note number (0-127) to a human-readable note name (e.g. 60 -> "C4") */
function midiNoteToName(note: number): string {
  const octave = Math.floor(note / 12) - 1;
  const name = NOTE_NAMES[note % 12];
  return `${name}${octave}`;
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
                  {midiNoteToName(kg.LONOTE)}–{midiNoteToName(kg.HINOTE)}
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
