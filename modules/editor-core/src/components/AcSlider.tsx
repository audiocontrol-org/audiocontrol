import type { ReactNode } from 'react';
import { AcRangeBar, type AcRangeBarProps } from './AcRangeBar';

/**
 * `<AcSlider>` — v3 parameter-row surface.
 *
 * Three-column grid: LABEL | range-bar | mono readout. The range-bar is
 * `<AcRangeBar>`; the readout supports a primary value plus an optional unit.
 *
 * NOTE: this is the v3 RANGE-BAR pattern (read-or-write display of a value
 * inside a fixed range). It is NOT a replacement for `ParameterSlider`
 * (Radix-based with drag handle, used by Roland editor) — that component
 * remains unchanged. Consumers of the new v3 pages use `<AcSlider>`; legacy
 * pages keep `ParameterSlider` until their per-page polish dispatch.
 *
 * Mockup source:
 *   docs/1.0/001-IN-PROGRESS/s550-support/explorations/04-tones.html:1465-1546
 */
export interface AcSliderProps {
  /** The eyebrow label rendered in the first column. */
  label: string;
  /** The range-bar props (linear, bipolar, or enum). */
  bar: AcRangeBarProps;
  /** The readout shown in the third column. */
  readout: ReactNode;
  /** Optional unit text rendered subtly after the readout value. */
  unit?: string;
  /** Optional className appended to the slider root. */
  className?: string;
}

export function AcSlider({
  label,
  bar,
  readout,
  unit,
  className,
}: AcSliderProps): JSX.Element {
  const rootClass = className ? `ac-slider ${className}` : 'ac-slider';
  return (
    <div className={rootClass}>
      <span className="ac-slider__label">{label}</span>
      <AcRangeBar {...bar} />
      <span className="ac-slider__readout">
        <strong>{readout}</strong>
        {unit !== undefined ? <span className="ac-slider__readout-unit">{unit}</span> : null}
      </span>
    </div>
  );
}
