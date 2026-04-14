import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import { DeleteIcon } from '@audiocontrol/editor-core';
import { formatMidiNote } from '@/lib/midi-note-parser';

interface KeygroupSummaryProps {
  keygroups: (KeygroupHeader | undefined)[];
  keygroupCount: number;
  isLoading: boolean;
  onAddKeygroup?: () => void;
  onDeleteKeygroup?: (index: number) => void;
}

/** Count how many additional velocity zones (beyond zone 1) have a non-empty sample name. */
function countExtraZones(kg: KeygroupHeader): number {
  let count = 0;
  if (kg.SNAME2.trim().length > 0) count++;
  if (kg.SNAME3.trim().length > 0) count++;
  if (kg.SNAME4.trim().length > 0) count++;
  return count;
}

function KeygroupRow({
  kg,
  index,
  onDelete,
}: {
  kg: KeygroupHeader;
  index: number;
  onDelete?: (index: number) => void;
}): JSX.Element {
  const noteRange = `${formatMidiNote(kg.LONOTE)} \u2014 ${formatMidiNote(kg.HINOTE)}`;
  const primarySample = kg.SNAME1.trim() || '(none)';
  const extraZones = countExtraZones(kg);

  return (
    <div className="group flex items-center gap-4 py-1.5 px-3 text-sm">
      <span className="text-gray-500 w-8 text-right shrink-0">{index + 1}</span>
      <span className="text-gray-300 font-mono w-28 shrink-0">{noteRange}</span>
      <span className="text-gray-300 font-mono truncate flex-1">{primarySample}</span>
      {extraZones > 0 && (
        <span className="text-gray-500 shrink-0">+{extraZones} zone{extraZones > 1 ? 's' : ''}</span>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(index)}
          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity shrink-0 p-0.5 rounded"
          title={`Delete keygroup ${index + 1}`}
        >
          <DeleteIcon />
        </button>
      )}
    </div>
  );
}

export function KeygroupSummary({
  keygroups,
  keygroupCount,
  isLoading,
  onAddKeygroup,
  onDeleteKeygroup,
}: KeygroupSummaryProps): JSX.Element {
  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden mb-3">
      <div className="bg-gray-800 px-3 py-2 text-sm font-medium flex items-center justify-between">
        <span>Keygroups ({keygroupCount})</span>
        {onAddKeygroup && (
          <button
            type="button"
            onClick={onAddKeygroup}
            disabled={isLoading}
            className="text-xs text-gray-400 hover:text-gray-200 disabled:opacity-50 transition-colors"
            title="Add keygroup"
          >
            + Add
          </button>
        )}
      </div>
      <div className="divide-y divide-gray-800">
        {isLoading && keygroupCount > 0 && keygroups.every((kg) => kg === undefined) ? (
          <div className="py-2 px-3 text-sm text-gray-400">Loading keygroups...</div>
        ) : keygroupCount === 0 ? (
          <div className="py-2 px-3 text-sm text-gray-400">No keygroups</div>
        ) : (
          keygroups.map((kg, i) =>
            kg ? (
              <KeygroupRow key={i} kg={kg} index={i} onDelete={onDeleteKeygroup} />
            ) : (
              <div key={i} className="py-1.5 px-3 text-sm text-gray-500">
                Loading keygroup {i + 1}...
              </div>
            ),
          )
        )}
      </div>
    </div>
  );
}
