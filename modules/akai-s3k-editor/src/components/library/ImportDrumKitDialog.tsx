/**
 * Import Drum Kit Dialog — transfers a chopped sample from the library
 * to the device as an S3000XL program with one keygroup per slice.
 *
 * Uses SteppedProgressDrawer:
 * 1. Load sample metadata (slice count, base note)
 * 2. Send each slice as a separate SDS sample
 * 3. Create program + keygroups on device
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import { loadSampleMeta } from '@audiocontrol/sampler-library/browser';
import type { S3000xlClientInterface } from '@audiocontrol/sampler-devices/s3k';
import { SteppedProgressDrawer, type ProgressStep } from '@audiocontrol/editor-core';
import {
  importDrumKitToDevice,
  type DrumKitImportProgress,
} from '@/lib/drumkit-import';

// =========================================================================
// Types
// =========================================================================

export interface ImportDrumKitDialogProps {
  open: boolean;
  onClose: () => void;
  sampleName: string;
  samplePath: string[];
  client: S3000xlClientInterface;
  libraryRoot: StorageDirectoryHandle;
  onImportComplete: () => Promise<void>;
}

// =========================================================================
// Component
// =========================================================================

export function ImportDrumKitDialog({
  open,
  onClose,
  sampleName,
  samplePath,
  client,
  libraryRoot,
  onImportComplete,
}: ImportDrumKitDialogProps): JSX.Element {
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [summary, setSummary] = useState<string | undefined>();
  const cancelledRef = useRef(false);
  const onImportCompleteRef = useRef(onImportComplete);
  onImportCompleteRef.current = onImportComplete;

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
    ]);

    void (async () => {
      try {
        // Step 1: Load metadata
        const meta = await loadSampleMeta(libraryRoot, sampleName, samplePath);
        if (cancelledRef.current) return;

        if (!meta.slices || meta.slices.length === 0) {
          throw new Error('This sample has no slices defined');
        }

        const sliceCount = meta.slices.length;
        updateStep('load', {
          status: 'complete',
          detail: `${sliceCount} slices, ${meta.sampleRate} Hz`,
        });

        // Build step list for the import
        setSteps((prev) => [
          ...prev,
          ...meta.slices!.map((slice, i) => ({
            id: `slice-${i}`,
            label: `Send slice "${slice.label || `Slice ${i + 1}`}"`,
            status: 'pending' as const,
          })),
          { id: 'program', label: 'Create program + keygroups', status: 'pending' },
        ]);

        if (cancelledRef.current) return;

        // Step 2+3: Import (sends slices + creates program)
        // Track progress by mapping the import's phases to our steps
        let lastPhase: DrumKitImportProgress['phase'] | null = null;
        let currentSliceIndex = -1;

        const importResult = await importDrumKitToDevice({
          client,
          libraryRoot,
          sampleName,
          samplePath,
          onProgress: (progress) => {
            if (progress.phase === 'sending-samples') {
              // Mark slice steps as active/complete
              const sliceIdx = progress.currentStep - 1;
              if (sliceIdx !== currentSliceIndex) {
                // Complete previous slice
                if (currentSliceIndex >= 0) {
                  updateStep(`slice-${currentSliceIndex}`, { status: 'complete', progress: undefined });
                  // Refresh device after each sample
                  void onImportCompleteRef.current();
                }
                currentSliceIndex = sliceIdx;
                updateStep(`slice-${sliceIdx}`, { status: 'active' });
              }
              // Update SDS progress within current slice
              if (progress.sdsProgress) {
                const pct = progress.sdsProgress.packetsTotal > 0
                  ? Math.round((progress.sdsProgress.packetsSent / progress.sdsProgress.packetsTotal) * 100)
                  : 0;
                updateStep(`slice-${sliceIdx}`, { progress: pct });
              }
            } else if (progress.phase === 'creating-program' || progress.phase === 'creating-keygroups') {
              // Complete last slice if transitioning from sending
              if (lastPhase === 'sending-samples' && currentSliceIndex >= 0) {
                updateStep(`slice-${currentSliceIndex}`, { status: 'complete', progress: undefined });
              }
              updateStep('program', { status: 'active', detail: progress.stepLabel });
            }
            lastPhase = progress.phase;
          },
        });

        // Complete remaining steps
        if (currentSliceIndex >= 0) {
          updateStep(`slice-${currentSliceIndex}`, { status: 'complete', progress: undefined });
        }
        updateStep('program', {
          status: 'complete',
          detail: `${importResult.programName} (#${importResult.programIndex}), ${importResult.keygroupCount} keygroups`,
        });

        setSummary(`Drum kit imported: ${importResult.sampleCount} samples, ${importResult.keygroupCount} keygroups.`);
        setIsComplete(true);
        await onImportCompleteRef.current();

      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[ImportDrumKit] Failed:', err);
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
      title={`Import "${sampleName}" as Drum Program`}
      onClose={onClose}
      onCancel={() => { cancelledRef.current = true; }}
      steps={steps}
      isComplete={isComplete}
      hasError={hasError}
      summary={summary}
    />
  );
}
