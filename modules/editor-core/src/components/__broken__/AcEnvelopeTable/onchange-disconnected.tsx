import { AcEnvelopeTable, type AcEnvelopeTableProps } from '@/components/AcEnvelopeTable';

/**
 * BROKEN variant: `onchange-disconnected`.
 *
 * Wraps the production `AcEnvelopeTable` but substitutes no-op callbacks
 * for `onTimeChange` / `onLevelChange`. If either was supplied the
 * production component still renders its native `<input type="range">`
 * overlays (because the callbacks are "supplied" — `interactive` is true),
 * but the operator's intended callback is replaced with a sink, so input
 * events never propagate back to the parent's state.
 *
 * Mimics the failure mode where the table looks fully editable, the
 * native input value updates locally on drag/keyboard, but no model
 * change is observed.
 */
export function AcEnvelopeTableBrokenOnChangeDisconnected(
  props: AcEnvelopeTableProps,
): JSX.Element {
  const proxied: AcEnvelopeTableProps = {
    ...props,
    onTimeChange:
      props.onTimeChange === undefined
        ? undefined
        : () => {
            /* deliberate: drop the call before it reaches the parent */
          },
    onLevelChange:
      props.onLevelChange === undefined
        ? undefined
        : () => {
            /* deliberate: drop the call before it reaches the parent */
          },
  };
  return <AcEnvelopeTable {...proxied} />;
}
