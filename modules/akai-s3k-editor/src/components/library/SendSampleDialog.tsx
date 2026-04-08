/**
 * Send Sample Dialog — transfers a WAV sample from the library to the device.
 *
 * Reads the sample from library storage, parses the WAV to get PCM data,
 * and sends it to the S3000XL via MIDI Sample Dump Standard (SDS).
 *
 * Flow:
 * 1. Load sample from library storage (name + path)
 * 2. Parse WAV -> Int16Array + sample rate
 * 3. Show sample info + target sample number
 * 4. Send via SDS with progress
 * 5. Refresh device sample list on success
 */

import { useState, useCallback, useEffect } from 'react';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import { loadSample } from '@audiocontrol/sampler-library/browser';
import type { S3000xlClientInterface } from '@audiocontrol/sampler-devices/s3k';
import { Dialog, DialogTitle, DialogDescription, DialogActions } from '@/components/ui/Dialog';
import { SdsProgressBar } from '@/components/ui/SdsTransferProgress';
import { useSampleTransfer } from '@/hooks/useSampleTransfer';
import { parseWavFile, type WavFileInfo } from '@/lib/wav-reader';

// =========================================================================
// Types
// =========================================================================

export interface SendSampleDialogProps {
  open: boolean;
  onClose: () => void;
  /** Sample directory name in the library */
  sampleName: string;
  /** Path within the samples directory */
  samplePath: string[];
  client: S3000xlClientInterface;
  libraryRoot: StorageDirectoryHandle;
  /** Current device sample count (used to compute next free slot) */
  deviceSampleCount: number;
  /** Called after a successful send to refresh device state */
  onTransferComplete: () => Promise<void>;
}

type DialogPhase = 'loading' | 'ready' | 'transferring' | 'success' | 'error';

// =========================================================================
// Helpers
// =========================================================================

function formatDuration(sampleCount: number, sampleRate: number): string {
  const seconds = sampleCount / sampleRate;
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`;
  return `${seconds.toFixed(2)}s`;
}

function WavInfoDisplay({ info }: { info: WavFileInfo }): JSX.Element {
  return (
    <div className="p-3 bg-gray-700/50 border border-gray-600 rounded text-sm space-y-1">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
        <span>{info.sampleRate.toLocaleString()} Hz</span>
        <span>{info.bitsPerSample}-bit</span>
        <span>{info.numChannels === 1 ? 'Mono' : 'Stereo (downmixed to mono)'}</span>
        <span>{info.numSamples.toLocaleString()} samples</span>
        <span>{formatDuration(info.numSamples, info.sampleRate)}</span>
      </div>
    </div>
  );
}

// =========================================================================
// Dialog
// =========================================================================

export function SendSampleDialog({
  open,
  onClose,
  sampleName,
  samplePath,
  client,
  libraryRoot,
  deviceSampleCount,
  onTransferComplete,
}: SendSampleDialogProps): JSX.Element {
  const [phase, setPhase] = useState<DialogPhase>('loading');
  const [wavInfo, setWavInfo] = useState<WavFileInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { transferState, sendToDevice, clearError } = useSampleTransfer(client);

  // The SDS sample number for a new sample is the next unused index
  const targetSampleNumber = deviceSampleCount;

  // Load sample from library when dialog opens
  useEffect(() => {
    if (!open) return;

    setPhase('loading');
    setWavInfo(null);
    setLoadError(null);
    clearError();

    let cancelled = false;

    async function load() {
      try {
        const result = await loadSample(libraryRoot, sampleName, samplePath);
        if (cancelled) return;

        const info = parseWavFile(result.wavData);
        setWavInfo(info);
        setPhase('ready');
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setLoadError(message);
        setPhase('error');
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [open, libraryRoot, sampleName, samplePath, clearError]);

  const handleSend = useCallback(async () => {
    if (!wavInfo) return;

    console.log(`[SendSampleDialog] handleSend: target=${targetSampleNumber}, samples=${wavInfo.samples.length}, rate=${wavInfo.sampleRate}`);
    setPhase('transferring');

    try {
      await sendToDevice(targetSampleNumber, wavInfo.samples, wavInfo.sampleRate);
      console.log(`[SendSampleDialog] sendToDevice resolved — setting phase to success`);
      setPhase('success');
      // Give device time to commit the sample before refreshing
      await new Promise((r) => setTimeout(r, 1500));
      await onTransferComplete();
    } catch {
      setPhase('error');
    }
  }, [wavInfo, targetSampleNumber, sendToDevice, onTransferComplete]);

  const handleClose = useCallback(() => {
    if (phase === 'transferring') return; // Prevent close during transfer
    onClose();
  }, [phase, onClose]);

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Send Sample to Device</DialogTitle>

      {phase === 'loading' && (
        <DialogDescription>
          Loading &ldquo;{sampleName}&rdquo; from library...
        </DialogDescription>
      )}

      {phase === 'error' && (
        <div className="space-y-3">
          <div className="p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
            {loadError || transferState.error || 'An unknown error occurred'}
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

      {phase === 'ready' && wavInfo && (
        <div className="space-y-4">
          <DialogDescription>
            Send &ldquo;{sampleName}&rdquo; to sample slot #{targetSampleNumber} on the device.
          </DialogDescription>

          <WavInfoDisplay info={wavInfo} />

          <DialogActions>
            <button
              className="ac-btn ac-btn-sm ac-btn-secondary"
              onClick={handleClose}
            >
              Cancel
            </button>
            <button
              className="ac-btn ac-btn-sm ac-btn-primary"
              onClick={handleSend}
              data-testid="send-sample-confirm"
            >
              Send
            </button>
          </DialogActions>
        </div>
      )}

      {phase === 'transferring' && (
        <div className="space-y-4">
          <SdsProgressBar
            progress={transferState.progress}
            direction="send"
          />
          <p className="text-xs text-gray-500">
            Do not disconnect the device during transfer.
          </p>
        </div>
      )}

      {phase === 'success' && (
        <div className="space-y-4">
          <div className="p-3 bg-green-900/30 border border-green-700 rounded text-green-300 text-sm">
            Sample &ldquo;{sampleName}&rdquo; sent successfully.
          </div>
          <DialogActions>
            <button
              className="ac-btn ac-btn-sm ac-btn-primary"
              onClick={handleClose}
              data-testid="send-sample-done"
            >
              Done
            </button>
          </DialogActions>
        </div>
      )}
    </Dialog>
  );
}
