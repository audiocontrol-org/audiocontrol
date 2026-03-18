/**
 * Import Samples Dialog
 *
 * Dialog for importing a sample bundle (drum kit or chopped sample) to the device.
 * Allows user to select starting tone slot, wave bank/segment, and patch slot.
 * All slot counts, bank options, and formatting are driven by MemoryLayout.
 */

import { useState, useCallback, useMemo } from 'react';
import type { OperationState } from '@/types/import-operation';
import { isOperationComplete } from '@/types/import-operation';
import * as Dialog from '@radix-ui/react-dialog';
import type { SamplerTone, SamplerPatch } from '@/core/midi/SamplerClient';
import type { SampleImportBundle } from '@/hooks/useImportSamples';
import { midiNoteToName } from '@audiocontrol/sampler-library/browser';
import { cn } from '@/lib/utils';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { MemoryMapPanel } from '@/components/ui/MemoryMapPanel';
import { BestFitPicker } from '@/components/ui/BestFitPicker';
import {
  OperationProgressBar,
  OperationErrorBanner,
  OperationSuccessScreen,
  OperationButtonContent,
  DialogCloseButton,
} from '@/components/ui/ImportStatus';
import type { AllocationProposal } from '@/components/ui/memory-map-types';
import { findContiguousBestFits } from '@/lib/best-fit';
import type { FitOption, ContiguousFitValues } from '@/lib/best-fit';

export interface ImportSamplesDialogProps extends OperationState {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bundle: SampleImportBundle;
  deviceTones: (SamplerTone | undefined)[];
  devicePatches: (SamplerPatch | undefined)[];
  onImport: (params: {
    startingToneSlot: number;
    waveBank: 0 | 1 | 2 | 3;
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
}: ImportSamplesDialogProps): JSX.Element {
  const config = useDeviceConfig();
  const { memoryLayout } = config;

  const totalSamples = bundle.slices.length;
  const { importTargets } = memoryLayout;
  const hasSource = !!bundle.source;

  // User selections
  const [selectedTargetIndex, setSelectedTargetIndex] = useState(0);
  const [startingToneSlot, setStartingToneSlot] = useState(0);
  const [waveBank, setWaveBank] = useState<0 | 1 | 2 | 3>(0);
  const [startingSegment, setStartingSegment] = useState(0);
  const [targetPatchSlot, setTargetPatchSlot] = useState(0);
  const [singlePatch, setSinglePatch] = useState(true);
  const [useMonolithicMode, setUseMonolithicMode] = useState(hasSource);

  // Best fit state
  const [fitOptions, setFitOptions] = useState<FitOption<ContiguousFitValues>[]>([]);
  const [selectedFitIndex, setSelectedFitIndex] = useState<number | null>(null);
  const [showBestFits, setShowBestFits] = useState(false);

  const selectedTarget = importTargets[selectedTargetIndex];
  const absoluteToneSlot = startingToneSlot + selectedTarget.toneIndexOffset;

  const targetGroup = memoryLayout.toneGroups.find(
    g => g.firstIndex === selectedTarget.toneIndexOffset
  ) ?? memoryLayout.toneGroups[0];
  const groupToneCount = targetGroup.count;

  const toneSlotsNeeded = useMonolithicMode ? totalSamples + 1 : totalSamples;
  const hasEnoughToneSlots = startingToneSlot + toneSlotsNeeded <= groupToneCount;
  const patchSlotsNeeded = singlePatch ? 1 : totalSamples;
  const hasEnoughPatchSlots = targetPatchSlot + patchSlotsNeeded <= config.totalPatches;

  const estimatedSegments = totalSamples;
  const hasEnoughSegments = startingSegment + estimatedSegments <= 18;

  const availableBanks = {
    labels: targetGroup.waveBankLabels,
    indices: targetGroup.waveBankIndices,
  };

  const selectedBankLabel = (() => {
    const labelIdx = availableBanks.indices.indexOf(waveBank);
    return labelIdx >= 0 ? availableBanks.labels[labelIdx] : String(waveBank);
  })();

  const proposal = useMemo((): AllocationProposal => {
    const toneSlots = Array.from(
      { length: toneSlotsNeeded },
      (_, i) => absoluteToneSlot + i
    );
    const waveSegments = [{
      bank: waveBank,
      segmentTop: startingSegment,
      segmentLength: estimatedSegments,
    }];
    return { toneSlots, waveSegments };
  }, [absoluteToneSlot, toneSlotsNeeded, waveBank, startingSegment, estimatedSegments]);

  const handleFindBestFit = useCallback(() => {
    const options = findContiguousBestFits(
      deviceTones, toneSlotsNeeded, estimatedSegments,
      memoryLayout.toneGroups, memoryLayout.formatToneSlot,
    );
    setFitOptions(options);
    setSelectedFitIndex(null);
    setShowBestFits(true);
  }, [deviceTones, toneSlotsNeeded, estimatedSegments, memoryLayout]);

  const handleSelectFit = useCallback((index: number) => {
    const option = fitOptions[index];
    if (!option) return;
    setSelectedFitIndex(index);
    setSelectedTargetIndex(option.values.targetIndex);
    setStartingToneSlot(option.values.startingToneSlot);
    setWaveBank(option.values.waveBank);
    setStartingSegment(option.values.startingSegment);
  }, [fitOptions]);

  const handleTargetChange = useCallback((index: number) => {
    setSelectedTargetIndex(index);
    setStartingToneSlot(0);
    const newGroup = memoryLayout.toneGroups.find(
      g => g.firstIndex === importTargets[index].toneIndexOffset
    ) ?? memoryLayout.toneGroups[0];
    setWaveBank(newGroup.waveBankIndices[0] as 0 | 1 | 2 | 3);
  }, [importTargets, memoryLayout.toneGroups]);

  const handleImport = useCallback(async () => {
    await onImport({
      startingToneSlot: absoluteToneSlot,
      waveBank,
      startingSegment,
      targetPatchSlot,
      singlePatch,
      patchName: bundle.name,
      useMonolithicMode,
    });
  }, [absoluteToneSlot, waveBank, startingSegment, targetPatchSlot, singlePatch, bundle.name, useMonolithicMode, onImport]);

  const handleClose = useCallback(() => {
    if (!isOperating) {
      onOpenChange(false);
    }
  }, [isOperating, onOpenChange]);

  const isComplete = isOperationComplete({ isOperating, progress, error: operationError });

  const maxStartingTone = Math.max(0, groupToneCount - toneSlotsNeeded);
  const maxStartingPatch = Math.max(0, config.totalPatches - (singlePatch ? 1 : totalSamples));

  // MIDI range for display
  const firstNote = bundle.slices[0]?.midiNote;
  const lastNote = bundle.slices[bundle.slices.length - 1]?.midiNote;

  // Summary description
  const summaryDescription = bundle.kitCount
    ? `"${bundle.name}" (${bundle.kitCount} kit${bundle.kitCount !== 1 ? 's' : ''}, ${totalSamples} samples)`
    : `"${bundle.name}" (${totalSamples} slice${totalSamples !== 1 ? 's' : ''})`;

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-s330-panel border border-s330-accent rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
          <Dialog.Title className="text-lg font-bold text-s330-text mb-4">
            Import Samples
          </Dialog.Title>

          {isComplete ? (
            <OperationSuccessScreen
              message="Samples imported successfully!"
              detail={
                <>
                  <p>Created {toneSlotsNeeded} tone{toneSlotsNeeded !== 1 ? 's' : ''} in slots {memoryLayout.formatToneSlot(absoluteToneSlot)} - {memoryLayout.formatToneSlot(absoluteToneSlot + toneSlotsNeeded - 1)}
                    {useMonolithicMode && ` (1 holder + ${totalSamples} sub-tones)`}
                  </p>
                  {singlePatch ? (
                    <p>Created 1 patch in slot {memoryLayout.formatPatchSlot(targetPatchSlot)} with all {totalSamples} samples mapped</p>
                  ) : (
                    <p>Created {totalSamples} patch{totalSamples !== 1 ? 'es' : ''} in slots {memoryLayout.formatPatchSlot(targetPatchSlot)} - {memoryLayout.formatPatchSlot(targetPatchSlot + totalSamples - 1)}</p>
                  )}
                </>
              }
              onDone={handleClose}
            />
          ) : (
            <div className="space-y-4">
              <Dialog.Description className="text-sm text-s330-muted">
                Import {summaryDescription}
              </Dialog.Description>

              {/* Bundle Summary */}
              <div className="bg-s330-bg rounded p-3 text-sm">
                <div className="text-s330-muted text-xs uppercase tracking-wide mb-2">Summary</div>
                <div className="grid grid-cols-2 gap-2">
                  {bundle.kitCount !== undefined && (
                    <div>
                      <span className="text-s330-muted">Kits:</span>
                      <span className="ml-2 text-s330-text">{bundle.kitCount}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-s330-muted">{bundle.kitCount ? 'Samples' : 'Slices'}:</span>
                    <span className="ml-2 text-s330-text">{totalSamples}</span>
                  </div>
                  <div>
                    <span className="text-s330-muted">Sample Rate:</span>
                    <span className="ml-2 text-s330-text">{bundle.sampleRate / 1000}kHz</span>
                  </div>
                  {firstNote !== undefined && lastNote !== undefined && (
                    <div>
                      <span className="text-s330-muted">MIDI Range:</span>
                      <span className="ml-2 text-s330-text">
                        {midiNoteToName(firstNote)} - {midiNoteToName(lastNote)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Memory Map */}
              <MemoryMapPanel
                deviceTones={deviceTones}
                toneGroups={memoryLayout.toneGroups}
                formatToneSlot={memoryLayout.formatToneSlot}
                proposal={proposal}
                onFindBestFit={handleFindBestFit}
                findBestFitDisabled={isOperating}
              />

              {showBestFits && fitOptions.length > 0 && (
                <BestFitPicker
                  options={fitOptions}
                  selectedIndex={selectedFitIndex}
                  onSelect={handleSelectFit}
                  onClose={() => setShowBestFits(false)}
                  disabled={isOperating}
                />
              )}

              {/* Import Target */}
              <div>
                <label htmlFor="importTarget" className="block text-sm text-s330-muted mb-1">
                  Target
                </label>
                <select
                  id="importTarget"
                  value={selectedTargetIndex}
                  onChange={(e) => handleTargetChange(Number(e.target.value))}
                  disabled={isOperating}
                  className={cn(
                    'w-full bg-s330-bg border border-s330-accent/50 rounded px-3 py-2 text-s330-text',
                    'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                    isOperating && 'opacity-50'
                  )}
                >
                  {importTargets.map((target, i) => (
                    <option key={i} value={i}>{target.label}</option>
                  ))}
                </select>
              </div>

              {/* Starting Tone Slot */}
              <div>
                <label htmlFor="startingToneSlot" className="block text-sm text-s330-muted mb-1">
                  Starting Tone Slot (needs {toneSlotsNeeded} consecutive slot{toneSlotsNeeded !== 1 ? 's' : ''})
                  {useMonolithicMode && <span className="text-yellow-500 ml-1">(+1 for wave holder)</span>}
                </label>
                <select
                  id="startingToneSlot"
                  value={startingToneSlot}
                  onChange={(e) => setStartingToneSlot(Number(e.target.value))}
                  disabled={isOperating}
                  className={cn(
                    'w-full bg-s330-bg border border-s330-accent/50 rounded px-3 py-2 text-s330-text',
                    'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                    isOperating && 'opacity-50'
                  )}
                >
                  {Array.from({ length: maxStartingTone + 1 }, (_, i) => {
                    const absStart = i + selectedTarget.toneIndexOffset;
                    const absEnd = absStart + toneSlotsNeeded - 1;
                    const hasOccupied = Array.from({ length: toneSlotsNeeded }, (_, j) => deviceTones[absStart + j])
                      .some((t) => t !== undefined);
                    return (
                      <option key={i} value={i}>
                        {memoryLayout.formatToneSlot(absStart)} - {memoryLayout.formatToneSlot(absEnd)}
                        {hasOccupied ? ' (will overwrite)' : ' (empty)'}
                      </option>
                    );
                  })}
                </select>
                {!hasEnoughToneSlots && (
                  <p className="text-xs text-red-400 mt-1">
                    Not enough consecutive tone slots available
                  </p>
                )}
              </div>

              {/* Wave Bank and Segment */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="waveBank" className="block text-sm text-s330-muted mb-1">
                    Wave Bank
                  </label>
                  <select
                    id="waveBank"
                    value={waveBank}
                    onChange={(e) => setWaveBank(Number(e.target.value) as 0 | 1 | 2 | 3)}
                    disabled={isOperating}
                    className={cn(
                      'w-full bg-s330-bg border border-s330-accent/50 rounded px-3 py-2 text-s330-text',
                      'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                      isOperating && 'opacity-50'
                    )}
                  >
                    {availableBanks.indices.map((idx, i) => (
                      <option key={idx} value={idx}>Bank {availableBanks.labels[i]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="startingSegment" className="block text-sm text-s330-muted mb-1">
                    Starting Segment
                  </label>
                  <select
                    id="startingSegment"
                    value={startingSegment}
                    onChange={(e) => setStartingSegment(Number(e.target.value))}
                    disabled={isOperating}
                    className={cn(
                      'w-full bg-s330-bg border border-s330-accent/50 rounded px-3 py-2 text-s330-text',
                      'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                      isOperating && 'opacity-50'
                    )}
                  >
                    {Array.from({ length: 18 }, (_, i) => (
                      <option key={i} value={i}>
                        Segment {i}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-s330-muted -mt-2">
                Each sample uses 1+ segments based on length. Total segments: ~{estimatedSegments}
              </p>
              {!hasEnoughSegments && (
                <p className="text-xs text-yellow-500">
                  Warning: May not have enough segments. Actual usage depends on sample lengths.
                </p>
              )}

              {/* Patch Mode Toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="singlePatch"
                  checked={singlePatch}
                  onChange={(e) => setSinglePatch(e.target.checked)}
                  disabled={isOperating}
                  className="w-4 h-4 rounded bg-s330-bg border-s330-accent/50 text-s330-highlight focus:ring-s330-highlight"
                />
                <label htmlFor="singlePatch" className="text-sm text-s330-text">
                  Create single patch with all samples mapped
                </label>
              </div>

              {/* Monolithic Mode Toggle — only for source-based bundles */}
              {hasSource && (
                <div className="border border-s330-accent/30 rounded p-3 bg-s330-bg/50">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="monolithicMode"
                      checked={useMonolithicMode}
                      onChange={(e) => setUseMonolithicMode(e.target.checked)}
                      disabled={isOperating}
                      className="w-4 h-4 rounded bg-s330-bg border-s330-accent/50 text-s330-highlight focus:ring-s330-highlight"
                    />
                    <label htmlFor="monolithicMode" className="text-sm text-s330-text">
                      Use monolithic mode with sub-tones
                      <span className="ml-2 text-xs text-s330-muted">(recommended)</span>
                    </label>
                  </div>
                  {useMonolithicMode && (
                    <p className="text-xs text-s330-muted mt-2">
                      Uploads all slices as one contiguous wave segment. Creates a "holder" primary tone
                      that owns the wave data (not mapped to any MIDI note), then all {totalSamples} slices
                      become sub-tones with their own start/end points. Uses {toneSlotsNeeded} tone slots total.
                    </p>
                  )}
                </div>
              )}

              {/* Patch Slot */}
              <div>
                <label htmlFor="targetPatchSlot" className="block text-sm text-s330-muted mb-1">
                  {singlePatch ? 'Patch Slot' : `Starting Patch Slot (needs ${totalSamples} consecutive slots)`}
                </label>
                <select
                  id="targetPatchSlot"
                  value={targetPatchSlot}
                  onChange={(e) => setTargetPatchSlot(Number(e.target.value))}
                  disabled={isOperating}
                  className={cn(
                    'w-full bg-s330-bg border border-s330-accent/50 rounded px-3 py-2 text-s330-text',
                    'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                    isOperating && 'opacity-50'
                  )}
                >
                  {singlePatch ? (
                    Array.from({ length: config.totalPatches }, (_, i) => {
                      const hasOccupied = devicePatches[i] !== undefined;
                      return (
                        <option key={i} value={i}>
                          {memoryLayout.formatPatchSlot(i)}
                          {hasOccupied ? ' (will overwrite)' : ' (empty)'}
                        </option>
                      );
                    })
                  ) : (
                    Array.from({ length: maxStartingPatch + 1 }, (_, i) => {
                      const endSlot = i + totalSamples - 1;
                      const hasOccupied = Array.from({ length: totalSamples }, (_, j) => devicePatches[i + j])
                        .some((p) => p !== undefined);
                      return (
                        <option key={i} value={i}>
                          {memoryLayout.formatPatchSlot(i)} - {memoryLayout.formatPatchSlot(endSlot)}
                          {hasOccupied ? ' (will overwrite)' : ' (empty)'}
                        </option>
                      );
                    })
                  )}
                </select>
                {!hasEnoughPatchSlots && (
                  <p className="text-xs text-red-400 mt-1">
                    Not enough consecutive patch slots available
                  </p>
                )}
              </div>

              {/* Allocation Preview */}
              <div className="bg-s330-bg rounded p-3 text-sm">
                <div className="text-s330-muted text-xs uppercase tracking-wide mb-2">Allocation Preview</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-s330-muted">Tones:</span>
                    <span className="text-s330-text">
                      {memoryLayout.formatToneSlot(absoluteToneSlot)} - {memoryLayout.formatToneSlot(absoluteToneSlot + toneSlotsNeeded - 1)}
                      {useMonolithicMode && <span className="text-yellow-500 ml-1">(+1 holder)</span>}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-s330-muted">Wave Memory:</span>
                    <span className="text-s330-text">
                      Bank {selectedBankLabel}, Segment {startingSegment}+
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-s330-muted">Patch{singlePatch ? '' : 'es'}:</span>
                    <span className="text-s330-text">
                      {singlePatch
                        ? memoryLayout.formatPatchSlot(targetPatchSlot)
                        : `${memoryLayout.formatPatchSlot(targetPatchSlot)} - ${memoryLayout.formatPatchSlot(targetPatchSlot + totalSamples - 1)}`
                      }
                    </span>
                  </div>
                </div>
                <div className="text-xs text-s330-muted mt-2">
                  {singlePatch
                    ? `Single patch with all ${totalSamples} samples mapped to MIDI notes.`
                    : 'One patch per sample, each mapping one MIDI note to one tone.'
                  }
                </div>
              </div>

              {isOperating && progress && (
                <OperationProgressBar progress={progress} />
              )}

              {operationError && <OperationErrorBanner error={operationError} />}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleClose}
                  disabled={isOperating}
                  className={cn(
                    'ac-btn ac-btn-ghost',
                    isOperating && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={isOperating || !hasEnoughToneSlots || !hasEnoughPatchSlots}
                  className={cn(
                    'ac-btn ac-btn-primary',
                    (isOperating || !hasEnoughToneSlots || !hasEnoughPatchSlots) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <OperationButtonContent isOperating={isOperating} label="Import Samples" />
                </button>
              </div>
            </div>
          )}

          <Dialog.Close asChild>
            <DialogCloseButton disabled={isOperating} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
