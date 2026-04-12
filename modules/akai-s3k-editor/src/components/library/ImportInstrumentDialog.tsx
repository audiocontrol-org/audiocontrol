/**
 * Import Instrument Dialog — converts a common-area program (ProgramYaml)
 * to an S3K program with keygroups mapped from zones.
 *
 * Uses SteppedProgressDrawer to show all sub-operations as a live step list.
 * No intermediate approval dialogs — the initial open starts the flow:
 *
 * 1. Load program metadata from library
 * 2. Send each missing sample to device (if available)
 * 3. Create program + keygroups on device
 * 4. Verify / report result
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import {
  loadProgramMeta,
  loadProgramFromProgramsDir,
  getProgramDirFromProgramsDir,
} from '@audiocontrol/sampler-library/browser';
// ProgramYaml used internally by loadProgramMeta return type
import type { S3000xlClientInterface } from '@audiocontrol/sampler-devices/s3k';
import { SteppedProgressDrawer, type ProgressStep } from '@audiocontrol/editor-core';
import { parseWavFile } from '@/lib/wav-reader';
import {
  importInstrumentToDevice,
  resolveZoneSamples,
} from '@/lib/program-import';

// =========================================================================
// Types
// =========================================================================

export interface ImportInstrumentDialogProps {
  open: boolean;
  onClose: () => void;
  programDirName: string;
  programPath: string[];
  fromProgramsDir?: boolean;
  client: S3000xlClientInterface;
  libraryRoot: StorageDirectoryHandle;
  deviceSampleNames: string[];
  onImportComplete: () => Promise<void>;
}

// =========================================================================
// Helpers
// =========================================================================

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// =========================================================================
// Component
// =========================================================================

export function ImportInstrumentDialog({
  open,
  onClose,
  programDirName,
  programPath,
  fromProgramsDir,
  client,
  libraryRoot,
  deviceSampleNames,
  onImportComplete,
}: ImportInstrumentDialogProps): JSX.Element {
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [summary, setSummary] = useState<string | undefined>();
  const cancelledRef = useRef(false);

  // Helper to update a single step
  const updateStep = useCallback((id: string, update: Partial<ProgressStep>) => {
    setSteps((prev) => prev.map((s) => s.id === id ? { ...s, ...update } : s));
  }, []);

  // Run the entire import flow when dialog opens
  useEffect(() => {
    if (!open) return;

    cancelledRef.current = false;
    setIsComplete(false);
    setHasError(false);
    setSummary(undefined);

    // Start with the loading step
    setSteps([
      { id: 'load', label: `Load "${programDirName.trim()}"`, status: 'active' },
    ]);

    void (async () => {
      try {
        // Step 1: Load program metadata
        const meta = fromProgramsDir
          ? await loadProgramFromProgramsDir(libraryRoot, programDirName)
          : await loadProgramMeta(libraryRoot, programDirName, programPath);

        if (cancelledRef.current) return;

        const { resolved, missing } = resolveZoneSamples(meta.zones, deviceSampleNames);
        const missingSamples = [...new Set(missing.map((s) => s.replace(/\.wav$/i, '')))];

        updateStep('load', {
          status: 'complete',
          detail: `${meta.zones.length} zones, ${resolved.size} samples on device`,
        });

        // Build the full step list now that we know what's needed
        const sampleSteps: ProgressStep[] = [];
        if (missingSamples.length > 0 && fromProgramsDir) {
          for (const name of missingSamples) {
            sampleSteps.push({ id: `sample-${name}`, label: `Send sample "${name}"`, status: 'pending' });
          }
        } else if (missingSamples.length > 0) {
          // Can't send samples — warn but continue
          updateStep('load', {
            status: 'complete',
            detail: `${meta.zones.length} zones, ${resolved.size} on device, ${missingSamples.length} missing (will skip)`,
          });
        }

        setSteps((prev) => [
          ...prev,
          ...sampleSteps,
          { id: 'import', label: `Create program (${meta.zones.length} keygroups)`, status: 'pending' },
        ]);

        // Step 2: Send missing samples
        let updatedDeviceSampleNames = [...deviceSampleNames];
        if (missingSamples.length > 0 && fromProgramsDir) {
          try {
            const programDir = await getProgramDirFromProgramsDir(libraryRoot, programDirName);
            const samplesDir = await programDir.getDirectoryHandle('samples');
            let nextSampleNumber = updatedDeviceSampleNames.length;

            for (const baseName of missingSamples) {
              if (cancelledRef.current) return;
              const stepId = `sample-${baseName}`;

              try {
                updateStep(stepId, { status: 'active' });

                const wavHandle = await samplesDir.getFileHandle(`${baseName}.wav`);
                const wavFile = await wavHandle.getFile();
                const wavBuffer = await wavFile.arrayBuffer();
                const wavInfo = parseWavFile(wavBuffer);

                if (wavInfo.sampleRate <= 0) {
                  throw new Error(`Invalid sample rate (${wavInfo.sampleRate})`);
                }

                const totalBytes = wavInfo.samples.length * 2;

                await client.sendSampleViaSds(
                  nextSampleNumber, wavInfo.samples, wavInfo.sampleRate,
                  {
                    name: baseName,
                    onProgress: (progress) => {
                      const pct = progress.packetsTotal > 0
                        ? Math.round((progress.packetsSent / progress.packetsTotal) * 100)
                        : 0;
                      updateStep(stepId, {
                        progress: pct,
                        detail: `${formatBytes(pct * totalBytes / 100)} / ${formatBytes(totalBytes)}`,
                      });
                    },
                  },
                );

                updatedDeviceSampleNames.push(baseName);
                nextSampleNumber++;
                updateStep(stepId, { status: 'complete', detail: formatBytes(totalBytes), progress: undefined });
                // Refresh device memory view so the new sample appears immediately
                void onImportComplete();
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`[ImportInstrument] Failed to send sample "${baseName}":`, err);
                updateStep(stepId, { status: 'failed', error: msg, progress: undefined });
                // Continue with remaining samples
              }
            }
          } catch (err) {
            console.warn('[ImportInstrument] Could not read program samples directory:', err);
          }
        }

        if (cancelledRef.current) return;

        // Step 3: Create program on device
        updateStep('import', { status: 'active' });

        const importResult = await importInstrumentToDevice({
          client,
          program: meta,
          deviceSampleNames: updatedDeviceSampleNames,
          onProgress: (progress) => {
            updateStep('import', { detail: progress.stepLabel });
          },
        });

        updateStep('import', {
          status: 'complete',
          detail: `${importResult.programName} (#${importResult.programIndex}), ${importResult.keygroupsCreated} keygroups`,
        });

        const skippedCount = importResult.missingSamples.length;
        setSummary(
          skippedCount > 0
            ? `Imported successfully. ${skippedCount} zone${skippedCount !== 1 ? 's' : ''} skipped (missing samples).`
            : 'Imported successfully.',
        );
        setIsComplete(true);
        await onImportComplete();

      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[ImportInstrument] Failed:`, err);

        const isNotFound = err instanceof DOMException && err.name === 'NotFoundError';
        const userMessage = isNotFound
          ? `Program "${programDirName.trim()}" not found in library.`
          : message;

        // Mark the first active or pending step as failed
        setSteps((prev) => {
          const updated = [...prev];
          const activeIdx = updated.findIndex((s) => s.status === 'active' || s.status === 'pending');
          if (activeIdx >= 0) {
            updated[activeIdx] = { ...updated[activeIdx], status: 'failed', error: userMessage };
          }
          return updated;
        });
        setHasError(true);
      }
    })();

    return () => { cancelledRef.current = true; };
  }, [open, libraryRoot, programDirName, programPath, fromProgramsDir, deviceSampleNames, client, onImportComplete, updateStep]);

  return (
    <SteppedProgressDrawer
      open={open}
      title={`Import "${programDirName.trim()}" to Device`}
      onClose={onClose}
      onCancel={() => { cancelledRef.current = true; }}
      steps={steps}
      isComplete={isComplete}
      hasError={hasError}
      summary={summary}
    />
  );
}
