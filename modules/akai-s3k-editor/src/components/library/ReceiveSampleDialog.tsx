/**
 * Receive Sample Dialog — transfers a sample from the device to the library.
 *
 * Receives sample data from the S3000XL via MIDI Sample Dump Standard (SDS),
 * wraps it in a WAV file, and saves it to the library storage.
 *
 * Flow:
 * 1. Show device sample name + optional rename input
 * 2. Receive via SDS with progress
 * 3. Build WAV from PCM data + SDS header
 * 4. Save to library as a directory bundle (sample.yaml + sample.wav)
 * 5. Refresh library tree on success
 */

import { useState, useCallback, useEffect } from 'react';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import { saveSample, type SampleYaml } from '@audiocontrol/sampler-library/browser';
import type { S3000xlClientInterface } from '@audiocontrol/sampler-devices/s3k';
import { Dialog, DialogTitle, DialogDescription, DialogActions } from '@/components/ui/Dialog';
import { SdsProgressBar } from '@/components/ui/SdsTransferProgress';
import { useSampleTransfer, type SdsReceiveResult } from '@/hooks/useSampleTransfer';
import { buildWavFile } from '@/lib/wav-writer';
import { cn } from '@/lib/utils';

// =========================================================================
// Types
// =========================================================================

export interface ReceiveSampleDialogProps {
  open: boolean;
  onClose: () => void;
  /** Device sample index to receive */
  sampleIndex: number;
  /** Device sample name (for display and default save name) */
  sampleName: string;
  client: S3000xlClientInterface;
  libraryRoot: StorageDirectoryHandle;
  /** Called after successful save to refresh the library tree */
  onTransferComplete: () => Promise<void>;
}

type DialogPhase = 'confirm' | 'receiving' | 'saving' | 'success' | 'error';

// =========================================================================
// Helpers
// =========================================================================

function formatDuration(sampleCount: number, sampleRate: number): string {
  const seconds = sampleCount / sampleRate;
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`;
  return `${seconds.toFixed(2)}s`;
}

function makeSampleYaml(
  name: string,
  sampleRate: number,
  result: SdsReceiveResult,
): SampleYaml {
  const hasLoop = result.header.loopType !== 127;
  const loopModeMap: Record<number, 'forward' | 'alternating'> = {
    0: 'forward',
    1: 'alternating',
  };

  const yaml: SampleYaml = {
    format: 'sample' as const,
    version: 1 as const,
    name,
    file: 'sample.wav',
    sampleRate,
    createdAt: new Date().toISOString(),
  };

  if (hasLoop && loopModeMap[result.header.loopType]) {
    yaml.loopMode = loopModeMap[result.header.loopType];
    yaml.loopStart = result.header.loopStart;
    yaml.loopEnd = result.header.loopEnd;
  }

  return yaml;
}

function ReceivedInfo({ result }: { result: SdsReceiveResult }): JSX.Element {
  const sampleRate = Math.round(1_000_000_000 / result.header.samplePeriodNs);
  const hasLoop = result.header.loopType !== 127;

  return (
    <div className="p-3 bg-gray-700/50 border border-gray-600 rounded text-sm space-y-1">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
        <span>{sampleRate.toLocaleString()} Hz</span>
        <span>{result.header.sampleFormat}-bit</span>
        <span>{result.samples.length.toLocaleString()} samples</span>
        <span>{formatDuration(result.samples.length, sampleRate)}</span>
        {hasLoop && (
          <span>Loop: {result.header.loopStart}-{result.header.loopEnd}</span>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// Dialog
// =========================================================================

export function ReceiveSampleDialog({
  open,
  onClose,
  sampleIndex,
  sampleName,
  client,
  libraryRoot,
  onTransferComplete,
}: ReceiveSampleDialogProps): JSX.Element {
  const [phase, setPhase] = useState<DialogPhase>('confirm');
  const [saveName, setSaveName] = useState(sampleName);
  const [receiveResult, setReceiveResult] = useState<SdsReceiveResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { transferState, receiveFromDevice, clearError } = useSampleTransfer(client);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setPhase('confirm');
      setSaveName(sampleName);
      setReceiveResult(null);
      setErrorMessage(null);
      clearError();
    }
  }, [open, sampleName, clearError]);

  const handleReceive = useCallback(async () => {
    if (!saveName.trim()) {
      setErrorMessage('Sample name is required');
      return;
    }

    setPhase('receiving');
    setErrorMessage(null);

    try {
      const result = await receiveFromDevice(sampleIndex);
      if (!result) {
        // receiveFromDevice sets error internally on failure
        setPhase('error');
        setErrorMessage(transferState.error ?? 'Receive failed');
        return;
      }

      setReceiveResult(result);
      setPhase('saving');

      // Build WAV and save to library
      const sampleRate = Math.round(1_000_000_000 / result.header.samplePeriodNs);
      const wavBuffer = buildWavFile(result.samples, sampleRate);
      const yaml = makeSampleYaml(saveName.trim(), sampleRate, result);

      await saveSample(libraryRoot, {
        name: saveName.trim(),
        yaml,
        wavData: wavBuffer,
      });

      setPhase('success');
      await onTransferComplete();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
      setPhase('error');
    }
  }, [
    saveName,
    sampleIndex,
    receiveFromDevice,
    libraryRoot,
    onTransferComplete,
    transferState.error,
  ]);

  const handleClose = useCallback(() => {
    if (phase === 'receiving' || phase === 'saving') return;
    onClose();
  }, [phase, onClose]);

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Save Sample to Library</DialogTitle>

      {phase === 'confirm' && (
        <div className="space-y-4">
          <DialogDescription>
            Receive sample #{sampleIndex} (&ldquo;{sampleName}&rdquo;) from the device and save it to your library.
          </DialogDescription>

          <div>
            <label
              htmlFor="receive-sample-name"
              className="block text-sm text-gray-400 mb-1"
            >
              Save as
            </label>
            <input
              id="receive-sample-name"
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              maxLength={128}
              className={cn(
                'w-full bg-gray-700 border rounded px-3 py-2 text-gray-200 text-sm',
                'focus:outline-none focus:ring-2 focus:ring-blue-500',
                'border-gray-600',
              )}
              placeholder="Enter sample name"
              data-testid="receive-sample-name-input"
            />
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
              {errorMessage}
            </div>
          )}

          <DialogActions>
            <button
              className="ac-btn ac-btn-sm ac-btn-secondary"
              onClick={handleClose}
            >
              Cancel
            </button>
            <button
              className="ac-btn ac-btn-sm ac-btn-primary"
              onClick={handleReceive}
              disabled={!saveName.trim()}
              data-testid="receive-sample-confirm"
            >
              Receive & Save
            </button>
          </DialogActions>
        </div>
      )}

      {phase === 'receiving' && (
        <div className="space-y-4">
          <SdsProgressBar
            progress={transferState.progress}
            direction="receive"
          />
          <p className="text-xs text-gray-500">
            Do not disconnect the device during transfer.
          </p>
        </div>
      )}

      {phase === 'saving' && receiveResult && (
        <div className="space-y-3">
          <ReceivedInfo result={receiveResult} />
          <p className="text-sm text-gray-400">Saving to library...</p>
        </div>
      )}

      {phase === 'error' && (
        <div className="space-y-3">
          <div className="p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
            {errorMessage || transferState.error || 'An unknown error occurred'}
          </div>
          <DialogActions>
            <button
              className="ac-btn ac-btn-sm ac-btn-secondary"
              onClick={handleClose}
            >
              Close
            </button>
          </DialogActions>
        </div>
      )}

      {phase === 'success' && (
        <div className="space-y-4">
          {receiveResult && <ReceivedInfo result={receiveResult} />}
          <div className="p-3 bg-green-900/30 border border-green-700 rounded text-green-300 text-sm">
            Sample saved to library as &ldquo;{saveName.trim()}&rdquo;.
          </div>
          <DialogActions>
            <button
              className="ac-btn ac-btn-sm ac-btn-primary"
              onClick={handleClose}
              data-testid="receive-sample-done"
            >
              Done
            </button>
          </DialogActions>
        </div>
      )}
    </Dialog>
  );
}
