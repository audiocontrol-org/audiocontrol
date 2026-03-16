/**
 * Import Drum Kit Dialog
 *
 * Dialog for importing a drum kit bundle to the device.
 * Allows user to select starting tone slot, wave bank/segment, and patch slot.
 * All slot counts, bank options, and formatting are driven by MemoryLayout.
 */

import { useState, useCallback, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { SamplerTone, SamplerPatch } from '@/core/midi/SamplerClient';
import type { ResolvedDrumKitBundle } from '@audiocontrol/sampler-library/browser';
import { midiNoteToName } from '@audiocontrol/sampler-library/browser';
import { cn } from '@/lib/utils';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { MemoryMapPanel } from '@/components/ui/MemoryMapPanel';
import type { AllocationProposal } from '@/components/ui/memory-map-types';

export interface ImportDrumKitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bundle: ResolvedDrumKitBundle;
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
  isImporting: boolean;
  importProgress?: number;
  importError?: string | null;
  statusMessage?: string | null;
}

export function ImportDrumKitDialog({
  open,
  onOpenChange,
  bundle,
  deviceTones,
  devicePatches,
  onImport,
  isImporting,
  importProgress,
  importError,
  statusMessage,
}: ImportDrumKitDialogProps): JSX.Element {
  const config = useDeviceConfig();
  const { memoryLayout } = config;

  const totalSamples = bundle.totalSamples;
  const { importTargets } = memoryLayout;

  // User selections
  const [selectedTargetIndex, setSelectedTargetIndex] = useState(0);
  const [startingToneSlot, setStartingToneSlot] = useState(0);
  const [waveBank, setWaveBank] = useState<0 | 1 | 2 | 3>(0);
  const [startingSegment, setStartingSegment] = useState(0);
  const [targetPatchSlot, setTargetPatchSlot] = useState(0);
  const [singlePatch, setSinglePatch] = useState(true);
  const [useMonolithicMode, setUseMonolithicMode] = useState(true);

  // The selected import target determines the tone/bank offsets
  const selectedTarget = importTargets[selectedTargetIndex];
  const absoluteToneSlot = startingToneSlot + selectedTarget.toneIndexOffset;

  // Tone group for the selected target — determines slot count and valid banks
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

  // Valid wave banks come from the target group
  const availableBanks = {
    labels: targetGroup.waveBankLabels,
    indices: targetGroup.waveBankIndices,
  };

  // Bank label for allocation preview
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

  // Reset relative selections when target changes
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
    if (!isImporting) {
      onOpenChange(false);
    }
  }, [isImporting, onOpenChange]);

  const isComplete = importProgress === 100 && !isImporting;

  // Max starting index that leaves enough room (relative to group, not absolute)
  const maxStartingTone = Math.max(0, groupToneCount - toneSlotsNeeded);
  const maxStartingPatch = Math.max(0, config.totalPatches - (singlePatch ? 1 : totalSamples));

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-s330-panel border border-s330-accent rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
          <Dialog.Title className="text-lg font-bold text-s330-text mb-4">
            Import Drum Kit
          </Dialog.Title>

          {isComplete ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Drum kit imported successfully!</span>
              </div>
              <div className="text-sm text-s330-muted">
                <p>Created {toneSlotsNeeded} tone{toneSlotsNeeded !== 1 ? 's' : ''} in slots {memoryLayout.formatToneSlot(absoluteToneSlot)} - {memoryLayout.formatToneSlot(absoluteToneSlot + toneSlotsNeeded - 1)}
                  {useMonolithicMode && ` (1 holder + ${totalSamples} sub-tones)`}
                </p>
                {singlePatch ? (
                  <p>Created 1 patch in slot {memoryLayout.formatPatchSlot(targetPatchSlot)} with all {totalSamples} samples mapped</p>
                ) : (
                  <p>Created {totalSamples} patch{totalSamples !== 1 ? 'es' : ''} in slots {memoryLayout.formatPatchSlot(targetPatchSlot)} - {memoryLayout.formatPatchSlot(targetPatchSlot + totalSamples - 1)}</p>
                )}
              </div>
              <div className="flex justify-end">
                <button onClick={handleClose} className="ac-btn ac-btn-primary">
                  Done
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Dialog.Description className="text-sm text-s330-muted">
                Import "{bundle.name}" ({bundle.kits.length} kit{bundle.kits.length !== 1 ? 's' : ''}, {totalSamples} samples)
              </Dialog.Description>

              {/* Kit Summary */}
              <div className="bg-s330-bg rounded p-3 text-sm">
                <div className="text-s330-muted text-xs uppercase tracking-wide mb-2">Kit Summary</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-s330-muted">Kits:</span>
                    <span className="ml-2 text-s330-text">{bundle.kits.length}</span>
                  </div>
                  <div>
                    <span className="text-s330-muted">Samples:</span>
                    <span className="ml-2 text-s330-text">{totalSamples}</span>
                  </div>
                  <div>
                    <span className="text-s330-muted">Sample Rate:</span>
                    <span className="ml-2 text-s330-text">{bundle.sampleRate / 1000}kHz</span>
                  </div>
                  <div>
                    <span className="text-s330-muted">MIDI Range:</span>
                    <span className="ml-2 text-s330-text">
                      {bundle.kits[0] && midiNoteToName(bundle.kits[0].midiNotes.kick)} - {bundle.kits[bundle.kits.length - 1] && midiNoteToName(bundle.kits[bundle.kits.length - 1]!.midiNotes.hhOpen)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Memory Map */}
              <MemoryMapPanel
                deviceTones={deviceTones}
                toneGroups={memoryLayout.toneGroups}
                formatToneSlot={memoryLayout.formatToneSlot}
                proposal={proposal}
              />

              {/* Import Target */}
              <div>
                <label htmlFor="importTarget" className="block text-sm text-s330-muted mb-1">
                  Target
                </label>
                <select
                  id="importTarget"
                  value={selectedTargetIndex}
                  onChange={(e) => handleTargetChange(Number(e.target.value))}
                  disabled={isImporting}
                  className={cn(
                    'w-full bg-s330-bg border border-s330-accent/50 rounded px-3 py-2 text-s330-text',
                    'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                    isImporting && 'opacity-50'
                  )}
                >
                  {importTargets.map((target, i) => (
                    <option key={i} value={i}>{target.label}</option>
                  ))}
                </select>
              </div>

              {/* Starting Tone Slot (relative to selected block) */}
              <div>
                <label htmlFor="startingToneSlot" className="block text-sm text-s330-muted mb-1">
                  Starting Tone Slot (needs {toneSlotsNeeded} consecutive slot{toneSlotsNeeded !== 1 ? 's' : ''})
                  {useMonolithicMode && <span className="text-yellow-500 ml-1">(+1 for wave holder)</span>}
                </label>
                <select
                  id="startingToneSlot"
                  value={startingToneSlot}
                  onChange={(e) => setStartingToneSlot(Number(e.target.value))}
                  disabled={isImporting}
                  className={cn(
                    'w-full bg-s330-bg border border-s330-accent/50 rounded px-3 py-2 text-s330-text',
                    'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                    isImporting && 'opacity-50'
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
                    disabled={isImporting}
                    className={cn(
                      'w-full bg-s330-bg border border-s330-accent/50 rounded px-3 py-2 text-s330-text',
                      'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                      isImporting && 'opacity-50'
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
                    disabled={isImporting}
                    className={cn(
                      'w-full bg-s330-bg border border-s330-accent/50 rounded px-3 py-2 text-s330-text',
                      'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                      isImporting && 'opacity-50'
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
                  disabled={isImporting}
                  className="w-4 h-4 rounded bg-s330-bg border-s330-accent/50 text-s330-highlight focus:ring-s330-highlight"
                />
                <label htmlFor="singlePatch" className="text-sm text-s330-text">
                  Create single patch with all samples mapped
                </label>
              </div>

              {/* Monolithic Mode Toggle */}
              <div className="border border-s330-accent/30 rounded p-3 bg-s330-bg/50">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="monolithicMode"
                    checked={useMonolithicMode}
                    onChange={(e) => setUseMonolithicMode(e.target.checked)}
                    disabled={isImporting}
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

              {/* Patch Slot */}
              <div>
                <label htmlFor="targetPatchSlot" className="block text-sm text-s330-muted mb-1">
                  {singlePatch ? 'Patch Slot' : `Starting Patch Slot (needs ${totalSamples} consecutive slots)`}
                </label>
                <select
                  id="targetPatchSlot"
                  value={targetPatchSlot}
                  onChange={(e) => setTargetPatchSlot(Number(e.target.value))}
                  disabled={isImporting}
                  className={cn(
                    'w-full bg-s330-bg border border-s330-accent/50 rounded px-3 py-2 text-s330-text',
                    'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                    isImporting && 'opacity-50'
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

              {/* Progress Bar */}
              {isImporting && importProgress !== undefined && (
                <div>
                  <div className="h-2 bg-s330-bg rounded-full overflow-hidden">
                    <div
                      className="h-full bg-s330-highlight transition-all duration-150 ease-out"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-s330-muted mt-1 text-right">
                    {statusMessage || `Importing... ${importProgress.toFixed(0)}%`}
                  </p>
                </div>
              )}

              {/* Error Display */}
              {importError && (
                <div className="text-sm text-red-400 bg-red-900/20 rounded p-2">
                  {importError}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleClose}
                  disabled={isImporting}
                  className={cn(
                    'ac-btn ac-btn-ghost',
                    isImporting && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={isImporting || !hasEnoughToneSlots || !hasEnoughPatchSlots}
                  className={cn(
                    'ac-btn ac-btn-primary',
                    (isImporting || !hasEnoughToneSlots || !hasEnoughPatchSlots) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {isImporting ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Importing...
                    </>
                  ) : (
                    'Import Drum Kit'
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
              disabled={isImporting}
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
