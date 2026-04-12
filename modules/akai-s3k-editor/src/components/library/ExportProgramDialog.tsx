/**
 * Export Program Dialog — saves a complete program from the device to the library.
 *
 * Uses SteppedProgressDrawer for a continuous flow:
 * 1. Read program header from device
 * 2. Read keygroup headers
 * 3. Save program to library (S3K or common area)
 * 4. Receive each referenced sample via SDS
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import type { S3000xlClientInterface } from '@audiocontrol/sampler-devices/s3k';
import { SteppedProgressDrawer, type ProgressStep } from '@audiocontrol/editor-core';
import { serializeProgram, extractSampleReferences } from '@/lib/program-serialization';
import { saveProgramToLibrary, saveProgramSample } from '@/lib/program-storage';
import { saveDeviceProgramToCommonArea } from '@/lib/program-promotion';
import { buildWavFile } from '@/lib/wav-writer';

// =========================================================================
// Types
// =========================================================================

export interface ExportProgramDialogProps {
  open: boolean;
  onClose: () => void;
  programIndex: number;
  programName: string;
  client: S3000xlClientInterface;
  libraryRoot: StorageDirectoryHandle;
  deviceSampleNames: string[];
  onExportComplete: () => Promise<void>;
  autoStart?: boolean;
  saveToCommonArea?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// =========================================================================
// Component
// =========================================================================

export function ExportProgramDialog({
  open,
  onClose,
  programIndex,
  programName,
  client,
  libraryRoot,
  deviceSampleNames,
  onExportComplete,
  saveToCommonArea,
}: ExportProgramDialogProps): JSX.Element {
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

    const trimmedName = programName.trim();
    const target = saveToCommonArea ? 'common library' : 'Akai library';

    setSteps([
      { id: 'header', label: 'Read program header', status: 'active' },
    ]);

    void (async () => {
      try {
        // Step 1: Fetch program header
        const programHeader = await client.fetchProgramHeader(programIndex);
        const groups = programHeader.GROUPS;

        updateStep('header', { status: 'complete', detail: `${groups} keygroups` });

        // Step 2: Fetch keygroup headers
        setSteps((prev) => [
          ...prev,
          { id: 'keygroups', label: `Read ${groups} keygroup headers`, status: 'active' },
        ]);

        const keygroupHeaders = [];
        for (let i = 0; i < groups; i++) {
          if (cancelledRef.current) return;
          updateStep('keygroups', { detail: `${i + 1} / ${groups}`, progress: Math.round(((i + 1) / groups) * 100) });
          const kg = await client.fetchKeygroupHeader(programIndex, i);
          keygroupHeaders.push(kg);
        }

        updateStep('keygroups', { status: 'complete', detail: `${groups} keygroups read`, progress: undefined });

        // Step 3: Save program to library
        setSteps((prev) => [
          ...prev,
          { id: 'save', label: `Save program to ${target}`, status: 'active' },
        ]);

        let programDir: StorageDirectoryHandle | undefined;
        if (saveToCommonArea) {
          const poly = (programHeader as unknown as Record<string, unknown>).POLY;
          const result = await saveDeviceProgramToCommonArea(
            libraryRoot, trimmedName,
            keygroupHeaders as unknown as Record<string, unknown>[],
            typeof poly === 'number' ? poly : 15,
          );
          programDir = result.programDir;
        } else {
          const yamlContent = serializeProgram(programHeader, keygroupHeaders);
          await saveProgramToLibrary(libraryRoot, trimmedName, yamlContent);
        }

        updateStep('save', { status: 'complete', detail: `Saved as "${trimmedName}"` });

        if (cancelledRef.current) return;

        // Step 4: Receive referenced samples via SDS
        const sampleRefs = extractSampleReferences(keygroupHeaders);
        const uniqueSamples = sampleRefs.filter((name) =>
          deviceSampleNames.some((dn) => dn.trim() === name),
        );

        // Add sample steps
        const sampleSteps: ProgressStep[] = uniqueSamples.map((name) => ({
          id: `sample-${name}`,
          label: `Receive sample "${name}"`,
          status: 'pending' as const,
        }));
        if (sampleSteps.length > 0) {
          setSteps((prev) => [...prev, ...sampleSteps]);
        }

        for (let i = 0; i < uniqueSamples.length; i++) {
          if (cancelledRef.current) return;

          const sampleName = uniqueSamples[i];
          const stepId = `sample-${sampleName}`;
          const sampleIndex = deviceSampleNames.findIndex((dn) => dn.trim() === sampleName);

          updateStep(stepId, { status: 'active' });

          try {
            const result = await client.receiveSampleViaSds(
              sampleIndex,
              (sdsProgress) => {
                const pct = sdsProgress.packetsTotal > 0
                  ? Math.round((sdsProgress.packetsSent / sdsProgress.packetsTotal) * 100)
                  : 0;
                updateStep(stepId, { progress: pct });
              },
            );

            const sampleRate = Math.round(1_000_000_000 / result.header.samplePeriodNs);
            const wavData = buildWavFile(result.samples, sampleRate);

            if (saveToCommonArea && programDir) {
              const safeSampleName = `${sampleName.trim().replace(/\s+/g, '_')}.wav`;
              const wavHandle = await programDir.getFileHandle(safeSampleName, { create: true });
              const writable = await wavHandle.createWritable();
              await writable.write(wavData);
              await writable.close();
            } else {
              await saveProgramSample(libraryRoot, trimmedName, sampleName, wavData);
            }

            updateStep(stepId, {
              status: 'complete',
              detail: formatBytes(wavData.byteLength),
              progress: undefined,
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[ExportProgram] Failed to receive sample "${sampleName}":`, err);
            updateStep(stepId, { status: 'failed', error: msg, progress: undefined });
          }
        }

        const missing = sampleRefs.filter((name) =>
          !deviceSampleNames.some((dn) => dn.trim() === name),
        );

        setSummary(
          missing.length > 0
            ? `Saved to ${target}. ${missing.length} referenced sample${missing.length !== 1 ? 's' : ''} not found on device.`
            : `Saved to ${target}.`,
        );
        setIsComplete(true);
        await onExportComplete();

      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[ExportProgram] Failed:', err);
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
  }, [open, programIndex, programName, client, libraryRoot, deviceSampleNames, saveToCommonArea, onExportComplete, updateStep]);

  return (
    <SteppedProgressDrawer
      open={open}
      title={`Save "${programName.trim()}" to Library`}
      onClose={onClose}
      onCancel={() => { cancelledRef.current = true; }}
      steps={steps}
      isComplete={isComplete}
      hasError={hasError}
      summary={summary}
    />
  );
}
