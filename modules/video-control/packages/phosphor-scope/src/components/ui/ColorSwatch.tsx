import type { PhosphorColor } from '@audiocontrol/video-core'

const COLOR_VALUES: Record<PhosphorColor, string> = {
  green: '#39ff14',
  amber: '#ffbf00',
  blue: '#00d4ff',
  white: '#ffffff',
}

interface ColorSwatchProps {
  colors: PhosphorColor[]
  value: PhosphorColor
  onChange: (color: PhosphorColor) => void
}

export function ColorSwatch({ colors, value, onChange }: ColorSwatchProps) {
  return (
    <div className="flex gap-2">
      {colors.map((color) => (
        <button
          key={color}
          onClick={() => onChange(color)}
          className={`
            w-6 h-6 rounded-full transition-all
            ${value === color ? 'ring-2 ring-white ring-offset-2 ring-offset-crt-panel' : ''}
          `}
          style={{
            backgroundColor: COLOR_VALUES[color],
            boxShadow:
              value === color ? `0 0 12px ${COLOR_VALUES[color]}` : 'none',
          }}
          title={color.charAt(0).toUpperCase() + color.slice(1)}
        />
      ))}
    </div>
  )
}
