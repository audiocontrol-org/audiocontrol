/**
 * Export Tone to Library Dialog
 *
 * Dialog for exporting a tone (parameters + wave data) to the sampler library.
 * Shows export progress and allows customizing the tone name.
 */

import { useState, useCallback, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { S330Tone } from '@audiocontrol/sampler-devices/s330';
import { cn } from '@/lib/utils';

export interface ExportToneDialogProps {
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
  /** Whether export is in progress */
  isExporting: boolean;
  /** Export progress (0-100) */
  exportProgress?: number;
  /** Export error message */
  exportError?: string | null;
  /** Status message for current operation */
  statusMessage?: string | null;
}

export function ExportToneDialog({
  open,
  onOpenChange,
  tone,
  toneIndex,
  onExport,
  isExporting,
  exportProgress,
  exportError,
  statusMessage,
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
      // Error should be handled by parent via exportError prop
    }
  }, [toneName, toneIndex, onExport]);

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
            Export Tone to Library
          </Dialog.Title>

          {isComplete ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Tone exported successfully!</span>
              </div>
              <p className="text-sm text-s330-muted">
                Saved as <span className="font-mono text-s330-text">{toneName}.yaml</span>
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
                  disabled={isExporting}
                  maxLength={32}
                  className={cn(
                    'w-full bg-s330-bg border rounded px-3 py-2 text-s330-text',
                    'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                    error ? 'border-red-500' : 'border-s330-accent/50',
                    isExporting && 'opacity-50'
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
              {isExporting && exportProgress !== undefined && (
                <div>
                  <div className="h-2 bg-s330-bg rounded-full overflow-hidden">
                    <div
                      className="h-full bg-s330-highlight transition-all duration-150 ease-out"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-s330-muted mt-1 text-right">
                    {statusMessage || (exportProgress < 50 ? 'Fetching wave data...' : 'Saving to library...')}
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
                  disabled={isExporting || !toneName.trim() || !tone}
                  className={cn(
                    'ac-btn ac-btn-primary',
                    (isExporting || !toneName.trim() || !tone) && 'opacity-50 cursor-not-allowed'
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
