import { clsx } from 'clsx';
import { formatPitch } from '@audiocontrol/editor-core';
import type { ZonePlayback } from '@audiocontrol/synth-core';

interface ZoneListProps {
  zones: ZonePlayback[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}

export function ZoneList({
  zones,
  selectedIndex,
  onSelect,
  onRemove,
  onMoveUp,
  onMoveDown,
}: ZoneListProps): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-medium text-sampler-muted uppercase tracking-wide px-2 mb-1">
        Zones ({zones.length})
      </div>
      {zones.map((zone, index) => (
        <button
          key={index}
          className={clsx(
            'flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm',
            index === selectedIndex
              ? 'bg-sampler-highlight text-sampler-text'
              : 'hover:bg-sampler-surface text-sampler-muted',
          )}
          onClick={() => onSelect(index)}
        >
          <span className="flex-1 truncate">
            {zone.label || `Zone ${index + 1}`}
          </span>
          <span className="text-xs opacity-60">
            {formatPitch(zone.keyRange[0])}–{formatPitch(zone.keyRange[1])}
          </span>
        </button>
      ))}

      {zones.length > 0 && (
        <div className="flex gap-1 mt-2 px-2">
          <button
            className="text-xs px-2 py-1 rounded bg-sampler-border text-sampler-muted hover:text-sampler-text disabled:opacity-30"
            onClick={() => onMoveUp(selectedIndex)}
            disabled={selectedIndex === 0}
            title="Move up"
          >
            ↑
          </button>
          <button
            className="text-xs px-2 py-1 rounded bg-sampler-border text-sampler-muted hover:text-sampler-text disabled:opacity-30"
            onClick={() => onMoveDown(selectedIndex)}
            disabled={selectedIndex >= zones.length - 1}
            title="Move down"
          >
            ↓
          </button>
          <div className="flex-1" />
          <button
            className="text-xs px-2 py-1 rounded bg-sampler-border text-red-400 hover:text-red-300 disabled:opacity-30"
            onClick={() => onRemove(selectedIndex)}
            disabled={zones.length <= 1}
            title="Remove zone"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
