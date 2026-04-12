interface VelocityZone {
  lowVel: number;
  highVel: number;
  sampleName: string;
}

interface VelocityRangeBarProps {
  zones: VelocityZone[];
  selectedZone: number;
  onSelectZone: (index: number) => void;
}

const ZONE_COLORS = [
  { bg: 'bg-blue-800', selected: 'bg-blue-600', border: 'border-blue-400' },
  { bg: 'bg-emerald-800', selected: 'bg-emerald-600', border: 'border-emerald-400' },
  { bg: 'bg-amber-800', selected: 'bg-amber-600', border: 'border-amber-400' },
  { bg: 'bg-purple-800', selected: 'bg-purple-600', border: 'border-purple-400' },
];

const VELOCITY_MAX = 127;

function velocityToPercent(velocity: number): number {
  return (velocity / VELOCITY_MAX) * 100;
}

export function VelocityRangeBar({
  zones,
  selectedZone,
  onSelectZone,
}: VelocityRangeBarProps): JSX.Element {
  return (
    <div className="px-3 py-2">
      {/* Velocity bar */}
      <div className="relative h-8 bg-gray-900 rounded border border-gray-600 overflow-hidden">
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
