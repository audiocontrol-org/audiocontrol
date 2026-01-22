/**
 * MIDI connection status indicator
 */

import { useMidiStore } from '@/stores/midiStore';

export function MidiStatus() {
  const { status, selectedInput, selectedOutput } = useMidiStore();

  const statusColors = {
    disconnected: 'bg-gray-500',
    connecting: 'bg-yellow-500 animate-pulse',
    connected: 'bg-green-500',
    error: 'bg-red-500',
  };

  const statusText = {
    disconnected: 'Disconnected',
    connecting: 'Connecting...',
    connected: 'Connected',
    error: 'Error',
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${statusColors[status]}`}
          aria-label={statusText[status]}
        />
        <span className="text-sm text-s330-muted">{statusText[status]}</span>
      </div>
      {status === 'connected' && selectedInput && selectedOutput && (
        <div className="text-xs text-s330-muted hidden sm:block">
          <span title={selectedInput.name}>{truncate(selectedInput.name, 20)}</span>
          <span className="mx-1">↔</span>
          <span title={selectedOutput.name}>{truncate(selectedOutput.name, 20)}</span>
        </div>
      )}
    </div>
  );
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
}
