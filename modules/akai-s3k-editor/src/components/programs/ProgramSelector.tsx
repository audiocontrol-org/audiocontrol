interface ProgramSelectorProps {
  programNames: string[];
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  label: string;
}

/**
 * Compact program selector dropdown for use in multi-editor panes.
 *
 * Renders a <select> element with all 128 program slots. Empty program names
 * display as "(empty)". The first option is a placeholder prompting the user
 * to choose a program.
 */
export function ProgramSelector({
  programNames,
  selectedIndex,
  onSelect,
  label,
}: ProgramSelectorProps): JSX.Element {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border-b border-gray-700">
      <label className="text-sm text-gray-400 shrink-0">{label}</label>
      <select
        value={selectedIndex ?? ''}
        onChange={(e) => {
          const val = e.target.value;
          onSelect(val === '' ? null : Number(val));
        }}
        className="flex-1 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 min-w-0"
      >
        <option value="">-- Select program --</option>
        {programNames.map((name, index) => {
          const display = name.trim() === '' ? `${index + 1}: (empty)` : `${index + 1}: ${name}`;
          return (
            <option key={index} value={index}>
              {display}
            </option>
          );
        })}
      </select>
    </div>
  );
}
