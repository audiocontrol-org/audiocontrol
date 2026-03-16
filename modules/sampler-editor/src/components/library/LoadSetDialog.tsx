/**
 * Load Set Dialog
 *
 * Modal dialog for loading a library set to the device.
 * Shows progress, warnings, and import target selection.
 *
 * The import target options come from the device's MemoryLayout —
 * this component never branches on device type.
 */

import { useCallback, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import type { ImportTarget, ToneSlotGroup } from '@/configs/types';
import { MemoryMapPanel } from '@/components/ui/MemoryMapPanel';
import type { AllocationProposal } from '@/components/ui/memory-map-types';
import type { S330Tone } from '@/core/midi/S330Client';

interface LoadSetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setName: string;
  /** Called with the selected import target */
  onLoad: (target: ImportTarget) => Promise<void>;
  isLoading: boolean;
  progress?: number;
  error: string | null;
  statusMessage?: string | null;
  /** Import target options from MemoryLayout */
  importTargets: ImportTarget[];
  /** Current device tones for memory map */
  deviceTones?: (S330Tone | undefined)[];
  /** Tone groups from MemoryLayout */
  toneGroups?: ToneSlotGroup[];
  /** Format tone slot label */
  formatToneSlot?: (index: number) => string;
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
  importTargets,
  deviceTones,
  toneGroups,
  formatToneSlot,
}: LoadSetDialogProps): JSX.Element {
  const [selectedTargetIndex, setSelectedTargetIndex] = useState(0);

  // Full-block proposal: all tones and all wave segments for the selected target
  const proposal = useMemo((): AllocationProposal | undefined => {
    const target = importTargets[selectedTargetIndex];
    if (!toneGroups) return undefined;

    const group = toneGroups.find((g) => g.firstIndex === target.toneIndexOffset);
    if (!group) return undefined;

    const toneSlots = Array.from({ length: group.count }, (_, i) => group.firstIndex + i);
    const waveSegments = group.waveBankIndices.map((bank) => ({
      bank,
      segmentTop: 0,
      segmentLength: 18,
    }));
    return { toneSlots, waveSegments };
  }, [selectedTargetIndex, importTargets, toneGroups]);

  const handleLoad = useCallback(async () => {
    await onLoad(importTargets[selectedTargetIndex]);
  }, [onLoad, importTargets, selectedTargetIndex]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!isLoading) {
      onOpenChange(nextOpen);
      if (!nextOpen) {
        setSelectedTargetIndex(0);
      }
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
            'w-full max-w-2xl p-6'
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

            {/* Import Target */}
            <div>
              <label htmlFor="importTarget" className="block text-sm text-s330-muted mb-1">
                Target
              </label>
              <select
                id="importTarget"
                value={selectedTargetIndex}
                onChange={(e) => setSelectedTargetIndex(Number(e.target.value))}
                disabled={isLoading}
                className={cn(
                  'w-full bg-s330-bg border border-s330-accent/50 rounded px-3 py-2 text-s330-text',
                  'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                  isLoading && 'opacity-50'
                )}
              >
                {importTargets.map((target, i) => (
                  <option key={i} value={i}>{target.label}</option>
                ))}
              </select>
            </div>

            {/* Memory Map */}
            {deviceTones && toneGroups && formatToneSlot && (
              <MemoryMapPanel
                deviceTones={deviceTones}
                toneGroups={toneGroups}
                formatToneSlot={formatToneSlot}
                proposal={proposal}
              />
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
