interface ButtonGroupProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

export function ButtonGroup<T extends string>({
  options,
  value,
  onChange,
}: ButtonGroupProps<T>) {
  return (
    <div className="flex gap-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`
            flex-1 px-3 py-1.5 text-xs font-medium uppercase tracking-wide
            border transition-all
            ${
              value === option.value
                ? 'border-phosphor-green text-phosphor-green bg-phosphor-green/5'
                : 'border-crt-border text-gray-500 hover:border-gray-500 hover:text-gray-400'
            }
          `}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
