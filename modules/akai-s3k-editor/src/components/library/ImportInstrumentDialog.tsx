/**
 * Import Instrument Dialog — converts a common-area program (ProgramYaml)
 * to an S3K program with keygroups mapped from zones.
 *
 * Flow:
 * 1. Load ProgramYaml metadata from library storage
 * 2. Resolve zone sample references against device samples
 * 3. Show program info, zone mapping, and missing sample warnings
 * 4. Create program + keygroups on device (with progress)
 * 5. Report success/error
 *
 * This handles the device-agnostic format (program.yaml with zones).
 * For S3K-specific programs (program.s3k.yaml), see ImportProgramDialog.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import { loadProgramMeta, loadProgramFromProgramsDir } from '@audiocontrol/sampler-library/browser';
import type { ProgramYaml } from '@audiocontrol/sampler-library/browser';
import type { S3000xlClientInterface } from '@audiocontrol/sampler-devices/s3k';
import { Dialog, DialogTitle, DialogDescription, DialogActions } from '@/components/ui/Dialog';
import {
  importInstrumentToDevice,
  resolveZoneSamples,
  type InstrumentImportProgress,
  type InstrumentImportResult,
} from '@/lib/program-import';

// =========================================================================
// Types
// =========================================================================

export interface ImportInstrumentDialogProps {
  open: boolean;
  onClose: () => void;
  /** Directory name of the program bundle in the library */
  programDirName: string;
  /** Path within the samples directory */
  programPath: string[];
  /** If true, load from library/common/programs/ instead of library/common/samples/ */
  fromProgramsDir?: boolean;
  client: S3000xlClientInterface;
  libraryRoot: StorageDirectoryHandle;
  /** Current sample names on the device */
  deviceSampleNames: string[];
  /** Called after successful import to refresh device state */
  onImportComplete: () => Promise<void>;
}

type DialogPhase = 'loading' | 'confirm' | 'importing' | 'success' | 'error';

// =========================================================================
// Progress display
// =========================================================================

function ProgressBar({
  progress,
}: {
  progress: InstrumentImportProgress;
}): JSX.Element {
  const phaseLabels: Record<InstrumentImportProgress['phase'], string> = {
    'resolving': 'Resolving samples',
    'creating-program': 'Creating program',
    'creating-keygroups': 'Creating keygroups',
  };

  const pct =
    progress.totalSteps > 0
      ? Math.round((progress.currentStep / progress.totalSteps) * 100)
      : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-gray-300">
        <span>{phaseLabels[progress.phase]}</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-150"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-400">{progress.stepLabel}</p>
    </div>
  );
}

// =========================================================================
// Program info display
// =========================================================================

function ProgramInfo({
  program,
  resolvedCount,
  missingCount,
}: {
  program: ProgramYaml;
  resolvedCount: number;
  missingCount: number;
}): JSX.Element {
  const totalZones = program.zones.length;
  const sampleNames = [...new Set(program.zones.map((z) => z.sample))];

  return (
    <div className="p-3 bg-gray-700/50 border border-gray-600 rounded text-sm space-y-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
        <span>{totalZones} zone{totalZones !== 1 ? 's' : ''}</span>
        <span>{sampleNames.length} unique sample{sampleNames.length !== 1 ? 's' : ''}</span>
        <span>{resolvedCount} found on device</span>
        {missingCount > 0 && (
          <span className="text-yellow-400">{missingCount} missing</span>
        )}
      </div>
      <div className="text-xs text-gray-500">
        Zones: {program.zones.map((z) => z.label ?? z.sample).join(', ')}
      </div>
    </div>
  );
}

function MissingSamplesWarning({ missing }: { missing: string[] }): JSX.Element {
  return (
    <div className="p-3 bg-yellow-900/30 border border-yellow-700 rounded text-sm space-y-2">
      <p className="text-yellow-300 font-medium">Missing samples on device</p>
      <p className="text-yellow-400/80 text-xs">
        These samples are referenced by the program but not found on the device.
        Zones using these samples will be skipped. Send the samples to the device
        first, then try again for a complete import.
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
  const [phase, setPhase] = useState<DialogPhase>('loading');
  const [programMeta, setProgramMeta] = useState<ProgramYaml | null>(null);
  const [missingSamples, setMissingSamples] = useState<string[]>([]);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [importProgress, setImportProgress] = useState<InstrumentImportProgress | null>(null);
  const [result, setResult] = useState<InstrumentImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  // Load program metadata when dialog opens
  useEffect(() => {
    if (!open) return;

    cancelledRef.current = false;
    setPhase('loading');
    setProgramMeta(null);
    setMissingSamples([]);
    setResolvedCount(0);
    setImportProgress(null);
    setResult(null);
    setErrorMessage(null);

    void (async () => {
      try {
        const meta = fromProgramsDir
          ? await loadProgramFromProgramsDir(libraryRoot, programDirName)
          : await loadProgramMeta(libraryRoot, programDirName, programPath);
        if (cancelledRef.current) return;

        // Pre-resolve to show the user what will happen
        const { resolved, missing } = resolveZoneSamples(meta.zones, deviceSampleNames);
        setProgramMeta(meta);
        setResolvedCount(resolved.size);
        setMissingSamples(missing);
        setPhase('confirm');
      } catch (err: unknown) {
        if (cancelledRef.current) return;
        const message = err instanceof Error ? err.message : String(err);
        setErrorMessage(message);
        setPhase('error');
      }
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [open, libraryRoot, programDirName, programPath, deviceSampleNames]);

  const handleImport = useCallback(async () => {
    if (!programMeta) return;

    setPhase('importing');
    setErrorMessage(null);

    try {
      const importResult = await importInstrumentToDevice({
        client,
        program: programMeta,
        deviceSampleNames,
        onProgress: (progress) => {
          setImportProgress(progress);
        },
      });

      setResult(importResult);
      setPhase('success');
      await onImportComplete();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
      setPhase('error');
    }
  }, [client, programMeta, deviceSampleNames, onImportComplete]);

  const handleClose = useCallback(() => {
    if (phase === 'importing') return;
    onClose();
  }, [phase, onClose]);

  const displayName = programMeta?.name ?? programDirName;

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Import Instrument to Device</DialogTitle>

      {phase === 'loading' && (
        <DialogDescription>
          Loading &ldquo;{displayName}&rdquo; from library...
        </DialogDescription>
      )}

      {phase === 'confirm' && programMeta && (
        <div className="space-y-4">
          <DialogDescription>
            Import &ldquo;{programMeta.name}&rdquo; as an S3K program.
            Each zone will become a keygroup with the corresponding key range
            and sample assignment.
          </DialogDescription>

          <ProgramInfo
            program={programMeta}
            resolvedCount={resolvedCount}
            missingCount={missingSamples.length}
          />

          {missingSamples.length > 0 && (
            <MissingSamplesWarning missing={missingSamples} />
          )}

          {resolvedCount > 0 && (
            <div className="p-3 bg-orange-900/20 border border-orange-800/50 rounded text-xs text-orange-300">
              This will create 1 new program with {resolvedCount} keygroup{resolvedCount !== 1 ? 's' : ''} on the device.
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
              onClick={handleImport}
              disabled={resolvedCount === 0}
              data-testid="import-instrument-confirm"
            >
              Import ({resolvedCount} zone{resolvedCount !== 1 ? 's' : ''})
            </button>
          </DialogActions>
        </div>
      )}

      {phase === 'importing' && importProgress && (
        <div className="space-y-4">
          <ProgressBar progress={importProgress} />
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

      {phase === 'success' && result && (
        <div className="space-y-4">
          <div className="p-3 bg-green-900/30 border border-green-700 rounded text-green-300 text-sm">
            Instrument imported successfully.
          </div>
          <div className="p-3 bg-gray-700/50 border border-gray-600 rounded text-sm space-y-1">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
              <span>Program: {result.programName} (#{result.programIndex})</span>
              <span>{result.keygroupsCreated} keygroup{result.keygroupsCreated !== 1 ? 's' : ''}</span>
            </div>
            {result.missingSamples.length > 0 && (
              <div className="text-xs text-yellow-400/70 mt-1">
                {result.missingSamples.length} zone{result.missingSamples.length !== 1 ? 's' : ''} skipped (missing samples)
              </div>
            )}
          </div>
          <DialogActions>
            <button
              className="ac-btn ac-btn-sm ac-btn-primary"
              onClick={handleClose}
              data-testid="import-instrument-done"
            >
              Done
            </button>
          </DialogActions>
        </div>
      )}
    </Dialog>
  );
}
