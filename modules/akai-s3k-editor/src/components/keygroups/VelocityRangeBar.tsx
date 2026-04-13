import {
  useCallback,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { clampVelocitySplit } from '@/components/keygroups/zone-constraints';

interface VelocityZone {
  lowVel: number;
  highVel: number;
  sampleName: string;
}

interface VelocityRangeBarProps {
  zones: VelocityZone[];
  selectedZone: number;
  onSelectZone: (index: number) => void;
  onSplitChange?: (leftZoneIndex: number, boundary: number) => void;
}

const ZONE_COLORS = [
  { bg: 'bg-blue-800', selected: 'bg-blue-600', border: 'border-blue-400' },
  { bg: 'bg-emerald-800', selected: 'bg-emerald-600', border: 'border-emerald-400' },
  { bg: 'bg-amber-800', selected: 'bg-amber-600', border: 'border-amber-400' },
  { bg: 'bg-purple-800', selected: 'bg-purple-600', border: 'border-purple-400' },
];

const VELOCITY_MAX = 127;
const VELOCITY_CARDINALITY = VELOCITY_MAX + 1;

interface SplitDragState {
  leftZoneIndex: number;
  boundary: number;
}

function velocityToPercent(velocity: number): number {
  return (velocity / VELOCITY_MAX) * 100;
}

function boundaryToPercent(boundary: number): number {
  return ((boundary + 1) / VELOCITY_CARDINALITY) * 100;
}

function handleZoneKeyDown(
  event: ReactKeyboardEvent<HTMLElement>,
  index: number,
  onSelectZone: (index: number) => void,
): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onSelectZone(index);
  }
}

export function VelocityRangeBar({
  zones,
  selectedZone,
  onSelectZone,
  onSplitChange,
}: VelocityRangeBarProps): JSX.Element {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<SplitDragState | null>(null);

  const getVelocityFromClientX = useCallback((clientX: number): number => {
    const surface = surfaceRef.current;
    if (!surface) return 0;
    const rect = surface.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.max(0, Math.min(VELOCITY_MAX, Math.floor(fraction * VELOCITY_CARDINALITY)));
  }, []);

  const displayZones = zones.map((zone) => ({ ...zone }));
  if (dragState) {
    const left = displayZones[dragState.leftZoneIndex];
    const right = displayZones[dragState.leftZoneIndex + 1];
    if (left && right) {
      left.highVel = dragState.boundary;
      right.lowVel = dragState.boundary + 1;
    }
  }

  const startSplitDrag = useCallback(
    (leftZoneIndex: number) => (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (!onSplitChange) return;
      event.preventDefault();
      event.stopPropagation();

      const leftZone = zones[leftZoneIndex];
      const rightZone = zones[leftZoneIndex + 1];
      if (!leftZone || !rightZone) return;

      onSelectZone(leftZoneIndex);

      const computeBoundary = (moveEvent: MouseEvent) =>
        clampVelocitySplit(
          getVelocityFromClientX(moveEvent.clientX),
          leftZone.lowVel,
          rightZone.highVel,
        );

      const handleMouseMove = (moveEvent: MouseEvent) => {
        setDragState({
          leftZoneIndex,
          boundary: computeBoundary(moveEvent),
        });
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        const boundary = computeBoundary(upEvent);
        setDragState(null);
        onSplitChange(leftZoneIndex, boundary);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      handleMouseMove(event.nativeEvent);
    },
    [getVelocityFromClientX, onSelectZone, onSplitChange, zones],
  );

  return (
    <div className="px-3 py-2">
      <div
        ref={surfaceRef}
        data-testid="velocity-range-bar-surface"
        className="relative h-8 bg-gray-900 rounded border border-gray-600 overflow-hidden"
      >
        {displayZones.map((zone, index) => {
          if (zone.highVel < zone.lowVel) return null;

          const leftPercent = velocityToPercent(zone.lowVel);
          const widthPercent = velocityToPercent(zone.highVel - zone.lowVel + 1);
          const colors = ZONE_COLORS[index % ZONE_COLORS.length];
          const isSelected = index === selectedZone;

          return (
            <div
              key={index}
              role="button"
              tabIndex={0}
              onClick={() => onSelectZone(index)}
              onKeyDown={(event) => handleZoneKeyDown(event, index, onSelectZone)}
              className={`absolute top-0 bottom-0 flex items-center justify-center transition-colors
                ${isSelected ? colors.selected : colors.bg}
                ${isSelected ? `border-2 ${colors.border}` : 'border border-gray-700'}
              `}
              data-testid={`velocity-range-zone-${index}`}
              style={{
                left: `${leftPercent}%`,
                width: `${Math.max(widthPercent, 0.8)}%`,
              }}
              title={`Zone ${index + 1}: ${zone.sampleName.trim() || '(empty)'} (${zone.lowVel}-${zone.highVel})`}
            >
              <span className="text-[10px] text-gray-100 truncate px-1 leading-none">
                {zone.sampleName.trim() || `Z${index + 1}`}
              </span>
            </div>
          );
        })}

        {onSplitChange &&
          displayZones.slice(0, -1).map((zone, index) => {
            const nextZone = displayZones[index + 1];
            if (!nextZone || zone.highVel < zone.lowVel || nextZone.highVel < nextZone.lowVel) {
              return null;
            }

            const boundary = zone.highVel;
            return (
              <button
                key={`split-${index}`}
                type="button"
                className="absolute top-0 bottom-0 w-3 -ml-1.5 cursor-ew-resize z-20"
                data-testid={`velocity-split-handle-${index}`}
                style={{ left: `${boundaryToPercent(boundary)}%` }}
                onMouseDown={startSplitDrag(index)}
                aria-label={`Velocity split ${index + 1}`}
              />
            );
          })}
      </div>

      <div className="relative h-4 mt-1">
        {[0, 32, 64, 96, 127].map((v) => (
          <span
            key={v}
            className="absolute text-[10px] text-gray-500 -translate-x-1/2"
            style={{ left: `${velocityToPercent(v)}%` }}
          >
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}
