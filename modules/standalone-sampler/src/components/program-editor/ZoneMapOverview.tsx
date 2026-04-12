import { clsx } from 'clsx';
import type { ZonePlayback } from '@audiocontrol/synth-core';

interface ZoneMapOverviewProps {
  zones: ZonePlayback[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

const TOTAL_KEYS = 128;

/**
 * Keyboard-style zone map: each zone is a horizontal bar spanning its key range.
 * Zones are stacked vertically. The selected zone is highlighted.
 */
export function ZoneMapOverview({
  zones,
  selectedIndex,
  onSelect,
}: ZoneMapOverviewProps): JSX.Element {
  if (zones.length === 0) return <></>;

  return (
    <div className="border border-sampler-border rounded-md overflow-hidden">
      <div className="text-xs font-medium text-sampler-muted px-3 py-1.5 bg-sampler-surface">
        Zone Map
      </div>
      <div className="p-2 flex flex-col gap-1">
        {zones.map((zone, index) => {
          const leftPercent = (zone.keyRange[0] / TOTAL_KEYS) * 100;
          const widthPercent = ((zone.keyRange[1] - zone.keyRange[0] + 1) / TOTAL_KEYS) * 100;

          return (
            <button
              key={index}
              className="relative h-5 w-full rounded-sm bg-sampler-border cursor-pointer"
              onClick={() => onSelect(index)}
              title={`${zone.label || `Zone ${index + 1}`}: ${zone.keyRange[0]}–${zone.keyRange[1]}`}
            >
              <div
                className={clsx(
                  'absolute top-0 h-full rounded-sm text-[10px] leading-5 px-1 truncate',
                  index === selectedIndex
                    ? 'bg-sampler-highlight text-sampler-text'
                    : 'bg-sampler-accent text-sampler-muted',
                )}
                style={{
                  left: `${leftPercent}%`,
                  width: `${widthPercent}%`,
                }}
              >
                {zone.label || `Z${index + 1}`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
