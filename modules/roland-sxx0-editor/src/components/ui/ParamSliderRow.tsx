/**
 * ParamSliderRow — Roland editor's wrapper for v3 AcSlider + AcNumberInput.
 *
 * Composes the editor-core atomic primitives (AcSlider + AcNumberInput
 * with `editable`) into a single read-write parameter row, with:
 *   - the legacy `param-<label>` data-testid wrapper so existing UI
 *     specs (capabilities/patch-writes.spec.ts) keep targeting it after
 *     the Phase 9 Task 4 ParameterSlider→AcSlider migration.
 *   - a Tooltip wrapper for the parameter help text.
 *   - the focusable affordance on the readout (per DESIGN-SYSTEM.md:
 *     "the bar itself is a visualization, not a focus target").
 *
 * Streaming writes (no save/cancel/undo) — per project memory
 * `feedback_live_editing_no_save`. The caller's onChange should both
 * update local state AND emit the device write; AcNumberInput fires
 * onChange per keystroke (or per arrow-key step) so each edit streams.
 */

import { AcSlider, AcNumberInput } from '@audiocontrol/editor-core';
import { Tooltip } from './Tooltip';

/**
 * Convert a slider label to a data-testid (matches the legacy
 * ParameterSlider shape — `param-level`, `param-a-t-sense`, etc.).
 */
export function labelToTestId(label: string): string {
  return `param-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

export interface ParamSliderRowProps {
  label: string;
  value: number;
  onChange: (next: number) => void;
  tooltip: string;
  min?: number;
  max?: number;
  disabled?: boolean;
}

export function ParamSliderRow({
  label,
  value,
  onChange,
  tooltip,
  min = 0,
  max = 127,
  disabled,
}: ParamSliderRowProps): JSX.Element {
  return (
    <Tooltip content={tooltip}>
      <div data-testid={labelToTestId(label)}>
        <AcSlider
          label={label}
          bar={{ variant: 'linear', value, min, max, ariaLabel: label }}
          readout={
            <AcNumberInput
              editable
              value={value}
              onChange={onChange}
              min={min}
              max={max}
              disabled={disabled}
              ariaLabel={`${label} value`}
            />
          }
        />
      </div>
    </Tooltip>
  );
}
