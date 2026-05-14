import { AcRangeBar, type AcRangeBarProps } from '@/components/AcRangeBar';

/**
 * BROKEN variant: `onchange-disconnected`.
 *
 * Wraps the production `AcRangeBar` but substitutes a no-op for the
 * `onChange` prop when the operator supplied one. The production
 * component still renders its native `<input type="range">` overlay
 * (because `onChange` is defined — `interactive` is true), but events
 * never propagate back to the parent's state.
 *
 * Mimics the failure mode where the bar looks fully editable, the
 * native input value updates locally on drag/keyboard, but no model
 * change is observed.
 */
export function AcRangeBarBrokenOnChangeDisconnected(
  props: AcRangeBarProps,
): JSX.Element {
  const noop = (): void => {
    /* deliberate: drop the call before it reaches the parent */
  };
  if (props.variant === 'enum') {
    return props.onChange === undefined
      ? <AcRangeBar {...props} />
      : <AcRangeBar {...props} onChange={noop} />;
  }
  if (props.variant === 'bipolar') {
    return props.onChange === undefined
      ? <AcRangeBar {...props} />
      : <AcRangeBar {...props} onChange={noop} />;
  }
  return props.onChange === undefined
    ? <AcRangeBar {...props} />
    : <AcRangeBar {...props} onChange={noop} />;
}
