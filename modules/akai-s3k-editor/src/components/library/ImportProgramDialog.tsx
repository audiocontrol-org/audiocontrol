/**
 * Import Program Dialog — restores a program from the library to the device.
 *
 * Reads a serialized S3000XL program (YAML) from library storage,
 * patches the raw SysEx data for the target program slot, and writes
 * the program header and keygroup headers to the device.
 *
 * Flow:
 * 1. Load and parse the program YAML from library
 * 2. Show program info (name, keygroup count, sample references)
 * 3. Optionally warn about missing samples on device
 * 4. Write program header to device
 * 5. Write each keygroup header (with progress)
 * 6. Report success/error
 */

import { useState, useCallback, useEffect } from 'react';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import type {
  S3000xlClientInterface,
  ProgramHeader,
  KeygroupHeader,
} from '@audiocontrol/sampler-devices/s3k';
import { Dialog, DialogTitle, DialogDescription, DialogActions } from '@/components/ui/Dialog';
import {
  deserializeProgram,
  decodeSerializedRaw,
  type SerializedProgram,
} from '@/lib/program-serialization';
import { loadProgramFromLibrary } from '@/lib/program-storage';
import { cn } from '@/lib/utils';

// =========================================================================
// Types
// =========================================================================

export interface ImportProgramDialogProps {
  open: boolean;
  onClose: () => void;
  /** Library program directory name to load */
  programDirName: string;
  /** Human-readable program name (from listing, shown during loading) */
  programName: string;
  /** Target program slot on the device (0-based index) */
  targetProgramIndex: number;
  client: S3000xlClientInterface;
  libraryRoot: StorageDirectoryHandle;
  /** Device sample names for checking references */
  deviceSampleNames: string[];
  /** Called after successful import to refresh device state */
  onImportComplete: () => Promise<void>;
}

type DialogPhase = 'loading' | 'confirm' | 'writing' | 'success' | 'error';

// =========================================================================
// Raw byte patching
// =========================================================================

/**
 * Indices into the raw SysEx response for the program number.
 * Response format: [F0, 47, ch, opcode, 48, PNUM_lo, PNUM_hi, ...data, F7]
 */
const PNUMBER_LO_INDEX = 5;
const PNUMBER_HI_INDEX = 6;
const KNUMBER_RAW_INDEX = 7;

/** Split a byte into [lowNibble, highNibble] (little-endian). */
function byte2nibblesLE(byte: number): [number, number] {
  return [byte & 0x0f, (byte >> 4) & 0x0f];
}

/**
 * Patch the program number in raw SysEx bytes.
 */
function patchProgramNumber(raw: number[], programNumber: number): number[] {
  const patched = [...raw];
  const [lo, hi] = byte2nibblesLE(programNumber);
  patched[PNUMBER_LO_INDEX] = lo;
  patched[PNUMBER_HI_INDEX] = hi;
  return patched;
}

/**
 * Patch the keygroup number in raw SysEx bytes.
 */
function patchKeygroupNumber(raw: number[], keygroupNumber: number): number[] {
  const patched = [...raw];
  patched[KNUMBER_RAW_INDEX] = keygroupNumber;
  return patched;
}

// =========================================================================
// Progress display
// =========================================================================

function ProgressBar({ current, total, label }: {
  current: number;
  total: number;
  label: string;
}): JSX.Element {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-300">{label}</p>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 text-right">{pct}%</p>
    </div>
  );
}

// =========================================================================
// Sample reference check
// =========================================================================

function MissingSamplesWarning({ missing }: { missing: string[] }): JSX.Element {
  return (
    <div className="p-3 bg-yellow-900/30 border border-yellow-700 rounded text-sm space-y-2">
      <p className="text-yellow-300 font-medium">Missing samples on device</p>
      <p className="text-yellow-400/80 text-xs">
        These samples are referenced by the program but are not currently
        loaded on the device. The program will import, but zones referencing
        these samples will be silent until the samples are loaded.
      </p>
      <ul className="text-yellow-400/70 text-xs space-y-0.5">
        {missing.map((name) => (
          <li key={name}>&bull; {name}</li>
        ))}
      </ul>
    </div>
  );
}

// =========================================================================
// Dialog
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
  const [phase, setPhase] = useState<DialogPhase>('loading');
  const [serialized, setSerialized] = useState<SerializedProgram | null>(null);
  const [missingSamples, setMissingSamples] = useState<string[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Use serialized.name when available, fall back to the prop for loading
  const displayName = serialized?.name ?? programName;

  // Load program data when dialog opens
  useEffect(() => {
    if (!open) return;

    setSerialized(null);
    setMissingSamples([]);
    setProgress({ current: 0, total: 0, label: '' });
    setErrorMessage(null);
    setPhase('loading');

    void (async () => {
      try {
        const yaml = await loadProgramFromLibrary(libraryRoot, programDirName);
        const program = deserializeProgram(yaml);
        setSerialized(program);

        // Check which referenced samples are missing from device
        const deviceNames = new Set(
          deviceSampleNames.map((n) => n.trim()),
        );
        const missing = program.sampleReferences.filter(
          (ref) => !deviceNames.has(ref.trim()),
        );
        setMissingSamples(missing);
        setPhase('confirm');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setErrorMessage(message);
        setPhase('error');
      }
    })();
  }, [open, programDirName, libraryRoot, deviceSampleNames]);

  const handleImport = useCallback(async () => {
    if (!serialized) return;

    setPhase('writing');
    setErrorMessage(null);

    try {
      const decoded = decodeSerializedRaw(serialized);
      const totalSteps = 1 + decoded.keygroupsRaw.length;

      // Step 1: Write program header
      setProgress({
        current: 0,
        total: totalSteps,
        label: 'Writing program header...',
      });

      const patchedProgramRaw = patchProgramNumber(
        decoded.programRaw,
        targetProgramIndex,
      );
      const programHeader = { raw: patchedProgramRaw } as ProgramHeader;
      await client.writeProgramHeader(programHeader);

      // Step 2: Write each keygroup
      for (let i = 0; i < decoded.keygroupsRaw.length; i++) {
        setProgress({
          current: i + 1,
          total: totalSteps,
          label: `Writing keygroup ${i + 1} of ${decoded.keygroupsRaw.length}...`,
        });

        let patchedKgRaw = patchProgramNumber(
          decoded.keygroupsRaw[i],
          targetProgramIndex,
        );
        patchedKgRaw = patchKeygroupNumber(patchedKgRaw, i);

        const kgHeader = { raw: patchedKgRaw } as KeygroupHeader;
        await client.writeKeygroupHeader(kgHeader);
      }

      // Invalidate caches so refreshed data reflects the imported program
      client.invalidateProgramCache();
      client.invalidateKeygroupCache();

      setProgress({
        current: totalSteps,
        total: totalSteps,
        label: 'Complete',
      });
      setPhase('success');
      await onImportComplete();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
      setPhase('error');
    }
  }, [serialized, targetProgramIndex, client, onImportComplete]);

  const handleClose = useCallback(() => {
    if (phase === 'writing') return;
    onClose();
  }, [phase, onClose]);

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Send Program to Device</DialogTitle>

      {phase === 'loading' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            Loading &ldquo;{displayName}&rdquo;...
          </p>
        </div>
      )}

      {phase === 'confirm' && serialized && (
        <div className="space-y-4">
          <DialogDescription>
            Import &ldquo;{displayName}&rdquo; to program slot #{targetProgramIndex}
            on the device.
          </DialogDescription>

          <div className={cn(
            'p-3 bg-gray-700/50 border border-gray-600 rounded text-sm space-y-1',
          )}>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
              <span>{serialized.keygroupCount} keygroup{serialized.keygroupCount !== 1 ? 's' : ''}</span>
              <span>{serialized.sampleReferences.length} sample{serialized.sampleReferences.length !== 1 ? 's' : ''} referenced</span>
            </div>
            {serialized.sampleReferences.length > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                Samples: {serialized.sampleReferences.join(', ')}
              </div>
            )}
          </div>

          {missingSamples.length > 0 && (
            <MissingSamplesWarning missing={missingSamples} />
          )}

          <div className="p-3 bg-orange-900/20 border border-orange-800/50 rounded text-xs text-orange-300">
            This will overwrite program #{targetProgramIndex} on the device.
          </div>

          <DialogActions>
            <button
              className="ac-btn ac-btn-sm ac-btn-secondary"
              onClick={handleClose}
            >
              Cancel
            </button>
            <button
              className="ac-btn ac-btn-sm ac-btn-primary"
              onClick={handleImport}
              data-testid="import-program-confirm"
            >
              Import
            </button>
          </DialogActions>
        </div>
      )}

      {phase === 'writing' && (
        <div className="space-y-4">
          <ProgressBar
            current={progress.current}
            total={progress.total}
            label={progress.label}
          />
          <p className="text-xs text-gray-500">
            Do not disconnect the device during transfer.
          </p>
        </div>
      )}

      {phase === 'error' && (
        <div className="space-y-3">
          <div className="p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
            {errorMessage || 'An unknown error occurred'}
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

      {phase === 'success' && serialized && (
        <div className="space-y-4">
          <div className="p-3 bg-green-900/30 border border-green-700 rounded text-green-300 text-sm">
            Program &ldquo;{displayName}&rdquo; imported to slot #{targetProgramIndex}
            ({serialized.keygroupCount} keygroup{serialized.keygroupCount !== 1 ? 's' : ''}).
          </div>
          <DialogActions>
            <button
              className="ac-btn ac-btn-sm ac-btn-primary"
              onClick={handleClose}
              data-testid="import-program-done"
            >
              Done
            </button>
          </DialogActions>
        </div>
      )}
    </Dialog>
  );
}
