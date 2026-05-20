import { AcEnvelopeTable, type AcEnvelopeTableProps } from '@/components/AcEnvelopeTable';

/**
 * BROKEN variant: `cells-role-img`.
 *
 * Wraps the production `AcEnvelopeTable` but strips `onTimeChange` /
 * `onLevelChange` to `undefined`. The production component then renders
 * each per-segment cell as a `role="img"` paint with NO `<input
 * type="range">` overlay, even though the operator's intended props
 * supplied real callbacks. Mimics the failure mode where the envelope
 * table looked editable but accepted no input on any cell.
 */
export function AcEnvelopeTableBrokenCellsRoleImg(
  props: AcEnvelopeTableProps,
): JSX.Element {
  const stripped: AcEnvelopeTableProps = {
    ...props,
    onTimeChange: undefined,
    onLevelChange: undefined,
  };
  return <AcEnvelopeTable {...stripped} />;
}
