/**
 * Export Tone to Library Dialog
 *
 * Dialog for exporting a tone (parameters + wave data) to the sampler library.
 * Shows export progress and allows customizing the tone name.
 */

import { useState, useCallback, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { S330Tone } from '@audiocontrol/sampler-devices/s330';
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

export interface ExportToneDialogProps extends OperationState {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onOpenChange: (open: boolean) => void;
  /** The tone to export (null if not loaded) */
  tone: S330Tone | null;
  /** Tone index (for display) */
  toneIndex: number;
  /** Callback to perform the export - receives tone name and index */
  onExport: (toneName: string, toneIndex: number) => Promise<void>;
}

export function ExportToneDialog({
  open,
  onOpenChange,
  tone,
  toneIndex,
  onExport,
  isOperating,
  progress,
  error: operationError,
}: ExportToneDialogProps): JSX.Element {
  const [toneName, setToneName] = useState(tone?.name || `Tone_${toneIndex + 1}`);
  const [localError, setLocalError] = useState<string | null>(null);

  // Reset tone name when dialog opens or tone changes
  useEffect(() => {
    if (open) {
      setToneName(tone?.name || `Tone_${toneIndex + 1}`);
      setLocalError(null);
    }
  }, [open, tone?.name, toneIndex]);

  const handleExport = useCallback(async () => {
    if (!toneName.trim()) {
      setLocalError('Tone name is required');
      return;
    }

    setLocalError(null);
    try {
      await onExport(toneName.trim(), toneIndex);
    } catch (err) {
      // Error should be handled by parent via operationError prop
    }
  }, [toneName, toneIndex, onExport]);

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
            Export Tone to Library
          </Dialog.Title>

          {isComplete ? (
            <OperationSuccessScreen
              message="Tone exported successfully!"
              detail={
                <p>
                  Saved as <span className="font-mono text-s330-text">{toneName}.yaml</span>
                </p>
              }
              onDone={handleClose}
            />
          ) : (
            <div className="space-y-4">
              <Dialog.Description className="text-sm text-s330-muted">
                Export tone T{toneIndex + 1} parameters and wave data to your sampler library.
              </Dialog.Description>

              {/* Tone Name Input */}
              <div>
                <label htmlFor="toneName" className="block text-sm text-s330-muted mb-1">
                  Tone Name
                </label>
                <input
                  id="toneName"
                  type="text"
                  value={toneName}
                  onChange={(e) => setToneName(e.target.value)}
                  disabled={isOperating}
                  maxLength={32}
                  className={cn(
                    'w-full bg-s330-bg border rounded px-3 py-2 text-s330-text',
                    'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                    error ? 'border-red-500' : 'border-s330-accent/50',
                    isOperating && 'opacity-50'
                  )}
                  placeholder="Enter tone name"
                />
              </div>

              {/* Tone Info */}
              {tone && (
                <div className="bg-s330-bg rounded p-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-s330-muted">Sample Rate:</span>
                      <span className="ml-2 text-s330-text">{tone.sampleRate}</span>
                    </div>
                    <div>
                      <span className="text-s330-muted">Loop Mode:</span>
                      <span className="ml-2 text-s330-text capitalize">{tone.loopMode}</span>
                    </div>
                    <div>
                      <span className="text-s330-muted">Original Key:</span>
                      <span className="ml-2 text-s330-text">{tone.originalKey}</span>
                    </div>
                    <div>
                      <span className="text-s330-muted">TVF:</span>
                      <span className="ml-2 text-s330-text">{tone.tvf.enabled ? 'ON' : 'OFF'}</span>
                    </div>
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
                  disabled={isOperating || !toneName.trim() || !tone}
                  data-testid="export-confirm"
                  className={cn(
                    'ac-btn ac-btn-primary',
                    (isOperating || !toneName.trim() || !tone) && 'opacity-50 cursor-not-allowed'
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
