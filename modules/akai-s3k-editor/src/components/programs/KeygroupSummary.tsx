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

/**
 * `<KeygroupSummary>` — the program-internal keygroup roster.
 *
 * Renders the list of keygroups assigned to the currently-edited program
 * as a labeled .ac-summary-table — bordered panel + .ac-detail-head-style
 * header with the count + Add affordance + a single row per keygroup with
 * note-range, sample name, extra-zone count, and a delete affordance.
 *
 * Affordances (Add, Delete) are ALWAYS VISIBLE — never opacity-on-hover.
 * Touch devices have no hover concept; hiding the delete affordance until
 * pointer-hover makes it impossible to target on mobile and confusingly
 * absent on touchscreen laptops.
 *
 * Refactored 2026-05-26 to retire the Tailwind dark-mode chrome that
 * pre-dated the akai-harmonization design-token migration. The previous
 * implementation hardcoded `bg-gray-800`, `text-gray-300`, `divide-y
 * divide-gray-800` etc.; those rendered as illegible cream-on-cream
 * against the akai canvas surface. Now every visual value is sourced from
 * the canonical design tokens declared in editor-core.
 */

function countExtraZones(kg: KeygroupHeader): number {
  let count = 0;
  if (kg.SNAME2.trim().length > 0) count++;
  if (kg.SNAME3.trim().length > 0) count++;
  if (kg.SNAME4.trim().length > 0) count++;
  return count;
}

interface KeygroupRowProps {
  kg: KeygroupHeader;
  index: number;
  onDelete?: (index: number) => void;
}

function KeygroupRow({ kg, index, onDelete }: KeygroupRowProps): JSX.Element {
  const noteRange = `${formatMidiNote(kg.LONOTE)} — ${formatMidiNote(kg.HINOTE)}`;
  const primarySample = kg.SNAME1.trim() || '(none)';
  const extraZones = countExtraZones(kg);

  return (
    <li className="ac-summary-row">
      <span className="ac-summary-row__index">{index + 1}</span>
      <span className="ac-summary-row__range">{noteRange}</span>
      <span className="ac-summary-row__name">{primarySample}</span>
      {extraZones > 0 ? (
        <span className="ac-summary-row__meta">
          +{extraZones} zone{extraZones > 1 ? 's' : ''}
        </span>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          onClick={() => onDelete(index)}
          className="ac-summary-row__action"
          aria-label={`Delete keygroup ${index + 1}`}
          title={`Delete keygroup ${index + 1}`}
        >
          <DeleteIcon />
        </button>
      ) : null}
    </li>
  );
}

export function KeygroupSummary({
  keygroups,
  keygroupCount,
  isLoading,
  onAddKeygroup,
  onDeleteKeygroup,
}: KeygroupSummaryProps): JSX.Element {
  const labelId = 'program-keygroup-summary-label';
  const showLoading =
    isLoading && keygroupCount > 0 && keygroups.every((kg) => kg === undefined);
  const showEmpty = keygroupCount === 0;

  return (
    <section className="ac-summary-table" aria-labelledby={labelId}>
      <header className="ac-summary-head">
        <div className="ac-summary-head__title">
          <span id={labelId} className="ac-summary-head__label">
            Program keygroups
          </span>
          <span className="ac-summary-head__count" aria-hidden="true">
            {keygroupCount}
          </span>
        </div>
        {onAddKeygroup ? (
          <button
            type="button"
            onClick={onAddKeygroup}
            disabled={isLoading}
            className="ac-summary-head__action"
            aria-label="Add keygroup"
            title="Add keygroup"
          >
            + Add
          </button>
        ) : null}
      </header>
      <ol className="ac-summary-list">
        {showLoading ? (
          <li className="ac-summary-row ac-summary-row--note">
            Loading keygroups…
          </li>
        ) : showEmpty ? (
          <li className="ac-summary-row ac-summary-row--note">No keygroups</li>
        ) : (
          keygroups.map((kg, i) =>
            kg !== undefined ? (
              <KeygroupRow
                key={i}
                kg={kg}
                index={i}
                onDelete={onDeleteKeygroup}
              />
            ) : (
              <li key={i} className="ac-summary-row ac-summary-row--note">
                Loading keygroup {i + 1}…
              </li>
            ),
          )
        )}
      </ol>
    </section>
  );
}
