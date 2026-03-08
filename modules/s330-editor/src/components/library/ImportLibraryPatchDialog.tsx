/**
 * Import Library Patch Dialog
 *
 * Dialog for importing a patch from a library set to the device.
 * Handles automatic import of required tones with user-configurable slot mappings.
 */

import { useState, useCallback, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { S330Tone, S330Patch } from '@/core/midi/S330Client';
import type { SetYaml } from '@audiocontrol/sampler-library/browser';
import {
  loadPatchFromSet,
  loadToneFromSet,
  loadSetManifest,
  convertYamlToS330Patch,
  convertYamlToS330Tone,
  getPatchToneDependencies,
  remapPatchToneLayers,
} from '@/lib/library-service';
import { cn } from '@/lib/utils';

/**
 * Format tone slot number (0-31 -> T11-T48)
 */
function formatToneSlot(index: number): string {
  const bank = Math.floor(index / 8) + 1;
  const slot = (index % 8) + 1;
  return `T${bank}${slot}`;
}

/**
 * Format patch slot number (0-15 -> P01-P16)
 */
function formatPatchSlot(index: number): string {
  return `P${String(index + 1).padStart(2, '0')}`;
}

interface ToneImportMapping {
  /** Original slot in the library set */
  originalSlot: number;
  /** File name in the set */
  fileName: string;
  /** Target slot on device */
  targetSlot: number;
  /** Target wave bank */
  waveBank: 0 | 1;
  /** Target segment start */
  segmentTop: number;
  /** Segments needed (from original tone) */
  segmentsNeeded: number;
}

export interface ImportLibraryPatchDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onOpenChange: (open: boolean) => void;
  /** Library directory handle */
  libraryHandle: FileSystemDirectoryHandle;
  /** Name of the set containing the patch */
  setName: string;
  /** File name of the patch (without extension) */
  patchFile: string;
  /** Current device tones (to show slot occupancy) */
  deviceTones: (S330Tone | undefined)[];
  /** Current device patches (to show slot occupancy) */
  devicePatches: (S330Patch | undefined)[];
  /** Callback to perform the import */
  onImport: (params: {
    setName: string;
    patchFile: string;
    patch: S330Patch;
    targetPatchSlot: number;
    tones: Array<{
      tone: S330Tone;
      wavData: Uint8Array;
      targetSlot: number;
      waveBank: 0 | 1;
      segmentTop: number;
      segmentLength: number;
    }>;
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

export function ImportLibraryPatchDialog({
  open,
  onOpenChange,
  libraryHandle,
  setName,
  patchFile,
  deviceTones,
  devicePatches,
  onImport,
  isImporting,
  importProgress,
  importError,
  statusMessage,
}: ImportLibraryPatchDialogProps): JSX.Element {
  // State for loaded data
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [patch, setPatch] = useState<S330Patch | null>(null);
  const [manifest, setManifest] = useState<SetYaml | null>(null);

  // User selections
  const [targetPatchSlot, setTargetPatchSlot] = useState(0);
  const [toneMappings, setToneMappings] = useState<ToneImportMapping[]>([]);

  // Load patch and manifest when dialog opens
  useEffect(() => {
    if (!open) return;

    setIsLoading(true);
    setLoadError(null);
    setPatch(null);
    setManifest(null);
    setToneMappings([]);

    const loadData = async () => {
      try {
        // Load manifest
        const loadedManifest = await loadSetManifest(libraryHandle, setName);
        setManifest(loadedManifest);

        // Find patch entry to get original slot
        const patchEntry = loadedManifest.patches.find((p) => p.file === patchFile);
        if (patchEntry) {
          setTargetPatchSlot(patchEntry.slot);
        }

        // Load patch
        const patchYaml = await loadPatchFromSet(libraryHandle, setName, patchFile);
        const convertedPatch = convertYamlToS330Patch(patchYaml);
        setPatch(convertedPatch);

        // Analyze dependencies and create initial mappings
        const requiredTones = getPatchToneDependencies(convertedPatch);
        const mappings: ToneImportMapping[] = [];

        for (const slot of requiredTones) {
          const toneEntry = loadedManifest.tones.find((t) => t.slot === slot);
          if (toneEntry) {
            mappings.push({
              originalSlot: slot,
              fileName: toneEntry.file,
              targetSlot: slot, // Default to same slot
              waveBank: toneEntry.waveAllocation.bank,
              segmentTop: toneEntry.waveAllocation.segmentTop,
              segmentsNeeded: toneEntry.waveAllocation.segmentLength,
            });
          }
        }

        setToneMappings(mappings);
      } catch (err) {
        console.error('[ImportLibraryPatchDialog] Failed to load patch:', err);
        setLoadError(err instanceof Error ? err.message : 'Failed to load patch');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [open, libraryHandle, setName, patchFile]);

  // Update a tone mapping
  const updateToneMapping = useCallback((index: number, updates: Partial<ToneImportMapping>) => {
    setToneMappings((prev) =>
      prev.map((m, i) => (i === index ? { ...m, ...updates } : m))
    );
  }, []);

  // Perform import
  const handleImport = useCallback(async () => {
    if (!patch || !manifest) return;

    try {
      // Load all required tones with wave data
      const tonesData: Array<{
        tone: S330Tone;
        wavData: Uint8Array;
        targetSlot: number;
        waveBank: 0 | 1;
        segmentTop: number;
        segmentLength: number;
      }> = [];

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
  }, [patch, manifest, toneMappings, targetPatchSlot, onImport, libraryHandle, setName, patchFile]);

  const handleClose = useCallback(() => {
    if (!isImporting) {
      onOpenChange(false);
    }
  }, [isImporting, onOpenChange]);

  const isComplete = importProgress === 100 && !isImporting;
  const error = loadError || importError;

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-s330-panel border border-s330-accent rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col p-6">
          <Dialog.Title className="text-lg font-bold text-s330-text mb-4">
            Import Library Patch
          </Dialog.Title>

          {isComplete ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Patch imported successfully!</span>
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
                <span>Loading patch data...</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col min-h-0 space-y-4">
              <Dialog.Description className="text-sm text-s330-muted">
                Import "{patchFile}" from {setName} with its required tones.
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

              {/* Target Patch Slot */}
              <div>
                <label htmlFor="targetPatchSlot" className="block text-sm text-s330-muted mb-1">
                  Target Patch Slot
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
                  {Array.from({ length: 16 }, (_, i) => {
                    const existingPatch = devicePatches[i];
                    const slotLabel = formatPatchSlot(i);
                    const occupancy = existingPatch ? ` - ${existingPatch.common.name}` : ' - (empty)';
                    return (
                      <option key={i} value={i}>
                        {slotLabel}{occupancy}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Required Tones Section */}
              {toneMappings.length > 0 && (
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="text-sm text-s330-muted mb-2">
                    Required Tones ({toneMappings.length})
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {toneMappings.map((mapping, index) => (
                      <div
                        key={mapping.originalSlot}
                        className="bg-s330-bg rounded p-3 text-sm space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-s330-text font-medium">{mapping.fileName}</span>
                          <span className="text-xs text-s330-muted">
                            Original: {formatToneSlot(mapping.originalSlot)}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs text-s330-muted mb-1">
                              Target Slot
                            </label>
                            <select
                              value={mapping.targetSlot}
                              onChange={(e) =>
                                updateToneMapping(index, { targetSlot: Number(e.target.value) })
                              }
                              disabled={isImporting}
                              className={cn(
                                'w-full bg-s330-panel border border-s330-accent/50 rounded px-2 py-1 text-s330-text text-xs',
                                'focus:outline-none focus:ring-1 focus:ring-s330-highlight',
                                isImporting && 'opacity-50'
                              )}
                            >
                              {Array.from({ length: 32 }, (_, i) => {
                                const existingTone = deviceTones[i];
                                const slotLabel = formatToneSlot(i);
                                const occupancy = existingTone ? ` - ${existingTone.name}` : '';
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
                                updateToneMapping(index, { waveBank: Number(e.target.value) as 0 | 1 })
                              }
                              disabled={isImporting}
                              className={cn(
                                'w-full bg-s330-panel border border-s330-accent/50 rounded px-2 py-1 text-s330-text text-xs',
                                'focus:outline-none focus:ring-1 focus:ring-s330-highlight',
                                isImporting && 'opacity-50'
                              )}
                            >
                              <option value={0}>Bank A</option>
                              <option value={1}>Bank B</option>
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
                              disabled={isImporting}
                              className={cn(
                                'w-full bg-s330-panel border border-s330-accent/50 rounded px-2 py-1 text-s330-text text-xs',
                                'focus:outline-none focus:ring-1 focus:ring-s330-highlight',
                                isImporting && 'opacity-50'
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
                    ))}
                  </div>
                </div>
              )}

              {toneMappings.length === 0 && patch && (
                <div className="bg-s330-bg rounded p-3 text-sm text-s330-muted">
                  This patch has no tone assignments.
                </div>
              )}

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
              {error && (
                <div className="text-sm text-red-400 bg-red-900/20 rounded p-2">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
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
                  disabled={isImporting || !patch}
                  className={cn(
                    'ac-btn ac-btn-primary',
                    (isImporting || !patch) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {isImporting ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Importing...
                    </>
                  ) : (
                    <>Import Patch {toneMappings.length > 0 && `+ ${toneMappings.length} Tones`}</>
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
