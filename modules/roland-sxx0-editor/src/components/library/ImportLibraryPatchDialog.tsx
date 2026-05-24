/**
 * Import Library Patch Dialog (v3)
 *
 * Right-edge SlideDrawer per the v3 design language. Mirrors the
 * Export* family's chrome and adopts the shared
 * `useExportDialogLifecycle` hook. Replaces the legacy centered
 * Radix.Dialog.
 *
 * Imports a patch from a library set (or individual bundle) to the
 * device, handling automatic import of required tones with
 * user-configurable slot/bank/segment mappings.
 *
 * Closes BUG-002 silent-failure shape for patch imports: synchronous
 * throws from onImport (including the parent hook's preconditions)
 * coalesce with `operationError` via `effectiveError` and surface as
 * a failed step in the log instead of dismissing the dialog silently.
 *
 * Form body extracted to ImportLibraryPatchDialogBody.tsx (sibling
 * file) to stay under the 500-line cap.
 *
 * Closes V3-IMPORT sub-task 4 of #450.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { SlideDrawer } from '@audiocontrol/editor-core';
import type { OperationState } from '@/types/import-operation';
import type { SamplerTone, SamplerPatch } from '@/core/midi/SamplerClient';
import type {
  StorageDirectoryHandle,
} from '@audiocontrol/sampler-library/browser';
import { remapPatchToneLayers } from '@/lib/library-service';
import {
  isToneSlotEmpty,
  isPatchSlotEmpty,
} from '@/lib/slot-allocation';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { OperationLoadingSpinner } from '@/components/ui/ImportStatus';
import type { AllocationProposal } from '@/components/ui/memory-map-types';
import { findPatchBestFits } from '@/lib/best-fit';
import type { FitOption, PatchFitValues } from '@/lib/best-fit';
import { useExportDialogLifecycle } from '@/hooks/useExportDialogLifecycle';
import {
  StepLogBody,
  renderFooter,
} from '@/components/library/ExportToneDialog';
import {
  PatchImportFormBody,
  type ToneImportMapping,
} from '@/components/library/ImportLibraryPatchDialogBody';
import {
  loadPatchForImport,
  materialiseDependentTones,
} from '@/components/library/ImportLibraryPatchDialogLoad';

export type { ToneImportMapping };

export interface ImportLibraryPatchDialogProps extends OperationState {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  libraryHandle: StorageDirectoryHandle;
  setName: string;
  patchFile: string;
  patchPath?: string[];
  deviceTones: (SamplerTone | undefined)[];
  devicePatches: (SamplerPatch | undefined)[];
  initialTargetSlot?: number;
  onImport: (params: {
    setName: string;
    patchFile: string;
    patch: SamplerPatch;
    targetPatchSlot: number;
    tones: Array<{
      tone: SamplerTone;
      wavData: Uint8Array;
      targetSlot: number;
      /** See `ToneImportMapping.waveBank` JSDoc — `number` for S-330/S-550 parity. */
      waveBank: number;
      segmentTop: number;
      segmentLength: number;
    }>;
  }) => Promise<void>;
}

export function ImportLibraryPatchDialog({
  open,
  onOpenChange,
  libraryHandle,
  setName,
  patchFile,
  patchPath,
  deviceTones,
  devicePatches,
  onImport,
  isOperating,
  progress,
  error: operationError,
  initialTargetSlot,
}: ImportLibraryPatchDialogProps): JSX.Element | null {
  const config = useDeviceConfig();
  const { memoryLayout } = config;

  // Per-dialog loaded state.
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [patch, setPatch] = useState<SamplerPatch | null>(null);

  // User selections.
  const [targetPatchSlot, setTargetPatchSlot] = useState(
    initialTargetSlot ?? 0,
  );
  const [toneMappings, setToneMappings] = useState<ToneImportMapping[]>([]);

  // Best fit state.
  const [fitOptions, setFitOptions] = useState<FitOption<PatchFitValues>[]>([]);
  const [selectedFitIndex, setSelectedFitIndex] = useState<number | null>(null);
  const [showBestFits, setShowBestFits] = useState(false);

  // Tones referenced by patch but not found in library/manifest.
  const [missingToneSlots, setMissingToneSlots] = useState<number[]>([]);

  // Shared lifecycle hook — coalesces local + load + operation errors.
  const {
    localError,
    setLocalError,
    hasStarted,
    setHasStarted,
    isComplete,
    effectiveError,
    steps,
    handleClose,
  } = useExportDialogLifecycle({
    open,
    isOperating,
    progress,
    operationError: loadError ?? operationError,
    onOpenChange,
  });

  // Load patch + manifest when drawer opens. The async work is in
  // `loadPatchForImport` (sibling module); this effect owns the
  // state-machine plumbing (reset on open, capture errors, finalise
  // loading flag).
  useEffect(() => {
    if (!open) return;

    setIsLoading(true);
    setLoadError(null);
    setPatch(null);
    setToneMappings([]);
    setMissingToneSlots([]);

    void (async () => {
      try {
        const result = await loadPatchForImport({
          libraryHandle,
          setName,
          patchFile,
          patchPath,
          deviceTones,
          devicePatches,
          initialTargetSlot,
        });
        setPatch(result.patch);
        setTargetPatchSlot(result.patchSlot);
        setToneMappings(result.toneMappings);
        setMissingToneSlots(result.missingToneSlots);
      } catch (err) {
        console.error('[ImportLibraryPatchDialog] Failed to load patch:', err);
        setLoadError(
          err instanceof Error ? err.message : 'Failed to load patch',
        );
      } finally {
        setIsLoading(false);
      }
    })();
  }, [
    open,
    libraryHandle,
    setName,
    patchFile,
    patchPath,
    initialTargetSlot,
    deviceTones,
    devicePatches,
  ]);

  const updateToneMapping = useCallback(
    (index: number, updates: Partial<ToneImportMapping>) => {
      setToneMappings((prev) =>
        prev.map((m, i) => (i === index ? { ...m, ...updates } : m)),
      );
    },
    [],
  );

  const handleImport = useCallback(async () => {
    if (!patch) {
      setLocalError('Patch data not loaded');
      return;
    }
    setLocalError(null);
    setHasStarted(true);

    try {
      const tonesData = await materialiseDependentTones({
        libraryHandle,
        setName,
        patchFile,
        patchPath,
        toneMappings,
      });

      const toneRemapping = new Map<number, number>();
      for (const mapping of toneMappings) {
        toneRemapping.set(mapping.originalSlot, mapping.targetSlot);
      }
      const remappedPatch = remapPatchToneLayers(patch, toneRemapping);

      await onImport({
        setName,
        patchFile,
        patch: remappedPatch,
        targetPatchSlot,
        tones: tonesData,
      });
    } catch (err) {
      // Coalesces with operationError via effectiveError — closes
      // BUG-002 silent-failure shape for patch imports.
      console.error('[ImportLibraryPatchDialog] Import failed:', err);
      setLocalError(err instanceof Error ? err.message : 'Import failed');
    }
  }, [
    patch,
    toneMappings,
    targetPatchSlot,
    onImport,
    libraryHandle,
    setName,
    patchFile,
    patchPath,
    setLocalError,
    setHasStarted,
  ]);

  const willOverwritePatch = useMemo(
    () => !isPatchSlotEmpty(devicePatches, targetPatchSlot),
    [devicePatches, targetPatchSlot],
  );
  const existingPatchName = devicePatches[targetPatchSlot]?.common.name;

  const handleFindBestFit = useCallback(() => {
    const deps = toneMappings.map((m) => ({
      originalSlot: m.originalSlot,
      segmentsNeeded: m.segmentsNeeded,
    }));
    const options = findPatchBestFits(
      deviceTones,
      devicePatches,
      deps,
      memoryLayout.toneGroups,
      memoryLayout.formatPatchSlot,
    );
    setFitOptions(options);
    setSelectedFitIndex(null);
    setShowBestFits(true);
  }, [deviceTones, devicePatches, toneMappings, memoryLayout]);

  const handleSelectFit = useCallback(
    (index: number) => {
      const option = fitOptions[index];
      if (!option) return;
      setSelectedFitIndex(index);
      setTargetPatchSlot(option.values.targetPatchSlot);
      setToneMappings((prev) =>
        prev.map((m, i) => {
          const alloc = option.values.toneAllocations[i];
          if (!alloc) return m;
          return {
            ...m,
            targetSlot: alloc.targetSlot,
            waveBank: alloc.waveBank,
            segmentTop: alloc.segmentTop,
          };
        }),
      );
    },
    [fitOptions],
  );

  const proposal = useMemo(
    (): AllocationProposal => ({
      toneSlots: toneMappings.map((m) => m.targetSlot),
      waveSegments: toneMappings.map((m) => ({
        bank: m.waveBank,
        segmentTop: m.segmentTop,
        segmentLength: m.segmentsNeeded,
      })),
    }),
    [toneMappings],
  );

  const toneOverwrites = useMemo(
    () =>
      toneMappings.map((mapping) => ({
        willOverwrite: !isToneSlotEmpty(deviceTones, mapping.targetSlot),
        existingName: deviceTones[mapping.targetSlot]?.name,
      })),
    [toneMappings, deviceTones],
  );

  if (!open) return null;

  const canImport = !isOperating && !!patch && !isLoading;
  const footer = renderFooter({
    hasStarted,
    isComplete,
    hasError: !!effectiveError,
    isOperating,
    canExport: canImport,
    onCancel: handleClose,
    onExport: handleImport,
    onClose: handleClose,
    verb: `Import${toneMappings.length > 0 ? ` + ${toneMappings.length} Tones` : ''}`,
    testIdPrefix: 'import',
  });

  return (
    <SlideDrawer
      open={open}
      title="Import library patch"
      onClose={handleClose}
      footer={footer}
    >
      {hasStarted ? (
        <div
          data-testid={
            isComplete && !effectiveError ? 'import-success' : 'import-progress'
          }
        >
          <StepLogBody
            steps={steps}
            isComplete={isComplete}
            hasError={!!effectiveError}
            successMessage={
              <>
                Patch imported successfully — wrote to{' '}
                <span style={{ fontFamily: 'var(--ac-font-mono)' }}>
                  {memoryLayout.formatPatchSlot(targetPatchSlot)}
                </span>
                {toneMappings.length > 0 &&
                  ` with ${toneMappings.length} tone${toneMappings.length !== 1 ? 's' : ''}`}
              </>
            }
          />
        </div>
      ) : isLoading ? (
        <OperationLoadingSpinner message="Loading patch data..." />
      ) : (
        <PatchImportFormBody
          patch={patch}
          patchFile={patchFile}
          setName={setName}
          memoryLayout={memoryLayout}
          totalPatches={config.totalPatches}
          totalTones={config.totalTones}
          targetPatchSlot={targetPatchSlot}
          setTargetPatchSlot={setTargetPatchSlot}
          willOverwritePatch={willOverwritePatch}
          existingPatchName={existingPatchName}
          missingToneSlots={missingToneSlots}
          toneMappings={toneMappings}
          updateToneMapping={updateToneMapping}
          toneOverwrites={toneOverwrites}
          devicePatches={devicePatches}
          deviceTones={deviceTones}
          isOperating={isOperating}
          proposal={proposal}
          onFindBestFit={handleFindBestFit}
          showBestFits={showBestFits}
          setShowBestFits={setShowBestFits}
          fitOptions={fitOptions}
          selectedFitIndex={selectedFitIndex}
          onSelectFit={handleSelectFit}
          error={localError ?? loadError ?? operationError ?? null}
        />
      )}
    </SlideDrawer>
  );
}
