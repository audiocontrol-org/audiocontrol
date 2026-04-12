import { useCallback, useRef, useState } from 'react';
import { formatMidiNote } from '@/lib/midi-note-parser';

interface KeyRangeEditorProps {
  lowNote: number;
  highNote: number;
  onChange: (field: 'LONOTE' | 'HINOTE', value: number) => void;
}

const TOTAL_NOTES = 128;

/** Octave boundary labels shown below the bar */
const OCTAVE_LABELS = Array.from({ length: 11 }, (_, i) => ({
  note: (i + 1) * 12, // C0=12, C1=24, ... C9=120; C-1=0 is off-screen left
  label: `C${i - 1}`,
})).filter((o) => o.note <= 127);

// Add C-1 at position 0
const ALL_LABELS = [{ note: 0, label: 'C-1' }, ...OCTAVE_LABELS];

function clampNote(value: number): number {
  return Math.max(0, Math.min(127, Math.round(value)));
}

function noteToPercent(note: number): number {
  return (note / (TOTAL_NOTES - 1)) * 100;
}

type DragTarget = 'low' | 'high' | null;

export function KeyRangeEditor({ lowNote, highNote, onChange }: KeyRangeEditorProps): JSX.Element {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragTarget, setDragTarget] = useState<DragTarget>(null);
  const [dragLow, setDragLow] = useState(lowNote);
  const [dragHigh, setDragHigh] = useState(highNote);

  const displayLow = dragTarget !== null ? dragLow : lowNote;
  const displayHigh = dragTarget !== null ? dragHigh : highNote;

  const getNoteFromClientX = useCallback((clientX: number): number => {
    const bar = barRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    const fraction = (clientX - rect.left) / rect.width;
    return clampNote(fraction * (TOTAL_NOTES - 1));
  }, []);

  const handleMouseDown = useCallback(
    (edge: 'low' | 'high') => (e: React.MouseEvent) => {
      e.preventDefault();
      setDragTarget(edge);
      setDragLow(lowNote);
      setDragHigh(highNote);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const note = getNoteFromClientX(moveEvent.clientX);
        if (edge === 'low') {
          setDragLow(note);
        } else {
          setDragHigh(note);
        }
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        const note = getNoteFromClientX(upEvent.clientX);
        if (edge === 'low') {
          onChange('LONOTE', Math.min(note, highNote));
        } else {
          onChange('HINOTE', Math.max(note, lowNote));
        }
        setDragTarget(null);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [lowNote, highNote, onChange, getNoteFromClientX],
  );

  const leftPercent = noteToPercent(displayLow);
  const rightPercent = noteToPercent(displayHigh);
  const widthPercent = rightPercent - leftPercent;

  return (
    <div className="px-3 py-2">
      {/* Range display text */}
      <div className="text-sm text-gray-300 mb-2 text-center">
        {formatMidiNote(displayLow)} -- {formatMidiNote(displayHigh)}
      </div>

      {/* Visual bar */}
      <div
        ref={barRef}
        className="relative h-8 bg-gray-900 rounded border border-gray-600 select-none"
      >
        {/* Selected range fill */}
        <div
          className="absolute top-0 bottom-0 bg-blue-700 opacity-60 rounded-sm"
          style={{
            left: `${leftPercent}%`,
            width: `${Math.max(widthPercent, 0.5)}%`,
          }}
        />

        {/* Low edge handle */}
        <div
          className="absolute top-0 bottom-0 w-2 cursor-ew-resize z-10 hover:bg-blue-400 transition-colors rounded-l"
          style={{ left: `calc(${leftPercent}% - 4px)` }}
          onMouseDown={handleMouseDown('low')}
          role="slider"
          aria-label="Low note"
          aria-valuemin={0}
          aria-valuemax={127}
          aria-valuenow={displayLow}
          tabIndex={0}
        />

        {/* High edge handle */}
        <div
          className="absolute top-0 bottom-0 w-2 cursor-ew-resize z-10 hover:bg-blue-400 transition-colors rounded-r"
          style={{ left: `calc(${rightPercent}% - 4px)` }}
          onMouseDown={handleMouseDown('high')}
          role="slider"
          aria-label="High note"
          aria-valuemin={0}
          aria-valuemax={127}
          aria-valuenow={displayHigh}
          tabIndex={0}
        />
      </div>

      {/* Octave labels */}
      <div className="relative h-4 mt-1">
        {ALL_LABELS.map((o) => (
          <span
            key={o.note}
            className="absolute text-[10px] text-gray-500 -translate-x-1/2"
            style={{ left: `${noteToPercent(o.note)}%` }}
          >
            {o.label}
          </span>
        ))}
      </div>

      {/* Numeric inputs */}
      <div className="flex items-center justify-center gap-4 mt-2">
        <label className="flex items-center gap-1 text-sm text-gray-400">
          Low
          <input
            type="number"
            value={lowNote}
            min={0}
            max={127}
            onChange={(e) => onChange('LONOTE', clampNote(Number(e.target.value)))}
            className="w-16 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 text-right"
          />
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-400">
          High
          <input
            type="number"
            value={highNote}
            min={0}
            max={127}
            onChange={(e) => onChange('HINOTE', clampNote(Number(e.target.value)))}
            className="w-16 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 text-right"
          />
        </label>
      </div>
    </div>
  );
}
