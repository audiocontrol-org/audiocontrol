import { useState, useCallback } from 'react';
import type { S3000xlClientInterface } from '@audiocontrol/sampler-devices/s3k';
import { useSampleTransfer, type TransferState } from '@/hooks/useSampleTransfer';

interface SampleTransferPanelProps {
  client: S3000xlClientInterface;
  sampleNames: string[];
}

function TransferProgress({ state }: { state: TransferState }) {
  if (!state.isTransferring && !state.error) return null;

  const { progress, direction, error } = state;

  const percentage =
    progress && progress.packetsTotal > 0
      ? Math.round((progress.packetsSent / progress.packetsTotal) * 100)
      : 0;

  return (
    <div className="mt-4 space-y-2">
      {state.isTransferring && (
        <>
          <div className="flex items-center justify-between text-sm text-gray-300">
            <span>
              {direction === 'receive' ? 'Receiving' : 'Sending'} sample...
            </span>
            <span>{percentage}%</span>
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
        </>
      )}

      {error && (
        <div className="p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}

export function SampleTransferPanel({
  client,
  sampleNames,
}: SampleTransferPanelProps): JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const { transferState, receiveFromDevice, clearError } = useSampleTransfer(client);

  const handleReceive = useCallback(async () => {
    if (selectedIndex === null) return;
    clearError();
    await receiveFromDevice(selectedIndex);
  }, [selectedIndex, receiveFromDevice, clearError]);

  const hasSamples = sampleNames.length > 0;

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
      <h2 className="text-lg font-semibold text-gray-100 mb-4">
        Sample Transfer (SDS)
      </h2>

      <div className="space-y-4">
        {/* Sample selector */}
        <div>
          <label
            htmlFor="sample-select"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Sample
          </label>
          <select
            id="sample-select"
            className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-gray-200 text-sm
                       focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
                       disabled:opacity-50 disabled:cursor-not-allowed"
            value={selectedIndex ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedIndex(val === '' ? null : Number(val));
            }}
            disabled={!hasSamples || transferState.isTransferring}
          >
            <option value="">
              {hasSamples ? '-- Select a sample --' : 'No samples on device'}
            </option>
            {sampleNames.map((name, i) => (
              <option key={i} value={i}>
                {i}: {name}
              </option>
            ))}
          </select>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <button
            className="ac-btn ac-btn-sm ac-btn-primary"
            onClick={handleReceive}
            disabled={
              selectedIndex === null || transferState.isTransferring
            }
          >
            Receive from Device
          </button>
          <button
            className="ac-btn ac-btn-sm ac-btn-secondary"
            disabled
            title="File picker integration coming in a future phase"
          >
            Send to Device
          </button>
        </div>

        {/* Progress / error display */}
        <TransferProgress state={transferState} />
      </div>
    </div>
  );
}
