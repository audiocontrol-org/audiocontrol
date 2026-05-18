import { useId, type ChangeEvent } from 'react';

/**
 * `<AcToggle>` — v3 segmented control for small enumerated parameters.
 *
 * Two or more labeled positions in a single horizontal pill. Renders
 * as a fieldset of `<input type="radio">` elements with the active
 * position highlighted in the accent color. The native radios are
 * visually hidden but remain the keyboard/screen-reader targets.
 *
 * Use for binary or low-cardinality enums where a dropdown wastes a
 * click and a slider is semantically wrong (e.g., polarity, mode
 * switches). For numeric stepped ranges (0..N) use `AcSlider` instead.
 *
 * Styled by `control-primitives.css` (`.ac-toggle*`).
 */
export interface AcToggleOption<T extends string> {
  readonly value: T;
  readonly label: string;
  /** Optional per-option data-testid on the underlying `<input>`. */
  readonly dataTestId?: string;
}

export interface AcToggleProps<T extends string> {
  /** Currently-selected option value. */
  value: T;
  /** Available options. At least two required for the control to be meaningful. */
  options: ReadonlyArray<AcToggleOption<T>>;
  /** Called with the new value when the user picks an option. */
  onChange: (next: T) => void;
  /** Optional disabled flag — disables every option. */
  disabled?: boolean;
  /**
   * Optional radio-group name. If omitted a unique id is generated;
   * supply explicitly when nesting multiple toggles inside a single form
   * that submits the names.
   */
  name?: string;
  /** Optional ARIA label for the whole group. */
  ariaLabel?: string;
  /** Optional className appended to the outer wrapper. */
  className?: string;
}

export function AcToggle<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
  name,
  ariaLabel,
  className,
}: AcToggleProps<T>): JSX.Element {
  const autoName = useId();
  const groupName = name ?? autoName;
  const wrapperClass = className ? `ac-toggle ${className}` : 'ac-toggle';

  return (
    <div
      className={wrapperClass}
      role="radiogroup"
      aria-label={ariaLabel}
      data-disabled={disabled || undefined}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
          if (e.target.checked) onChange(opt.value);
        };
        return (
          <label
            key={opt.value}
            className="ac-toggle__option"
            data-active={isActive || undefined}
            data-testid={opt.dataTestId}
          >
            <input
              className="ac-toggle__input"
              type="radio"
              name={groupName}
              value={opt.value}
              checked={isActive}
              onChange={handleChange}
              disabled={disabled}
            />
            <span className="ac-toggle__label">{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}
