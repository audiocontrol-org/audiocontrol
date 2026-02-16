import type { MidiPortInfo } from '@audiocontrol/shared-midi';

export interface MidiPortSelectorProps {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220, flex: 1 }}>
      <label style={{ fontSize: 12, fontWeight: 600 }}>{label}</label>
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        style={{
          borderRadius: 8,
          border: '1px solid #4b5563',
          background: '#111827',
          color: '#e5e7eb',
          padding: '10px 12px',
        }}
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
