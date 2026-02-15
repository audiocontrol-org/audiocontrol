import type { MidiPortInfo } from '@audiocontrol/shared-midi';

interface MidiPortSelectorProps {
  label: string;
  ports: MidiPortInfo[];
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function MidiPortSelector({
  label,
  ports,
  value,
  onChange,
  disabled = false,
}: MidiPortSelectorProps): JSX.Element {
  return (
    <div className="col">
      <label>{label}</label>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        <option value="">Select a port...</option>
        {ports.map((port) => (
          <option key={port.id} value={port.id}>
            {port.name}
            {port.manufacturer ? ` (${port.manufacturer})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
