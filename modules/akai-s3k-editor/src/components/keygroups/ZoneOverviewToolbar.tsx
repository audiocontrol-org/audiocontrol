import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import type { NoteRange } from '@/components/keygroups/note-coordinate-utils';
import {
  FULL_RANGE,
  zoomIn,
  zoomOut,
  computeKeyRange,
} from '@/components/keygroups/note-coordinate-utils';

interface ZoneOverviewToolbarProps {
  noteRange: NoteRange;
  onNoteRangeChange: (range: NoteRange) => void;
  keygroups: (KeygroupHeader | undefined)[];
  keygroupCount: number;
}

export function ZoneOverviewToolbar({
  noteRange,
  onNoteRangeChange,
  keygroups,
  keygroupCount,
}: ZoneOverviewToolbarProps): JSX.Element {
  const isFullRange = noteRange.min === FULL_RANGE.min && noteRange.max === FULL_RANGE.max;
  const isMaxZoomIn = noteRange.max - noteRange.min <= 12;

  return (
    <div className="mx-4 mb-1 flex items-center gap-1">
      <button
        className="px-2 py-0.5 text-xs rounded bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        onClick={() => onNoteRangeChange(zoomIn(noteRange))}
        disabled={isMaxZoomIn}
        title="Zoom In"
      >
        + Zoom In
      </button>
      <button
        className="px-2 py-0.5 text-xs rounded bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        onClick={() => onNoteRangeChange(zoomOut(noteRange))}
        disabled={isFullRange}
        title="Zoom Out"
      >
        - Zoom Out
      </button>
      <button
        className="px-2 py-0.5 text-xs rounded bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
        onClick={() => onNoteRangeChange(computeKeyRange(keygroups, keygroupCount))}
        title="Zoom to fit all keygroups"
      >
        Fit
      </button>
      <button
        className="px-2 py-0.5 text-xs rounded bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        onClick={() => onNoteRangeChange(FULL_RANGE)}
        disabled={isFullRange}
        title="Reset to full MIDI range (0-127)"
      >
        Reset
      </button>
      <span className="ml-2 text-xs text-gray-600 font-mono">
        {noteRange.min}-{noteRange.max}
      </span>
    </div>
  );
}
