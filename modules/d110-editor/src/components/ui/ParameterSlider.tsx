import {
  ParameterSlider as CoreParameterSlider,
  formatKeyfollow,
  formatPercent,
  formatPitch,
  formatSigned,
  type ParameterSliderProps as CoreParameterSliderProps,
} from '@audiocontrol/editor-core';

interface ParameterSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onCommit?: () => void;
  min?: number;
  max?: number;
  step?: number;
  formatValue?: (value: number) => string;
  disabled?: boolean;
  className?: string;
}

export function ParameterSlider({
  label,
  value,
  onChange,
  onCommit,
  min = 0,
  max = 100,
  step = 1,
  formatValue = (v) => String(v),
  disabled = false,
  className,
}: ParameterSliderProps): JSX.Element {
  const theme: CoreParameterSliderProps['theme'] = {
    disabledContainer: 'opacity-50',
    label: 'text-xs text-d110-muted',
    value: 'text-xs font-mono text-d110-text',
    disabledRoot: 'pointer-events-none',
    track: 'bg-d110-surface relative grow rounded-full h-2',
    range: 'absolute bg-d110-accent rounded-full h-full',
    thumb: 'block w-4 h-4 bg-d110-text rounded-full focus:outline-none focus:ring-2 focus:ring-d110-highlight hover:bg-white transition-colors',
  };

  return (
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
      className={className}
      theme={theme}
    />
  );
}
export { formatPercent, formatSigned, formatPitch, formatKeyfollow };
