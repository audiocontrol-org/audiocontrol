/**
 * Import Drum Kit Dialog
 *
 * Dialog for importing a drum kit bundle to the device.
 * Allows user to select starting tone slot, wave bank/segment, and patch slot.
 */

import { useState, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { S330Tone, S330Patch } from '@/core/midi/S330Client';
import type { ResolvedDrumKitBundle } from '@audiocontrol/sampler-library/browser';
import { midiNoteToName } from '@audiocontrol/sampler-library/browser';
import { cn } from '@/lib/utils';

/**
 * Format tone slot number (0-31 -> T11-T48)
 */
function formatToneSlot(index: number): string {
  const bank = Math.floor(index / 8) + 1;
  const slot = (index % 8) + 1;
  return `T${bank}${slot}`;
}

/**
 * Format patch slot number (0-15 -> P01-P16)
 */
function formatPatchSlot(index: number): string {
  return `P${String(index + 1).padStart(2, '0')}`;
}

export interface ImportDrumKitDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onOpenChange: (open: boolean) => void;
  /** Resolved drum kit bundle to import */
  bundle: ResolvedDrumKitBundle;
  /** Current device tones (to show slot occupancy) */
  deviceTones: (S330Tone | undefined)[];
  /** Current device patches (to show slot occupancy) */
  devicePatches: (S330Patch | undefined)[];
  /** Callback to perform the import */
  onImport: (params: {
    startingToneSlot: number;
    waveBank: 0 | 1;
    startingSegment: number;
    targetPatchSlot: number;
  }) => Promise<void>;
  /** Whether import is in progress */
  isImporting: boolean;
  /** Import progress (0-100) */
  importProgress?: number;
  /** Import error message */
  importError?: string | null;
  /** Status message */
  statusMessage?: string | null;
}

export function ImportDrumKitDialog({
  open,
  onOpenChange,
  bundle,
  deviceTones,
  devicePatches,
  onImport,
  isImporting,
  importProgress,
  importError,
  statusMessage,
}: ImportDrumKitDialogProps): JSX.Element {
  // Calculate total samples needed
  const totalSamples = bundle.totalSamples;

  // User selections
  const [startingToneSlot, setStartingToneSlot] = useState(0);
  const [waveBank, setWaveBank] = useState<0 | 1>(0);
  const [startingSegment, setStartingSegment] = useState(0);
  const [targetPatchSlot, setTargetPatchSlot] = useState(0);

  const hasEnoughToneSlots = startingToneSlot + totalSamples <= 32;
  const hasEnoughPatchSlots = targetPatchSlot + totalSamples <= 16;

  // Estimate segments needed (1 segment per sample as a rough estimate)
  const estimatedSegments = totalSamples;
  const hasEnoughSegments = startingSegment + estimatedSegments <= 18;

  const handleImport = useCallback(async () => {
    await onImport({
      startingToneSlot,
      waveBank,
      startingSegment,
      targetPatchSlot,
    });
  }, [startingToneSlot, waveBank, startingSegment, targetPatchSlot, onImport]);

  const handleClose = useCallback(() => {
    if (!isImporting) {
      onOpenChange(false);
    }
  }, [isImporting, onOpenChange]);

  const isComplete = importProgress === 100 && !isImporting;

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-s330-panel border border-s330-accent rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
          <Dialog.Title className="text-lg font-bold text-s330-text mb-4">
            Import Drum Kit
          </Dialog.Title>

          {isComplete ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Drum kit imported successfully!</span>
              </div>
              <div className="text-sm text-s330-muted">
                <p>Created {totalSamples} tone{totalSamples !== 1 ? 's' : ''} in slots {formatToneSlot(startingToneSlot)} - {formatToneSlot(startingToneSlot + totalSamples - 1)}</p>
                <p>Created {totalSamples} patch{totalSamples !== 1 ? 'es' : ''} in slots {formatPatchSlot(targetPatchSlot)} - {formatPatchSlot(targetPatchSlot + totalSamples - 1)}</p>
              </div>
              <div className="flex justify-end">
                <button onClick={handleClose} className="ac-btn ac-btn-primary">
                  Done
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Dialog.Description className="text-sm text-s330-muted">
                Import "{bundle.name}" ({bundle.kits.length} kit{bundle.kits.length !== 1 ? 's' : ''}, {totalSamples} samples)
              </Dialog.Description>

              {/* Kit Summary */}
              <div className="bg-s330-bg rounded p-3 text-sm">
                <div className="text-s330-muted text-xs uppercase tracking-wide mb-2">Kit Summary</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-s330-muted">Kits:</span>
                    <span className="ml-2 text-s330-text">{bundle.kits.length}</span>
                  </div>
                  <div>
                    <span className="text-s330-muted">Samples:</span>
                    <span className="ml-2 text-s330-text">{totalSamples}</span>
                  </div>
                  <div>
                    <span className="text-s330-muted">Sample Rate:</span>
                    <span className="ml-2 text-s330-text">{bundle.sampleRate / 1000}kHz</span>
                  </div>
                  <div>
                    <span className="text-s330-muted">MIDI Range:</span>
                    <span className="ml-2 text-s330-text">
                      {bundle.kits[0] && midiNoteToName(bundle.kits[0].midiNotes.kick)} - {bundle.kits[bundle.kits.length - 1] && midiNoteToName(bundle.kits[bundle.kits.length - 1]!.midiNotes.hhOpen)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Starting Tone Slot */}
              <div>
                <label htmlFor="startingToneSlot" className="block text-sm text-s330-muted mb-1">
                  Starting Tone Slot (needs {totalSamples} consecutive slots)
                </label>
                <select
                  id="startingToneSlot"
                  value={startingToneSlot}
                  onChange={(e) => setStartingToneSlot(Number(e.target.value))}
                  disabled={isImporting}
                  className={cn(
                    'w-full bg-s330-bg border border-s330-accent/50 rounded px-3 py-2 text-s330-text',
                    'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                    isImporting && 'opacity-50'
                  )}
                >
                  {Array.from({ length: Math.max(1, 32 - totalSamples + 1) }, (_, i) => {
                    const endSlot = i + totalSamples - 1;
                    const hasOccupied = Array.from({ length: totalSamples }, (_, j) => deviceTones[i + j])
                      .some((t) => t !== undefined);
                    return (
                      <option key={i} value={i}>
                        {formatToneSlot(i)} - {formatToneSlot(endSlot)}
                        {hasOccupied ? ' (will overwrite)' : ' (empty)'}
                      </option>
                    );
                  })}
                </select>
                {!hasEnoughToneSlots && (
                  <p className="text-xs text-red-400 mt-1">
                    Not enough consecutive tone slots available
                  </p>
                )}
              </div>

              {/* Wave Bank and Segment */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="waveBank" className="block text-sm text-s330-muted mb-1">
                    Wave Bank
                  </label>
                  <select
                    id="waveBank"
                    value={waveBank}
                    onChange={(e) => setWaveBank(Number(e.target.value) as 0 | 1)}
                    disabled={isImporting}
                    className={cn(
                      'w-full bg-s330-bg border border-s330-accent/50 rounded px-3 py-2 text-s330-text',
                      'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                      isImporting && 'opacity-50'
                    )}
                  >
                    <option value={0}>Bank A</option>
                    <option value={1}>Bank B</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="startingSegment" className="block text-sm text-s330-muted mb-1">
                    Starting Segment
                  </label>
                  <select
                    id="startingSegment"
                    value={startingSegment}
                    onChange={(e) => setStartingSegment(Number(e.target.value))}
                    disabled={isImporting}
                    className={cn(
                      'w-full bg-s330-bg border border-s330-accent/50 rounded px-3 py-2 text-s330-text',
                      'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                      isImporting && 'opacity-50'
                    )}
                  >
                    {Array.from({ length: 18 }, (_, i) => (
                      <option key={i} value={i}>
                        Segment {i}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-s330-muted -mt-2">
                Each sample uses 1+ segments based on length. Total segments: ~{estimatedSegments}
              </p>
              {!hasEnoughSegments && (
                <p className="text-xs text-yellow-500">
                  Warning: May not have enough segments. Actual usage depends on sample lengths.
                </p>
              )}

              {/* Starting Patch Slot */}
              <div>
                <label htmlFor="targetPatchSlot" className="block text-sm text-s330-muted mb-1">
                  Starting Patch Slot (needs {totalSamples} consecutive slots)
                </label>
                <select
                  id="targetPatchSlot"
                  value={targetPatchSlot}
                  onChange={(e) => setTargetPatchSlot(Number(e.target.value))}
                  disabled={isImporting}
                  className={cn(
                    'w-full bg-s330-bg border border-s330-accent/50 rounded px-3 py-2 text-s330-text',
                    'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                    isImporting && 'opacity-50'
                  )}
                >
                  {Array.from({ length: Math.max(1, 16 - totalSamples + 1) }, (_, i) => {
                    const endSlot = i + totalSamples - 1;
                    const hasOccupied = Array.from({ length: totalSamples }, (_, j) => devicePatches[i + j])
                      .some((p) => p !== undefined);
                    return (
                      <option key={i} value={i}>
                        {formatPatchSlot(i)} - {formatPatchSlot(endSlot)}
                        {hasOccupied ? ' (will overwrite)' : ' (empty)'}
                      </option>
                    );
                  })}
                </select>
                {!hasEnoughPatchSlots && (
                  <p className="text-xs text-red-400 mt-1">
                    Not enough consecutive patch slots available
                  </p>
                )}
              </div>

              {/* Allocation Preview */}
              <div className="bg-s330-bg rounded p-3 text-sm">
                <div className="text-s330-muted text-xs uppercase tracking-wide mb-2">Allocation Preview</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-s330-muted">Tones:</span>
                    <span className="text-s330-text">
                      {formatToneSlot(startingToneSlot)} - {formatToneSlot(startingToneSlot + totalSamples - 1)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-s330-muted">Wave Memory:</span>
                    <span className="text-s330-text">
                      Bank {waveBank === 0 ? 'A' : 'B'}, Segment {startingSegment}+
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-s330-muted">Patches:</span>
                    <span className="text-s330-text">
                      {formatPatchSlot(targetPatchSlot)} - {formatPatchSlot(targetPatchSlot + totalSamples - 1)}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-s330-muted mt-2">
                  One patch per sample, each mapping one MIDI note to one tone.
                </div>
              </div>

              {/* Progress Bar */}
              {isImporting && importProgress !== undefined && (
                <div>
                  <div className="h-2 bg-s330-bg rounded-full overflow-hidden">
                    <div
                      className="h-full bg-s330-highlight transition-all duration-150 ease-out"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-s330-muted mt-1 text-right">
                    {statusMessage || `Importing... ${importProgress.toFixed(0)}%`}
                  </p>
                </div>
              )}

              {/* Error Display */}
              {importError && (
                <div className="text-sm text-red-400 bg-red-900/20 rounded p-2">
                  {importError}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleClose}
                  disabled={isImporting}
                  className={cn(
                    'ac-btn ac-btn-ghost',
                    isImporting && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={isImporting || !hasEnoughToneSlots || !hasEnoughPatchSlots}
                  className={cn(
                    'ac-btn ac-btn-primary',
                    (isImporting || !hasEnoughToneSlots || !hasEnoughPatchSlots) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {isImporting ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Importing...
                    </>
                  ) : (
                    'Import Drum Kit'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Close button */}
          <Dialog.Close asChild>
            <button
              className="absolute top-4 right-4 text-s330-muted hover:text-s330-text"
              aria-label="Close"
              disabled={isImporting}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
