/**
 * Save Set Dialog
 *
 * Modal dialog for saving the current device state to a named set in the library.
 */

import { useState, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import type { OperationProgress } from '@/types/import-operation';
import {
  OperationProgressBar,
  OperationErrorBanner,
} from '@/components/ui/ImportStatus';

interface SaveSetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (setName: string, description?: string) => Promise<void>;
  isSaving: boolean;
  /**
   * Structured save progress. Migrated from a bare `number` (0-100) to the
   * shared `OperationProgress` shape so the dialog can render the canonical
   * `OperationProgressBar` (bytes/elapsed/ETA) instead of a thin custom
   * bar — matching every other long-running dialog in this directory.
   */
  progress?: OperationProgress;
  error: string | null;
  success?: boolean;
}

export function SaveSetDialog({
  open,
  onOpenChange,
  onSave,
  isSaving,
  progress,
  error,
  success,
}: SaveSetDialogProps): JSX.Element {
  const [setName, setSetName] = useState('');
  const [description, setDescription] = useState('');

  const handleSave = useCallback(async () => {
    if (!setName.trim()) return;
    await onSave(setName.trim(), description.trim() || undefined);
  }, [setName, description, onSave]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!isSaving) {
      onOpenChange(nextOpen);
      if (!nextOpen) {
        // Reset form on close
        setSetName('');
        setDescription('');
      }
    }
  }, [isSaving, onOpenChange]);

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content
          className={cn(
            'fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
            'bg-s330-panel border border-s330-accent rounded-lg shadow-xl',
            'w-full max-w-md p-6'
          )}
        >
          <Dialog.Title className="text-lg font-bold text-s330-text mb-4">
            Save Device to Library
          </Dialog.Title>

          <div className="space-y-4">
            {/* Set Name */}
            <div>
              <label htmlFor="setName" className="ac-field-label mb-1">
                Set Name
              </label>
              <input
                id="setName"
                type="text"
                value={setName}
                onChange={(e) => setSetName(e.target.value)}
                disabled={isSaving}
                placeholder="e.g., My_Drum_Kit"
                data-testid="set-name-input"
                className="ac-input"
                autoFocus
              />
              <p className="text-xs text-s330-muted mt-1">
                Use letters, numbers, and underscores. Spaces will be converted.
              </p>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="ac-field-label mb-1">
                Description (optional)
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSaving}
                placeholder="Brief description of this set..."
                rows={3}
                className="ac-input resize-none"
              />
            </div>

            {/* Progress Bar */}
            {isSaving && progress && (
              <div data-testid="save-progress">
                <OperationProgressBar progress={progress} />
              </div>
            )}

            {/* Success */}
            {success && (
              <div
                data-testid="save-success"
                className="p-3 bg-green-500/10 border border-green-500/30 rounded"
              >
                <p className="text-sm text-green-400">Set saved successfully!</p>
              </div>
            )}

            {/* Error */}
            {error && <OperationErrorBanner error={error} />}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-6">
            {success ? (
              <Dialog.Close asChild>
                <button className="ac-btn ac-btn-primary">
                  Done
                </button>
              </Dialog.Close>
            ) : (
              <>
                <Dialog.Close asChild>
                  <button
                    className="ac-btn ac-btn-secondary"
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  onClick={handleSave}
                  disabled={!setName.trim() || isSaving}
                  data-testid="confirm-save-set"
                  className={cn(
                    'ac-btn ac-btn-primary',
                    (!setName.trim() || isSaving) && 'opacity-50'
                  )}
                >
                  {isSaving ? 'Saving...' : 'Save Set'}
                </button>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
