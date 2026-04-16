/**
 * Receive Sample Dialog — transfers a sample from the device to the library.
 *
 * Uses SteppedProgressDrawer:
 * 1. Receive via SDS with progress (bar, bytes, elapsed, ETA)
 * 2. Build WAV from PCM data
 * 3. Save to library storage
 *
 * Cancel aborts the SDS transfer via AbortController.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import { saveSample, type SampleYaml } from '@audiocontrol/sampler-library/browser';
import type { S3000xlClientInterface } from '@audiocontrol/sampler-devices/s3k';
import { SteppedProgressDrawer, type ProgressStep, formatBytes } from '@audiocontrol/editor-core';
import { useSampleTransfer, type SdsReceiveResult } from '@/hooks/useSampleTransfer';
import { buildWavFile } from '@/lib/wav-writer';

// =========================================================================
// Types
// =========================================================================

export interface ReceiveSampleDialogProps {
  open: boolean;
  onClose: () => void;
  sampleIndex: number;
  sampleName: string;
  client: S3000xlClientInterface;
  libraryRoot: StorageDirectoryHandle;
  onTransferComplete: () => Promise<void>;
  autoStart?: boolean;
}

// =========================================================================
// Helpers
// =========================================================================

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

function formatProgress(bytesSent: number, bytesTotal: number, startTime: number): string {
  const bytes = `${formatBytes(bytesSent)} / ${formatBytes(bytesTotal)}`;
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const bytesPerSec = elapsed > 0 ? bytesSent / elapsed : 0;
  const remaining = bytesPerSec > 0 ? Math.round((bytesTotal - bytesSent) / bytesPerSec) : 0;
  const elapsedStr = elapsed > 0 ? `${elapsed}s elapsed` : '';
  const etaStr = remaining > 0 ? `~${remaining}s remaining` : '';
  const timeStr = [elapsedStr, etaStr].filter(Boolean).join(' \u2022 ');
  return timeStr ? `${bytes} \u2022 ${timeStr}` : bytes;
}

// =========================================================================
// Component
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
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [summary, setSummary] = useState<string | undefined>();
  const abortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);
  const hasStartedRef = useRef(false);

  const { receiveFromDevice, transferState } = useSampleTransfer(client);

  const updateStep = useCallback((id: string, update: Partial<ProgressStep>) => {
    setSteps((prev) => prev.map((s) => s.id === id ? { ...s, ...update } : s));
  }, []);

  // Pipe SDS transfer progress into the receive step
  useEffect(() => {
    if (!transferState.progress || !transferState.isTransferring) return;
    const { bytesSent, bytesTotal } = transferState.progress;
    const pct = bytesTotal > 0 ? Math.round((bytesSent / bytesTotal) * 100) : undefined;
    updateStep('receive', {
      progress: pct,
      detail: formatProgress(bytesSent, bytesTotal, startTimeRef.current),
    });
  }, [transferState.progress, transferState.isTransferring, updateStep]);

  useEffect(() => {
    if (!open) {
      hasStartedRef.current = false;
      return;
    }
    // Only start the transfer once per open — don't restart on dep changes
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const abortController = new AbortController();
    abortRef.current = abortController;
    startTimeRef.current = Date.now();
    setIsComplete(false);
    setHasError(false);
    setSummary(undefined);

    const trimmedName = sampleName.trim();

    setSteps([
      { id: 'receive', label: `Receive "${trimmedName}" from device`, status: 'active' },
      { id: 'save', label: 'Save to library', status: 'pending' },
    ]);

    void (async () => {
      try {
        // Step 1: Receive via SDS
        const result = await receiveFromDevice(sampleIndex, abortController.signal);
        if (!result || abortController.signal.aborted) return;

        const sampleRate = Math.round(1_000_000_000 / result.header.samplePeriodNs);
        const pcmBytes = result.samples.length * 2;
        const durationStr = `${(result.samples.length / sampleRate).toFixed(2)}s`;

        updateStep('receive', {
          status: 'complete',
          progress: 100,
          detail: `${sampleRate} Hz, ${durationStr}, ${formatBytes(pcmBytes)}`,
        });

        // Step 2: Build WAV and save to library
        updateStep('save', { status: 'active' });

        const wavBuffer = buildWavFile(result.samples, sampleRate);
        const yaml = makeSampleYaml(trimmedName, sampleRate, result);

        await saveSample(libraryRoot, {
          name: trimmedName,
          yaml,
          wavData: wavBuffer,
        });

        updateStep('save', { status: 'complete', detail: `Saved as "${trimmedName}"` });
        setSummary(`Sample "${trimmedName}" saved to library.`);
        setIsComplete(true);
        await onTransferComplete();

      } catch (err: unknown) {
        if (abortController.signal.aborted) return;
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[ReceiveSample] Failed:`, err);
        setSteps((prev) => {
          const updated = [...prev];
          const idx = updated.findIndex((s) => s.status === 'active' || s.status === 'pending');
          if (idx >= 0) {
            updated[idx] = { ...updated[idx], status: 'failed', error: message };
          }
          return updated;
        });
        setHasError(true);
      }
    })();

    // No cleanup abort — transfer runs to completion or is explicitly cancelled.
    // The hasStartedRef guard prevents re-running on dep changes.
  }, [open, sampleIndex, sampleName, client, libraryRoot, onTransferComplete, receiveFromDevice, updateStep]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    onClose();
  }, [onClose]);

  return (
    <SteppedProgressDrawer
      open={open}
      title={`Save "${sampleName.trim()}" to Library`}
      onClose={isComplete || hasError ? onClose : handleCancel}
      onCancel={handleCancel}
      steps={steps}
      isComplete={isComplete}
      hasError={hasError}
      summary={summary}
    />
  );
}
