/**
 * Import Drum Kit Dialog — transfers a chopped sample from the library
 * to the device as an S3000XL program with one keygroup per slice.
 *
 * Flow:
 * 1. Load chopped sample metadata (slice count, base note, etc.)
 * 2. Show drum kit info + confirm
 * 3. Send each slice as a separate SDS sample (with progress)
 * 4. Create program + keygroups on the device
 * 5. Report success/error
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import { loadSampleMeta } from '@audiocontrol/sampler-library/browser';
import type { SampleYaml } from '@audiocontrol/sampler-library/browser';
import type { S3000xlClientInterface } from '@audiocontrol/sampler-devices/s3k';
import { Dialog, DialogTitle, DialogDescription, DialogActions } from '@/components/ui/Dialog';
import {
  importDrumKitToDevice,
  type DrumKitImportProgress,
  type DrumKitImportResult,
} from '@/lib/drumkit-import';
import { parseMidiNote, formatMidiNote } from '@/lib/midi-note-parser';

// =========================================================================
// Types
// =========================================================================

export interface ImportDrumKitDialogProps {
  open: boolean;
  onClose: () => void;
  /** Sample directory name in the library */
  sampleName: string;
  /** Path within the samples directory */
  samplePath: string[];
  client: S3000xlClientInterface;
  libraryRoot: StorageDirectoryHandle;
  /** Called after successful import to refresh device state */
  onImportComplete: () => Promise<void>;
}

type DialogPhase = 'loading' | 'confirm' | 'importing' | 'success' | 'error';

// =========================================================================
// Progress display
// =========================================================================

function ImportProgressBar({
  progress,
}: {
  progress: DrumKitImportProgress;
}): JSX.Element {
  const phaseLabels: Record<DrumKitImportProgress['phase'], string> = {
    'loading': 'Loading...',
    'sending-samples': 'Sending samples',
    'creating-program': 'Creating program',
    'creating-keygroups': 'Creating keygroups',
  };

  const phasePct =
    progress.totalSteps > 0
      ? Math.round((progress.currentStep / progress.totalSteps) * 100)
      : 0;

  // For SDS transfers, blend sample-level and packet-level progress
  let detailPct = phasePct;
  if (progress.phase === 'sending-samples' && progress.sdsProgress) {
    const sds = progress.sdsProgress;
    const packetPct =
      sds.packetsTotal > 0
        ? (sds.packetsSent / sds.packetsTotal)
        : 0;
    // Each sample is 1/totalSteps. Current progress within that sample is packetPct.
    const stepWeight = 1 / progress.totalSteps;
    detailPct = Math.round(
      ((progress.currentStep - 1) / progress.totalSteps + stepWeight * packetPct) * 100,
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-gray-300">
        <span>{phaseLabels[progress.phase]}</span>
        <span>{detailPct}%</span>
      </div>

      <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-150"
          style={{ width: `${detailPct}%` }}
        />
      </div>

      <p className="text-xs text-gray-400">{progress.stepLabel}</p>

      {progress.phase === 'sending-samples' && progress.sdsProgress && (
        <p className="text-xs text-gray-500">
          Packet {progress.sdsProgress.packetsSent} of {progress.sdsProgress.packetsTotal}
        </p>
      )}
    </div>
  );
}

// =========================================================================
// Kit info display
// =========================================================================

function DrumKitInfo({ meta }: { meta: SampleYaml }): JSX.Element {
  const sliceCount = meta.slices?.length ?? 0;
  const baseNote = meta.drumKit?.baseNote;
  const baseNoteDisplay = baseNote !== undefined
    ? (typeof baseNote === 'number' ? formatMidiNote(baseNote) : String(baseNote))
    : 'C2';
  const baseNoteNumber = baseNote !== undefined ? parseMidiNote(baseNote) : 36;
  const lastNote = baseNoteNumber + sliceCount - 1;
  const lastNoteDisplay = lastNote <= 127 ? formatMidiNote(lastNote) : `${lastNote} (out of range)`;

  return (
    <div className="p-3 bg-gray-700/50 border border-gray-600 rounded text-sm space-y-1">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
        <span>{sliceCount} slice{sliceCount !== 1 ? 's' : ''}</span>
        <span>{meta.sampleRate.toLocaleString()} Hz</span>
        <span>Base note: {baseNoteDisplay}</span>
        <span>Range: {baseNoteDisplay} - {lastNoteDisplay}</span>
      </div>
      {meta.slices && (
        <div className="text-xs text-gray-500 mt-1">
          Slices: {meta.slices.map((s) => s.label).join(', ')}
        </div>
      )}
    </div>
  );
}

// =========================================================================
// Dialog
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
  const [phase, setPhase] = useState<DialogPhase>('loading');
  const [sampleMeta, setSampleMeta] = useState<SampleYaml | null>(null);
  const [importProgress, setImportProgress] = useState<DrumKitImportProgress | null>(null);
  const [result, setResult] = useState<DrumKitImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  // Load sample metadata when dialog opens
  useEffect(() => {
    if (!open) return;

    cancelledRef.current = false;
    setPhase('loading');
    setSampleMeta(null);
    setImportProgress(null);
    setResult(null);
    setErrorMessage(null);

    void (async () => {
      try {
        const meta = await loadSampleMeta(libraryRoot, sampleName, samplePath);
        if (cancelledRef.current) return;

        if (!meta.slices || meta.slices.length === 0) {
          throw new Error('This sample has no slices defined');
        }

        setSampleMeta(meta);
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
  }, [open, libraryRoot, sampleName, samplePath]);

  const handleImport = useCallback(async () => {
    setPhase('importing');
    setErrorMessage(null);

    try {
      const importResult = await importDrumKitToDevice({
        client,
        libraryRoot,
        sampleName,
        samplePath,
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
  }, [client, libraryRoot, sampleName, samplePath, onImportComplete]);

  const handleClose = useCallback(() => {
    if (phase === 'importing') return; // Prevent close during import
    onClose();
  }, [phase, onClose]);

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Import Drum Kit to Device</DialogTitle>

      {phase === 'loading' && (
        <DialogDescription>
          Loading &ldquo;{sampleName}&rdquo; from library...
        </DialogDescription>
      )}

      {phase === 'confirm' && sampleMeta && (
        <div className="space-y-4">
          <DialogDescription>
            Import &ldquo;{sampleMeta.name}&rdquo; as a drum program on the device.
            Each slice will be sent as a separate sample, and a program with one
            keygroup per slice will be created.
          </DialogDescription>

          <DrumKitInfo meta={sampleMeta} />

          <div className="p-3 bg-orange-900/20 border border-orange-800/50 rounded text-xs text-orange-300">
            This will create {sampleMeta.slices?.length ?? 0} new samples
            and 1 new program on the device.
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
              data-testid="import-drumkit-confirm"
            >
              Import
            </button>
          </DialogActions>
        </div>
      )}

      {phase === 'importing' && importProgress && (
        <div className="space-y-4">
          <ImportProgressBar progress={importProgress} />
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
            Drum kit imported successfully.
          </div>
          <div className="p-3 bg-gray-700/50 border border-gray-600 rounded text-sm space-y-1">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
              <span>Program: {result.programName} (#{result.programIndex})</span>
              <span>{result.keygroupCount} keygroup{result.keygroupCount !== 1 ? 's' : ''}</span>
              <span>{result.sampleCount} sample{result.sampleCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <DialogActions>
            <button
              className="ac-btn ac-btn-sm ac-btn-primary"
              onClick={handleClose}
              data-testid="import-drumkit-done"
            >
              Done
            </button>
          </DialogActions>
        </div>
      )}
    </Dialog>
  );
}
