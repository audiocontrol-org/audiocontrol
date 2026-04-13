import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import { formatMidiNote } from '@/lib/midi-note-parser';
import {
  computeVisibleKeyRange,
  type NoteCoordinateRange,
  noteToPercent,
} from '@/components/keygroups/note-coordinate';

interface ZoneOverviewProps {
  keygroups: (KeygroupHeader | undefined)[];
  keygroupCount: number;
  selectedKeygroupIndex: number | null;
  onSelectKeygroup: (index: number) => void;
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
  visibleRange,
}: ZoneOverviewProps): JSX.Element {
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
          className="absolute top-0"
          style={{
            left: `${LEFT_LABEL_WIDTH}px`,
            right: 0,
            height: `calc(100% - ${BOTTOM_LABEL_HEIGHT}px)`,
          }}
        >
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
            const zones = getVelocityZones(header);

            // Key range as percentage of visible range
            const xStart =
              noteToPercent(Math.max(header.LONOTE, range.min), range);
            const xEnd =
              noteToPercent(Math.min(header.HINOTE, range.max) + 1, range);
            const width = xEnd - xStart;

            if (width <= 0) return null;

            if (zones.length === 0) {
              // Render the keygroup as a single band spanning full velocity
              return (
                <button
                  key={`kg-${index}`}
                  className="absolute cursor-pointer border transition-all"
                  onClick={() => onSelectKeygroup(index)}
                  title={`KG ${index + 1}: ${formatMidiNote(header.LONOTE)}-${formatMidiNote(header.HINOTE)}`}
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
                </button>
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
                <button
                  key={`kg-${index}-z${zone.zoneIndex}`}
                  className="absolute cursor-pointer border transition-all overflow-hidden"
                  data-testid={`zone-overview-zone-${index}-${zone.zoneIndex}`}
                  onClick={() => onSelectKeygroup(index)}
                  title={`KG ${index + 1} Zone ${zone.zoneIndex}: ${formatMidiNote(header.LONOTE)}-${formatMidiNote(header.HINOTE)}, vel ${zone.lovel}-${zone.hivel}${zone.sampleName ? ` [${zone.sampleName}]` : ''}`}
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
                </button>
              );
            });
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
