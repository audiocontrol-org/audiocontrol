import { useRef, useState, useCallback, useEffect } from 'react';

interface VelocityZone {
  lowVel: number;
  highVel: number;
  sampleName: string;
}

interface VelocityRangeBarProps {
  zones: VelocityZone[];
  selectedZone: number;
  onSelectZone: (index: number) => void;
  /** Called continuously during split point drag. splitIndex is the boundary between zones[splitIndex] and zones[splitIndex+1]. */
  onSplitDrag?: (splitIndex: number, velocity: number) => void;
  /** Called on mouseup after split point drag. */
  onSplitCommit?: (splitIndex: number, velocity: number) => void;
}

const ZONE_COLORS = [
  { bg: 'bg-blue-800', selected: 'bg-blue-600', border: 'border-blue-400' },
  { bg: 'bg-emerald-800', selected: 'bg-emerald-600', border: 'border-emerald-400' },
  { bg: 'bg-amber-800', selected: 'bg-amber-600', border: 'border-amber-400' },
  { bg: 'bg-purple-800', selected: 'bg-purple-600', border: 'border-purple-400' },
];

const VELOCITY_MAX = 127;
const HANDLE_WIDTH_PX = 6;

function velocityToPercent(velocity: number): number {
  return (velocity / VELOCITY_MAX) * 100;
}

function clampVelocity(value: number): number {
  return Math.max(0, Math.min(VELOCITY_MAX, Math.round(value)));
}

interface SplitDragState {
  splitIndex: number;
  lastVelocity: number;
}

export function VelocityRangeBar({
  zones,
  selectedZone,
  onSelectZone,
  onSplitDrag,
  onSplitCommit,
}: VelocityRangeBarProps): JSX.Element {
  const barRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<SplitDragState | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const callbacksRef = useRef({ onSplitDrag, onSplitCommit });
  callbacksRef.current = { onSplitDrag, onSplitCommit };

  const clientXToVelocity = useCallback((clientX: number): number => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const ratio = (clientX - rect.left) / rect.width;
    return clampVelocity(ratio * VELOCITY_MAX);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const velocity = clientXToVelocity(e.clientX);
      if (velocity !== drag.lastVelocity) {
        drag.lastVelocity = velocity;
        callbacksRef.current.onSplitDrag?.(drag.splitIndex, velocity);
      }
    },
    [clientXToVelocity],
  );

  const handleMouseUp = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    callbacksRef.current.onSplitCommit?.(drag.splitIndex, drag.lastVelocity);
    dragRef.current = null;
    setIsDragging(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleSplitMouseDown = useCallback(
    (splitIndex: number) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const velocity = clientXToVelocity(e.clientX);
      dragRef.current = { splitIndex, lastVelocity: velocity };
      setIsDragging(true);
      callbacksRef.current.onSplitDrag?.(splitIndex, velocity);
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [clientXToVelocity, handleMouseMove, handleMouseUp],
  );

  const showHandles = onSplitDrag !== undefined && onSplitCommit !== undefined;

  return (
    <div className="px-3 py-2">
      {/* Velocity bar */}
      <div
        ref={barRef}
        className="relative h-8 bg-gray-900 rounded border border-gray-600 overflow-hidden"
      >
        {zones.map((zone, index) => {
          // Skip zones with no range or empty sample
          if (zone.highVel < zone.lowVel) return null;

          const leftPercent = velocityToPercent(zone.lowVel);
          const widthPercent = velocityToPercent(zone.highVel - zone.lowVel + 1);
          const colors = ZONE_COLORS[index % ZONE_COLORS.length];
          const isSelected = index === selectedZone;

          return (
            <button
              key={index}
              type="button"
              onClick={() => onSelectZone(index)}
              className={`absolute top-0 bottom-0 flex items-center justify-center transition-colors
                ${isSelected ? colors.selected : colors.bg}
                ${isSelected ? `border-2 ${colors.border}` : 'border border-gray-700'}
              `}
              style={{
                left: `${leftPercent}%`,
                width: `${Math.max(widthPercent, 0.8)}%`,
              }}
              title={`Zone ${index + 1}: ${zone.sampleName.trim() || '(empty)'} (${zone.lowVel}-${zone.highVel})`}
            >
              <span className="text-[10px] text-gray-100 truncate px-1 leading-none">
                {zone.sampleName.trim() || `Z${index + 1}`}
              </span>
            </button>
          );
        })}

        {/* Split point drag handles */}
        {showHandles &&
          zones.map((zone, index) => {
            // Render a handle between zone[index] and zone[index+1]
            if (index >= zones.length - 1) return null;
            const nextZone = zones[index + 1];
            if (zone.highVel < zone.lowVel || nextZone.highVel < nextZone.lowVel) {
              return null;
            }

            // Position at the boundary (highVel of left zone)
            const boundaryPercent = velocityToPercent(zone.highVel + 0.5);

            return (
              <div
                key={`split-${index}`}
                data-testid={`split-handle-${index}`}
                onMouseDown={handleSplitMouseDown(index)}
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${boundaryPercent}%`,
                  width: `${HANDLE_WIDTH_PX}px`,
                  marginLeft: `-${HANDLE_WIDTH_PX / 2}px`,
                  cursor: 'ew-resize',
                  zIndex: 20,
                  background: isDragging
                    ? 'rgba(96, 165, 250, 0.5)'
                    : 'transparent',
                  transition: 'background 0.1s',
                }}
                className="hover:bg-blue-400/50"
              />
            );
          })}
      </div>

      {/* Velocity scale labels */}
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
