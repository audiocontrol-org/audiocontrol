/**
 * `<S3kParamRow>` — akai dialect's wrapper for the canonical
 * `<AcSlider>` + `<AcNumberInput editable>` composition.
 *
 * Mirrors roland's `ParamSliderRow`. Diverges in three akai-specific
 * affordances that the broader brief (Phase 2 task 2.2) pre-declared
 * as the akai dialect's policy:
 *
 *   1. `onFocus={(e) => e.currentTarget.select()}` on the readout input —
 *      preserves the dense-panel "click number, type new value" ergonomic
 *      from the legacy `.s3k-param-value` button.
 *   2. `Math.round` on every emitted value — akai parameters are all
 *      integers; the underlying `<input type="range">` step defaults to 1
 *      already, but native browsers can still emit fractional values from
 *      pointer drag on narrow ranges. Rounding here guarantees the device
 *      sees an integer regardless of input source.
 *   3. `tooltip:` is optional (not required like roland's). Most akai
 *      call sites omit it; the wrapper conditionally wraps the row in
 *      a `<Tooltip>` only when supplied.
 *
 * Until akai gains a Tooltip primitive, `tooltip:` is documented but the
 * wrapping branch throws so an accidental adopter surfaces the missing
 * primitive instead of silently dropping the tooltip text. When the
 * Tooltip primitive lands (separate dispatch), the throw is replaced with
 * `<Tooltip content={tooltip}>{row}</Tooltip>`.
 */

import { AcSlider, AcNumberInput } from '@audiocontrol/editor-core';
import type { FocusEvent } from 'react';

export interface S3kParamRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  /** Bipolar (center-anchored) variant — for params like pan, tune-offset. */
  bipolar?: boolean;
  /** Optional unit suffix rendered subtly after the readout (e.g. "%"). */
  unit?: string;
  /**
   * Optional accessible label override; defaults to `label`. The readout's
   * aria-label is always `${ariaLabel ?? label} value`.
   */
  ariaLabel?: string;
  /**
   * Optional tooltip text. Not yet wired — wrapping primitive will land in
   * a follow-up dispatch when akai gains a Tooltip primitive. Supplying a
   * non-empty value here today throws to surface the missing primitive.
   */
  tooltip?: string;
}

const handleFocusSelectAll = (e: FocusEvent<HTMLInputElement>): void => {
  e.currentTarget.select();
};

export function S3kParamRow({
  label,
  value,
  min,
  max,
  onChange,
  bipolar,
  unit,
  ariaLabel,
  tooltip,
}: S3kParamRowProps): JSX.Element {
  if (tooltip !== undefined) {
    throw new Error(
      'S3kParamRow: `tooltip` prop is reserved for a follow-up dispatch ' +
        '(akai Tooltip primitive not yet landed). Omit `tooltip` until the ' +
        'primitive ships, then this wrapper will mount the row inside a ' +
        '`<Tooltip content={tooltip}>` shell.',
    );
  }
  const accessibleLabel = ariaLabel ?? label;
  const roundedOnChange = (next: number): void => onChange(Math.round(next));

  return (
    <AcSlider
      label={label}
      bar={
        bipolar === true
          ? {
              variant: 'bipolar',
              value,
              min,
              max,
              onChange: roundedOnChange,
              ariaLabel: accessibleLabel,
            }
          : {
              variant: 'linear',
              value,
              min,
              max,
              onChange: roundedOnChange,
              ariaLabel: accessibleLabel,
            }
      }
      readout={
        <AcNumberInput
          editable
          value={value}
          onChange={roundedOnChange}
          min={min}
          max={max}
          ariaLabel={`${accessibleLabel} value`}
          onFocus={handleFocusSelectAll}
        />
      }
      unit={unit}
    />
  );
}
