import type { MidiPortInfo } from '@audiocontrol/shared-midi';

export interface MidiPortSelectorProps {
  label: string;
  ports: MidiPortInfo[];
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  testId?: string;
}

export function MidiPortSelector({
  label,
  ports,
  value,
  onChange,
  disabled = false,
  testId,
}: MidiPortSelectorProps): JSX.Element {
  return (
    <div className="ac-field">
      <label className="ac-label">{label}</label>
      <select
        className="ac-select"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        data-testid={testId}
      >
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
