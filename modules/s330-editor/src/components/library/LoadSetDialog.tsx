/**
 * Load Set Dialog
 *
 * Modal dialog for loading a library set to the device.
 * Shows progress and warnings about overwriting existing data.
 */

import { useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

interface LoadSetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setName: string;
  onLoad: () => Promise<void>;
  isLoading: boolean;
  progress?: number;
  error: string | null;
}

export function LoadSetDialog({
  open,
  onOpenChange,
  setName,
  onLoad,
  isLoading,
  progress,
  error,
}: LoadSetDialogProps): JSX.Element {
  const handleLoad = useCallback(async () => {
    await onLoad();
  }, [onLoad]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!isLoading) {
      onOpenChange(nextOpen);
    }
  }, [isLoading, onOpenChange]);

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
            Load Set to Device
          </Dialog.Title>

          <div className="space-y-4">
            {/* Set Info */}
            <div className="p-4 bg-s330-bg rounded">
              <div className="text-xs text-s330-muted uppercase tracking-wide mb-1">
                Loading Set
              </div>
              <div className="text-lg font-bold text-s330-text">{setName}</div>
            </div>

            {/* Warning */}
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded">
              <p className="text-sm text-yellow-400">
                <strong>Warning:</strong> This will overwrite existing tones and patches
                in the corresponding slots on your device.
              </p>
            </div>

            {/* Progress Bar */}
            {isLoading && progress !== undefined && (
              <div>
                <div className="h-2 bg-s330-bg rounded-full overflow-hidden">
                  <div
                    className="h-full bg-s330-highlight transition-all duration-150"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-s330-muted mt-1">
                  {progress < 50 ? 'Loading from library...' : 'Uploading to device...'}
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6">
            <Dialog.Close asChild>
              <button
                className="ac-btn ac-btn-secondary"
                disabled={isLoading}
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleLoad}
              disabled={isLoading}
              className={cn(
                'ac-btn ac-btn-primary',
                isLoading && 'opacity-50'
              )}
            >
              {isLoading ? 'Loading...' : 'Load Set'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
