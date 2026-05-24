import type { ReactNode } from 'react';
import { AcRangeBar, type AcRangeBarProps } from './AcRangeBar';

/**
 * `<AcSlider>` — v3 parameter-row surface.
 *
 * Three-column grid: LABEL | range-bar | mono readout. The range-bar is
 * `<AcRangeBar>`; the readout supports a primary value plus an optional unit.
 *
 * Read-or-write: the inner `<AcRangeBar>` becomes a real interactive control
 * when its `onChange` prop is supplied (overlay `<input type="range">`
 * provides pointer drag, click-to-set, and native keyboard semantics —
 * arrow keys, home / end, page up/down). The readout is a separate slot;
 * pair with `<AcNumberInput editable>` for click-to-type. See
 * `modules/roland-sxx0-editor/src/components/ui/ParamSliderRow.tsx` for
 * the canonical interactive consumer and
 * `modules/akai-s3k-editor/src/components/ui/S3kParamRow.tsx` for the akai
 * dialect's equivalent.
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
