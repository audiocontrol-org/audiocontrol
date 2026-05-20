import { ParameterSlider as CoreParameterSlider, type ParameterSliderProps as CoreParameterSliderProps } from '@audiocontrol/editor-core';
import { Tooltip } from './Tooltip';

interface ParameterSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onCommit?: () => void; // Called when drag ends - use for device sends
  min?: number;
  max?: number;
  step?: number;
  formatValue?: (value: number) => string;
  disabled?: boolean;
  tooltip?: string;
}

import { labelToTestId } from '@/components/ui/labelToTestId';

export function ParameterSlider({
  label,
  value,
  onChange,
  onCommit,
  min = 0,
  max = 127,
  step = 1,
  formatValue = (v) => String(v),
  disabled = false,
  tooltip,
}: ParameterSliderProps) {
  const theme: CoreParameterSliderProps['theme'] = {
    disabledContainer: 'opacity-50',
    label: 'text-xs text-s330-muted',
    value: 'text-xs font-mono text-s330-text',
    disabledRoot: 'pointer-events-none',
    track: 'bg-s330-bg relative grow rounded-full h-2',
    range: 'absolute bg-s330-highlight rounded-full h-full',
    thumb: 'block w-4 h-4 bg-s330-text rounded-full focus:outline-none focus:ring-2 focus:ring-s330-highlight hover:bg-white transition-colors',
  };

  const testId = labelToTestId(label);

  const slider = (
    <div data-testid={testId}>
      <CoreParameterSlider
        label={label}
        value={value}
        onChange={onChange}
        onCommit={onCommit}
        min={min}
        max={max}
        step={step}
        formatValue={formatValue}
        disabled={disabled}
        theme={theme}
      />
    </div>
  );

  if (tooltip) {
    return (
      <Tooltip content={tooltip}>
        {slider}
      </Tooltip>
    );
  }

  return slider;
}
