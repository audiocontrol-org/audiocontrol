/**
 * KeyRangeEditor — single-zone key-range editor with low/high handles.
 *
 * Promoted to <AcZoneStrip> (per-edge handles, default mode) on
 * 2026-05-24 during akai-harmonization Phase 2 task 2.2 (Commit 3 of
 * the AcZoneStrip extraction sequence). The pre-migration
 * implementation was 173 lines of inline tailwind bar + drag-state
 * tracking; the canonical primitive owns the chrome, so this wrapper
 * carries only the akai-specific bits:
 *
 *   1. Single-zone mapping (low/high note → AcZoneStripZone with
 *      handle='start' → LONOTE, handle='end' → HINOTE).
 *   2. Pointer-driven drag tracking — AcZoneStrip signals drag-start;
 *      this wrapper binds window pointer-move / pointer-up and
 *      translates client X → note via percentToNote / bar bounding
 *      rect. The drafts (dragLow / dragHigh) live in local state so
 *      the range-display text updates live during the drag without
 *      streaming partial commits to the device.
 *   3. The range-display text above the bar + the octave markers
 *      below + the numeric inputs at the bottom (axis labels and
 *      paired numeric editors — not part of the strip primitive).
 *
 * Single-zone with two per-edge handles maps onto AcZoneStrip's
 * default (per-edge) mode naturally: zoneIndex is always 0; handle
 * is 'start' (LONOTE) or 'end' (HINOTE).
 */

import { useCallback, useRef, useState } from 'react';
import { AcZoneStrip, type AcZoneStripZone } from '@audiocontrol/editor-core';
import { formatMidiNote } from '@/lib/midi-note-parser';
import type { NoteRange } from '@/components/keygroups/note-coordinate-utils';
import {
  noteToPercent,
  percentToNote,
  clampNote,
  getVisibleOctaveMarkers,
} from '@/components/keygroups/note-coordinate-utils';

interface KeyRangeEditorProps {
  lowNote: number;
  highNote: number;
  onChange: (field: 'LONOTE' | 'HINOTE', value: number) => void;
  noteRange: NoteRange;
}

type DragTarget = 'low' | 'high' | null;

/**
 * akai-blue hue. AcZoneStrip's segment-color rule anchors at +200deg
 * (blue base), so input 0 lands on the same blue identity as the
 * pre-migration tailwind `bg-blue-700` fill. Inputs add to the base
 * and rotate around the wheel — 240 = blue→purple, 200 = blue→amber.
 */
const KEY_RANGE_ZONE_HUE = 0;

export function KeyRangeEditor({
  lowNote,
  highNote,
  onChange,
  noteRange,
}: KeyRangeEditorProps): JSX.Element {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragTarget, setDragTarget] = useState<DragTarget>(null);
  const [dragLow, setDragLow] = useState(lowNote);
  const [dragHigh, setDragHigh] = useState(highNote);

  const displayLow = dragTarget !== null ? dragLow : lowNote;
  const displayHigh = dragTarget !== null ? dragHigh : highNote;

  const getNoteFromClientX = useCallback(
    (clientX: number): number => {
      const bar = barRef.current;
      if (!bar) return 0;
      const rect = bar.getBoundingClientRect();
      const fraction = (clientX - rect.left) / rect.width;
      return percentToNote(fraction * 100, noteRange);
    },
    [noteRange],
  );

  const startDrag = useCallback(
    (edge: 'low' | 'high', initialClientX: number) => {
      setDragTarget(edge);
      setDragLow(lowNote);
      setDragHigh(highNote);

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const note = getNoteFromClientX(moveEvent.clientX);
        if (edge === 'low') {
          setDragLow(note);
        } else {
          setDragHigh(note);
        }
      };

      const handlePointerUp = (upEvent: PointerEvent) => {
        const note = getNoteFromClientX(upEvent.clientX);
        if (edge === 'low') {
          onChange('LONOTE', Math.min(note, highNote));
        } else {
          onChange('HINOTE', Math.max(note, lowNote));
        }
        setDragTarget(null);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
      };

      // Apply the initial position synchronously so the drag visually
      // tracks the pointer's starting X even before the first move.
      const note = getNoteFromClientX(initialClientX);
      if (edge === 'low') {
        setDragLow(note);
      } else {
        setDragHigh(note);
      }

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    },
    [lowNote, highNote, onChange, getNoteFromClientX],
  );

  const handleStartDrag = useCallback(
    (
      _zoneIndex: number,
      handle: 'start' | 'end' | 'split',
      event: React.PointerEvent<HTMLElement>,
    ) => {
      // Single zone, per-edge mode → 'start' = LONOTE, 'end' = HINOTE.
      // 'split' is impossible (splitHandles is false), but the union
      // type forces the defensive guard.
      if (handle === 'split') return;
      event.preventDefault();
      event.stopPropagation();
      startDrag(handle === 'start' ? 'low' : 'high', event.clientX);
    },
    [startDrag],
  );

  const visibleMarkers = getVisibleOctaveMarkers(noteRange);

  const stripZones: AcZoneStripZone[] = [
    {
      startValue: displayLow,
      endValue: displayHigh,
      hue: KEY_RANGE_ZONE_HUE,
      ariaLabel: `Key range ${formatMidiNote(displayLow)} to ${formatMidiNote(displayHigh)}`,
      title: `${formatMidiNote(displayLow)} – ${formatMidiNote(displayHigh)}`,
      // KeyRangeEditor's per-edge handles ARE interactive sliders (the
      // operator drags them to set LONOTE/HINOTE live). The handle
      // a11y override promotes them from role="separator" (the
      // canonical default for split bars) to role="slider" with the
      // current note value carried via aria-valuenow. The "Low note"
      // / "High note" labels match the labels used by Playwright UI
      // specs that drive the keygroup editor (zone-overview.spec.ts).
      startHandle: {
        ariaLabel: 'Low note',
        ariaValueNow: displayLow,
        ariaValueMin: 0,
        ariaValueMax: 127,
      },
      endHandle: {
        ariaLabel: 'High note',
        ariaValueNow: displayHigh,
        ariaValueMin: 0,
        ariaValueMax: 127,
      },
    },
  ];

  return (
    <div className="px-3 py-2">
      {/* Range display text */}
      <div className="text-sm text-gray-300 mb-2 text-center">
        {formatMidiNote(displayLow)} -- {formatMidiNote(displayHigh)}
      </div>

      <AcZoneStrip
        barRef={barRef}
        zones={stripZones}
        range={{ min: noteRange.min, max: noteRange.max }}
        onStartDrag={handleStartDrag}
        ariaLabel="Key range"
      />

      {/* Octave labels */}
      <div className="relative h-4 mt-1">
        {visibleMarkers.map((o) => (
          <span
            key={o.note}
            className="absolute text-[10px] text-gray-500 -translate-x-1/2"
            style={{ left: `${noteToPercent(o.note, noteRange)}%` }}
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
