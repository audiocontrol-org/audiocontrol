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
}: MidiPortSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-s330-text">{label}</label>
      <Select.Root value={value ?? undefined} onValueChange={onChange} disabled={disabled}>
        <Select.Trigger
          className={cn(
            'flex items-center justify-between w-full px-3 py-2 rounded-md',
            'bg-s330-bg border border-s330-accent',
            'text-s330-text text-sm',
            'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
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
            className="bg-s330-panel border border-s330-accent rounded-md shadow-lg overflow-hidden z-50"
            position="popper"
            sideOffset={4}
          >
            <Select.Viewport className="p-1">
              {ports.length === 0 ? (
                <div className="px-3 py-2 text-sm text-s330-muted">
                  No MIDI ports found
                </div>
              ) : (
                ports.map((port) => (
                  <Select.Item
                    key={port.id}
                    value={port.id}
                    className={cn(
                      'px-3 py-2 text-sm rounded cursor-pointer',
                      'text-s330-text hover:bg-s330-accent',
                      'focus:outline-none focus:bg-s330-accent',
                      'data-[highlighted]:bg-s330-accent'
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
                          <span className="text-s330-muted text-xs">
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

function ChevronDownIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className="text-s330-muted"
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
