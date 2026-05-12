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
import type { OperationState } from '@/types/import-operation';
import { cn } from '@/lib/utils';
import type { ImportTarget, ToneSlotGroup } from '@/configs/types';
import { MemoryMapPanel } from '@/components/ui/MemoryMapPanel';
import {
  OperationProgressBar,
  OperationErrorBanner,
  OperationButtonContent,
} from '@/components/ui/ImportStatus';
import type { AllocationProposal } from '@/components/ui/memory-map-types';
import type { SamplerTone } from '@/core/midi/SamplerClient';

interface LoadSetDialogProps extends OperationState {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setName: string;
  onLoad: (target: ImportTarget) => Promise<void>;
  importTargets: ImportTarget[];
  deviceTones?: (SamplerTone | undefined)[];
  toneGroups?: ToneSlotGroup[];
  formatToneSlot?: (index: number) => string;
  success?: boolean;
}

export function LoadSetDialog({
  open,
  onOpenChange,
  setName,
  onLoad,
  isOperating,
  progress,
  error: operationError,
  importTargets,
  deviceTones,
  toneGroups,
  formatToneSlot,
  success,
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
    if (!isOperating) {
      onOpenChange(nextOpen);
      if (!nextOpen) {
        setSelectedTargetIndex(0);
      }
    }
  }, [isOperating, onOpenChange]);

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
              <label htmlFor="importTarget" className="ac-field-label mb-1">
                Target
              </label>
              <select
                id="importTarget"
                value={selectedTargetIndex}
                onChange={(e) => setSelectedTargetIndex(Number(e.target.value))}
                disabled={isOperating}
                className="ac-select"
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

            {isOperating && progress && (
              <div data-testid="load-progress">
                <OperationProgressBar progress={progress} />
              </div>
            )}

            {/* Success */}
            {success && (
              <div
                data-testid="load-success"
                className="p-3 bg-green-500/10 border border-green-500/30 rounded"
              >
                <p className="text-sm text-green-400">Set loaded successfully!</p>
              </div>
            )}

            {operationError && (
              <div data-testid="load-error">
                <OperationErrorBanner error={operationError} />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6">
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
                    disabled={isOperating}
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  onClick={handleLoad}
                  disabled={isOperating}
                  data-testid="confirm-load-set"
                  className={cn(
                    'ac-btn ac-btn-primary',
                    isOperating && 'opacity-50'
                  )}
                >
                  <OperationButtonContent isOperating={isOperating} label="Load Set" operatingLabel="Loading..." />
                </button>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
