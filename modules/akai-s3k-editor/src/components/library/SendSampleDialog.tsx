/**
 * Send Sample Dialog — transfers a WAV sample from the library to the device.
 *
 * Uses SteppedProgressDrawer:
 * 1. Load sample from library + query device sample count
 * 2. Send via SDS with progress
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import { loadSample } from '@audiocontrol/sampler-library/browser';
import type { S3000xlClientInterface } from '@audiocontrol/sampler-devices/s3k';
import { SteppedProgressDrawer, type ProgressStep, formatBytes } from '@audiocontrol/editor-core';
import { parseWavFile } from '@/lib/wav-reader';

// =========================================================================
// Types
// =========================================================================

export interface SendSampleDialogProps {
  open: boolean;
  onClose: () => void;
  sampleName: string;
  samplePath: string[];
  client: S3000xlClientInterface;
  libraryRoot: StorageDirectoryHandle;
  deviceSampleCount: number;
  onTransferComplete: () => Promise<void>;
}

// =========================================================================
// Component
// =========================================================================

export function SendSampleDialog({
  open,
  onClose,
  sampleName,
  samplePath,
  client,
  libraryRoot,
  onTransferComplete,
}: SendSampleDialogProps): JSX.Element {
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [summary, setSummary] = useState<string | undefined>();
  const cancelledRef = useRef(false);

  const updateStep = useCallback((id: string, update: Partial<ProgressStep>) => {
    setSteps((prev) => prev.map((s) => s.id === id ? { ...s, ...update } : s));
  }, []);

  useEffect(() => {
    if (!open) return;

    cancelledRef.current = false;
    setIsComplete(false);
    setHasError(false);
    setSummary(undefined);

    setSteps([
      { id: 'load', label: `Load "${sampleName}"`, status: 'active' },
      { id: 'send', label: 'Send to device', status: 'pending' },
    ]);

    void (async () => {
      try {
        // Step 1: Load WAV and get fresh device sample count
        const [result, sampleNames] = await Promise.all([
          loadSample(libraryRoot, sampleName, samplePath),
          client.refreshSampleNames(),
        ]);
        if (cancelledRef.current) return;

        const wavInfo = parseWavFile(result.wavData);
        const targetSlot = sampleNames.length;
        const sizeStr = formatBytes(wavInfo.samples.length * 2);
        const durationStr = `${(wavInfo.numSamples / wavInfo.sampleRate).toFixed(2)}s`;

        updateStep('load', {
          status: 'complete',
          detail: `${wavInfo.sampleRate} Hz, ${durationStr}, ${sizeStr}`,
        });

        if (cancelledRef.current) return;

        // Step 2: Send via SDS
        updateStep('send', { status: 'active', label: `Send to device (slot #${targetSlot})` });

        const totalSampleBytes = wavInfo.samples.length * 2;
        await client.sendSampleViaSds(targetSlot, wavInfo.samples, wavInfo.sampleRate, {
          name: sampleName,
          onProgress: (sdsProgress) => {
            const pct = sdsProgress.packetsTotal > 0
              ? Math.round((sdsProgress.packetsSent / sdsProgress.packetsTotal) * 100)
              : 0;
            const transferred = Math.round(totalSampleBytes * pct / 100);
            updateStep('send', { progress: pct, detail: `${formatBytes(transferred)} / ${formatBytes(totalSampleBytes)}` });
          },
        });

        if (cancelledRef.current) return;

        updateStep('send', { status: 'complete', detail: `Sent as slot #${targetSlot}`, progress: undefined });
        setSummary(`Sample "${sampleName}" sent to device.`);
        setIsComplete(true);
        await onTransferComplete();

      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[SendSample] Failed:`, err);
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

    return () => { cancelledRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, libraryRoot, sampleName, samplePath, client]);

  return (
    <SteppedProgressDrawer
      open={open}
      title={`Send "${sampleName}" to Device`}
      onClose={onClose}
      onCancel={() => { cancelledRef.current = true; }}
      steps={steps}
      isComplete={isComplete}
      hasError={hasError}
      summary={summary}
    />
  );
}
