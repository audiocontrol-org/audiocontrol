import { forwardRef, type ChangeEvent, type Ref } from 'react';

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
 * Forwarded ref points at the underlying `<input>` of the editable shape.
 * `<AcNumberInput>` is `forwardRef`'d at the source so callers (e.g. Radix
 * `<Tooltip>` composing around the focusable affordance) receive a real
 * DOM ref via composition — without each callsite needing to wrap
 * `<AcNumberInput>` in a `<div>`. Matches the pattern landed on
 * `<AcCheckbox>` in commit 4952d643. The read-only shape has no
 * focusable element; if a caller refs a read-only `<AcNumberInput>` the
 * ref is unused (read-only readouts are display-only and have no Tooltip
 * use case in the current codebase).
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
  /**
   * Optional `data-testid` applied to the outer `<span>` (the read-only
   * shape has no input). Use to let Playwright `getByTestId` target the
   * readout when verifying displayed values.
   */
  dataTestId?: string;
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
  /**
   * Optional `data-testid` applied to the `<input>` element. Lands on the
   * input (not the wrapping `<span>`) so Playwright's
   * `getByTestId(...).fill(...)` targets the actual editable affordance —
   * matching how a raw native `<input type="number" data-testid="...">`
   * would behave.
   */
  dataTestId?: string;
}

export type AcNumberInputProps = AcNumberInputReadProps | AcNumberInputEditProps;

export const AcNumberInput = forwardRef<HTMLInputElement, AcNumberInputProps>(
  function AcNumberInput(props, ref): JSX.Element {
    if (props.editable === true) {
      return renderEditable(props, ref);
    }
    return renderRead(props);
  },
);

function renderRead(p: AcNumberInputReadProps): JSX.Element {
  const formatted = p.formatValue ? p.formatValue(p.value) : String(p.value);
  const baseClass = 'ac-number-input';
  const className = p.className ? `${baseClass} ${p.className}` : baseClass;
  return (
    <span className={className} aria-label={p.ariaLabel} data-testid={p.dataTestId}>
      <span className="ac-number-input__value">{formatted}</span>
      {p.unit !== undefined ? <span className="ac-number-input__unit">{p.unit}</span> : null}
    </span>
  );
}

function renderEditable(
  p: AcNumberInputEditProps,
  ref: Ref<HTMLInputElement>,
): JSX.Element {
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
    // Clamp to min/max BEFORE invoking onChange. Browsers only enforce
    // <input min max> on form submit, not on typed input — so without this
    // clamp, typing "200" into a 0..127 slider would call onChange(200) and
    // either throw at the device boundary (S-330 strict clamp) or produce
    // a visible/device disagreement (S-550 silently clamps). Same for "-5"
    // on a 0..127 control. The clamp guarantees the device sees what the
    // user sees, regardless of typed input.
    const lo = p.min;
    const hi = p.max;
    let clamped = parsed;
    if (lo !== undefined && clamped < lo) clamped = lo;
    if (hi !== undefined && clamped > hi) clamped = hi;
    p.onChange(clamped);
  };
  return (
    <span className={className}>
      <input
        ref={ref}
        type="number"
        className="ac-number-input__value"
        value={formatted}
        onChange={handleChange}
        min={p.min}
        max={p.max}
        step={p.step ?? 1}
        disabled={p.disabled}
        aria-label={p.ariaLabel}
        data-testid={p.dataTestId}
      />
      {p.unit !== undefined ? <span className="ac-number-input__unit">{p.unit}</span> : null}
    </span>
  );
}
