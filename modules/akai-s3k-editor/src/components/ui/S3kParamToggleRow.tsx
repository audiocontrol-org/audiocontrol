/**
 * `<S3kParamToggleRow>` — akai dialect's wrapper for the canonical
 * `<AcToggle>` segmented control, configured as a two-position ON/OFF
 * boolean affordance.
 *
 * Reuses the established roland shape: `.ac-compact-field` container,
 * `.ac-field-label` eyebrow, `<AcToggle>` two-option segmented control.
 * See `modules/roland-sxx0-editor/src/components/patches/PatchCommonPanel.tsx`
 * for the canonical consumer pattern.
 */

import { AcToggle } from '@audiocontrol/editor-core';

type ToggleValue = 'on' | 'off';

const TOGGLE_OPTIONS = [
  { value: 'on' as const, label: 'ON' },
  { value: 'off' as const, label: 'OFF' },
] as const;

export interface S3kParamToggleRowProps {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}

export function S3kParamToggleRow({
  label,
  checked,
  onChange,
  disabled,
}: S3kParamToggleRowProps): JSX.Element {
  const value: ToggleValue = checked ? 'on' : 'off';
  return (
    <div className="ac-compact-field">
      <span className="ac-field-label">{label}</span>
      <AcToggle<ToggleValue>
        value={value}
        options={TOGGLE_OPTIONS}
        onChange={(next) => onChange(next === 'on')}
        ariaLabel={label}
        disabled={disabled}
      />
    </div>
  );
}
