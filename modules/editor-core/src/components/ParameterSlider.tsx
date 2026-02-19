import * as Slider from '@radix-ui/react-slider';

export interface ParameterSliderTheme {
  container?: string;
  disabledContainer?: string;
  label?: string;
  value?: string;
  root?: string;
  disabledRoot?: string;
  track?: string;
  range?: string;
  thumb?: string;
}

export interface ParameterSliderProps {
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
  theme?: ParameterSliderTheme;
}

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
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
  className,
  theme,
}: ParameterSliderProps): JSX.Element {
  return (
    <div className={cx('space-y-2', disabled && theme?.disabledContainer, theme?.container, className)}>
      <div className="flex items-center justify-between">
        <label className={theme?.label}>{label}</label>
        <span className={theme?.value}>
          {formatValue(value)}
        </span>
      </div>
      <Slider.Root
        className={cx('relative flex items-center select-none touch-none w-full h-5', disabled && theme?.disabledRoot, theme?.root)}
        value={[value]}
        onValueChange={([v]) => {
          if (typeof v === 'number') onChange(v);
        }}
        onValueCommit={() => onCommit?.()}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
      >
        <Slider.Track className={theme?.track}>
          <Slider.Range className={theme?.range} />
        </Slider.Track>
        <Slider.Thumb className={theme?.thumb} />
      </Slider.Root>
    </div>
  );
}
