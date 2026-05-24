/**
 * `<S3kParamSelectRow>` — akai dialect's wrapper for the canonical
 * `<select class="ac-select">` enum-picker primitive.
 *
 * Uses the established roland shape: `.ac-compact-field` container,
 * `.ac-field-label` eyebrow, native `<select class="ac-select">`. See
 * `modules/roland-sxx0-editor/src/components/patches/PatchCommonPanel.tsx`
 * for the canonical consumer.
 *
 * No `<AcSelect>` React primitive exists — the canonical dropdown shape
 * is the native `<select>` styled by `.ac-select` (see
 * `modules/editor-core/src/design/primitives.css:281`).
 */

import type { ChangeEvent } from 'react';

export interface S3kParamSelectOption {
  readonly value: number;
  readonly label: string;
}

export interface S3kParamSelectRowProps {
  label: string;
  value: number;
  options: ReadonlyArray<S3kParamSelectOption>;
  onChange: (next: number) => void;
  disabled?: boolean;
}

export function S3kParamSelectRow({
  label,
  value,
  options,
  onChange,
  disabled,
}: S3kParamSelectRowProps): JSX.Element {
  const handleChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    onChange(Number(e.target.value));
  };
  return (
    <div className="ac-compact-field">
      <span className="ac-field-label">{label}</span>
      <select
        value={value}
        onChange={handleChange}
        disabled={disabled}
        className="ac-select"
        aria-label={label}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
