/**
 * Import Tone from Library Dialog
 *
 * Dialog for importing a tone from the sampler library to a device slot.
 * Shows tone details and allows selecting the target slot.
 */

import { useState, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { ToneYaml } from '@audiocontrol/sampler-library/browser';
import { cn } from '@/lib/utils';

export interface ImportToneDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onOpenChange: (open: boolean) => void;
  /** The tone YAML to import */
  tone: ToneYaml | null;
  /** Callback to perform the import */
  onImport: (targetSlot: number) => Promise<void>;
  /** Whether import is in progress */
  isImporting: boolean;
  /** Import progress (0-100) */
  importProgress?: number;
  /** Import error message */
  importError?: string | null;
  /** Total number of tone slots available */
  totalSlots?: number;
}

export function ImportToneDialog({
  open,
  onOpenChange,
  tone,
  onImport,
  isImporting,
  importProgress,
  importError,
  totalSlots = 32,
}: ImportToneDialogProps): JSX.Element {
  const [targetSlot, setTargetSlot] = useState(0);

  const handleImport = useCallback(async () => {
    try {
      await onImport(targetSlot);
    } catch (err) {
      // Error should be handled by parent via importError prop
    }
  }, [targetSlot, onImport]);

  const handleClose = useCallback(() => {
    if (!isImporting) {
      onOpenChange(false);
    }
  }, [isImporting, onOpenChange]);

  const isComplete = importProgress === 100 && !isImporting;

  if (!tone) {
    return <></>;
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-s330-panel border border-s330-accent rounded-lg shadow-xl w-full max-w-md p-6">
          <Dialog.Title className="text-lg font-bold text-s330-text mb-4">
            Import Tone from Library
          </Dialog.Title>

          {isComplete ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Tone imported successfully!</span>
              </div>
              <p className="text-sm text-s330-muted">
                <span className="font-mono text-s330-text">{tone.name}</span> imported to slot T{targetSlot + 1}
              </p>
              <div className="flex justify-end">
                <button
                  onClick={handleClose}
                  className="ac-btn ac-btn-primary"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Dialog.Description className="text-sm text-s330-muted">
                Import <span className="font-mono text-s330-text">{tone.name}</span> to your S-330.
              </Dialog.Description>

              {/* Tone Info */}
              <div className="bg-s330-bg rounded p-3 text-sm">
                <h4 className="font-medium text-s330-text mb-2">{tone.name}</h4>
                <div className="grid grid-cols-2 gap-2 text-s330-muted">
                  <div>
                    <span>Sample Rate:</span>
                    <span className="ml-2 text-s330-text">{tone.wave.sampleRate} Hz</span>
                  </div>
                  <div>
                    <span>Loop Mode:</span>
                    <span className="ml-2 text-s330-text capitalize">{tone.wave.loopMode}</span>
                  </div>
                  {tone.s330 && (
                    <>
                      <div>
                        <span>Original Key:</span>
                        <span className="ml-2 text-s330-text">{tone.s330.originalKey}</span>
                      </div>
                      <div>
                        <span>TVA Level:</span>
                        <span className="ml-2 text-s330-text">{tone.s330.tva?.level ?? '-'}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Target Slot Selection */}
              <div>
                <label htmlFor="targetSlot" className="block text-sm text-s330-muted mb-1">
                  Target Slot
                </label>
                <select
                  id="targetSlot"
                  value={targetSlot}
                  onChange={(e) => setTargetSlot(parseInt(e.target.value))}
                  disabled={isImporting}
                  className={cn(
                    'w-full bg-s330-bg border border-s330-accent/50 rounded px-3 py-2 text-s330-text',
                    'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                    isImporting && 'opacity-50'
                  )}
                >
                  {Array.from({ length: totalSlots }, (_, i) => (
                    <option key={i} value={i}>
                      T{Math.floor(i / 8) + 1}{(i % 8) + 1} (Slot {i + 1})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-s330-muted mt-1">
                  This will overwrite any existing tone data in this slot.
                </p>
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
                    {importProgress < 50 ? 'Uploading wave data...' : 'Sending parameters...'}
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
                  disabled={isImporting}
                  className={cn(
                    'ac-btn ac-btn-primary',
                    isImporting && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {isImporting ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Importing...
                    </>
                  ) : (
                    'Import'
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
