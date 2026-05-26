/**
 * `<S3kParamRadioRow>` — akai dialect's wrapper for the canonical
 * `<AcToggle>` segmented control, configured as an N-position pill-radio
 * for low-cardinality enum parameters.
 *
 * Reuses the established roland shape: `.ac-compact-field` container,
 * `.ac-field-label` eyebrow, `<AcToggle>` N-option segmented control.
 *
 * The S3000XL header fields these wrap are `number` values (0..N-1
 * enums); AcToggle is generic over `T extends string`, so this wrapper
 * coerces the numeric option `value` to its stringified form for the
 * underlying control and back to a `number` for the consumer's
 * `onChange`. Stringification is the lossless 1:1 standard `String()`
 * conversion — no clamp, no parse drift; the consumer sees the same
 * integer it passed in via `options[].value`.
 *
 * Replaces the dropdown variant (`S3kParamSelectRow`) per the mockup
 * which uses pill-radios uniformly for every low-cardinality enum
 * (mockup `mockups/programs.html:117-150`).
 */

import { AcToggle } from '@audiocontrol/editor-core';

export interface S3kParamRadioOption {
  readonly value: number;
  readonly label: string;
}

export interface S3kParamRadioRowProps {
  label: string;
  value: number;
  options: ReadonlyArray<S3kParamRadioOption>;
  onChange: (next: number) => void;
  disabled?: boolean;
}

export function S3kParamRadioRow({
  label,
  value,
  options,
  onChange,
  disabled,
}: S3kParamRadioRowProps): JSX.Element {
  const toggleOptions = options.map((opt) => ({
    value: String(opt.value),
    label: opt.label,
  }));

  return (
    <div className="ac-compact-field">
      <span className="ac-field-label">{label}</span>
      <AcToggle<string>
        value={String(value)}
        options={toggleOptions}
        onChange={(next) => onChange(Number(next))}
        ariaLabel={label}
        disabled={disabled}
      />
    </div>
  );
}
