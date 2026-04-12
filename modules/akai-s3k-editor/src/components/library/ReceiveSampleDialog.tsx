/**
 * Receive Sample Dialog — transfers a sample from the device to the library.
 *
 * Uses SteppedProgressDrawer:
 * 1. Receive via SDS with progress
 * 2. Build WAV from PCM data
 * 3. Save to library storage
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
  const cancelledRef = useRef(false);

  const { receiveFromDevice } = useSampleTransfer(client);

  const updateStep = useCallback((id: string, update: Partial<ProgressStep>) => {
    setSteps((prev) => prev.map((s) => s.id === id ? { ...s, ...update } : s));
  }, []);

  useEffect(() => {
    if (!open) return;

    cancelledRef.current = false;
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
        const result = await receiveFromDevice(sampleIndex);
        if (!result) {
          throw new Error('Receive failed — no data returned');
        }
        if (cancelledRef.current) return;

        const sampleRate = Math.round(1_000_000_000 / result.header.samplePeriodNs);
        const pcmBytes = result.samples.length * 2;
        const durationStr = `${(result.samples.length / sampleRate).toFixed(2)}s`;

        updateStep('receive', {
          status: 'complete',
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

    return () => { cancelledRef.current = true; };
  }, [open, sampleIndex, sampleName, client, libraryRoot, onTransferComplete, receiveFromDevice, updateStep]);

  return (
    <SteppedProgressDrawer
      open={open}
      title={`Save "${sampleName.trim()}" to Library`}
      onClose={onClose}
      onCancel={() => { cancelledRef.current = true; }}
      steps={steps}
      isComplete={isComplete}
      hasError={hasError}
      summary={summary}
    />
  );
}
