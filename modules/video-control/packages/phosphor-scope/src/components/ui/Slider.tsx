interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  formatValue?: (value: number) => string
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  formatValue = (v) => v.toString(),
}: SliderProps) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <label className="text-gray-500">{label}</label>
        <span className="text-gray-400 font-mono">{formatValue(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-3
          [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:bg-gray-400
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:hover:bg-phosphor-green
          [&::-webkit-slider-thumb]:transition-colors"
      />
    </div>
  )
}
