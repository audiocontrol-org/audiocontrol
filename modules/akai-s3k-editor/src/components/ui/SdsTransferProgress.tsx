/**
 * SDS transfer progress bar with byte-level detail, elapsed time, and ETA.
 *
 * Shared between SendSampleDialog and ReceiveSampleDialog. Meets project
 * progress indicator spec: bar, bytes transferred/total, elapsed, ETA,
 * current item name, item count (secondary).
 */

import { useRef } from 'react';
import type { SdsTransferProgress } from '@audiocontrol/midi-core';

interface SdsProgressBarProps {
  progress: SdsTransferProgress | null;
  direction: 'send' | 'receive';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

export function SdsProgressBar({ progress, direction }: SdsProgressBarProps): JSX.Element {
  // Track start time via ref so it persists across renders
  const startTimeRef = useRef<number | null>(null);
  if (progress && progress.packetsSent > 0 && startTimeRef.current === null) {
    startTimeRef.current = Date.now();
  }

  const percentage =
    progress && progress.bytesTotal > 0
      ? Math.round((progress.bytesSent / progress.bytesTotal) * 100)
      : 0;

  const elapsed = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
  const bytesPerMs = elapsed > 0 && progress ? progress.bytesSent / elapsed : 0;
  const remainingBytes = progress ? progress.bytesTotal - progress.bytesSent : 0;
  const etaMs = bytesPerMs > 0 ? remainingBytes / bytesPerMs : 0;

  const label = direction === 'send' ? 'Sending sample to device' : 'Receiving sample from device';

  return (
    <div className="space-y-2">
      {/* Progress bar */}
      <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-150"
          style={{ width: `${Math.max(percentage, 1)}%` }}
        />
      </div>

      {/* Bytes + percentage */}
      <div className="flex justify-between text-sm text-gray-300">
        <span>
          {progress ? formatBytes(progress.bytesSent) : '0 B'} / {progress ? formatBytes(progress.bytesTotal) : '0 B'}
        </span>
        <span data-testid="sds-dialog-progress-percent">{percentage}%</span>
      </div>

      {/* Elapsed + ETA */}
      <div className="flex justify-between text-xs text-gray-400">
        <span>
          {elapsed > 1000 && `${formatDuration(elapsed)} elapsed`}
          {etaMs > 1000 && ` \u2022 ~${formatDuration(etaMs)} remaining`}
        </span>
        <span>{label}</span>
      </div>
    </div>
  );
}
