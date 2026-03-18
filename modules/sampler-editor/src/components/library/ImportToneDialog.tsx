/**
 * Import Tone from Library Dialog
 *
 * Dialog for importing a tone from the sampler library to a device slot.
 * Shows tone details and allows selecting the target slot.
 */

import { useState, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { ToneYaml } from '@audiocontrol/sampler-library/browser';
import type { OperationState } from '@/types/import-operation';
import { isOperationComplete } from '@/types/import-operation';
import { cn } from '@/lib/utils';
import {
  OperationProgressBar,
  OperationErrorBanner,
  OperationSuccessScreen,
  OperationButtonContent,
  DialogCloseButton,
} from '@/components/ui/ImportStatus';

export interface ImportToneDialogProps extends OperationState {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tone: ToneYaml | null;
  onImport: (targetSlot: number) => Promise<void>;
  totalSlots?: number;
}

export function ImportToneDialog({
  open,
  onOpenChange,
  tone,
  onImport,
  isOperating,
  progress,
  error: operationError,
  totalSlots = 32,
}: ImportToneDialogProps): JSX.Element {
  const [targetSlot, setTargetSlot] = useState(0);

  const handleImport = useCallback(async () => {
    try {
      await onImport(targetSlot);
    } catch (err) {
      // Error should be handled by parent via error prop
    }
  }, [targetSlot, onImport]);

  const handleClose = useCallback(() => {
    if (!isOperating) {
      onOpenChange(false);
    }
  }, [isOperating, onOpenChange]);

  const isComplete = isOperationComplete({ isOperating, progress, error: operationError });

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
            <OperationSuccessScreen
              message="Tone imported successfully!"
              detail={
                <p>
                  <span className="font-mono text-s330-text">{tone.name}</span> imported to slot T{targetSlot + 1}
                </p>
              }
              onDone={handleClose}
            />
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
                  disabled={isOperating}
                  className={cn(
                    'w-full bg-s330-bg border border-s330-accent/50 rounded px-3 py-2 text-s330-text',
                    'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                    isOperating && 'opacity-50'
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

              {isOperating && progress && (
                <OperationProgressBar progress={progress} />
              )}

              {operationError && <OperationErrorBanner error={operationError} />}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleClose}
                  disabled={isOperating}
                  className={cn(
                    'ac-btn ac-btn-ghost',
                    isOperating && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={isOperating}
                  className={cn(
                    'ac-btn ac-btn-primary',
                    isOperating && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <OperationButtonContent isOperating={isOperating} label="Import" operatingLabel="Importing..." />
                </button>
              </div>
            </div>
          )}

          <Dialog.Close asChild>
            <DialogCloseButton disabled={isOperating} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
