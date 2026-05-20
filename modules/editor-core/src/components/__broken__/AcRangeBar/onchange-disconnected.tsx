import { AcRangeBar, type AcRangeBarProps } from '@/components/AcRangeBar';

/**
 * BROKEN variant: `onchange-disconnected`.
 *
 * Wraps the production `AcRangeBar` but substitutes a no-op for the
 * `onChange` prop when the operator supplied one. The production
 * component still renders its native `<input type="range">` overlay
 * (because `onChange` is defined — `interactive` is true).
 *
 * The native input's `change` event fires but does not advance parent
 * state. React's controlled-input model then snaps the input back to
 * the un-advanced `value` on every render, so the bar visually does
 * not move on drag. Credibility specs assert that the bar's
 * `aria-valuenow` or rendered readout does NOT advance after a
 * pointer drag.
 */
export function AcRangeBarBrokenOnChangeDisconnected(
  props: AcRangeBarProps,
): JSX.Element {
  const noop = (): void => {
    /* deliberate: drop the call before it reaches the parent */
  };
  if (props.onChange === undefined) return <AcRangeBar {...props} />;
  const swapped: AcRangeBarProps = { ...props, onChange: noop };
  return <AcRangeBar {...swapped} />;
}
