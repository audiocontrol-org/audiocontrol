/**
 * Import Library Patch Dialog
 *
 * Dialog for importing a patch from a library set to the device.
 * Handles automatic import of required tones with user-configurable slot mappings.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { OperationState } from '@/types/import-operation';
import { isOperationComplete } from '@/types/import-operation';
import * as Dialog from '@radix-ui/react-dialog';
import type { SamplerTone, SamplerPatch } from '@/core/midi/SamplerClient';
import type { SetYaml, StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import {
  loadPatchFromSet,
  loadToneFromSet,
  loadSetManifest,
  loadIndividualPatch,
  convertYamlToS330Patch,
  convertYamlToS330Tone,
  getPatchToneDependencies,
  remapPatchToneLayers,
} from '@/lib/library-service';
import { suggestPatchAllocation, isToneSlotEmpty, isPatchSlotEmpty, type WaveBankIndex } from '@/lib/slot-allocation';
import { cn } from '@/lib/utils';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { MemoryMapPanel } from '@/components/ui/MemoryMapPanel';
import { BestFitPicker } from '@/components/ui/BestFitPicker';
import {
  OperationProgressBar,
  OperationErrorBanner,
  OperationSuccessScreen,
  OperationLoadingSpinner,
  OperationButtonContent,
  DialogCloseButton,
} from '@/components/ui/ImportStatus';
import type { AllocationProposal } from '@/components/ui/memory-map-types';
import { findPatchBestFits } from '@/lib/best-fit';
import type { FitOption, PatchFitValues } from '@/lib/best-fit';

interface ToneImportMapping {
  /** Original slot in the library set */
  originalSlot: number;
  /** File name in the set */
  fileName: string;
  /** Target slot on device */
  targetSlot: number;
  /**
   * Target wave bank.
   *
   * `number` (rather than `0 | 1 | 2 | 3`) because the bank `<option>` set is
   * layout-driven via `MemoryLayout.getWaveBanksForTone(targetSlot)` — S-330
   * yields `{0, 1}`, S-550 yields `{0, 1}` for tones 0-31 and `{2, 3}` for
   * tones 32-63. The static literal union cannot encode the per-slot
   * narrowing, and the device-client boundary already validates against
   * `DeviceConfig.maxWaveBankIndex`. Mirrors the widening on
   * `useLibraryImportDialogs.ImportPatchParams` (commit 10a21a6d / #393).
   */
  waveBank: number;
  /** Target segment start */
  segmentTop: number;
  /** Segments needed (from original tone) */
  segmentsNeeded: number;
}

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
}: ImportLibraryPatchDialogProps): JSX.Element {
  const config = useDeviceConfig();
  const { memoryLayout } = config;

  // State for loaded data
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [patch, setPatch] = useState<SamplerPatch | null>(null);
  const [_manifest, setManifest] = useState<SetYaml | null>(null);

  // User selections - use initialTargetSlot if provided
  const [targetPatchSlot, setTargetPatchSlot] = useState(initialTargetSlot ?? 0);
  const [toneMappings, setToneMappings] = useState<ToneImportMapping[]>([]);

  // Best fit state
  const [fitOptions, setFitOptions] = useState<FitOption<PatchFitValues>[]>([]);
  const [selectedFitIndex, setSelectedFitIndex] = useState<number | null>(null);
  const [showBestFits, setShowBestFits] = useState(false);

  // Track missing tones (referenced by patch but not found in library/manifest)
  const [missingToneSlots, setMissingToneSlots] = useState<number[]>([]);

  // Load patch and manifest when dialog opens
  useEffect(() => {
    if (!open) return;

    setIsLoading(true);
    setLoadError(null);
    setPatch(null);
    setManifest(null);
    setToneMappings([]);
    setMissingToneSlots([]);

    const loadData = async () => {
      try {
        // Check if this is an individual patch bundle (not from a set)
        const isIndividual = setName === '__individual__';
        let convertedPatch: SamplerPatch;
        // `preferredBank` stays a `WaveBankIndex` (`0 | 1 | 2 | 3`) because it
        // feeds `suggestPatchAllocation`, whose signature requires that
        // literal-union. The user-visible `ToneImportMapping.waveBank` is
        // widened to `number` separately because the rendered `<option>` set
        // is layout-driven via `getWaveBanksForTone`.
        let dependentTones: Array<{ originalSlot: number; segmentsNeeded: number; fileName: string; preferredBank: WaveBankIndex }> = [];

        if (isIndividual) {
          // Load individual patch bundle directly from library
          const bundle = await loadIndividualPatch(libraryHandle, patchFile, patchPath ?? []);
          convertedPatch = convertYamlToS330Patch(bundle.patch);
          setPatch(convertedPatch);

          // Analyze which tones the patch actually references
          const requiredTones = getPatchToneDependencies(convertedPatch);
          const missing: number[] = [];

          // Collect dependent tone info from bundle
          for (const slot of requiredTones) {
            const toneData = bundle.tones.get(slot);
            if (toneData) {
              const convertedTone = convertYamlToS330Tone(toneData.yaml);
              dependentTones.push({
                originalSlot: slot,
                segmentsNeeded: toneData.segmentsNeeded,
                fileName: `T${String(slot + 1).padStart(2, '0')}`,
                // Cast retained: `SSeriesWaveParams.bank` is `number` upstream,
                // but `suggestPatchAllocation`'s `preferredBank` parameter
                // requires `WaveBankIndex`. Pre-existing — not in scope for #396.
                preferredBank: convertedTone.wave.bank as WaveBankIndex,
              });
            } else {
              // Track tones referenced by patch but not found in bundle
              missing.push(slot);
            }
          }

          setMissingToneSlots(missing);
          setManifest(null);
        } else {
          // Load from a set
          const loadedManifest = await loadSetManifest(libraryHandle, setName);
          setManifest(loadedManifest);

          // Load patch
          const patchYaml = await loadPatchFromSet(libraryHandle, setName, patchFile);
          convertedPatch = convertYamlToS330Patch(patchYaml);
          setPatch(convertedPatch);

          // Analyze dependencies
          const requiredTones = getPatchToneDependencies(convertedPatch);
          const missing: number[] = [];

          for (const slot of requiredTones) {
            const toneEntry = loadedManifest.tones.find((t) => t.slot === slot);
            if (toneEntry) {
              dependentTones.push({
                originalSlot: slot,
                segmentsNeeded: toneEntry.waveAllocation.segmentLength,
                fileName: toneEntry.file,
                preferredBank: toneEntry.waveAllocation.bank,
              });
            } else {
              // Track tones referenced by patch but not found in manifest
              missing.push(slot);
            }
          }

          setMissingToneSlots(missing);
        }

        // Use smart allocation to find safe defaults for patch and all tones
        const allocation = suggestPatchAllocation(
          deviceTones,
          devicePatches,
          dependentTones.map(t => ({ originalSlot: t.originalSlot, segmentsNeeded: t.segmentsNeeded })),
          initialTargetSlot,
          dependentTones[0]?.preferredBank
        );

        // Set patch slot - prefer empty slot unless user dragged to specific slot
        if (initialTargetSlot !== undefined) {
          setTargetPatchSlot(initialTargetSlot);
        } else {
          setTargetPatchSlot(allocation.patchSlot);
        }

        // Create tone mappings with smart allocation
        const mappings: ToneImportMapping[] = dependentTones.map((tone, index) => {
          const toneAlloc = allocation.toneAllocations[index];
          return {
            originalSlot: tone.originalSlot,
            fileName: tone.fileName,
            targetSlot: toneAlloc?.suggestedSlot ?? tone.originalSlot,
            waveBank: toneAlloc?.waveMemory?.bank ?? tone.preferredBank,
            segmentTop: toneAlloc?.waveMemory?.segmentTop ?? 0,
            segmentsNeeded: tone.segmentsNeeded,
          };
        });

        setToneMappings(mappings);
      } catch (err) {
        console.error('[ImportLibraryPatchDialog] Failed to load patch:', err);
        setLoadError(err instanceof Error ? err.message : 'Failed to load patch');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [open, libraryHandle, setName, patchFile, patchPath, initialTargetSlot, deviceTones, devicePatches]);

  // Update a tone mapping
  const updateToneMapping = useCallback((index: number, updates: Partial<ToneImportMapping>) => {
    setToneMappings((prev) =>
      prev.map((m, i) => (i === index ? { ...m, ...updates } : m))
    );
  }, []);

  // Perform import
  const handleImport = useCallback(async () => {
    if (!patch) return;

    const isIndividual = setName === '__individual__';

    try {
      // Load all required tones with wave data
      const tonesData: Array<{
        tone: SamplerTone;
        wavData: Uint8Array;
        targetSlot: number;
        /** See `ToneImportMapping.waveBank` JSDoc — `number` for S-330/S-550 parity. */
        waveBank: number;
        segmentTop: number;
        segmentLength: number;
      }> = [];

      if (isIndividual) {
        // Load tones from individual patch bundle
        const bundle = await loadIndividualPatch(libraryHandle, patchFile, patchPath ?? []);

        for (const mapping of toneMappings) {
          const toneData = bundle.tones.get(mapping.originalSlot);
          if (!toneData) {
            throw new Error(`Tone at slot ${mapping.originalSlot} not found in bundle`);
          }

          const tone = convertYamlToS330Tone(toneData.yaml);
          tonesData.push({
            tone,
            wavData: toneData.wavData,
            targetSlot: mapping.targetSlot,
            waveBank: mapping.waveBank,
            segmentTop: mapping.segmentTop,
            // Use segmentsNeeded from the bundle - it's calculated from the actual WAV data
            segmentLength: toneData.segmentsNeeded,
          });
        }
      } else {
        // Load tones from set
        for (const mapping of toneMappings) {
          const { yaml, wavData } = await loadToneFromSet(
            libraryHandle,
            setName,
            mapping.fileName
          );
          const tone = convertYamlToS330Tone(yaml);

          tonesData.push({
            tone,
            wavData,
            targetSlot: mapping.targetSlot,
            waveBank: mapping.waveBank,
            segmentTop: mapping.segmentTop,
            segmentLength: mapping.segmentsNeeded,
          });
        }
      }

      // Build tone remapping
      const toneRemapping = new Map<number, number>();
      for (const mapping of toneMappings) {
        toneRemapping.set(mapping.originalSlot, mapping.targetSlot);
      }

      // Remap patch tone layers
      const remappedPatch = remapPatchToneLayers(patch, toneRemapping);

      await onImport({
        setName,
        patchFile,
        patch: remappedPatch,
        targetPatchSlot,
        tones: tonesData,
      });
    } catch (err) {
      console.error('[ImportLibraryPatchDialog] Import failed:', err);
      throw err;
    }
  }, [patch, toneMappings, targetPatchSlot, onImport, libraryHandle, setName, patchFile, patchPath]);

  const handleClose = useCallback(() => {
    if (!isOperating) {
      onOpenChange(false);
    }
  }, [isOperating, onOpenChange]);

  const isComplete = isOperationComplete({ isOperating, progress, error: operationError });
  const error = loadError || operationError;

  // Check if selected slots will overwrite existing data
  // Use the same empty detection as the allocation logic (segmentLength === 0 for tones, blank name + no assignments for patches)
  const willOverwritePatch = useMemo(() => {
    return !isPatchSlotEmpty(devicePatches, targetPatchSlot);
  }, [devicePatches, targetPatchSlot]);

  const existingPatchName = devicePatches[targetPatchSlot]?.common.name;

  const handleFindBestFit = useCallback(() => {
    const deps = toneMappings.map((m) => ({ originalSlot: m.originalSlot, segmentsNeeded: m.segmentsNeeded }));
    const options = findPatchBestFits(
      deviceTones, devicePatches, deps,
      memoryLayout.toneGroups, memoryLayout.formatPatchSlot,
    );
    setFitOptions(options);
    setSelectedFitIndex(null);
    setShowBestFits(true);
  }, [deviceTones, devicePatches, toneMappings, memoryLayout, config.totalPatches]);

  const handleSelectFit = useCallback((index: number) => {
    const option = fitOptions[index];
    if (!option) return;
    setSelectedFitIndex(index);
    setTargetPatchSlot(option.values.targetPatchSlot);
    setToneMappings((prev) =>
      prev.map((m, i) => {
        const alloc = option.values.toneAllocations[i];
        if (!alloc) return m;
        return { ...m, targetSlot: alloc.targetSlot, waveBank: alloc.waveBank, segmentTop: alloc.segmentTop };
      })
    );
  }, [fitOptions]);

  const proposal = useMemo((): AllocationProposal => ({
    toneSlots: toneMappings.map((m) => m.targetSlot),
    waveSegments: toneMappings.map((m) => ({
      bank: m.waveBank,
      segmentTop: m.segmentTop,
      segmentLength: m.segmentsNeeded,
    })),
  }), [toneMappings]);

  // Check which tones will be overwritten
  const toneOverwrites = useMemo(() => {
    return toneMappings.map((mapping) => ({
      willOverwrite: !isToneSlotEmpty(deviceTones, mapping.targetSlot),
      existingName: deviceTones[mapping.targetSlot]?.name,
    }));
  }, [toneMappings, deviceTones]);

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-s330-panel border border-s330-accent rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col p-6">
          <Dialog.Title className="text-lg font-bold text-s330-text mb-4">
            Import Library Patch
          </Dialog.Title>

          {isComplete ? (
            <div data-testid="import-success">
              <OperationSuccessScreen
                message="Patch imported successfully!"
                onDone={handleClose}
              />
            </div>
          ) : isLoading ? (
            <OperationLoadingSpinner message="Loading patch data..." />
          ) : (
            <div className="flex flex-col min-h-0 space-y-4">
              <Dialog.Description className="text-sm text-s330-muted">
                Import "{patchFile}" {setName === '__individual__' ? 'from library' : `from ${setName}`} with its required tones.
              </Dialog.Description>

              {/* Patch Info */}
              {patch && (
                <div className="bg-s330-bg rounded p-3 text-sm">
                  <div className="text-s330-muted text-xs uppercase tracking-wide mb-2">Patch Info</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-s330-muted">Name:</span>
                      <span className="ml-2 text-s330-text">{patch.common.name}</span>
                    </div>
                    <div>
                      <span className="text-s330-muted">Key Mode:</span>
                      <span className="ml-2 text-s330-text capitalize">{patch.common.keyMode}</span>
                    </div>
                    <div>
                      <span className="text-s330-muted">Level:</span>
                      <span className="ml-2 text-s330-text">{patch.common.level}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Memory Map */}
              <MemoryMapPanel
                deviceTones={deviceTones}
                toneGroups={memoryLayout.toneGroups}
                formatToneSlot={memoryLayout.formatToneSlot}
                proposal={proposal}
                onFindBestFit={toneMappings.length > 0 ? handleFindBestFit : undefined}
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

              {/* Target Patch Slot */}
              <div>
                <label htmlFor="targetPatchSlot" className="block text-sm text-s330-muted mb-1">
                  Target Patch Slot
                </label>
                <select
                  id="targetPatchSlot"
                  value={targetPatchSlot}
                  onChange={(e) => setTargetPatchSlot(Number(e.target.value))}
                  disabled={isOperating}
                  data-testid="target-slot-select"
                  className={cn(
                    'w-full bg-s330-bg border rounded px-3 py-2 text-s330-text',
                    'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                    isOperating && 'opacity-50',
                    willOverwritePatch
                      ? 'border-yellow-500/50'
                      : 'border-s330-accent/50'
                  )}
                >
                  {Array.from({ length: config.totalPatches }, (_, i) => {
                    const existingPatch = devicePatches[i];
                    const slotLabel = memoryLayout.formatPatchSlot(i);
                    const isEmpty = isPatchSlotEmpty(devicePatches, i);
                    const occupancy = isEmpty ? ' - (empty)' : ` - ${existingPatch?.common.name || ''}`;
                    return (
                      <option key={i} value={i} data-occupied={!isEmpty || undefined}>
                        {slotLabel}{occupancy}
                      </option>
                    );
                  })}
                </select>
                {willOverwritePatch && (
                  <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1" data-testid="slot-occupied-warning">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Will overwrite "{existingPatchName}"
                  </p>
                )}
              </div>

              {/* Missing Tone Warning */}
              {missingToneSlots.length > 0 && (
                <div
                  data-testid="missing-tone-warning"
                  className="text-yellow-400 text-sm p-2 bg-yellow-900/20 rounded flex items-center gap-2"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>
                    Some referenced tones could not be found: {missingToneSlots.map(s => memoryLayout.formatToneSlot(s)).join(', ')}
                  </span>
                </div>
              )}

              {/* Required Tones Section */}
              {toneMappings.length > 0 && (
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="text-sm text-s330-muted mb-2">
                    Required Tones ({toneMappings.length})
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {toneMappings.map((mapping, index) => {
                      // Bank options are layout-driven per the mapping's
                      // target slot. S-330 always returns A/B; S-550 returns
                      // A/B for tones 0-31 and C/D for tones 32-63. Mirrors
                      // the pattern in ImportSampleDialog — no device
                      // conditionals here.
                      const { labels: bankLabels, indices: bankIndices } =
                        memoryLayout.getWaveBanksForTone(mapping.targetSlot);
                      return (
                      <div
                        key={mapping.originalSlot}
                        className="bg-s330-bg rounded p-3 text-sm space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-s330-text font-medium">{mapping.fileName}</span>
                          <span className="text-xs text-s330-muted">
                            Original: {memoryLayout.formatToneSlot(mapping.originalSlot)}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs text-s330-muted mb-1">
                              Target Slot
                              {toneOverwrites[index]?.willOverwrite && (
                                <span className="ml-1 text-yellow-400" title={`Will overwrite ${toneOverwrites[index]?.existingName}`}>⚠</span>
                              )}
                            </label>
                            <select
                              value={mapping.targetSlot}
                              onChange={(e) => {
                                const newTargetSlot = Number(e.target.value);
                                // Clamp wave bank to a valid one for the new
                                // target slot — on S-550, moving across the
                                // 32-tone block boundary changes the valid
                                // bank set ({0,1} ↔ {2,3}). If the current
                                // bank is still valid, keep it; otherwise
                                // pick the first valid bank for the new slot.
                                const validBanks =
                                  memoryLayout.getWaveBanksForTone(newTargetSlot).indices;
                                const newWaveBank = validBanks.includes(mapping.waveBank)
                                  ? mapping.waveBank
                                  : (validBanks[0] ?? mapping.waveBank);
                                updateToneMapping(index, {
                                  targetSlot: newTargetSlot,
                                  waveBank: newWaveBank,
                                });
                              }}
                              disabled={isOperating}
                              className={cn(
                                'w-full bg-s330-panel border rounded px-2 py-1 text-s330-text text-xs',
                                'focus:outline-none focus:ring-1 focus:ring-s330-highlight',
                                isOperating && 'opacity-50',
                                toneOverwrites[index]?.willOverwrite
                                  ? 'border-yellow-500/50'
                                  : 'border-s330-accent/50'
                              )}
                            >
                              {Array.from({ length: config.totalTones }, (_, i) => {
                                const existingTone = deviceTones[i];
                                const slotLabel = memoryLayout.formatToneSlot(i);
                                const isEmpty = isToneSlotEmpty(deviceTones, i);
                                const occupancy = isEmpty ? ' - (empty)' : ` - ${existingTone?.name || ''}`;
                                return (
                                  <option key={i} value={i}>
                                    {slotLabel}{occupancy}
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs text-s330-muted mb-1">
                              Wave Bank
                            </label>
                            <select
                              value={mapping.waveBank}
                              onChange={(e) =>
                                updateToneMapping(index, { waveBank: Number(e.target.value) })
                              }
                              disabled={isOperating}
                              className={cn(
                                'w-full bg-s330-panel border border-s330-accent/50 rounded px-2 py-1 text-s330-text text-xs',
                                'focus:outline-none focus:ring-1 focus:ring-s330-highlight',
                                isOperating && 'opacity-50'
                              )}
                            >
                              {bankIndices.map((bankIndex, i) => (
                                <option key={bankIndex} value={bankIndex}>Bank {bankLabels[i]}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs text-s330-muted mb-1">
                              Segment ({mapping.segmentsNeeded} needed)
                            </label>
                            <select
                              value={mapping.segmentTop}
                              onChange={(e) =>
                                updateToneMapping(index, { segmentTop: Number(e.target.value) })
                              }
                              disabled={isOperating}
                              className={cn(
                                'w-full bg-s330-panel border border-s330-accent/50 rounded px-2 py-1 text-s330-text text-xs',
                                'focus:outline-none focus:ring-1 focus:ring-s330-highlight',
                                isOperating && 'opacity-50'
                              )}
                            >
                              {Array.from(
                                { length: Math.max(1, 18 - mapping.segmentsNeeded + 1) },
                                (_, i) => (
                                  <option key={i} value={i}>
                                    {i} - {i + mapping.segmentsNeeded - 1}
                                  </option>
                                )
                              )}
                            </select>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {toneMappings.length === 0 && patch && (
                <div className="bg-s330-bg rounded p-3 text-sm text-s330-muted">
                  This patch has no tone assignments.
                </div>
              )}

              {isOperating && progress && (
                <div data-testid="import-progress">
                  <OperationProgressBar progress={progress} />
                </div>
              )}

              {error && <OperationErrorBanner error={error} />}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
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
                  disabled={isOperating || !patch}
                  data-testid="confirm-import-button"
                  className={cn(
                    'ac-btn ac-btn-primary',
                    (isOperating || !patch) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <OperationButtonContent
                    isOperating={isOperating}
                    label={`Import Patch${toneMappings.length > 0 ? ` + ${toneMappings.length} Tones` : ''}`}
                  />
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
