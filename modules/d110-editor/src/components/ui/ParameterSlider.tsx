/**
 * Parameter slider component for D-110 editor
 *
 * Reusable slider with label, value display, and commit handling.
 */

import * as Slider from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

interface ParameterSliderProps {
  /** Label displayed above the slider */
  label: string;
  /** Current value */
  value: number;
  /** Called on every value change during drag */
  onChange: (value: number) => void;
  /** Called when drag ends - use for sending to hardware */
  onCommit?: () => void;
  /** Minimum value (default: 0) */
  min?: number;
  /** Maximum value (default: 100) */
  max?: number;
  /** Step size (default: 1) */
  step?: number;
  /** Custom value formatter for display */
  formatValue?: (value: number) => string;
  /** Disable the slider */
  disabled?: boolean;
  /** Optional className for container */
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
  return (
    <div className={cn('space-y-2', disabled && 'opacity-50', className)}>
      <div className="flex items-center justify-between">
        <label className="text-xs text-d110-muted">{label}</label>
        <span className="text-xs font-mono text-d110-text">
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
        <Slider.Track className="bg-d110-surface relative grow rounded-full h-2">
          <Slider.Range className="absolute bg-d110-accent rounded-full h-full" />
        </Slider.Track>
        <Slider.Thumb
          className={cn(
            'block w-4 h-4 bg-d110-text rounded-full',
            'focus:outline-none focus:ring-2 focus:ring-d110-highlight',
            'hover:bg-white transition-colors'
          )}
        />
      </Slider.Root>
    </div>
  );
}

/**
 * Common value formatters
 */
export const formatPercent = (value: number, max = 100): string =>
  `${Math.round((value / max) * 100)}%`;

export const formatSigned = (value: number, center = 50): string => {
  const offset = value - center;
  if (offset === 0) return '0';
  return offset > 0 ? `+${offset}` : String(offset);
};

export const formatPitch = (value: number): string => {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(value / 12) - 1;
  const note = notes[value % 12];
  return `${note}${octave}`;
};

export const formatKeyfollow = (value: number): string => {
  const names = [
    '-1', '-1/2', '-1/4', '0', '1/8', '1/4', '3/8', '1/2',
    '5/8', '3/4', '7/8', '1', '5/4', '3/2', '2', 's1', 's2',
  ];
  return names[value] ?? String(value);
};
