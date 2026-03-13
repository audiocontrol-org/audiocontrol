/**
 * Export Patch to Library Dialog
 *
 * Dialog for exporting a patch bundle (parameters + all dependent tones) to the sampler library.
 * Shows export progress and allows customizing the patch name.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { S330Patch } from '@audiocontrol/sampler-devices/s330';
import { getPatchToneDependencies } from '@/lib/library-service';
import { cn } from '@/lib/utils';

export interface ExportPatchDialogProps {
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
  /** Whether export is in progress */
  isExporting: boolean;
  /** Export progress (0-100) */
  exportProgress?: number;
  /** Export error message */
  exportError?: string | null;
}

export function ExportPatchDialog({
  open,
  onOpenChange,
  patch,
  patchIndex,
  onExport,
  isExporting,
  exportProgress,
  exportError,
}: ExportPatchDialogProps): JSX.Element {
  const [patchName, setPatchName] = useState(patch?.common.name || `Patch_${patchIndex + 1}`);
  const [localError, setLocalError] = useState<string | null>(null);

  // Calculate number of referenced tones
  const referencedToneCount = useMemo(() => {
    if (!patch) return 0;
    return getPatchToneDependencies(patch).length;
  }, [patch]);

  // Reset patch name when dialog opens or patch changes
  useEffect(() => {
    if (open) {
      setPatchName(patch?.common.name || `Patch_${patchIndex + 1}`);
      setLocalError(null);
    }
  }, [open, patch?.common.name, patchIndex]);

  const handleExport = useCallback(async () => {
    if (!patchName.trim()) {
      setLocalError('Patch name is required');
      return;
    }

    setLocalError(null);
    try {
      await onExport(patchName.trim(), patchIndex);
    } catch {
      // Error should be handled by parent via exportError prop
    }
  }, [patchName, patchIndex, onExport]);

  const handleClose = useCallback(() => {
    if (!isExporting) {
      setLocalError(null);
      onOpenChange(false);
    }
  }, [isExporting, onOpenChange]);

  const error = localError || exportError;
  const isComplete = exportProgress === 100 && !isExporting;

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-s330-panel border border-s330-accent rounded-lg shadow-xl w-full max-w-md p-6">
          <Dialog.Title className="text-lg font-bold text-s330-text mb-4">
            Export Patch to Library
          </Dialog.Title>

          {isComplete ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Patch bundle exported successfully!</span>
              </div>
              <p className="text-sm text-s330-muted">
                Saved to <span className="font-mono text-s330-text">{patchName}/</span> with {referencedToneCount} tone{referencedToneCount !== 1 ? 's' : ''}
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
                Export patch P{String(patchIndex + 1).padStart(2, '0')} with all its dependent tones to your sampler library.
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
                  disabled={isExporting}
                  maxLength={32}
                  className={cn(
                    'w-full bg-s330-bg border rounded px-3 py-2 text-s330-text',
                    'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                    error ? 'border-red-500' : 'border-s330-accent/50',
                    isExporting && 'opacity-50'
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
              {isExporting && exportProgress !== undefined && (
                <div>
                  <div className="h-2 bg-s330-bg rounded-full overflow-hidden">
                    <div
                      className="h-full bg-s330-highlight transition-all duration-150 ease-out"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-s330-muted mt-1 text-right">
                    {exportProgress < 60
                      ? `Fetching wave data from device... (${Math.round(exportProgress / 60 * referencedToneCount)}/${referencedToneCount} tones)`
                      : 'Writing files to library...'
                    }
                  </p>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="text-sm text-red-400 bg-red-900/20 rounded p-2">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleClose}
                  disabled={isExporting}
                  className={cn(
                    'ac-btn ac-btn-ghost',
                    isExporting && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  disabled={isExporting || !patchName.trim() || !patch}
                  className={cn(
                    'ac-btn ac-btn-primary',
                    (isExporting || !patchName.trim() || !patch) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {isExporting ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Exporting...
                    </>
                  ) : (
                    'Export'
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
              disabled={isExporting}
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
