import type { ChangeEvent, ReactNode } from 'react';

/**
 * `<AcCheckbox>` — v3 design-language checkbox.
 *
 * Composes the three-element mockup pattern: a `<label class="ac-checkbox">`
 * wrapping `<input class="ac-checkbox__input" type="checkbox">` and a
 * `<span class="ac-checkbox__label">`. Styled by `control-primitives.css`.
 *
 * Distinct from the pre-existing `.ac-checkbox-label` (single class used by
 * `BuildInfo`'s logs filter). Both coexist; new code uses `<AcCheckbox>`.
 *
 * Mockup source:
 *   docs/1.0/001-IN-PROGRESS/s550-support/explorations/01-design-language.html:552-603
 */
export interface AcCheckboxProps {
  /** The visible label text rendered next to the checkbox. */
  children: ReactNode;
  /** Whether the box is currently checked. */
  checked: boolean;
  /** Called with the new checked state when the user toggles. */
  onChange: (checked: boolean) => void;
  /** Optional disabled flag. */
  disabled?: boolean;
  /** Optional `aria-label` for screen-reader contexts where `children` is iconic. */
  ariaLabel?: string;
  /** Optional className appended to the outer label (NOT replacing `.ac-checkbox`). */
  className?: string;
  /** Optional `id` to wire to an external `<label htmlFor>`. */
  id?: string;
  /** Optional `name` for form submission. */
  name?: string;
}

export function AcCheckbox({
  children,
  checked,
  onChange,
  disabled = false,
  ariaLabel,
  className,
  id,
  name,
}: AcCheckboxProps): JSX.Element {
  const labelClass = className ? `ac-checkbox ${className}` : 'ac-checkbox';
  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChange(event.target.checked);
  };
  return (
    <label className={labelClass}>
      <input
        className="ac-checkbox__input"
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        aria-label={ariaLabel}
        id={id}
        name={name}
      />
      <span className="ac-checkbox__label">{children}</span>
    </label>
  );
}
