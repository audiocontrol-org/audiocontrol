import { useRef, useCallback, useState, useEffect } from 'react';
import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import type { NoteRange } from '@/components/keygroups/note-coordinate-utils';
import {
  noteToPercent,
  percentToNote,
  clampVelocity,
  velocityToPercentInverted,
  getVisibleOctaveMarkers,
} from '@/components/keygroups/note-coordinate-utils';
import type { ZoneDragField } from '@/components/keygroups/use-zone-drag';
import { useZoneDrag } from '@/components/keygroups/use-zone-drag';
import { ZoneRect } from '@/components/keygroups/ZoneOverviewZone';

// Axis label area sizing
const LEFT_LABEL_WIDTH = 36; // px for velocity axis labels
const BOTTOM_LABEL_HEIGHT = 20; // px for note axis labels

export interface NewZoneRange {
  lowNote: number;
  highNote: number;
  lowVel: number;
  highVel: number;
}

interface CreationDragState {
  startNote: number;
  startVel: number;
  currentNote: number;
  currentVel: number;
}

interface ZoneOverviewProps {
  keygroups: (KeygroupHeader | undefined)[];
  keygroupCount: number;
  selectedKeygroupIndex: number | null;
  onSelectKeygroup: (index: number) => void;
  noteRange: NoteRange;
  onZoneDrag?: (keygroupIndex: number, field: ZoneDragField, value: number) => void;
  onZoneCommit?: (keygroupIndex: number, field: ZoneDragField, value: number) => void;
  onCreateZone?: (range: NewZoneRange) => void;
}

function CreationPreview({
  drag,
  noteRange,
}: {
  drag: CreationDragState;
  noteRange: NoteRange;
}): JSX.Element {
  const lowNote = Math.min(drag.startNote, drag.currentNote);
  const highNote = Math.max(drag.startNote, drag.currentNote);
  const lowVel = Math.min(drag.startVel, drag.currentVel);
  const highVel = Math.max(drag.startVel, drag.currentVel);

  const xStart = noteToPercent(lowNote, noteRange);
  const xEnd = noteToPercent(highNote + 1, noteRange);
  const yTop = velocityToPercentInverted(highVel);
  const yBottom = ((128 - lowVel) / 128) * 100;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${xStart}%`,
        width: `${xEnd - xStart}%`,
        top: `${yTop}%`,
        height: `${yBottom - yTop}%`,
        border: '2px dashed rgba(147, 197, 253, 0.6)',
        background: 'rgba(59, 130, 246, 0.15)',
        zIndex: 15,
      }}
    />
  );
}

export function ZoneOverview({
  keygroups,
  keygroupCount,
  selectedKeygroupIndex,
  onSelectKeygroup,
  noteRange,
  onZoneDrag,
  onZoneCommit,
  onCreateZone,
}: ZoneOverviewProps): JSX.Element {
  const vizRef = useRef<HTMLDivElement>(null);
  const [creationDrag, setCreationDrag] = useState<CreationDragState | null>(null);

  const getNoteFromEvent = useCallback(
    (e: MouseEvent): number => {
      const el = vizRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const percent = ((e.clientX - rect.left) / rect.width) * 100;
      return percentToNote(percent, noteRange);
    },
    [noteRange],
  );

  const getVelocityFromEvent = useCallback(
    (e: MouseEvent): number => {
      const el = vizRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      return clampVelocity(Math.round(127 * (1 - (e.clientY - rect.top) / rect.height)));
    },
    [],
  );

  const dragCallbacks = useCallback(() => {
    return {
      onDrag: onZoneDrag ?? (() => {}),
      onCommit: onZoneCommit ?? (() => {}),
    };
  }, [onZoneDrag, onZoneCommit]);

  const { state: dragState, startDrag } = useZoneDrag(dragCallbacks());

  const hasDragCallbacks = onZoneDrag !== undefined && onZoneCommit !== undefined;

  // --- Drag-to-create zone in empty space ---
  const handleVizMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!onCreateZone) return;
      // Only respond to left button on the viz background (zone divs stopPropagation)
      if (e.button !== 0) return;
      const note = getNoteFromEvent(e.nativeEvent);
      const vel = getVelocityFromEvent(e.nativeEvent);
      setCreationDrag({ startNote: note, startVel: vel, currentNote: note, currentVel: vel });
    },
    [onCreateZone, getNoteFromEvent, getVelocityFromEvent],
  );

  useEffect(() => {
    if (!creationDrag) return;

    const handleMouseMove = (e: MouseEvent) => {
      const note = getNoteFromEvent(e);
      const vel = getVelocityFromEvent(e);
      setCreationDrag((prev) =>
        prev ? { ...prev, currentNote: note, currentVel: vel } : null,
      );
    };

    const handleMouseUp = (e: MouseEvent) => {
      setCreationDrag((current) => {
        if (current && onCreateZone) {
          const note = getNoteFromEvent(e);
          const vel = getVelocityFromEvent(e);
          const lowNote = Math.min(current.startNote, note);
          const highNote = Math.max(current.startNote, note);
          const lowVel = Math.min(current.startVel, vel);
          const highVel = Math.max(current.startVel, vel);
          // Only create if the user actually dragged a range
          if (highNote > lowNote || highVel > lowVel) {
            onCreateZone({ lowNote, highNote, lowVel, highVel });
          }
        }
        return null;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [creationDrag, getNoteFromEvent, getVelocityFromEvent, onCreateZone]);

  if (keygroupCount === 0) {
    return (
      <div className="mx-4 mb-3 p-4 rounded bg-gray-800/50 text-gray-500 text-sm text-center">
        No keygroups to display.
      </div>
    );
  }

  // Collect all loaded keygroups for rendering
  const loadedKeygroups: { index: number; header: KeygroupHeader }[] = [];
  for (let i = 0; i < keygroupCount; i++) {
    const kg = keygroups[i];
    if (kg) {
      loadedKeygroups.push({ index: i, header: kg });
    }
  }

  const visibleMarkers = getVisibleOctaveMarkers(noteRange);

  return (
    <div className="mx-4 mb-3">
      <div
        className="relative rounded bg-gray-900/70 border border-gray-700 overflow-hidden"
        style={{ height: '240px' }}
      >
        {/* Velocity axis labels */}
        <div
          className="absolute top-0 left-0 flex flex-col justify-between text-xs text-gray-500 font-mono"
          style={{
            width: `${LEFT_LABEL_WIDTH}px`,
            height: `calc(100% - ${BOTTOM_LABEL_HEIGHT}px)`,
            padding: '2px 4px',
          }}
        >
          <span>127</span>
          <span>64</span>
          <span>0</span>
        </div>

        {/* Main visualization area */}
        <div
          ref={vizRef}
          className="absolute top-0"
          onMouseDown={handleVizMouseDown}
          style={{
            left: `${LEFT_LABEL_WIDTH}px`,
            right: 0,
            height: `calc(100% - ${BOTTOM_LABEL_HEIGHT}px)`,
          }}
        >
          {/* Background grid lines for octave markers */}
          {visibleMarkers.map((marker) => {
            const xPercent = noteToPercent(marker.note, noteRange);
            return (
              <div
                key={`grid-${marker.note}`}
                className="absolute top-0 h-full border-l border-gray-700/40"
                style={{ left: `${xPercent}%` }}
              />
            );
          })}

          {/* Velocity midline */}
          <div
            className="absolute left-0 right-0 border-t border-gray-700/30"
            style={{ top: '50%' }}
          />

          {/* Keygroup zones */}
          {loadedKeygroups.map(({ index, header }) => {
            const isDraggingThis =
              dragState.isDragging && dragState.activeKeygroupIndex === index;

            return (
              <ZoneRect
                key={`kg-${index}`}
                keygroupIndex={index}
                header={header}
                keygroupCount={keygroupCount}
                noteRange={noteRange}
                isSelected={selectedKeygroupIndex === index}
                isDraggingThis={isDraggingThis}
                hasDragCallbacks={hasDragCallbacks}
                onSelectKeygroup={onSelectKeygroup}
                startDrag={startDrag}
                getNoteFromEvent={getNoteFromEvent}
                getVelocityFromEvent={getVelocityFromEvent}
              />
            );
          })}

          {/* Creation drag preview rectangle */}
          {creationDrag && <CreationPreview drag={creationDrag} noteRange={noteRange} />}
        </div>

        {/* Note axis labels (bottom) */}
        <div
          className="absolute bottom-0 left-0 right-0 flex items-center"
          style={{
            height: `${BOTTOM_LABEL_HEIGHT}px`,
            paddingLeft: `${LEFT_LABEL_WIDTH}px`,
          }}
        >
          <div className="relative w-full h-full">
            {visibleMarkers.map((marker) => {
              const xPercent = noteToPercent(marker.note, noteRange);
              return (
                <span
                  key={`label-${marker.note}`}
                  className="absolute text-xs text-gray-500 font-mono"
                  style={{
                    left: `${xPercent}%`,
                    transform: 'translateX(-50%)',
                    top: '2px',
                  }}
                >
                  {marker.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
