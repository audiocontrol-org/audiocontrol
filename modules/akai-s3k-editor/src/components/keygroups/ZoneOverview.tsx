import { useRef, useCallback, useEffect } from 'react';
import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import type { NoteRange } from '@/components/keygroups/note-coordinate-utils';
import {
  noteToPercent,
  velocityToPercentInverted,
  getVisibleOctaveMarkers,
  percentToNote,
  zoomAtNote,
  panRange,
} from '@/components/keygroups/note-coordinate-utils';
import type { ZoneDragField } from '@/components/keygroups/use-zone-drag';
import { useZoneDrag } from '@/components/keygroups/use-zone-drag';
import { ZoneRect, keygroupHue } from '@/components/keygroups/ZoneOverviewZone';
import type { NewZoneRange } from '@/components/keygroups/use-zone-overview-drags';
import { useZoneOverviewDrags } from '@/components/keygroups/use-zone-overview-drags';

export type { NewZoneRange };

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
  onCreateZone?: (range: NewZoneRange) => void;
  onNoteRangeChange?: (range: NoteRange) => void;
  /**
   * When false, renders a thin summary stripe (one cell per keygroup
   * colored by its hue, click to select) instead of the full chart.
   * Preserves at-a-glance "how many keygroups + which is selected"
   * awareness while reclaiming the chart's ~240px of vertical space.
   * Default true (expanded) to keep existing call sites' behavior.
   */
  expanded?: boolean;
}

/**
 * Compact summary stripe shown when the chart is collapsed. Each
 * keygroup is a button sized by its note span; selected keygroup
 * carries a 2px accent ring. Hue matches the chart's per-keygroup
 * color so the user's mental model of "which color is which keygroup"
 * survives the collapse.
 */
function ZoneOverviewSummaryStripe({
  keygroups,
  keygroupCount,
  selectedKeygroupIndex,
  onSelectKeygroup,
}: Pick<
  ZoneOverviewProps,
  'keygroups' | 'keygroupCount' | 'selectedKeygroupIndex' | 'onSelectKeygroup'
>): JSX.Element {
  const loaded: { index: number; header: KeygroupHeader }[] = [];
  for (let i = 0; i < keygroupCount; i++) {
    const kg = keygroups[i];
    if (kg) loaded.push({ index: i, header: kg });
  }

  if (loaded.length === 0) {
    return (
      <div className="ac-zone-summary-stripe ac-zone-summary-stripe--empty">
        No keygroups
      </div>
    );
  }

  return (
    <div
      className="ac-zone-summary-stripe"
      role="group"
      aria-label="Keygroup summary"
    >
      {loaded.map(({ index, header }) => {
        const span = Math.max(1, header.HINOTE - header.LONOTE + 1);
        const hue = keygroupHue(index, keygroupCount);
        const isSelected = selectedKeygroupIndex === index;
        const sampleName = header.SNAME1.trim() || '(none)';
        return (
          <button
            key={index}
            type="button"
            className="ac-zone-summary-cell"
            data-selected={isSelected || undefined}
            style={{
              flexGrow: span,
              ['--ac-zone-hue' as string]: String(hue),
            }}
            onClick={() => onSelectKeygroup(index)}
            aria-label={`Select keygroup ${index + 1}: ${sampleName}, notes ${header.LONOTE}-${header.HINOTE}`}
            title={`KG${index + 1}: notes ${header.LONOTE}-${header.HINOTE} · ${sampleName}`}
          >
            <span className="ac-zone-summary-cell__label">KG{index + 1}</span>
          </button>
        );
      })}
    </div>
  );
}

function CreationPreview({
  drag,
  noteRange,
}: {
  drag: { startNote: number; startVel: number; currentNote: number; currentVel: number };
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

export function ZoneOverview(props: ZoneOverviewProps): JSX.Element {
  // Branch BEFORE the expanded chart's own hook tree to keep React's
  // Rules of Hooks satisfied: the expanded path uses useRef + useCallback
  // + useEffect + custom hooks; the collapsed stripe needs none of them.
  // Each branch is a self-contained component that consistently calls
  // its own hooks.
  if (props.expanded === false) {
    return (
      <ZoneOverviewSummaryStripe
        keygroups={props.keygroups}
        keygroupCount={props.keygroupCount}
        selectedKeygroupIndex={props.selectedKeygroupIndex}
        onSelectKeygroup={props.onSelectKeygroup}
      />
    );
  }
  return <ZoneOverviewExpanded {...props} />;
}

function ZoneOverviewExpanded({
  keygroups,
  keygroupCount,
  selectedKeygroupIndex,
  onSelectKeygroup,
  noteRange,
  onZoneDrag,
  onZoneCommit,
  onCreateZone,
  onNoteRangeChange,
}: ZoneOverviewProps): JSX.Element {
  const vizRef = useRef<HTMLDivElement>(null);

  // Wheel/trackpad gestures:
  // - Pinch (ctrlKey + deltaY): zoom in/out centered on mouse position
  // - Two-finger horizontal scroll (deltaX): pan left/right
  // - Two-finger vertical scroll (deltaY without ctrlKey): pass through to page
  useEffect(() => {
    const el = vizRef.current;
    if (!el || !onNoteRangeChange) return;

    const handleWheel = (e: WheelEvent): void => {
      if (e.ctrlKey) {
        // Pinch-to-zoom (trackpad pinch fires wheel with ctrlKey)
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
        const centerNote = percentToNote(xPercent, noteRange);
        const zoomFactor = e.deltaY > 0 ? 1.15 : 0.85;
        const newRange = zoomAtNote(noteRange, centerNote, zoomFactor);
        if (newRange.max - newRange.min >= 12) {
          onNoteRangeChange(newRange);
        }
      } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        // Horizontal scroll → pan
        e.preventDefault();
        const span = noteRange.max - noteRange.min;
        const notesPerPixel = span / el.getBoundingClientRect().width;
        const deltaNotes = e.deltaX * notesPerPixel;
        onNoteRangeChange(panRange(noteRange, deltaNotes));
      }
      // Vertical scroll without ctrlKey: don't prevent default, let page scroll
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [noteRange, onNoteRangeChange]);

  // Arrow key panning (left/right to pan, prevent DOM navigation)
  useEffect(() => {
    const el = vizRef.current;
    if (!el || !onNoteRangeChange) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const span = noteRange.max - noteRange.min;
        const step = Math.max(1, Math.round(span * 0.1));
        const delta = e.key === 'ArrowLeft' ? -step : step;
        onNoteRangeChange(panRange(noteRange, delta));
      }
    };

    el.addEventListener('keydown', handleKeyDown);
    return () => el.removeEventListener('keydown', handleKeyDown);
  }, [noteRange, onNoteRangeChange]);

  const hasDragCallbacks = onZoneDrag !== undefined && onZoneCommit !== undefined;

  const dragCallbacks = useCallback(() => {
    return {
      onDrag: onZoneDrag ?? (() => {}),
      onCommit: onZoneCommit ?? (() => {}),
    };
  }, [onZoneDrag, onZoneCommit]);

  const { state: dragState, startDrag } = useZoneDrag(dragCallbacks());

  const {
    creationDrag,
    translateDrag,
    getNoteFromEvent,
    getVelocityFromEvent,
    handleVizMouseDown,
    handleStartTranslate,
  } = useZoneOverviewDrags({
    vizRef,
    noteRange,
    keygroups,
    hasDragCallbacks,
    onZoneDrag,
    onZoneCommit,
    onCreateZone,
  });

  if (keygroupCount === 0) {
    return (
      <div className="ac-zone-overview-chart-frame ac-zone-overview-chart-frame--empty">
        No keygroups to display.
      </div>
    );
  }

  const loadedKeygroups: { index: number; header: KeygroupHeader }[] = [];
  for (let i = 0; i < keygroupCount; i++) {
    const kg = keygroups[i];
    if (kg) {
      loadedKeygroups.push({ index: i, header: kg });
    }
  }

  const visibleMarkers = getVisibleOctaveMarkers(noteRange);

  return (
    // Full-bleed: chart fills .ac-detail-scroll's content width edge-to-edge,
    // bottom margin only. Operator visual review 2026-05-27: the prior
    // `mx-4` horizontal margin made the chart look indented from the
    // container without a visible enclosing border to justify the gap —
    // weird in-between state. Edge-to-edge bleed reads as "chart band",
    // matching how a video player or LCD strip would sit in its surface.
    <div className="ac-zone-overview-chart-frame">
      <div
        className="ac-zone-overview-chart"
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
          tabIndex={0}
          onMouseDown={handleVizMouseDown}
          style={{
            left: `${LEFT_LABEL_WIDTH}px`,
            right: 0,
            height: `calc(100% - ${BOTTOM_LABEL_HEIGHT}px)`,
          }}
        >
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

          <div
            className="absolute left-0 right-0 border-t border-gray-700/30"
            style={{ top: '50%' }}
          />

          {loadedKeygroups.map(({ index, header }) => {
            const isDraggingThis =
              dragState.isDragging && dragState.activeKeygroupIndex === index;
            const isTranslatingThis =
              translateDrag !== null && translateDrag.keygroupIndex === index;

            return (
              <ZoneRect
                key={`kg-${index}`}
                keygroupIndex={index}
                header={header}
                keygroupCount={keygroupCount}
                noteRange={noteRange}
                isSelected={selectedKeygroupIndex === index}
                isDraggingThis={isDraggingThis}
                isTranslating={isTranslatingThis}
                hasDragCallbacks={hasDragCallbacks}
                onSelectKeygroup={onSelectKeygroup}
                startDrag={startDrag}
                onStartTranslate={hasDragCallbacks ? handleStartTranslate : undefined}
                getNoteFromEvent={getNoteFromEvent}
                getVelocityFromEvent={getVelocityFromEvent}
              />
            );
          })}

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
