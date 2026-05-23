/**
 * Import Samples Dialog (v3)
 *
 * Right-edge SlideDrawer per the v3 design language. Mirrors the
 * Export* family's chrome and adopts the shared
 * `useExportDialogLifecycle` hook. Replaces the legacy centered
 * Radix.Dialog.
 *
 * Imports a sample bundle (drum kit or chopped sample) into the device:
 * the user picks the starting tone slot, wave bank/segment, patch
 * slot, and (optionally) monolithic-mode for sliced bundles. All
 * slot counts, bank options, and formatting are driven by the active
 * MemoryLayout — no device conditionals here.
 *
 * Closes BUG-002 silent-failure shape for sample imports: synchronous
 * throws from onImport coalesce with `operationError` via
 * `effectiveError` and surface as a failed step in the log instead of
 * silently dismissing the dialog.
 *
 * Form body extracted to ImportSamplesDialogBody.tsx (sibling file)
 * to stay under the 500-line cap.
 *
 * Closes V3-IMPORT sub-task 3 of #450.
 */

import { useState, useCallback, useMemo } from 'react';
import { SlideDrawer } from '@audiocontrol/editor-core';
import type { OperationState } from '@/types/import-operation';
import type { SamplerTone, SamplerPatch } from '@/core/midi/SamplerClient';
import type { SampleImportBundle } from '@/hooks/useImportSamples';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { findContiguousBestFits } from '@/lib/best-fit';
import type { FitOption, ContiguousFitValues } from '@/lib/best-fit';
import type { AllocationProposal } from '@/components/ui/memory-map-types';
import { useExportDialogLifecycle } from '@/hooks/useExportDialogLifecycle';
import {
  StepLogBody,
  renderFooter,
} from '@/components/library/ExportToneDialog';
import { SamplesImportFormBody } from '@/components/library/ImportSamplesDialogBody';

export interface ImportSamplesDialogProps extends OperationState {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bundle: SampleImportBundle;
  deviceTones: (SamplerTone | undefined)[];
  devicePatches: (SamplerPatch | undefined)[];
  onImport: (params: {
    startingToneSlot: number;
    /**
     * Wave bank index typed as `number` rather than `0 | 1 | 2 | 3` so the same
     * dialog serves both S-330 (banks 0-1) and S-550 (banks 0-3). The rendered
     * `<option>` set is layout-driven via `availableBanks.indices`; runtime
     * validation lives at the device-client boundary
     * (`s330-client.ts:1592,1632`, `s550-addresses.ts:168`).
     * Mirrors the pattern established in #393 / #396 / #399.
     */
    waveBank: number;
    startingSegment: number;
    targetPatchSlot: number;
    singlePatch?: boolean;
    patchName?: string;
    useMonolithicMode?: boolean;
  }) => Promise<void>;
}

export function ImportSamplesDialog({
  open,
  onOpenChange,
  bundle,
  deviceTones,
  devicePatches,
  onImport,
  isOperating,
  progress,
  error: operationError,
}: ImportSamplesDialogProps): JSX.Element | null {
  const config = useDeviceConfig();
  const { memoryLayout } = config;

  const totalSamples = bundle.slices.length;
  const { importTargets } = memoryLayout;
  const hasSource = !!bundle.source;

  // User selections
  const [selectedTargetIndex, setSelectedTargetIndex] = useState(0);
  const [startingToneSlot, setStartingToneSlot] = useState(0);
  const [waveBank, setWaveBank] = useState<number>(0);
  const [startingSegment, setStartingSegment] = useState(0);
  const [targetPatchSlot, setTargetPatchSlot] = useState(0);
  const [singlePatch, setSinglePatch] = useState(true);
  const [useMonolithicMode, setUseMonolithicMode] = useState(hasSource);

  // Best fit state
  const [fitOptions, setFitOptions] = useState<
    FitOption<ContiguousFitValues>[]
  >([]);
  const [selectedFitIndex, setSelectedFitIndex] = useState<number | null>(null);
  const [showBestFits, setShowBestFits] = useState(false);

  const selectedTarget = importTargets[selectedTargetIndex];
  const absoluteToneSlot = startingToneSlot + selectedTarget.toneIndexOffset;

  const targetGroup =
    memoryLayout.toneGroups.find(
      (g) => g.firstIndex === selectedTarget.toneIndexOffset,
    ) ?? memoryLayout.toneGroups[0];
  const groupToneCount = targetGroup.count;

  const toneSlotsNeeded = useMonolithicMode ? totalSamples + 1 : totalSamples;
  const hasEnoughToneSlots =
    startingToneSlot + toneSlotsNeeded <= groupToneCount;
  const patchSlotsNeeded = singlePatch ? 1 : totalSamples;
  const hasEnoughPatchSlots =
    targetPatchSlot + patchSlotsNeeded <= config.totalPatches;

  const estimatedSegments = totalSamples;

  const proposal = useMemo(
    (): AllocationProposal => {
      const toneSlots = Array.from(
        { length: toneSlotsNeeded },
        (_, i) => absoluteToneSlot + i,
      );
      const waveSegments = [
        {
          bank: waveBank,
          segmentTop: startingSegment,
          segmentLength: estimatedSegments,
        },
      ];
      return { toneSlots, waveSegments };
    },
    [
      absoluteToneSlot,
      toneSlotsNeeded,
      waveBank,
      startingSegment,
      estimatedSegments,
    ],
  );

  // Lifecycle hook (mirrors Export*/ImportLibraryToneDialog adoption).
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
    operationError,
    onOpenChange,
  });

  const handleFindBestFit = useCallback(() => {
    const options = findContiguousBestFits(
      deviceTones,
      toneSlotsNeeded,
      estimatedSegments,
      memoryLayout.toneGroups,
      memoryLayout.formatToneSlot,
    );
    setFitOptions(options);
    setSelectedFitIndex(null);
    setShowBestFits(true);
  }, [deviceTones, toneSlotsNeeded, estimatedSegments, memoryLayout]);

  const handleSelectFit = useCallback(
    (index: number) => {
      const option = fitOptions[index];
      if (!option) return;
      setSelectedFitIndex(index);
      setSelectedTargetIndex(option.values.targetIndex);
      setStartingToneSlot(option.values.startingToneSlot);
      setWaveBank(option.values.waveBank);
      setStartingSegment(option.values.startingSegment);
    },
    [fitOptions],
  );

  const handleTargetChange = useCallback(
    (index: number) => {
      setSelectedTargetIndex(index);
      setStartingToneSlot(0);
      const newGroup =
        memoryLayout.toneGroups.find(
          (g) => g.firstIndex === importTargets[index].toneIndexOffset,
        ) ?? memoryLayout.toneGroups[0];
      setWaveBank(newGroup.waveBankIndices[0]);
    },
    [importTargets, memoryLayout.toneGroups],
  );

  const handleImport = useCallback(async () => {
    setLocalError(null);
    setHasStarted(true);
    try {
      await onImport({
        startingToneSlot: absoluteToneSlot,
        waveBank,
        startingSegment,
        targetPatchSlot,
        singlePatch,
        patchName: bundle.name,
        useMonolithicMode,
      });
    } catch (err) {
      // Coalesces with operationError via effectiveError — closes
      // BUG-002 silent-failure shape for sample imports.
      setLocalError(err instanceof Error ? err.message : 'Import failed');
    }
  }, [
    absoluteToneSlot,
    waveBank,
    startingSegment,
    targetPatchSlot,
    singlePatch,
    bundle.name,
    useMonolithicMode,
    onImport,
    setLocalError,
    setHasStarted,
  ]);

  if (!open) return null;

  const canImport = !isOperating && hasEnoughToneSlots && hasEnoughPatchSlots;
  const footer = renderFooter({
    hasStarted,
    isComplete,
    hasError: !!effectiveError,
    isOperating,
    canExport: canImport,
    onCancel: handleClose,
    onExport: handleImport,
    onClose: handleClose,
    verb: 'Import',
    testIdPrefix: 'import',
  });

  const successMessage = (
    <>
      <p>
        Created {toneSlotsNeeded} tone{toneSlotsNeeded !== 1 ? 's' : ''} in
        slots {memoryLayout.formatToneSlot(absoluteToneSlot)} -{' '}
        {memoryLayout.formatToneSlot(absoluteToneSlot + toneSlotsNeeded - 1)}
        {useMonolithicMode && ` (1 holder + ${totalSamples} sub-tones)`}
      </p>
      {singlePatch ? (
        <p>
          Created 1 patch in slot {memoryLayout.formatPatchSlot(targetPatchSlot)}{' '}
          with all {totalSamples} samples mapped
        </p>
      ) : (
        <p>
          Created {totalSamples} patch{totalSamples !== 1 ? 'es' : ''} in slots{' '}
          {memoryLayout.formatPatchSlot(targetPatchSlot)} -{' '}
          {memoryLayout.formatPatchSlot(targetPatchSlot + totalSamples - 1)}
        </p>
      )}
    </>
  );

  return (
    <SlideDrawer
      open={open}
      title="Import samples"
      onClose={handleClose}
      footer={footer}
    >
      {hasStarted ? (
        // `import-progress` + `import-success` testids preserved for
        // existing e2e specs (device-library-* round-trip tests).
        <div
          data-testid={
            isComplete && !effectiveError ? 'import-success' : 'import-progress'
          }
        >
          <StepLogBody
            steps={steps}
            isComplete={isComplete}
            hasError={!!effectiveError}
            successMessage={successMessage}
          />
        </div>
      ) : (
        <SamplesImportFormBody
          bundle={bundle}
          deviceTones={deviceTones}
          devicePatches={devicePatches}
          memoryLayout={memoryLayout}
          totalSamples={totalSamples}
          totalPatches={config.totalPatches}
          importTargets={importTargets}
          selectedTargetIndex={selectedTargetIndex}
          onTargetChange={handleTargetChange}
          targetGroup={targetGroup}
          startingToneSlot={startingToneSlot}
          setStartingToneSlot={setStartingToneSlot}
          absoluteToneSlot={absoluteToneSlot}
          toneSlotsNeeded={toneSlotsNeeded}
          hasEnoughToneSlots={hasEnoughToneSlots}
          waveBank={waveBank}
          setWaveBank={setWaveBank}
          startingSegment={startingSegment}
          setStartingSegment={setStartingSegment}
          estimatedSegments={estimatedSegments}
          targetPatchSlot={targetPatchSlot}
          setTargetPatchSlot={setTargetPatchSlot}
          hasEnoughPatchSlots={hasEnoughPatchSlots}
          singlePatch={singlePatch}
          setSinglePatch={setSinglePatch}
          useMonolithicMode={useMonolithicMode}
          setUseMonolithicMode={setUseMonolithicMode}
          hasSource={hasSource}
          isOperating={isOperating}
          proposal={proposal}
          onFindBestFit={handleFindBestFit}
          showBestFits={showBestFits}
          setShowBestFits={setShowBestFits}
          fitOptions={fitOptions}
          selectedFitIndex={selectedFitIndex}
          onSelectFit={handleSelectFit}
          error={localError ?? operationError ?? null}
        />
      )}
    </SlideDrawer>
  );
}
