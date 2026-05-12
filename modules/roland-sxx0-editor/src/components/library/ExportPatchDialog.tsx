/**
 * Export Patch to Library Dialog
 *
 * Dialog for exporting a patch bundle (parameters + all dependent tones) to the sampler library.
 * Shows export progress and allows customizing the patch name.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { S330Patch } from '@audiocontrol/sampler-devices/s330';
import type { OperationState } from '@/types/import-operation';
import { isOperationComplete } from '@/types/import-operation';
import { getPatchToneDependencies } from '@/lib/library-service';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { cn } from '@/lib/utils';
import {
  OperationProgressBar,
  OperationErrorBanner,
  OperationSuccessScreen,
  OperationButtonContent,
  DialogCloseButton,
} from '@/components/ui/ImportStatus';

export interface ExportPatchDialogProps extends OperationState {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onOpenChange: (open: boolean) => void;
  /** The patch to export (null if not loaded) */
  patch: S330Patch | null;
  /** Patch index (for display) */
  patchIndex: number;
  /** Callback to perform the export - receives patch name and index */
  onExport: (patchName: string, patchIndex: number) => Promise<void>;
}

export function ExportPatchDialog({
  open,
  onOpenChange,
  patch,
  patchIndex,
  onExport,
  isOperating,
  progress,
  error: operationError,
}: ExportPatchDialogProps): JSX.Element {
  const { memoryLayout } = useDeviceConfig();
  // Device-aware default name (S-330: Patch_P11..Patch_P28; S-550:
  // Patch_I11..Patch_IV28). Never `Patch_${idx + 1}` — that produces
  // `Patch_17` for S-550 patch index 16, which has no analogue on the
  // device. The `Patch_` prefix preserves the "this is a name, not a slot
  // id" affordance — the default is written to disk as the patch directory
  // name, and a bare `II11/` directory is uncomfortable as a filename.
  const defaultPatchName = `Patch_${memoryLayout.formatPatchSlot(patchIndex)}`;
  const [patchName, setPatchName] = useState(patch?.common.name || defaultPatchName);
  const [localError, setLocalError] = useState<string | null>(null);

  // Calculate number of referenced tones
  const referencedToneCount = useMemo(() => {
    if (!patch) return 0;
    return getPatchToneDependencies(patch).length;
  }, [patch]);

  // Reset patch name when dialog opens or patch changes
  useEffect(() => {
    if (open) {
      setPatchName(patch?.common.name || defaultPatchName);
      setLocalError(null);
    }
  }, [open, patch?.common.name, defaultPatchName]);

  const handleExport = useCallback(async () => {
    if (!patchName.trim()) {
      setLocalError('Patch name is required');
      return;
    }

    setLocalError(null);
    try {
      await onExport(patchName.trim(), patchIndex);
    } catch {
      // Error should be handled by parent via operationError prop
    }
  }, [patchName, patchIndex, onExport]);

  const handleClose = useCallback(() => {
    if (!isOperating) {
      setLocalError(null);
      onOpenChange(false);
    }
  }, [isOperating, onOpenChange]);

  const error = localError || operationError;
  const isComplete = isOperationComplete({ isOperating, progress, error: operationError });

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content data-testid="export-dialog" className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-s330-panel border border-s330-accent rounded-lg shadow-xl w-full max-w-md p-6">
          <Dialog.Title className="text-lg font-bold text-s330-text mb-4">
            Export Patch to Library
          </Dialog.Title>

          {isComplete ? (
            <OperationSuccessScreen
              message="Patch bundle exported successfully!"
              detail={
                <p>
                  Saved to <span className="font-mono text-s330-text">{patchName}/</span> with {referencedToneCount} tone{referencedToneCount !== 1 ? 's' : ''}
                </p>
              }
              onDone={handleClose}
            />
          ) : (
            <div className="space-y-4">
              <Dialog.Description className="text-sm text-s330-muted">
                Export patch {memoryLayout.formatPatchSlot(patchIndex)} with all its dependent tones to your sampler library.
              </Dialog.Description>

              {/* Patch Name Input */}
              <div>
                <label htmlFor="patchName" className="block text-sm text-s330-muted mb-1">
                  Patch Name
                </label>
                <input
                  id="patchName"
                  type="text"
                  value={patchName}
                  onChange={(e) => setPatchName(e.target.value)}
                  disabled={isOperating}
                  maxLength={32}
                  data-error={error ? 'true' : undefined}
                  className={cn(
                    'ac-input',
                    error && 'ac-input--error',
                  )}
                  placeholder="Enter patch name"
                />
              </div>

              {/* Patch Info */}
              {patch && (
                <div className="bg-s330-bg rounded p-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-s330-muted">Key Mode:</span>
                      <span className="ml-2 text-s330-text capitalize">{patch.common.keyMode}</span>
                    </div>
                    <div>
                      <span className="text-s330-muted">Level:</span>
                      <span className="ml-2 text-s330-text">{patch.common.level}</span>
                    </div>
                    <div>
                      <span className="text-s330-muted">Bender Range:</span>
                      <span className="ml-2 text-s330-text">{patch.common.benderRange}</span>
                    </div>
                    <div>
                      <span className="text-s330-muted">Output:</span>
                      <span className="ml-2 text-s330-text">
                        {patch.common.outputAssign === 8 ? 'TONE' : patch.common.outputAssign}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-s330-accent/30">
                    <span className="text-s330-muted">Dependent Tones:</span>
                    <span className="ml-2 text-s330-text font-medium">
                      {referencedToneCount} tone{referencedToneCount !== 1 ? 's' : ''} will be exported
                    </span>
                  </div>
                </div>
              )}

              {/* Progress Bar */}
              {isOperating && progress && (
                <OperationProgressBar progress={progress} />
              )}

              {/* Error Display */}
              {error && <OperationErrorBanner error={error} />}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleClose}
                  disabled={isOperating}
                  data-testid="export-cancel"
                  className={cn(
                    'ac-btn ac-btn-ghost',
                    isOperating && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  disabled={isOperating || !patchName.trim() || !patch}
                  data-testid="export-confirm"
                  className={cn(
                    'ac-btn ac-btn-primary',
                    (isOperating || !patchName.trim() || !patch) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <OperationButtonContent isOperating={isOperating} label="Export" operatingLabel="Exporting..." />
                </button>
              </div>
            </div>
          )}

          {/* Close button */}
          <Dialog.Close asChild>
            <DialogCloseButton disabled={isOperating} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
