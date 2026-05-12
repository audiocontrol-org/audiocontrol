import type { ChangeEvent } from 'react';

/**
 * `<AcNumberInput>` — display-font numeric readout. Two shapes:
 *
 *   - **read-only** (default): render `<span class="ac-number-input">` with
 *     the value in display font and an optional dim unit.
 *   - **editable** (`editable={true}`): render `<input type="number">` with
 *     the same display styling; emits `onChange` on every keystroke.
 *
 * The editable input throws if `onChange` is not provided — silent no-ops
 * are forbidden (per project rule on loud failures).
 *
 * Mockup source (display-font numeric readouts):
 *   docs/1.0/001-IN-PROGRESS/s550-support/explorations/04-tones.html
 *   (`.tones__param-readout`, `.tones__envelope-mini-readout`)
 */
export interface AcNumberInputReadProps {
  editable?: false;
  /** The numeric value to render. */
  value: number;
  /** Optional unit text (e.g. "kHz", "smp"). Rendered subtly. */
  unit?: string;
  /** Optional custom formatter; defaults to `String(value)`. */
  formatValue?: (value: number) => string;
  /** Optional className appended to the root span. */
  className?: string;
  /** Optional `aria-label` for screen readers. */
  ariaLabel?: string;
}

export interface AcNumberInputEditProps {
  editable: true;
  value: number;
  /** Required when `editable`; called on every change. */
  onChange: (next: number) => void;
  /** Minimum acceptable value (inclusive). */
  min?: number;
  /** Maximum acceptable value (inclusive). */
  max?: number;
  /** Increment step; defaults to 1. */
  step?: number;
  unit?: string;
  formatValue?: (value: number) => string;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

export type AcNumberInputProps = AcNumberInputReadProps | AcNumberInputEditProps;

export function AcNumberInput(props: AcNumberInputProps): JSX.Element {
  if (props.editable === true) {
    return renderEditable(props);
  }
  return renderRead(props);
}

function renderRead(p: AcNumberInputReadProps): JSX.Element {
  const formatted = p.formatValue ? p.formatValue(p.value) : String(p.value);
  const baseClass = 'ac-number-input';
  const className = p.className ? `${baseClass} ${p.className}` : baseClass;
  return (
    <span className={className} aria-label={p.ariaLabel}>
      <span className="ac-number-input__value">{formatted}</span>
      {p.unit !== undefined ? <span className="ac-number-input__unit">{p.unit}</span> : null}
    </span>
  );
}

function renderEditable(p: AcNumberInputEditProps): JSX.Element {
  const formatted = p.formatValue ? p.formatValue(p.value) : String(p.value);
  const baseClass = 'ac-number-input ac-number-input--editable';
  const className = p.className ? `${baseClass} ${p.className}` : baseClass;
  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const raw = event.target.value;
    if (raw === '') {
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) {
      return;
    }
    p.onChange(parsed);
  };
  return (
    <span className={className}>
      <input
        type="number"
        className="ac-number-input__value"
        value={formatted}
        onChange={handleChange}
        min={p.min}
        max={p.max}
        step={p.step ?? 1}
        disabled={p.disabled}
        aria-label={p.ariaLabel}
      />
      {p.unit !== undefined ? <span className="ac-number-input__unit">{p.unit}</span> : null}
    </span>
  );
}
