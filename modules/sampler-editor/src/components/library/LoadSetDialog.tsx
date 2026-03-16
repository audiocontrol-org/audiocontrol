/**
 * Load Set Dialog
 *
 * Modal dialog for loading a library set to the device.
 * Shows progress and warnings about overwriting existing data.
 *
 * For the S-550 (which has two independent blocks), allows selecting
 * which block to load the set into:
 * - Block 1: Tones 0-31, Wave Banks A/B
 * - Block 2: Tones 32-63, Wave Banks C/D
 */

import { useCallback, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

interface LoadSetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setName: string;
  /** Called with target block (1 or 2 for S-550, undefined for S-330) */
  onLoad: (targetBlock?: number) => Promise<void>;
  isLoading: boolean;
  progress?: number;
  error: string | null;
  statusMessage?: string | null;
  /** Number of wave banks on the device (2 for S-330, 4 for S-550) */
  waveBankCount: number;
}

export function LoadSetDialog({
  open,
  onOpenChange,
  setName,
  onLoad,
  isLoading,
  progress,
  error,
  statusMessage,
  waveBankCount,
}: LoadSetDialogProps): JSX.Element {
  const [targetBlock, setTargetBlock] = useState<1 | 2>(1);

  const handleLoad = useCallback(async () => {
    const block = hasBlocks ? targetBlock : undefined;
    await onLoad(block);
  }, [onLoad, targetBlock]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!isLoading) {
      onOpenChange(nextOpen);
      if (!nextOpen) {
        setTargetBlock(1);
      }
    }
  }, [isLoading, onOpenChange]);

  // S-550 has 4 wave banks = 2 blocks. S-330 has 2 = 1 block (no selection needed).
  const hasBlocks = waveBankCount > 2;

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

            {/* Block Selector (S-550 only) */}
            {hasBlocks && (
              <div>
                <label htmlFor="targetBlock" className="block text-sm text-s330-muted mb-1">
                  Target Block
                </label>
                <select
                  id="targetBlock"
                  value={targetBlock}
                  onChange={(e) => setTargetBlock(Number(e.target.value) as 1 | 2)}
                  disabled={isLoading}
                  className={cn(
                    'w-full bg-s330-bg border border-s330-accent/50 rounded px-3 py-2 text-s330-text',
                    'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                    isLoading && 'opacity-50'
                  )}
                >
                  <option value={1}>Block 1 — Tones 1-32, Banks A/B</option>
                  <option value={2}>Block 2 — Tones 33-64, Banks C/D</option>
                </select>
                <p className="text-xs text-s330-muted mt-1">
                  Each block is an independent memory area with its own tones and wave banks.
                </p>
              </div>
            )}

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
                  {statusMessage || (progress < 50 ? 'Loading from library...' : 'Uploading to device...')}
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
