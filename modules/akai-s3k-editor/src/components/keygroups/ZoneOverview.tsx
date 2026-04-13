import { useRef, useCallback } from 'react';
import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import type { NoteRange } from '@/components/keygroups/note-coordinate-utils';
import {
  noteToPercent,
  percentToNote,
  clampVelocity,
  getVisibleOctaveMarkers,
} from '@/components/keygroups/note-coordinate-utils';
import type { ZoneDragField } from '@/components/keygroups/use-zone-drag';
import { useZoneDrag } from '@/components/keygroups/use-zone-drag';
import { ZoneRect } from '@/components/keygroups/ZoneOverviewZone';

// Axis label area sizing
const LEFT_LABEL_WIDTH = 36; // px for velocity axis labels
const BOTTOM_LABEL_HEIGHT = 20; // px for note axis labels

interface ZoneOverviewProps {
  keygroups: (KeygroupHeader | undefined)[];
  keygroupCount: number;
  selectedKeygroupIndex: number | null;
  onSelectKeygroup: (index: number) => void;
  noteRange: NoteRange;
  onZoneDrag?: (keygroupIndex: number, field: ZoneDragField, value: number) => void;
  onZoneCommit?: (keygroupIndex: number, field: ZoneDragField, value: number) => void;
}

export function ZoneOverview({
  keygroups,
  keygroupCount,
  selectedKeygroupIndex,
  onSelectKeygroup,
  noteRange,
  onZoneDrag,
  onZoneCommit,
}: ZoneOverviewProps): JSX.Element {
  const vizRef = useRef<HTMLDivElement>(null);

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
