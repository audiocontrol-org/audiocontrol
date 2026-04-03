/**
 * SDS transfer progress bar with packet-level detail.
 *
 * Shared between SendSampleDialog and ReceiveSampleDialog. Renders a
 * progress bar, percentage, and byte-level stats from an SdsTransferProgress
 * object.
 */

import type { SdsTransferProgress } from '@audiocontrol/midi-core';

interface SdsProgressBarProps {
  progress: SdsTransferProgress | null;
  direction: 'send' | 'receive';
}

export function SdsProgressBar({ progress, direction }: SdsProgressBarProps): JSX.Element {
  const percentage =
    progress && progress.packetsTotal > 0
      ? Math.round((progress.packetsSent / progress.packetsTotal) * 100)
      : 0;

  const label = direction === 'send' ? 'Sending' : 'Receiving';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-gray-300">
        <span>{label} sample via SDS...</span>
        <span data-testid="sds-dialog-progress-percent">{percentage}%</span>
      </div>

      <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-150"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {progress && (
        <p className="text-xs text-gray-400">
          Packet {progress.packetsSent} of {progress.packetsTotal}
          {' '}({progress.bytesSent.toLocaleString()} / {progress.bytesTotal.toLocaleString()} bytes)
        </p>
      )}
    </div>
  );
}
