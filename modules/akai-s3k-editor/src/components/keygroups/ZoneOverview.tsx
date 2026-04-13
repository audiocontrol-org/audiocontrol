import {
  useCallback,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import { formatMidiNote } from '@/lib/midi-note-parser';
import {
  clampMidiNote,
  clientXToNote,
  computeVisibleKeyRange,
  type NoteCoordinateRange,
  noteToPercent,
} from '@/components/keygroups/note-coordinate';
import {
  clampHighNote,
  clampHighVelocity,
  clampLowNote,
  clampLowVelocity,
} from '@/components/keygroups/zone-constraints';
import type { KeygroupCreationDraft } from '@/components/keygroups/keygroup-creation';

interface ZoneOverviewProps {
  keygroups: (KeygroupHeader | undefined)[];
  keygroupCount: number;
  selectedKeygroupIndex: number | null;
  onSelectKeygroup: (index: number) => void;
  onParameterChange?: (field: string, value: number) => void;
  onCreateKeygroup?: (draft: KeygroupCreationDraft) => void;
  visibleRange?: NoteCoordinateRange;
}

/**
 * Pastel hue palette for keygroups. Each keygroup gets a distinct hue
 * distributed evenly around the color wheel.
 */
function keygroupColor(index: number, total: number, alpha: number): string {
  const hue = (index * 360) / Math.max(total, 1);
  return `hsla(${hue}, 55%, 55%, ${alpha})`;
}

function keygroupBorderColor(index: number, total: number): string {
  const hue = (index * 360) / Math.max(total, 1);
  return `hsl(${hue}, 65%, 70%)`;
}

interface VelocityZone {
  lovel: number;
  hivel: number;
  sampleName: string;
  zoneIndex: number;
}

type ZoneEdgeField = 'LONOTE' | 'HINOTE' | `LOVEL${1 | 2 | 3 | 4}` | `HIVEL${1 | 2 | 3 | 4}`;

interface DragState {
  keygroupIndex: number;
  field: ZoneEdgeField;
  value: number;
}

interface CreationState {
  startNote: number;
  endNote: number;
  startVelocity: number;
  endVelocity: number;
}

type VelocityLowField = `LOVEL${1 | 2 | 3 | 4}`;
type VelocityHighField = `HIVEL${1 | 2 | 3 | 4}`;

function getVelocityZones(kg: KeygroupHeader): VelocityZone[] {
  const zones: VelocityZone[] = [];

  const candidates = [
    { lo: kg.LOVEL1, hi: kg.HIVEL1, name: kg.SNAME1, idx: 1 },
    { lo: kg.LOVEL2, hi: kg.HIVEL2, name: kg.SNAME2, idx: 2 },
    { lo: kg.LOVEL3, hi: kg.HIVEL3, name: kg.SNAME3, idx: 3 },
    { lo: kg.LOVEL4, hi: kg.HIVEL4, name: kg.SNAME4, idx: 4 },
  ];

  for (const c of candidates) {
    // A zone is active if it has a non-empty sample name or a non-zero velocity range
    if (c.name.trim() !== '' || c.hi > 0) {
      zones.push({
        lovel: c.lo,
        hivel: c.hi,
        sampleName: c.name.trim(),
        zoneIndex: c.idx,
      });
    }
  }

  return zones;
}

function handleZoneKeyDown(
  event: ReactKeyboardEvent<HTMLElement>,
  index: number,
  onSelectKeygroup: (index: number) => void,
): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onSelectKeygroup(index);
  }
}

/** C octave markers across the MIDI range for the X-axis labels */
const OCTAVE_MARKERS: { note: number; label: string }[] = [];
for (let octave = -1; octave <= 9; octave++) {
  const note = (octave + 1) * 12;
  if (note >= 0 && note <= 127) {
    OCTAVE_MARKERS.push({ note, label: `C${octave}` });
  }
}

export function ZoneOverview({
  keygroups,
  keygroupCount,
  selectedKeygroupIndex,
  onSelectKeygroup,
  onParameterChange,
  onCreateKeygroup,
  visibleRange,
}: ZoneOverviewProps): JSX.Element {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [creationState, setCreationState] = useState<CreationState | null>(null);

  if (keygroupCount === 0) {
    return (
      <div className="mx-4 mb-3 p-4 rounded bg-gray-800/50 text-gray-500 text-sm text-center">
        No keygroups to display.
      </div>
    );
  }

  const range = visibleRange ?? computeVisibleKeyRange(keygroups, keygroupCount);

  // Collect all loaded keygroups for rendering
  const loadedKeygroups: { index: number; header: KeygroupHeader }[] = [];
  for (let i = 0; i < keygroupCount; i++) {
    const kg = keygroups[i];
    if (kg) {
      loadedKeygroups.push({ index: i, header: kg });
    }
  }

  // Axis label area sizing
  const LEFT_LABEL_WIDTH = 36; // px for velocity axis labels
  const BOTTOM_LABEL_HEIGHT = 20; // px for note axis labels

  // Filter octave markers to those within the visible range
  const visibleMarkers = OCTAVE_MARKERS.filter(
    (m) => m.note >= range.min && m.note <= range.max,
  );

  const getSurfaceRect = useCallback(() => surfaceRef.current?.getBoundingClientRect() ?? null, []);

  const getNoteFromClientX = useCallback((clientX: number): number => {
    const rect = getSurfaceRect();
    return clientXToNote(clientX, rect?.left ?? 0, rect?.width ?? 0, range);
  }, [getSurfaceRect, range]);

  const getVelocityFromClientY = useCallback((clientY: number): number => {
    const surface = surfaceRef.current;
    if (!surface) return 127;
    const rect = surface.getBoundingClientRect();
    if (rect.height <= 0) return 127;
    const fraction = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return clampMidiNote(127 - fraction * 128);
  }, []);

  const commitDrag = useCallback((field: ZoneEdgeField, value: number) => {
    onParameterChange?.(field, value);
  }, [onParameterChange]);

  const isPointInZone = useCallback((note: number, velocity: number): boolean => {
    return loadedKeygroups.some(({ header }) => {
      if (note < header.LONOTE || note > header.HINOTE) {
        return false;
      }

      const zones = getVelocityZones(header);
      if (zones.length === 0) {
        return true;
      }

      return zones.some((zone) => velocity >= zone.lovel && velocity <= zone.hivel);
    });
  }, [loadedKeygroups]);

  const startDrag = useCallback((
    keygroupIndex: number,
    field: ZoneEdgeField,
    computeValue: (moveEvent: MouseEvent) => number,
  ) => (event: ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onSelectKeygroup(keygroupIndex);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      setDragState({
        keygroupIndex,
        field,
        value: computeValue(moveEvent),
      });
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      const committedValue = computeValue(upEvent);
      setDragState(null);
      commitDrag(field, committedValue);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    handleMouseMove(event.nativeEvent);
  }, [commitDrag, onSelectKeygroup]);

  const startCreateDrag = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!onCreateKeygroup) return;
    const startNote = getNoteFromClientX(event.clientX);
    const startVelocity = getVelocityFromClientY(event.clientY);

    if (isPointInZone(startNote, startVelocity)) {
      return;
    }

    event.preventDefault();
    const handleMouseMove = (moveEvent: MouseEvent) => {
      setCreationState({
        startNote,
        startVelocity,
        endNote: getNoteFromClientX(moveEvent.clientX),
        endVelocity: getVelocityFromClientY(moveEvent.clientY),
      });
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      const endNote = getNoteFromClientX(upEvent.clientX);
      const endVelocity = getVelocityFromClientY(upEvent.clientY);
      const draft = {
        lowNote: Math.min(startNote, endNote),
        highNote: Math.max(startNote, endNote),
        lowVelocity: Math.min(startVelocity, endVelocity),
        highVelocity: Math.max(startVelocity, endVelocity),
      };
      setCreationState(null);
      onCreateKeygroup(draft);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    handleMouseMove(event.nativeEvent);
  }, [getNoteFromClientX, getVelocityFromClientY, isPointInZone, onCreateKeygroup]);

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
          ref={surfaceRef}
          data-testid="zone-overview-surface"
          className="absolute top-0"
          onMouseDown={startCreateDrag}
          style={{
            left: `${LEFT_LABEL_WIDTH}px`,
            right: 0,
            height: `calc(100% - ${BOTTOM_LABEL_HEIGHT}px)`,
          }}
        >
          <div
            className="absolute inset-0"
            data-testid="zone-overview-create-layer"
          />
          {/* Background grid lines for octave markers */}
          {visibleMarkers.map((marker) => {
            const xPercent = noteToPercent(marker.note, range);
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
            const isSelected = selectedKeygroupIndex === index;
            const displayHeader =
              dragState?.keygroupIndex === index
                ? { ...header, [dragState.field]: dragState.value }
                : header;
            const zones = getVelocityZones(displayHeader);

            // Key range as percentage of visible range
            const xStart =
              noteToPercent(Math.max(displayHeader.LONOTE, range.min), range);
            const xEnd =
              noteToPercent(Math.min(displayHeader.HINOTE, range.max) + 1, range);
            const width = xEnd - xStart;

            if (width <= 0) return null;

            if (zones.length === 0) {
              // Render the keygroup as a single band spanning full velocity
              return (
                <div
                  key={`kg-${index}`}
                  className="absolute cursor-pointer border transition-all"
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectKeygroup(index)}
                  onKeyDown={(event) => handleZoneKeyDown(event, index, onSelectKeygroup)}
                  title={`KG ${index + 1}: ${formatMidiNote(displayHeader.LONOTE)}-${formatMidiNote(displayHeader.HINOTE)}`}
                  style={{
                    left: `${xStart}%`,
                    width: `${width}%`,
                    top: 0,
                    bottom: 0,
                    background: keygroupColor(index, keygroupCount, 0.35),
                    borderColor: isSelected
                      ? '#93c5fd'
                      : keygroupBorderColor(index, keygroupCount),
                    borderWidth: isSelected ? '2px' : '1px',
                    boxShadow: isSelected ? '0 0 8px rgba(147, 197, 253, 0.4)' : 'none',
                    zIndex: isSelected ? 10 : 1,
                  }}
                >
                  <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-300 truncate px-1">
                    KG {index + 1}
                  </span>
                </div>
              );
            }

            return zones.map((zone) => {
              // Velocity range as percentage (0 at bottom, 127 at top)
              // CSS top: 0% = top of container = velocity 127
              const yTop = ((127 - zone.hivel) / 128) * 100;
              const yBottom = ((127 - zone.lovel + 1) / 128) * 100;
              const height = yBottom - yTop;

              if (height <= 0) return null;

              const label =
                zone.sampleName !== ''
                  ? zone.sampleName
                  : `KG ${index + 1} Z${zone.zoneIndex}`;

              return (
                <div
                  key={`kg-${index}-z${zone.zoneIndex}`}
                  className="absolute cursor-pointer border transition-all overflow-hidden"
                  data-testid={`zone-overview-zone-${index}-${zone.zoneIndex}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectKeygroup(index)}
                  onKeyDown={(event) => handleZoneKeyDown(event, index, onSelectKeygroup)}
                  title={`KG ${index + 1} Zone ${zone.zoneIndex}: ${formatMidiNote(displayHeader.LONOTE)}-${formatMidiNote(displayHeader.HINOTE)}, vel ${zone.lovel}-${zone.hivel}${zone.sampleName ? ` [${zone.sampleName}]` : ''}`}
                  style={{
                    left: `${xStart}%`,
                    width: `${width}%`,
                    top: `${yTop}%`,
                    height: `${height}%`,
                    background: keygroupColor(index, keygroupCount, 0.4),
                    borderColor: isSelected
                      ? '#93c5fd'
                      : keygroupBorderColor(index, keygroupCount),
                    borderWidth: isSelected ? '2px' : '1px',
                    boxShadow: isSelected
                      ? '0 0 8px rgba(147, 197, 253, 0.4)'
                      : 'none',
                    zIndex: isSelected ? 10 : 1,
                  }}
                >
                  <span className="block text-xs text-gray-200 truncate px-1 leading-tight mt-0.5">
                    {label}
                  </span>
                  {isSelected && onParameterChange && (
                    <>
                      <button
                        type="button"
                        className="absolute left-0 right-0 h-3 -top-1.5 cursor-ns-resize z-20"
                        data-testid={`zone-handle-velocity-high-${index}-${zone.zoneIndex}`}
                        onMouseDown={startDrag(
                          index,
                          `HIVEL${zone.zoneIndex}` as ZoneEdgeField,
                          (moveEvent) => clampHighVelocity(
                            getVelocityFromClientY(moveEvent.clientY),
                            displayHeader[`LOVEL${zone.zoneIndex}` as VelocityLowField],
                          ),
                        )}
                      />
                      <button
                        type="button"
                        className="absolute left-0 right-0 h-3 -bottom-1.5 cursor-ns-resize z-20"
                        data-testid={`zone-handle-velocity-low-${index}-${zone.zoneIndex}`}
                        onMouseDown={startDrag(
                          index,
                          `LOVEL${zone.zoneIndex}` as ZoneEdgeField,
                          (moveEvent) => clampLowVelocity(
                            getVelocityFromClientY(moveEvent.clientY),
                            displayHeader[`HIVEL${zone.zoneIndex}` as VelocityHighField],
                          ),
                        )}
                      />
                    </>
                  )}
                </div>
              );
            });
          })}

          {creationState && (
            <div
              data-testid="zone-overview-create-preview"
              className="absolute border border-dashed border-blue-300 bg-blue-400/20 pointer-events-none z-40"
              style={{
                left: `${noteToPercent(Math.min(creationState.startNote, creationState.endNote), range)}%`,
                width: `${Math.max(
                  noteToPercent(Math.max(creationState.startNote, creationState.endNote) + 1, range) -
                    noteToPercent(Math.min(creationState.startNote, creationState.endNote), range),
                  0.8,
                )}%`,
                top: `${((127 - Math.max(creationState.startVelocity, creationState.endVelocity)) / 128) * 100}%`,
                height: `${Math.max(
                  ((127 - Math.min(creationState.startVelocity, creationState.endVelocity) + 1) / 128) * 100 -
                    ((127 - Math.max(creationState.startVelocity, creationState.endVelocity)) / 128) * 100,
                  0.8,
                )}%`,
              }}
            />
          )}

          {loadedKeygroups.map(({ index, header }) => {
            if (!onParameterChange || selectedKeygroupIndex !== index) {
              return null;
            }

            const displayHeader =
              dragState?.keygroupIndex === index
                ? { ...header, [dragState.field]: dragState.value }
                : header;
            const xStart =
              noteToPercent(Math.max(displayHeader.LONOTE, range.min), range);
            const xEnd =
              noteToPercent(Math.min(displayHeader.HINOTE, range.max) + 1, range);
            const width = xEnd - xStart;

            if (width <= 0) {
              return null;
            }

            return (
              <div
                key={`kg-note-handles-${index}`}
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{
                  left: `${xStart}%`,
                  width: `${width}%`,
                  zIndex: 30,
                }}
              >
                <button
                  type="button"
                  className="absolute top-0 bottom-0 w-3 -left-1.5 cursor-ew-resize pointer-events-auto"
                  data-testid={`zone-handle-note-low-${index}`}
                  onMouseDown={startDrag(
                    index,
                    'LONOTE',
                    (moveEvent) => clampLowNote(
                      getNoteFromClientX(moveEvent.clientX),
                      displayHeader.HINOTE,
                    ),
                  )}
                />
                <button
                  type="button"
                  className="absolute top-0 bottom-0 w-3 -right-1.5 cursor-ew-resize pointer-events-auto"
                  data-testid={`zone-handle-note-high-${index}`}
                  onMouseDown={startDrag(
                    index,
                    'HINOTE',
                    (moveEvent) => clampHighNote(
                      getNoteFromClientX(moveEvent.clientX),
                      displayHeader.LONOTE,
                    ),
                  )}
                />
              </div>
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
              const xPercent = noteToPercent(marker.note, range);
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
