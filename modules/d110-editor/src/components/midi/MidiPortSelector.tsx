/**
 * MIDI port selection component
 */

import * as Select from '@radix-ui/react-select';
import type { MidiPortInfo } from '@/core/midi/types';
import { cn } from '@/lib/utils';

interface MidiPortSelectorProps {
  label: string;
  ports: MidiPortInfo[];
  value: string | null;
  onChange: (portId: string) => void;
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
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-d110-text">{label}</label>
      <Select.Root value={value ?? undefined} onValueChange={onChange} disabled={disabled}>
        <Select.Trigger
          className={cn(
            'flex items-center justify-between w-full px-3 py-2 rounded-md',
            'bg-d110-surface border border-d110-border',
            'text-d110-text text-sm',
            'focus:outline-none focus:ring-2 focus:ring-d110-accent',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Select.Value placeholder="Select a port..." />
          <Select.Icon>
            <ChevronDownIcon />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            className="bg-d110-panel border border-d110-border rounded-md shadow-lg overflow-hidden z-50"
            position="popper"
            sideOffset={4}
          >
            <Select.Viewport className="p-1">
              {ports.length === 0 ? (
                <div className="px-3 py-2 text-sm text-d110-muted">
                  No MIDI ports found
                </div>
              ) : (
                ports.map((port) => (
                  <Select.Item
                    key={port.id}
                    value={port.id}
                    className={cn(
                      'px-3 py-2 text-sm rounded cursor-pointer',
                      'text-d110-text hover:bg-d110-surface',
                      'focus:outline-none focus:bg-d110-surface',
                      'data-[highlighted]:bg-d110-surface'
                    )}
                  >
                    <Select.ItemText>
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            'w-2 h-2 rounded-full',
                            port.state === 'connected' ? 'bg-green-500' : 'bg-gray-500'
                          )}
                        />
                        {port.name}
                        {port.manufacturer && (
                          <span className="text-d110-muted text-xs">
                            ({port.manufacturer})
                          </span>
                        )}
                      </span>
                    </Select.ItemText>
                  </Select.Item>
                ))
              )}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}

function ChevronDownIcon(): JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className="text-d110-muted"
    >
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
