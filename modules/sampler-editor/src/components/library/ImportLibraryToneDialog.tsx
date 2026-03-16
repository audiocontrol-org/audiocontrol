/**
 * Import Library Tone Dialog
 *
 * Dialog for importing a tone from a library set to a device slot.
 * Allows user to select target slot and wave memory allocation.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { S330Tone } from '@/core/midi/S330Client';
import {
  loadToneFromSet,
  loadSetManifest,
  loadIndividualTone,
  convertYamlToS330Tone,
} from '@/lib/library-service';
import { suggestToneAllocation, isToneSlotEmpty } from '@/lib/slot-allocation';
import { cn } from '@/lib/utils';
import { calculateSegmentsNeeded } from '@audiocontrol/sampler-devices/s330';
import { useDeviceConfig } from '@/context/DeviceConfigContext';

export interface ImportLibraryToneDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onOpenChange: (open: boolean) => void;
  /** Library directory handle */
  libraryHandle: FileSystemDirectoryHandle;
  /** Name of the set containing the tone */
  setName: string;
  /** File name of the tone (without extension) */
  toneFile: string;
  /** Current device tones (to show slot occupancy) */
  deviceTones: (S330Tone | undefined)[];
  /** Initial target tone slot (e.g., from drag-drop target) */
  initialTargetSlot?: number;
  /** Callback to perform the import */
  onImport: (params: {
    setName: string;
    toneFile: string;
    tone: S330Tone;
    wavData: Uint8Array;
    targetSlot: number;
    waveBank: 0 | 1 | 2 | 3;
    segmentTop: number;
    segmentLength: number;
  }) => Promise<void>;
  /** Whether import is in progress */
  isImporting: boolean;
  /** Import progress (0-100) */
  importProgress?: number;
  /** Import error message */
  importError?: string | null;
  /** Status message */
  statusMessage?: string | null;
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
  isImporting,
  importProgress,
  importError,
  statusMessage,
}: ImportLibraryToneDialogProps): JSX.Element {
  const config = useDeviceConfig();

  // State for loaded tone
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tone, setTone] = useState<S330Tone | null>(null);
  const [wavData, setWavData] = useState<Uint8Array | null>(null);

  // User selections - use initialTargetSlot if provided
  const [targetSlot, setTargetSlot] = useState(initialTargetSlot ?? 0);
  const [waveBank, setWaveBank] = useState<0 | 1 | 2 | 3>(0);
  const [segmentTop, setSegmentTop] = useState(0);
  const [segmentLength, setSegmentLength] = useState(1);

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
        let convertedTone: S330Tone;
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
    if (!isImporting) {
      onOpenChange(false);
    }
  }, [isImporting, onOpenChange]);

  // Use the segment length from the manifest (stored in state)
  const segmentsNeeded = segmentLength;
  const isComplete = importProgress === 100 && !isImporting;
  const error = loadError || importError;

  // Check if selected slot will overwrite existing data
  // Use the same empty detection as the allocation logic (segmentLength === 0)
  const willOverwriteTone = useMemo(() => {
    return !isToneSlotEmpty(deviceTones, targetSlot);
  }, [deviceTones, targetSlot]);

  const existingToneName = deviceTones[targetSlot]?.name;

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-s330-panel border border-s330-accent rounded-lg shadow-xl w-full max-w-md p-6">
          <Dialog.Title className="text-lg font-bold text-s330-text mb-4">
            Import Library Tone
          </Dialog.Title>

          {isComplete ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Tone imported successfully!</span>
              </div>
              <div className="flex justify-end">
                <button onClick={handleClose} className="ac-btn ac-btn-primary">
                  Done
                </button>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-s330-muted">
                <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Loading tone data...</span>
              </div>
            </div>
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

              {/* Target Slot Selection */}
              <div>
                <label htmlFor="targetSlot" className="block text-sm text-s330-muted mb-1">
                  Target Tone Slot
                </label>
                <select
                  id="targetSlot"
                  value={targetSlot}
                  onChange={(e) => setTargetSlot(Number(e.target.value))}
                  disabled={isImporting}
                  className={cn(
                    'w-full bg-s330-bg border rounded px-3 py-2 text-s330-text',
                    'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                    isImporting && 'opacity-50',
                    willOverwriteTone
                      ? 'border-yellow-500/50'
                      : 'border-s330-accent/50'
                  )}
                >
                  {Array.from({ length: 32 }, (_, i) => {
                    const existingTone = deviceTones[i];
                    const slotLabel = config.memoryLayout.formatToneSlot(i);
                    const isEmpty = isToneSlotEmpty(deviceTones, i);
                    const occupancy = isEmpty ? ' - (empty)' : ` - ${existingTone?.name || ''}`;
                    return (
                      <option key={i} value={i}>
                        {slotLabel}{occupancy}
                      </option>
                    );
                  })}
                </select>
                {willOverwriteTone && (
                  <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
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
                    disabled={isImporting}
                    className={cn(
                      'w-full bg-s330-bg border border-s330-accent/50 rounded px-3 py-2 text-s330-text',
                      'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                      isImporting && 'opacity-50'
                    )}
                  >
                    {(() => {
                      const banks = config.memoryLayout.getWaveBanksForTone(targetSlot);
                      return banks.indices.map((idx, i) => (
                        <option key={idx} value={idx}>Bank {banks.labels[i]}</option>
                      ));
                    })()}
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
                    disabled={isImporting}
                    className={cn(
                      'w-full bg-s330-bg border border-s330-accent/50 rounded px-3 py-2 text-s330-text',
                      'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                      isImporting && 'opacity-50'
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
                    {statusMessage || `Uploading to device... ${importProgress.toFixed(0)}%`}
                  </p>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="text-sm text-red-400 bg-red-900/20 rounded p-2">
                  {error}
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
                  disabled={isImporting || !tone || !wavData}
                  className={cn(
                    'ac-btn ac-btn-primary',
                    (isImporting || !tone || !wavData) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {isImporting ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Importing...
                    </>
                  ) : (
                    'Import Tone'
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
