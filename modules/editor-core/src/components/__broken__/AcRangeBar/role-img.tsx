import { AcRangeBar, type AcRangeBarProps } from '@/components/AcRangeBar';

/**
 * BROKEN variant: `role-img`.
 *
 * Wraps the production `AcRangeBar` and strips the `onChange` prop. The
 * production component degrades to a `role="img"` display-only paint
 * with NO `<input type="range">` overlay even though the operator's
 * intent supplied a real callback. Mimics the pre-fix AcRangeBar that
 * was caught in QA — the bar painted correctly but accepted no pointer
 * or keyboard input.
 */
export function AcRangeBarBrokenRoleImg(props: AcRangeBarProps): JSX.Element {
  // Discriminated-union spread: strip onChange while preserving variant.
  if (props.variant === 'enum') {
    return <AcRangeBar {...props} onChange={undefined} />;
  }
  if (props.variant === 'bipolar') {
    return <AcRangeBar {...props} onChange={undefined} />;
  }
  return <AcRangeBar {...props} onChange={undefined} />;
}
