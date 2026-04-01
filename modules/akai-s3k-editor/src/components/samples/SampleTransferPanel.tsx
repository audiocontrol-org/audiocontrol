import { useState, useCallback, useRef } from 'react';
import type { S3000xlClientInterface } from '@audiocontrol/sampler-devices/s3k';
import {
  useSampleTransfer,
  type TransferState,
  type SdsReceiveResult,
} from '@/hooks/useSampleTransfer';
import { buildWavFile } from '@/lib/wav-writer';
import { parseWavFile, type WavFileInfo } from '@/lib/wav-reader';

interface SampleTransferPanelProps {
  client: S3000xlClientInterface;
  sampleNames: string[];
  onSampleListChanged: () => Promise<void>;
}

type SendMode = 'add-new' | 'replace';

const LOOP_TYPE_LABELS: Record<number, string> = {
  0: 'forward',
  1: 'forward/backward',
  127: 'off',
};

function formatDuration(sampleCount: number, sampleRate: number): string {
  const seconds = sampleCount / sampleRate;
  if (seconds < 1) {
    return `${(seconds * 1000).toFixed(0)}ms`;
  }
  return `${seconds.toFixed(2)}s`;
}

function loopTypeLabel(loopType: number): string {
  return LOOP_TYPE_LABELS[loopType] ?? `type ${loopType}`;
}

function downloadWav(result: SdsReceiveResult): void {
  const sampleRate = Math.round(
    1_000_000_000 / result.header.samplePeriodNs,
  );
  const wavBuffer = buildWavFile(result.samples, sampleRate);
  const blob = new Blob([wavBuffer], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `sample-${result.header.sampleNumber}.wav`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

function WavFileInfoDisplay({ info, fileName }: { info: WavFileInfo; fileName: string }) {
  return (
    <div className="p-3 bg-gray-700/50 border border-gray-600 rounded text-sm text-gray-300 space-y-1">
      <p className="font-medium text-gray-200 truncate" title={fileName}>
        {fileName}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
        <span>{info.sampleRate.toLocaleString()} Hz</span>
        <span>{info.bitsPerSample}-bit</span>
        <span>{info.numChannels === 1 ? 'Mono' : 'Stereo \u2192 Mono'}</span>
        <span>{info.numSamples.toLocaleString()} samples</span>
        <span>{formatDuration(info.numSamples, info.sampleRate)}</span>
      </div>
    </div>
  );
}

function ReceivedSampleInfo({
  result,
  onDownload,
}: {
  result: SdsReceiveResult;
  onDownload: () => void;
}) {
  const { header, samples } = result;
  const sampleRate = Math.round(1_000_000_000 / header.samplePeriodNs);
  const hasLoop = header.loopType !== 127;

  return (
    <div data-testid="sds-received-info" className="border border-gray-700 rounded-lg bg-gray-800/50 p-3 mt-4">
      <h3 className="text-sm font-medium text-gray-300 mb-2">
        Received Sample
      </h3>
      <div className="space-y-1">
        <p className="text-sm text-gray-200">
          <span className="text-gray-400">Sample #{header.sampleNumber}:</span>{' '}
          <span data-testid="sds-received-sample-count">{samples.length.toLocaleString()}</span> samples
        </p>
        <p className="text-sm text-gray-200">
          <span className="text-gray-400">Format:</span>{' '}
          <span data-testid="sds-received-sample-rate">{sampleRate.toLocaleString()}</span> Hz, {header.sampleFormat}-bit
        </p>
        {hasLoop && (
          <p className="text-sm text-gray-200">
            <span className="text-gray-400">Loop:</span>{' '}
            {header.loopStart.toLocaleString()}-
            {header.loopEnd.toLocaleString()} ({loopTypeLabel(header.loopType)})
          </p>
        )}
        <p className="text-sm text-gray-200">
          <span className="text-gray-400">Duration:</span>{' '}
          {formatDuration(samples.length, sampleRate)}
        </p>
      </div>
      <div className="mt-3">
        <button data-testid="sds-download-button" className="ac-btn ac-btn-sm ac-btn-primary" onClick={onDownload}>
          Download as WAV
        </button>
      </div>
    </div>
  );
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
            <span data-testid="sds-progress-percent">{percentage}%</span>
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
        <div data-testid="sds-error" className="p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}

interface SendConfirmPanelProps {
  wavInfo: WavFileInfo;
  fileName: string;
  sendMode: SendMode;
  onSendModeChange: (mode: SendMode) => void;
  selectedIndex: number | null;
  selectedSampleName: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  isTransferring: boolean;
}

function SendConfirmPanel({
  wavInfo,
  fileName,
  sendMode,
  onSendModeChange,
  selectedIndex,
  selectedSampleName,
  onConfirm,
  onCancel,
  isTransferring,
}: SendConfirmPanelProps) {
  const canReplace = selectedIndex !== null;

  return (
    <div data-testid="sds-send-confirm-panel" className="border border-gray-700 rounded-lg bg-gray-800/50 p-4 mt-4">
      <h3 className="text-sm font-medium text-gray-300 mb-3">Send to Device</h3>

      <WavFileInfoDisplay info={wavInfo} fileName={fileName} />

      <div className="mt-4 space-y-3">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="radio"
            name="send-mode"
            data-testid="sds-send-mode-add"
            className="mt-0.5"
            checked={sendMode === 'add-new'}
            onChange={() => onSendModeChange('add-new')}
          />
          <div>
            <span className="text-sm text-gray-200">Add as new sample</span>
            <p className="text-xs text-gray-400 ml-0">
              Creates a new sample slot on the device. No existing data is affected.
            </p>
          </div>
        </label>

        {canReplace && (
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="send-mode"
              data-testid="sds-send-mode-replace"
              className="mt-0.5"
              checked={sendMode === 'replace'}
              onChange={() => onSendModeChange('replace')}
            />
            <div>
              <span className="text-sm text-gray-200">
                Replace &ldquo;{selectedSampleName}&rdquo; (sample #{selectedIndex})
              </span>
              <p className="text-xs text-amber-400 ml-0">
                Deletes {selectedSampleName} first. Programs referencing this sample will lose their assignment.
              </p>
            </div>
          </label>
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          data-testid="sds-send-cancel-button"
          className="ac-btn ac-btn-sm ac-btn-secondary"
          onClick={onCancel}
          disabled={isTransferring}
        >
          Cancel
        </button>
        <button
          data-testid="sds-send-confirm-button"
          className="ac-btn ac-btn-sm ac-btn-primary"
          onClick={onConfirm}
          disabled={isTransferring}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export function SampleTransferPanel({
  client,
  sampleNames,
  onSampleListChanged,
}: SampleTransferPanelProps): JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [receiveResult, setReceiveResult] = useState<SdsReceiveResult | null>(null);
  const { transferState, sendToDevice, receiveFromDevice, deleteSample, clearError } =
    useSampleTransfer(client);
  const [parseError, setParseError] = useState<string | null>(null);
  const [pendingWav, setPendingWav] = useState<{ info: WavFileInfo; fileName: string } | null>(null);
  const [sendMode, setSendMode] = useState<SendMode>('add-new');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleReceive = useCallback(async () => {
    if (selectedIndex === null) return;
    clearError();
    setReceiveResult(null);
    setPendingWav(null);
    setParseError(null);
    const result = await receiveFromDevice(selectedIndex);
    if (result) {
      setReceiveResult(result);
    }
  }, [selectedIndex, receiveFromDevice, clearError]);

  const handleSendClick = useCallback(() => {
    clearError();
    setParseError(null);
    fileInputRef.current?.click();
  }, [clearError]);

  const handleFileSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Reset input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (!file) return;

      setParseError(null);
      setReceiveResult(null);

      try {
        const arrayBuffer = await file.arrayBuffer();
        const info = parseWavFile(arrayBuffer);
        setPendingWav({ info, fileName: file.name });
        setSendMode('add-new');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setParseError(message);
      }
    },
    [],
  );

  const handleConfirmSend = useCallback(async () => {
    if (!pendingWav) return;

    try {
      if (sendMode === 'replace' && selectedIndex !== null) {
        await deleteSample(selectedIndex);
        await sendToDevice(selectedIndex, pendingWav.info.samples, pendingWav.info.sampleRate);
      } else {
        await sendToDevice(0, pendingWav.info.samples, pendingWav.info.sampleRate);
      }
      setPendingWav(null);
      // Brief delay to let device commit the sample before refreshing the list
      await new Promise((r) => setTimeout(r, 1500));
      await onSampleListChanged();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setParseError(message);
    }
  }, [pendingWav, sendMode, selectedIndex, deleteSample, sendToDevice, onSampleListChanged]);

  const handleCancelSend = useCallback(() => {
    setPendingWav(null);
    setSendMode('add-new');
  }, []);

  const handleSampleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      setSelectedIndex(val === '' ? null : Number(val));
      setReceiveResult(null);
      setPendingWav(null);
      setParseError(null);
    },
    [],
  );

  const handleDownload = useCallback(() => {
    if (!receiveResult) return;
    downloadWav(receiveResult);
  }, [receiveResult]);

  const hasSamples = sampleNames.length > 0;
  const selectedSampleName = selectedIndex !== null ? sampleNames[selectedIndex] ?? null : null;

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
            data-testid="sds-sample-select"
            className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-gray-200 text-sm
                       focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
                       disabled:opacity-50 disabled:cursor-not-allowed"
            value={selectedIndex ?? ''}
            onChange={handleSampleChange}
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
            data-testid="sds-receive-button"
            className="ac-btn ac-btn-sm ac-btn-primary"
            onClick={handleReceive}
            disabled={
              selectedIndex === null || transferState.isTransferring
            }
          >
            Receive from Device
          </button>

          <input
            ref={fileInputRef}
            data-testid="sds-file-input"
            type="file"
            accept=".wav,audio/wav"
            className="hidden"
            onChange={handleFileSelected}
          />
          <button
            data-testid="sds-send-button"
            className="ac-btn ac-btn-sm ac-btn-secondary"
            onClick={handleSendClick}
            disabled={transferState.isTransferring}
          >
            Send to Device
          </button>
        </div>

        {/* Send confirmation panel */}
        {pendingWav && !transferState.isTransferring && (
          <SendConfirmPanel
            wavInfo={pendingWav.info}
            fileName={pendingWav.fileName}
            sendMode={sendMode}
            onSendModeChange={setSendMode}
            selectedIndex={selectedIndex}
            selectedSampleName={selectedSampleName}
            onConfirm={handleConfirmSend}
            onCancel={handleCancelSend}
            isTransferring={transferState.isTransferring}
          />
        )}

        {/* Parse error */}
        {parseError && (
          <div data-testid="sds-parse-error" className="p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
            {parseError}
          </div>
        )}

        {/* Progress / error display */}
        <TransferProgress state={transferState} />

        {/* Received sample info + download */}
        {receiveResult && !transferState.isTransferring && (
          <ReceivedSampleInfo
            result={receiveResult}
            onDownload={handleDownload}
          />
        )}
      </div>
    </div>
  );
}
