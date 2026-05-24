/**
 * Import Library Tone Dialog (v3)
 *
 * Right-edge SlideDrawer per the v3 design language: mirrors the
 * Export* family's chrome (ExportToneDialog / ExportPatchDialog /
 * BatchExportDrawer). Adopts the shared `useExportDialogLifecycle`
 * hook so the lifecycle state machine — localError / hasStarted /
 * effectiveError / steps / handleClose — is identical across every
 * library drawer.
 *
 * Two body modes drawn into a single SlideDrawer panel (so the
 * drawer never remounts mid-operation):
 *   - Idle: tone-loading + tone-form (target slot, wave bank,
 *     segment, MemoryMapPanel, BestFitPicker)
 *   - Run/Done/Fail: shared step-log (`ac-step-*`) growing in
 *     place as `OperationProgress` ticks
 *
 * Replaces the legacy centered Radix.Dialog. Closes BUG-002 (import
 * dialog empty-catch silent failures): synchronous throws from
 * preconditions in the parent hook now coalesce with `operationError`
 * into `effectiveError` and surface as a failed step row instead of
 * a silent dismissal.
 *
 * Closes V3-IMPORT sub-task 2 of #450.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { SlideDrawer } from '@audiocontrol/editor-core';
import type { OperationState } from '@/types/import-operation';
import type { SamplerTone } from '@/core/midi/SamplerClient';
import {
  loadToneFromSet,
  loadSetManifest,
  loadIndividualTone,
  convertYamlToS330Tone,
  type StorageDirectoryHandle,
} from '@/lib/library-service';
import {
  suggestToneAllocation,
  isToneSlotEmpty,
  type WaveBankIndex,
} from '@/lib/slot-allocation';
import { calculateSegmentsNeeded } from '@audiocontrol/sampler-devices/s330';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { OperationLoadingSpinner } from '@/components/ui/ImportStatus';
import type { AllocationProposal } from '@/components/ui/memory-map-types';
import { findToneBestFits } from '@/lib/best-fit';
import type { FitOption, ToneFitValues } from '@/lib/best-fit';
import { useExportDialogLifecycle } from '@/hooks/useExportDialogLifecycle';
import {
  StepLogBody,
  renderFooter,
} from '@/components/library/ExportToneDialog';
import { ToneImportFormBody } from '@/components/library/ImportLibraryToneDialogBody';

export interface ImportLibraryToneDialogProps extends OperationState {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  libraryHandle: StorageDirectoryHandle;
  setName: string;
  toneFile: string;
  deviceTones: (SamplerTone | undefined)[];
  initialTargetSlot?: number;
  onImport: (params: {
    setName: string;
    toneFile: string;
    tone: SamplerTone;
    wavData: Uint8Array;
    targetSlot: number;
    /**
     * Wave bank index, typed as `number` (rather than `0 | 1 | 2 | 3`)
     * because the bank `<option>` set is layout-driven via
     * `targetGroup.waveBankIndices` / `targetGroup.waveBankLabels`. The
     * literal-union would lie about which banks are valid for a given
     * tone group on S-550 (tones 32-63 use banks C/D, not A/B), and
     * runtime validation against the layout is the source of truth.
     * Mirrors the same widening in `ImportLibraryPatchDialog` (#396).
     */
    waveBank: number;
    segmentTop: number;
    segmentLength: number;
  }) => Promise<void>;
}

export function ImportLibraryToneDialog({
  open,
  onOpenChange,
  libraryHandle,
  setName,
  toneFile,
  deviceTones,
  initialTargetSlot,
  onImport,
  isOperating,
  progress,
  error: operationError,
}: ImportLibraryToneDialogProps): JSX.Element | null {
  const config = useDeviceConfig();
  const { memoryLayout } = config;
  const { importTargets } = memoryLayout;

  // State for loaded tone (per-dialog, owns the async load)
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tone, setTone] = useState<SamplerTone | null>(null);
  const [wavData, setWavData] = useState<Uint8Array | null>(null);

  // User selections
  const [selectedTargetIndex, setSelectedTargetIndex] = useState(0);
  const [targetSlot, setTargetSlot] = useState(initialTargetSlot ?? 0);
  const [waveBank, setWaveBank] = useState<number>(0);
  const [segmentTop, setSegmentTop] = useState(0);
  const [segmentLength, setSegmentLength] = useState(1);

  // Best fit state
  const [fitOptions, setFitOptions] = useState<FitOption<ToneFitValues>[]>([]);
  const [selectedFitIndex, setSelectedFitIndex] = useState<number | null>(null);
  const [showBestFits, setShowBestFits] = useState(false);

  const selectedTarget = importTargets[selectedTargetIndex];
  const targetGroup =
    memoryLayout.toneGroups.find(
      (g) => g.firstIndex === selectedTarget.toneIndexOffset,
    ) ?? memoryLayout.toneGroups[0];

  // Shared lifecycle hook (mirrors ExportToneDialog adoption pattern).
  // Owns: localError, setLocalError, hasStarted, setHasStarted,
  // isComplete, effectiveError, steps, handleClose.
  // The hook coalesces `localError` with `operationError` into
  // `effectiveError`, which is the value the step-log + form-error
  // render against. Pre-fix BUG-002 swallowed throws in the onImport
  // catch and never surfaced them; this routes them through.
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

  // Load tone data when the drawer opens.
  useEffect(() => {
    if (!open) return;

    setIsLoading(true);
    setLoadError(null);
    setTone(null);
    setWavData(null);

    const loadData = async (): Promise<void> => {
      try {
        const isIndividual = setName === '__individual__';
        let loadedWavData: Uint8Array;
        let convertedTone: SamplerTone;
        // `preferredBank` stays a `WaveBankIndex` because it feeds
        // `suggestToneAllocation`, whose signature requires that
        // literal-union. The user-visible `onImport.waveBank` is widened
        // to `number` separately because the rendered `<option>` set is
        // layout-driven via `targetGroup.waveBankIndices`.
        let preferredBank: WaveBankIndex = 0;

        if (isIndividual) {
          const { yaml, wavData: data } = await loadIndividualTone(
            libraryHandle,
            toneFile,
          );
          loadedWavData = data;
          convertedTone = convertYamlToS330Tone(yaml);
          preferredBank = convertedTone.wave.bank as WaveBankIndex;
        } else {
          const loadedManifest = await loadSetManifest(libraryHandle, setName);
          const entry = loadedManifest.tones.find((t) => t.file === toneFile);
          if (entry) preferredBank = entry.waveAllocation.bank;
          const { yaml, wavData: data } = await loadToneFromSet(
            libraryHandle,
            setName,
            toneFile,
          );
          loadedWavData = data;
          convertedTone = convertYamlToS330Tone(yaml);
        }

        setWavData(loadedWavData);
        setTone(convertedTone);

        const segmentsRequired = calculateSegmentsNeeded(
          loadedWavData.length / 2,
        );
        setSegmentLength(segmentsRequired);

        const allocation = suggestToneAllocation(
          deviceTones,
          segmentsRequired,
          initialTargetSlot,
          preferredBank,
        );

        if (initialTargetSlot !== undefined) {
          setTargetSlot(initialTargetSlot);
        } else {
          setTargetSlot(allocation.toneSlot);
        }

        if (allocation.waveMemory) {
          setWaveBank(allocation.waveMemory.bank);
          setSegmentTop(allocation.waveMemory.segmentTop);
        } else {
          setWaveBank(preferredBank);
          setSegmentTop(0);
        }
      } catch (err) {
        console.error('[ImportLibraryToneDialog] Failed to load tone:', err);
        setLoadError(
          err instanceof Error ? err.message : 'Failed to load tone',
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, [open, libraryHandle, setName, toneFile, initialTargetSlot, deviceTones]);

  const handleImport = useCallback(async () => {
    if (!tone || !wavData) {
      setLocalError('Tone data not loaded');
      return;
    }
    setLocalError(null);
    setHasStarted(true);
    try {
      await onImport({
        setName,
        toneFile,
        tone,
        wavData,
        targetSlot,
        waveBank,
        segmentTop,
        segmentLength,
      });
    } catch (err) {
      // Coalesces with operationError via effectiveError — closes
      // BUG-002 (legacy empty catch swallowed sync throws from the
      // parent hook's preconditions, leaving the dialog silently open).
      setLocalError(err instanceof Error ? err.message : 'Import failed');
    }
  }, [
    tone,
    wavData,
    setName,
    toneFile,
    targetSlot,
    waveBank,
    segmentTop,
    segmentLength,
    onImport,
    setLocalError,
    setHasStarted,
  ]);

  const segmentsNeeded = segmentLength;

  const willOverwriteTone = useMemo(
    () => !isToneSlotEmpty(deviceTones, targetSlot),
    [deviceTones, targetSlot],
  );
  const existingToneName = deviceTones[targetSlot]?.name;

  const proposal = useMemo(
    (): AllocationProposal => ({
      toneSlots: [targetSlot],
      waveSegments: [
        { bank: waveBank, segmentTop, segmentLength: segmentsNeeded },
      ],
    }),
    [targetSlot, waveBank, segmentTop, segmentsNeeded],
  );

  const handleFindBestFit = useCallback(() => {
    const options = findToneBestFits(
      deviceTones,
      segmentsNeeded,
      memoryLayout.toneGroups,
      memoryLayout.formatToneSlot,
    );
    setFitOptions(options);
    setSelectedFitIndex(null);
    setShowBestFits(true);
  }, [deviceTones, segmentsNeeded, memoryLayout]);

  const handleSelectFit = useCallback(
    (index: number) => {
      const option = fitOptions[index];
      if (!option) return;
      setSelectedFitIndex(index);
      setTargetSlot(option.values.targetSlot);
      setWaveBank(option.values.waveBank);
      setSegmentTop(option.values.segmentTop);
      setSegmentLength(option.values.segmentLength);
    },
    [fitOptions],
  );

  if (!open) return null;

  const canImport = !isOperating && !!tone && !!wavData && !isLoading;
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

  return (
    <SlideDrawer
      open={open}
      title="Import library tone"
      onClose={handleClose}
      footer={footer}
    >
      {hasStarted ? (
        // `import-progress` + `import-success` data-testids preserved
        // from the legacy chrome so existing e2e specs that poll for
        // these markers (device-library-roundtrip.spec.ts,
        // device-library-autofit.spec.ts, etc.) continue to work
        // under the v3 SlideDrawer. The wrapping div is a thin
        // marker over the shared StepLogBody — no extra layout.
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
                Tone imported successfully — wrote to{' '}
                <span style={{ fontFamily: 'var(--ac-font-mono)' }}>
                  {memoryLayout.formatToneSlot(targetSlot)}
                </span>
              </>
            }
          />
        </div>
      ) : isLoading ? (
        <OperationLoadingSpinner message="Loading tone data..." />
      ) : (
        <ToneImportFormBody
          tone={tone}
          toneFile={toneFile}
          setName={setName}
          segmentsNeeded={segmentsNeeded}
          targetSlot={targetSlot}
          setTargetSlot={setTargetSlot}
          waveBank={waveBank}
          setWaveBank={setWaveBank}
          segmentTop={segmentTop}
          setSegmentTop={setSegmentTop}
          selectedTargetIndex={selectedTargetIndex}
          setSelectedTargetIndex={setSelectedTargetIndex}
          targetGroup={targetGroup}
          memoryLayout={memoryLayout}
          deviceTones={deviceTones}
          willOverwriteTone={willOverwriteTone}
          existingToneName={existingToneName}
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

