/**
 * Import Program Dialog — restores an S3K program from the library to the device.
 *
 * Uses SteppedProgressDrawer:
 * 1. Load program YAML from library
 * 2. Write program header to device
 * 3. Write each keygroup header to device
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import type {
  S3000xlClientInterface,
  ProgramHeader,
  KeygroupHeader,
} from '@audiocontrol/sampler-devices/s3k';
import { SteppedProgressDrawer, type ProgressStep } from '@audiocontrol/editor-core';
import {
  deserializeProgram,
  decodeSerializedRaw,
} from '@/lib/program-serialization';
import { loadProgramFromLibrary } from '@/lib/program-storage';

// =========================================================================
// Types
// =========================================================================

export interface ImportProgramDialogProps {
  open: boolean;
  onClose: () => void;
  programDirName: string;
  programName: string;
  targetProgramIndex: number;
  client: S3000xlClientInterface;
  libraryRoot: StorageDirectoryHandle;
  deviceSampleNames: string[];
  onImportComplete: () => Promise<void>;
}

// =========================================================================
// Raw byte patching
// =========================================================================

const PNUMBER_LO_INDEX = 5;
const PNUMBER_HI_INDEX = 6;
const KNUMBER_RAW_INDEX = 7;

function byte2nibblesLE(byte: number): [number, number] {
  return [byte & 0x0f, (byte >> 4) & 0x0f];
}

function patchProgramNumber(raw: number[], programNumber: number): number[] {
  const patched = [...raw];
  const [lo, hi] = byte2nibblesLE(programNumber);
  patched[PNUMBER_LO_INDEX] = lo;
  patched[PNUMBER_HI_INDEX] = hi;
  return patched;
}

function patchKeygroupNumber(raw: number[], keygroupNumber: number): number[] {
  const patched = [...raw];
  patched[KNUMBER_RAW_INDEX] = keygroupNumber;
  return patched;
}

// =========================================================================
// Component
// =========================================================================

export function ImportProgramDialog({
  open,
  onClose,
  programDirName,
  programName,
  targetProgramIndex,
  client,
  libraryRoot,
  deviceSampleNames,
  onImportComplete,
}: ImportProgramDialogProps): JSX.Element {
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
      { id: 'load', label: `Load "${programName}"`, status: 'active' },
    ]);

    void (async () => {
      try {
        // Step 1: Load and parse program YAML
        const yaml = await loadProgramFromLibrary(libraryRoot, programDirName);
        const program = deserializeProgram(yaml);
        const decoded = decodeSerializedRaw(program);

        // Check missing samples
        const deviceNames = new Set(deviceSampleNames.map((n) => n.trim()));
        const missing = program.sampleReferences.filter((ref) => !deviceNames.has(ref.trim()));

        const kgCount = decoded.keygroupsRaw.length;
        updateStep('load', {
          status: 'complete',
          detail: `${kgCount} keygroups, ${program.sampleReferences.length} sample refs${missing.length > 0 ? ` (${missing.length} missing)` : ''}`,
        });

        if (cancelledRef.current) return;

        // Build step list for writes
        setSteps((prev) => [
          ...prev,
          { id: 'header', label: `Write program header (slot #${targetProgramIndex})`, status: 'pending' },
          { id: 'keygroups', label: `Write ${kgCount} keygroup headers`, status: 'pending' },
        ]);

        // Step 2: Write program header
        updateStep('header', { status: 'active' });

        const patchedProgramRaw = patchProgramNumber(decoded.programRaw, targetProgramIndex);
        await client.writeProgramHeader({ raw: patchedProgramRaw } as ProgramHeader);

        updateStep('header', { status: 'complete' });

        if (cancelledRef.current) return;

        // Step 3: Write each keygroup
        updateStep('keygroups', { status: 'active' });

        for (let i = 0; i < kgCount; i++) {
          if (cancelledRef.current) return;

          updateStep('keygroups', {
            detail: `${i + 1} / ${kgCount}`,
            progress: Math.round(((i + 1) / kgCount) * 100),
          });

          let patchedKgRaw = patchProgramNumber(decoded.keygroupsRaw[i], targetProgramIndex);
          patchedKgRaw = patchKeygroupNumber(patchedKgRaw, i);
          await client.writeKeygroupHeader({ raw: patchedKgRaw } as KeygroupHeader);
        }

        client.invalidateProgramCache();
        client.invalidateKeygroupCache();

        updateStep('keygroups', { status: 'complete', detail: `${kgCount} keygroups written`, progress: undefined });

        setSummary(
          missing.length > 0
            ? `Program sent to slot #${targetProgramIndex}. ${missing.length} referenced sample${missing.length !== 1 ? 's' : ''} missing on device.`
            : `Program sent to slot #${targetProgramIndex}.`,
        );
        setIsComplete(true);
        await onImportComplete();

      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[ImportProgram] Failed:', err);
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
  }, [open, programDirName, programName, targetProgramIndex, client, libraryRoot, deviceSampleNames, onImportComplete, updateStep]);

  return (
    <SteppedProgressDrawer
      open={open}
      title={`Send "${programName}" to Device`}
      onClose={onClose}
      onCancel={() => { cancelledRef.current = true; }}
      steps={steps}
      isComplete={isComplete}
      hasError={hasError}
      summary={summary}
    />
  );
}
