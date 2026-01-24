/**
 * Parameter slider component
 */

import * as Slider from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

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
}

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
}: ParameterSliderProps) {
  return (
    <div className={cn('space-y-2', disabled && 'opacity-50')}>
      <div className="flex items-center justify-between">
        <label className="text-xs text-s330-muted">{label}</label>
        <span className="text-xs font-mono text-s330-text">
          {formatValue(value)}
        </span>
      </div>
      <Slider.Root
        className={cn(
          'relative flex items-center select-none touch-none w-full h-5',
          disabled && 'pointer-events-none'
        )}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        onValueCommit={() => onCommit?.()}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
      >
        <Slider.Track className="bg-s330-bg relative grow rounded-full h-2">
          <Slider.Range className="absolute bg-s330-highlight rounded-full h-full" />
        </Slider.Track>
        <Slider.Thumb
          className={cn(
            'block w-4 h-4 bg-s330-text rounded-full',
            'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
            'hover:bg-white transition-colors'
          )}
        />
      </Slider.Root>
    </div>
  );
}
