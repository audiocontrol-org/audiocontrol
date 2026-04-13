import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import { formatMidiNote } from '@/lib/midi-note-parser';
import type { NoteRange } from '@/components/keygroups/note-coordinate-utils';
import {
  noteToPercent,
  velocityToPercentInverted,
} from '@/components/keygroups/note-coordinate-utils';
import type { ZoneDragField, VelocityZoneIndex } from '@/components/keygroups/use-zone-drag';
import { lovelField, hivelField } from '@/components/keygroups/use-zone-drag';

const HANDLE_SIZE = 6; // px
const HANDLE_HOVER_BG = 'rgba(59, 130, 246, 0.3)';

/**
 * Pastel hue palette for keygroups. Each keygroup gets a distinct hue
 * distributed evenly around the color wheel.
 */
export function keygroupColor(index: number, total: number, alpha: number): string {
  const hue = (index * 360) / Math.max(total, 1);
  return `hsla(${hue}, 55%, 55%, ${alpha})`;
}

export function keygroupBorderColor(index: number, total: number): string {
  const hue = (index * 360) / Math.max(total, 1);
  return `hsl(${hue}, 65%, 70%)`;
}

export interface VelocityZone {
  lovel: number;
  hivel: number;
  sampleName: string;
  zoneIndex: VelocityZoneIndex;
}

export function getVelocityZones(kg: KeygroupHeader): VelocityZone[] {
  const zones: VelocityZone[] = [];

  const candidates: ReadonlyArray<{
    lo: number;
    hi: number;
    name: string;
    idx: VelocityZoneIndex;
  }> = [
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

interface DragHandleProps {
  edge: 'left' | 'right' | 'top' | 'bottom';
  onMouseDown: (e: React.MouseEvent) => void;
}

function DragHandle({ edge, onMouseDown }: DragHandleProps): JSX.Element {
  const isHorizontal = edge === 'left' || edge === 'right';
  const style: React.CSSProperties = {
    position: 'absolute',
    zIndex: 20,
    cursor: isHorizontal ? 'ew-resize' : 'ns-resize',
    background: 'transparent',
    transition: 'background 0.1s',
  };

  if (edge === 'left') {
    style.left = 0;
    style.top = 0;
    style.bottom = 0;
    style.width = `${HANDLE_SIZE}px`;
  } else if (edge === 'right') {
    style.right = 0;
    style.top = 0;
    style.bottom = 0;
    style.width = `${HANDLE_SIZE}px`;
  } else if (edge === 'top') {
    style.top = 0;
    style.left = `${HANDLE_SIZE}px`;
    style.right = `${HANDLE_SIZE}px`;
    style.height = `${HANDLE_SIZE}px`;
  } else {
    style.bottom = 0;
    style.left = `${HANDLE_SIZE}px`;
    style.right = `${HANDLE_SIZE}px`;
    style.height = `${HANDLE_SIZE}px`;
  }

  return (
    <div
      style={style}
      onMouseDown={onMouseDown}
      onMouseEnter={(e) => {
        (e.currentTarget.style.background = HANDLE_HOVER_BG);
      }}
      onMouseLeave={(e) => {
        (e.currentTarget.style.background = 'transparent');
      }}
    />
  );
}

export interface ZoneRectProps {
  keygroupIndex: number;
  header: KeygroupHeader;
  keygroupCount: number;
  noteRange: NoteRange;
  isSelected: boolean;
  isDraggingThis: boolean;
  hasDragCallbacks: boolean;
  onSelectKeygroup: (index: number) => void;
  startDrag: (
    keygroupIndex: number,
    field: ZoneDragField,
    getValueFromEvent: (e: MouseEvent) => number,
  ) => (e: React.MouseEvent) => void;
  getNoteFromEvent: (e: MouseEvent) => number;
  getVelocityFromEvent: (e: MouseEvent) => number;
}

export function ZoneRect({
  keygroupIndex,
  header,
  keygroupCount,
  noteRange,
  isSelected,
  isDraggingThis,
  hasDragCallbacks,
  onSelectKeygroup,
  startDrag,
  getNoteFromEvent,
  getVelocityFromEvent,
}: ZoneRectProps): JSX.Element | null {
  const zones = getVelocityZones(header);

  // Key range as percentage of visible range
  const xStart = noteToPercent(
    Math.max(header.LONOTE, noteRange.min),
    noteRange,
  );
  const xEnd = noteToPercent(
    Math.min(header.HINOTE, noteRange.max) + 1,
    noteRange,
  );
  const width = xEnd - xStart;

  if (width <= 0) return null;

  const borderColor = isSelected
    ? '#93c5fd'
    : keygroupBorderColor(keygroupIndex, keygroupCount);
  const borderWidth = isSelected ? '2px' : '1px';
  const boxShadow = isDraggingThis
    ? '0 0 12px rgba(59, 130, 246, 0.5)'
    : isSelected
      ? '0 0 8px rgba(147, 197, 253, 0.4)'
      : 'none';
  const zIndex = isSelected ? 10 : 1;

  const handleClick = () => onSelectKeygroup(keygroupIndex);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') onSelectKeygroup(keygroupIndex);
  };
  // Stop mousedown from reaching the viz div so it doesn't trigger zone creation
  const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

  if (zones.length === 0) {
    // Render the keygroup as a single band spanning full velocity
    return (
      <div
        key={`kg-${keygroupIndex}`}
        role="button"
        tabIndex={0}
        className="absolute cursor-pointer border transition-all"
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onKeyDown={handleKeyDown}
        title={`KG ${keygroupIndex + 1}: ${formatMidiNote(header.LONOTE)}-${formatMidiNote(header.HINOTE)}`}
        style={{
          left: `${xStart}%`,
          width: `${width}%`,
          top: 0,
          bottom: 0,
          background: keygroupColor(keygroupIndex, keygroupCount, 0.35),
          borderColor,
          borderWidth,
          boxShadow,
          zIndex,
        }}
      >
        <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-300 truncate px-1">
          KG {keygroupIndex + 1}
        </span>
        {hasDragCallbacks && (
          <>
            <DragHandle
              edge="left"
              onMouseDown={startDrag(keygroupIndex, 'LONOTE', getNoteFromEvent)}
            />
            <DragHandle
              edge="right"
              onMouseDown={startDrag(keygroupIndex, 'HINOTE', getNoteFromEvent)}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <>
      {zones.map((zone) => {
        // Velocity range as percentage (0 at bottom, 127 at top)
        const yTop = velocityToPercentInverted(zone.hivel);
        const yBottom = ((128 - zone.lovel) / 128) * 100;
        const height = yBottom - yTop;

        if (height <= 0) return null;

        const loField = lovelField(zone.zoneIndex);
        const hiField = hivelField(zone.zoneIndex);

        const label =
          zone.sampleName !== ''
            ? zone.sampleName
            : `KG ${keygroupIndex + 1} Z${zone.zoneIndex}`;

        return (
          <div
            key={`kg-${keygroupIndex}-z${zone.zoneIndex}`}
            role="button"
            tabIndex={0}
            className="absolute cursor-pointer border transition-all overflow-hidden"
            onClick={handleClick}
            onMouseDown={handleMouseDown}
            onKeyDown={handleKeyDown}
            title={`KG ${keygroupIndex + 1} Zone ${zone.zoneIndex}: ${formatMidiNote(header.LONOTE)}-${formatMidiNote(header.HINOTE)}, vel ${zone.lovel}-${zone.hivel}${zone.sampleName ? ` [${zone.sampleName}]` : ''}`}
            style={{
              left: `${xStart}%`,
              width: `${width}%`,
              top: `${yTop}%`,
              height: `${height}%`,
              background: keygroupColor(keygroupIndex, keygroupCount, 0.4),
              borderColor,
              borderWidth,
              boxShadow,
              zIndex,
            }}
          >
            <span className="block text-xs text-gray-200 truncate px-1 leading-tight mt-0.5">
              {label}
            </span>
            {hasDragCallbacks && (
              <>
                <DragHandle
                  edge="left"
                  onMouseDown={startDrag(keygroupIndex, 'LONOTE', getNoteFromEvent)}
                />
                <DragHandle
                  edge="right"
                  onMouseDown={startDrag(keygroupIndex, 'HINOTE', getNoteFromEvent)}
                />
                <DragHandle
                  edge="top"
                  onMouseDown={startDrag(keygroupIndex, hiField, getVelocityFromEvent)}
                />
                <DragHandle
                  edge="bottom"
                  onMouseDown={startDrag(keygroupIndex, loField, getVelocityFromEvent)}
                />
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
