/**
 * Import Library Tone Dialog
 *
 * Dialog for importing a tone from a library set to a device slot.
 * Allows user to select target slot and wave memory allocation.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { OperationState } from '@/types/import-operation';
import { isOperationComplete } from '@/types/import-operation';
import * as Dialog from '@radix-ui/react-dialog';
import type { SamplerTone } from '@/core/midi/SamplerClient';
import {
  loadToneFromSet,
  loadSetManifest,
  loadIndividualTone,
  convertYamlToS330Tone,
  type StorageDirectoryHandle,
} from '@/lib/library-service';
import { suggestToneAllocation, isToneSlotEmpty } from '@/lib/slot-allocation';
import { cn } from '@/lib/utils';
import { calculateSegmentsNeeded } from '@audiocontrol/sampler-devices/s330';
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
import { findToneBestFits } from '@/lib/best-fit';
import type { FitOption, ToneFitValues } from '@/lib/best-fit';

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
    waveBank: 0 | 1 | 2 | 3;
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
}: ImportLibraryToneDialogProps): JSX.Element {
  const config = useDeviceConfig();

  // State for loaded tone
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tone, setTone] = useState<SamplerTone | null>(null);
  const [wavData, setWavData] = useState<Uint8Array | null>(null);

  const { memoryLayout } = config;
  const { importTargets } = memoryLayout;

  // User selections
  const [selectedTargetIndex, setSelectedTargetIndex] = useState(0);
  const [targetSlot, setTargetSlot] = useState(initialTargetSlot ?? 0);
  const [waveBank, setWaveBank] = useState<0 | 1 | 2 | 3>(0);
  const [segmentTop, setSegmentTop] = useState(0);
  const [segmentLength, setSegmentLength] = useState(1);

  // Best fit state
  const [fitOptions, setFitOptions] = useState<FitOption<ToneFitValues>[]>([]);
  const [selectedFitIndex, setSelectedFitIndex] = useState<number | null>(null);
  const [showBestFits, setShowBestFits] = useState(false);

  const selectedTarget = importTargets[selectedTargetIndex];
  const targetGroup = memoryLayout.toneGroups.find(
    g => g.firstIndex === selectedTarget.toneIndexOffset
  ) ?? memoryLayout.toneGroups[0];

  // Load tone data when dialog opens
  useEffect(() => {
    if (!open) return;

    setIsLoading(true);
    setLoadError(null);
    setTone(null);
    setWavData(null);

    const loadData = async () => {
      try {
        // Check if this is an individual tone (not from a set)
        const isIndividual = setName === '__individual__';
        let loadedWavData: Uint8Array;
        let convertedTone: SamplerTone;
        let preferredBank: 0 | 1 | 2 | 3 = 0;

        if (isIndividual) {
          // Load individual tone directly from library
          const { yaml, wavData: data } = await loadIndividualTone(libraryHandle, toneFile);
          loadedWavData = data;
          convertedTone = convertYamlToS330Tone(yaml);
          preferredBank = convertedTone.wave.bank as 0 | 1 | 2 | 3;
        } else {
          // Load from a set
          const loadedManifest = await loadSetManifest(libraryHandle, setName);
          const entry = loadedManifest.tones.find((t) => t.file === toneFile);

          if (entry) {
            preferredBank = entry.waveAllocation.bank;
          }

          // Load tone and wave data
          const { yaml, wavData: data } = await loadToneFromSet(libraryHandle, setName, toneFile);
          loadedWavData = data;
          convertedTone = convertYamlToS330Tone(yaml);
        }

        setWavData(loadedWavData);
        setTone(convertedTone);

        // Calculate segments needed from actual wave data
        const segmentsRequired = calculateSegmentsNeeded(loadedWavData.length / 2);
        setSegmentLength(segmentsRequired);

        // Use smart allocation to find safe defaults
        // If dragged to a specific slot, use that as preferred; otherwise find empty slot
        const allocation = suggestToneAllocation(
          deviceTones,
          segmentsRequired,
          initialTargetSlot,
          preferredBank
        );

        // Set target slot - prefer empty slot unless user dragged to specific slot
        if (initialTargetSlot !== undefined) {
          // User dragged to specific slot - use it but they can change
          setTargetSlot(initialTargetSlot);
        } else {
          // Auto-select first empty slot
          setTargetSlot(allocation.toneSlot);
        }

        // Set wave memory allocation - prefer available memory
        if (allocation.waveMemory) {
          setWaveBank(allocation.waveMemory.bank);
          setSegmentTop(allocation.waveMemory.segmentTop);
        } else {
          // No available memory - use preferred bank, segment 0
          setWaveBank(preferredBank);
          setSegmentTop(0);
        }
      } catch (err) {
        console.error('[ImportLibraryToneDialog] Failed to load tone:', err);
        setLoadError(err instanceof Error ? err.message : 'Failed to load tone');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [open, libraryHandle, setName, toneFile, initialTargetSlot, deviceTones]);

  const handleImport = useCallback(async () => {
    if (!tone || !wavData) return;

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
  }, [tone, wavData, setName, toneFile, targetSlot, waveBank, segmentTop, segmentLength, onImport]);

  const handleClose = useCallback(() => {
    if (!isOperating) {
      onOpenChange(false);
    }
  }, [isOperating, onOpenChange]);

  // Use the segment length from the manifest (stored in state)
  const segmentsNeeded = segmentLength;
  const isComplete = isOperationComplete({ isOperating, progress, error: operationError });
  const error = loadError || operationError;

  // Check if selected slot will overwrite existing data
  // Use the same empty detection as the allocation logic (segmentLength === 0)
  const willOverwriteTone = useMemo(() => {
    return !isToneSlotEmpty(deviceTones, targetSlot);
  }, [deviceTones, targetSlot]);

  const existingToneName = deviceTones[targetSlot]?.name;

  const proposal = useMemo((): AllocationProposal => ({
    toneSlots: [targetSlot],
    waveSegments: [{ bank: waveBank, segmentTop, segmentLength: segmentsNeeded }],
  }), [targetSlot, waveBank, segmentTop, segmentsNeeded]);

  const handleFindBestFit = useCallback(() => {
    const options = findToneBestFits(deviceTones, segmentsNeeded, memoryLayout.toneGroups, memoryLayout.formatToneSlot);
    setFitOptions(options);
    setSelectedFitIndex(null);
    setShowBestFits(true);
  }, [deviceTones, segmentsNeeded, memoryLayout]);

  const handleSelectFit = useCallback((index: number) => {
    const option = fitOptions[index];
    if (!option) return;
    setSelectedFitIndex(index);
    setTargetSlot(option.values.targetSlot);
    setWaveBank(option.values.waveBank);
    setSegmentTop(option.values.segmentTop);
  }, [fitOptions]);

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-s330-panel border border-s330-accent rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
          <Dialog.Title className="text-lg font-bold text-s330-text mb-4">
            Import Library Tone
          </Dialog.Title>

          {isComplete ? (
            <div data-testid="import-success">
              <OperationSuccessScreen
                message="Tone imported successfully!"
                onDone={handleClose}
              />
            </div>
          ) : isLoading ? (
            <OperationLoadingSpinner message="Loading tone data..." />
          ) : (
            <div className="space-y-4">
              <Dialog.Description className="text-sm text-s330-muted">
                Import "{toneFile}" {setName === '__individual__' ? 'from library' : `from ${setName}`} to device.
              </Dialog.Description>

              {/* Tone Info */}
              {tone && (
                <div className="bg-s330-bg rounded p-3 text-sm">
                  <div className="text-s330-muted text-xs uppercase tracking-wide mb-2">Tone Info</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-s330-muted">Name:</span>
                      <span className="ml-2 text-s330-text">{tone.name}</span>
                    </div>
                    <div>
                      <span className="text-s330-muted">Sample Rate:</span>
                      <span className="ml-2 text-s330-text">{tone.sampleRate}</span>
                    </div>
                    <div>
                      <span className="text-s330-muted">Loop Mode:</span>
                      <span className="ml-2 text-s330-text capitalize">{tone.loopMode}</span>
                    </div>
                    <div>
                      <span className="text-s330-muted">Segments:</span>
                      <span className="ml-2 text-s330-text">{segmentsNeeded}</span>
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
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    setSelectedTargetIndex(idx);
                    const newGroup = memoryLayout.toneGroups.find(
                      g => g.firstIndex === importTargets[idx].toneIndexOffset
                    ) ?? memoryLayout.toneGroups[0];
                    setTargetSlot(newGroup.firstIndex);
                    setWaveBank(newGroup.waveBankIndices[0] as 0 | 1 | 2 | 3);
                  }}
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

              {/* Target Slot Selection (scoped to selected group) */}
              <div>
                <label htmlFor="targetSlot" className="block text-sm text-s330-muted mb-1">
                  Target Tone Slot
                </label>
                <select
                  id="targetSlot"
                  value={targetSlot}
                  onChange={(e) => setTargetSlot(Number(e.target.value))}
                  disabled={isOperating}
                  data-testid="target-slot-select"
                  className={cn(
                    'w-full bg-s330-bg border rounded px-3 py-2 text-s330-text',
                    'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                    isOperating && 'opacity-50',
                    willOverwriteTone
                      ? 'border-yellow-500/50'
                      : 'border-s330-accent/50'
                  )}
                >
                  {Array.from({ length: targetGroup.count }, (_, i) => {
                    const absIndex = targetGroup.firstIndex + i;
                    const existingTone = deviceTones[absIndex];
                    const slotLabel = memoryLayout.formatToneSlot(absIndex);
                    const isEmpty = isToneSlotEmpty(deviceTones, absIndex);
                    const occupancy = isEmpty ? ' - (empty)' : ` - ${existingTone?.name || ''}`;
                    return (
                      <option key={absIndex} value={absIndex} data-occupied={!isEmpty || undefined}>
                        {slotLabel}{occupancy}
                      </option>
                    );
                  })}
                </select>
                {willOverwriteTone && (
                  <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1" data-testid="slot-occupied-warning">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Will overwrite "{existingToneName}"
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
                    {targetGroup.waveBankIndices.map((idx, i) => (
                      <option key={idx} value={idx}>Bank {targetGroup.waveBankLabels[i]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="segmentTop" className="block text-sm text-s330-muted mb-1">
                    Segment (needs {segmentsNeeded})
                  </label>
                  <select
                    id="segmentTop"
                    value={segmentTop}
                    onChange={(e) => setSegmentTop(Number(e.target.value))}
                    disabled={isOperating}
                    className={cn(
                      'w-full bg-s330-bg border border-s330-accent/50 rounded px-3 py-2 text-s330-text',
                      'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                      isOperating && 'opacity-50'
                    )}
                  >
                    {Array.from({ length: Math.max(1, 18 - segmentsNeeded + 1) }, (_, i) => (
                      <option key={i} value={i}>
                        {i} - {i + segmentsNeeded - 1}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-s330-muted -mt-2">
                Warning: This will overwrite existing wave data in the target segment(s).
              </p>

              {isOperating && progress && (
                <div data-testid="import-progress">
                  <OperationProgressBar progress={progress} />
                </div>
              )}

              {error && <OperationErrorBanner error={error} />}

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
                  disabled={isOperating || !tone || !wavData}
                  data-testid="confirm-import-button"
                  className={cn(
                    'ac-btn ac-btn-primary',
                    (isOperating || !tone || !wavData) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <OperationButtonContent isOperating={isOperating} label="Import Tone" />
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
