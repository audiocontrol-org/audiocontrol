/**
 * Library Export Hook
 *
 * Manages state and callbacks for exporting tones and patches
 * from the device to the library (device -> library direction).
 */

import { useState, useCallback, type MutableRefObject } from 'react';
import type { SamplerClientInterface, SamplerTone, SamplerPatch } from '@/core/midi/SamplerClient';
import type { DeviceDragData } from '@/components/library/DeviceMemoryPanel';
import type { OperationProgress } from '@/types/import-operation';
import {
  exportToneToDirectory,
  exportPatchToDirectory,
  getPatchToneDependencies,
  listIndividualTones,
  listIndividualPatches,
  type LibraryToneInfo,
  type LibraryPatchInfo,
  type PatchBundleTone,
} from '@/lib/library-service';

interface ExportToneDialogState {
  tone: SamplerTone;
  toneIndex: number;
}

interface ExportPatchDialogState {
  patch: SamplerPatch;
  patchIndex: number;
}

interface UseLibraryExportOptions {
  clientRef: MutableRefObject<SamplerClientInterface | null>;
  libraryHandle: FileSystemDirectoryHandle | null;
  tones: (SamplerTone | undefined)[];
  patches: (SamplerPatch | undefined)[];
  setIndividualTones: (tones: LibraryToneInfo[]) => void;
  setIndividualPatches: (patches: LibraryPatchInfo[]) => void;
}

interface UseLibraryExportResult {
  // Export tone dialog
  exportToneDialog: ExportToneDialogState | null;
  exportProgress: OperationProgress | undefined;
  exportError: string | null;

  // Export patch dialog
  exportPatchDialog: ExportPatchDialogState | null;
  exportPatchProgress: OperationProgress | undefined;
  exportPatchError: string | null;

  // Shared
  isExporting: boolean;

  // Handlers
  handleDropDeviceTone: (data: DeviceDragData) => void;
  handleDropDevicePatch: (data: DeviceDragData) => void;
  handleExportTone: (toneName: string, toneIndex: number) => Promise<void>;
  handleExportPatch: (patchName: string, patchIndex: number) => Promise<void>;

  // Dialog closers (for onOpenChange)
  closeExportToneDialog: () => void;
  closeExportPatchDialog: () => void;
}

export function useLibraryExport({
  clientRef,
  libraryHandle,
  tones,
  patches,
  setIndividualTones,
  setIndividualPatches,
}: UseLibraryExportOptions): UseLibraryExportResult {
  // Export tone dialog state
  const [exportToneDialog, setExportToneDialog] = useState<ExportToneDialogState | null>(null);
  const [exportProgress, setExportProgress] = useState<OperationProgress | undefined>(undefined);
  const [exportError, setExportError] = useState<string | null>(null);

  // Export patch dialog state
  const [exportPatchDialog, setExportPatchDialog] = useState<ExportPatchDialogState | null>(null);
  const [exportPatchProgress, setExportPatchProgress] = useState<OperationProgress | undefined>(undefined);
  const [exportPatchError, setExportPatchError] = useState<string | null>(null);

  // Shared
  const [isExporting, setIsExporting] = useState(false);

  // Close export tone dialog (only when not exporting)
  const closeExportToneDialog = useCallback(() => {
    if (!isExporting) {
      setExportToneDialog(null);
      setExportProgress(undefined);
      setExportError(null);
    }
  }, [isExporting]);

  // Close export patch dialog (only when not exporting)
  const closeExportPatchDialog = useCallback(() => {
    if (!isExporting) {
      setExportPatchDialog(null);
      setExportPatchProgress(undefined);
      setExportPatchError(null);
    }
  }, [isExporting]);

  // Handle drop from device memory to library (export tone) - opens dialog
  const handleDropDeviceTone = useCallback((data: DeviceDragData) => {
    if (!libraryHandle || !clientRef.current) {
      window.alert('Library or device not connected');
      return;
    }

    if (data.type !== 'tone') {
      return;
    }

    const tone = tones[data.index];
    if (!tone) {
      window.alert('Tone not loaded from device. Try refreshing device data first.');
      return;
    }

    // Open the export dialog
    setExportToneDialog({ tone, toneIndex: data.index });
    setExportProgress(undefined);
    setExportError(null);
  }, [libraryHandle, clientRef, tones]);

  // Handle drop from device memory to library (export patch) - opens dialog
  const handleDropDevicePatch = useCallback((data: DeviceDragData) => {
    if (!libraryHandle) {
      window.alert('Library not connected');
      return;
    }

    if (data.type !== 'patch') {
      return;
    }

    const patch = patches[data.index];
    if (!patch) {
      window.alert('Patch not loaded from device. Try refreshing device data first.');
      return;
    }

    // Open the export dialog
    setExportPatchDialog({ patch, patchIndex: data.index });
    setExportPatchProgress(undefined);
    setExportPatchError(null);
  }, [libraryHandle, patches]);

  // Handle export tone from dialog
  const handleExportTone = useCallback(async (toneName: string, toneIndex: number) => {
    if (!libraryHandle || !clientRef.current || !exportToneDialog) {
      throw new Error('Library or device not connected');
    }

    const tone = exportToneDialog.tone;

    setIsExporting(true);
    setExportError(null);
    setExportProgress({
      currentStep: 1, totalSteps: 2,
      stepLabel: 'Fetching wave data',
      bytesSent: 0, bytesTotal: 0,
      bytesSentAllSteps: 0, bytesTotalAllSteps: 0,
    });

    try {
      // Step 1: Fetch wave data from device
      const waveData = await clientRef.current.requestWaveData(
        toneIndex,
        (received, total) => {
          setExportProgress({
            currentStep: 1,
            totalSteps: 2,
            stepLabel: 'Fetching wave data',
            bytesSent: received,
            bytesTotal: total,
            bytesSentAllSteps: 0,
            bytesTotalAllSteps: total,
          });
        }
      );

      const waveBytes = waveData.data.length;

      // Step 2: Write to library
      setExportProgress({
        currentStep: 2,
        totalSteps: 2,
        stepLabel: 'Writing to library',
        bytesSent: 0,
        bytesTotal: 0,
        bytesSentAllSteps: waveBytes,
        bytesTotalAllSteps: waveBytes,
      });

      await exportToneToDirectory(
        libraryHandle,
        { ...tone, name: toneName },
        waveData,
        toneName,
        () => {
          // Writing is fast — just keep the progress at step 2
        }
      );

      // Final state: complete
      setExportProgress({
        currentStep: 2,
        totalSteps: 2,
        stepLabel: 'Export complete',
        bytesSent: 0,
        bytesTotal: 0,
        bytesSentAllSteps: waveBytes,
        bytesTotalAllSteps: waveBytes,
      });

      // Refresh individual tones list
      const updatedTones = await listIndividualTones(libraryHandle);
      setIndividualTones(updatedTones);
    } catch (err) {
      console.error('[LibraryPage] Failed to export tone:', err);
      const message = err instanceof Error ? err.message : 'Failed to export tone';
      setExportError(message);
      throw err;
    } finally {
      setIsExporting(false);
    }
  }, [libraryHandle, clientRef, exportToneDialog, setIndividualTones]);

  // Handle export patch from dialog
  const handleExportPatch = useCallback(async (patchName: string, _patchIndex: number) => {
    if (!libraryHandle || !exportPatchDialog || !clientRef.current) {
      throw new Error('Library or device not connected');
    }

    const patch = exportPatchDialog.patch;
    const client = clientRef.current;

    setIsExporting(true);
    setExportPatchError(null);

    try {
      // Get all tone slots referenced by this patch
      const referencedSlots = getPatchToneDependencies(patch);

      // Separate original tones (own wave data) from sub-tones (share source tone's wave data)
      const originalSlotSet = new Set<number>();
      const subToneSlots: number[] = [];
      for (const slot of referencedSlots) {
        const tone = tones[slot];
        if (!tone) {
          throw new Error(`Tone at slot ${slot} not loaded from device. Try refreshing device data first.`);
        }
        if (tone.wave.segmentLength > 0) {
          originalSlotSet.add(slot);
        } else {
          subToneSlots.push(slot);
        }
      }

      // Ensure every sub-tone's source (original) tone is included,
      // even if the patch doesn't directly reference it
      for (const slot of subToneSlots) {
        const tone = tones[slot]!;
        const sourceSlot = tone.sourceTone;
        if (!originalSlotSet.has(sourceSlot)) {
          const sourceTone = tones[sourceSlot];
          if (!sourceTone) {
            throw new Error(`Source tone T${sourceSlot + 1} for sub-tone T${slot + 1} not loaded from device. Try refreshing device data first.`);
          }
          originalSlotSet.add(sourceSlot);
        }
      }

      const originalSlots = Array.from(originalSlotSet).sort((a, b) => a - b);

      // Only original tones need wave data fetched
      const totalSteps = originalSlots.length + 1; // fetches + write step

      // Set initial progress immediately so the progress bar renders
      setExportPatchProgress({
        currentStep: 1, totalSteps,
        stepLabel: originalSlots.length > 0
          ? `Fetching tone T${originalSlots[0] + 1}`
          : 'Writing files to library',
        bytesSent: 0, bytesTotal: 0,
        bytesSentAllSteps: 0, bytesTotalAllSteps: 0,
      });

      // Fetch wave data for original tones only
      const bundleTones: PatchBundleTone[] = [];
      let completedWaveBytes = 0;
      let estimatedTotalBytes = 0;

      for (let i = 0; i < originalSlots.length; i++) {
        const slot = originalSlots[i];
        const tone = tones[slot]!;

        const waveData = await client.requestWaveData(
          slot,
          (received, total) => {
            if (estimatedTotalBytes === 0 || received === 0) {
              estimatedTotalBytes = completedWaveBytes + total + (total * (originalSlots.length - i - 1));
            }
            setExportPatchProgress({
              currentStep: i + 1,
              totalSteps,
              stepLabel: `Fetching tone T${slot + 1}`,
              bytesSent: received,
              bytesTotal: total,
              bytesSentAllSteps: completedWaveBytes,
              bytesTotalAllSteps: estimatedTotalBytes,
            });
          }
        );

        completedWaveBytes += waveData.data.length;
        bundleTones.push({ slot, tone, waveData });
      }

      // Add sub-tones without wave data — they reference the original tone's WAV
      for (const slot of subToneSlots) {
        const tone = tones[slot]!;
        bundleTones.push({ slot, tone });
      }

      // Final step: write to library
      setExportPatchProgress({
        currentStep: totalSteps,
        totalSteps: totalSteps,
        stepLabel: 'Writing files to library',
        bytesSent: 0,
        bytesTotal: 0,
        bytesSentAllSteps: completedWaveBytes,
        bytesTotalAllSteps: completedWaveBytes,
      });

      await exportPatchToDirectory(
        libraryHandle,
        { ...patch, common: { ...patch.common, name: patchName } },
        bundleTones,
        patchName,
        () => {
          // Writing is fast — keep progress at final step
        }
      );

      // Final state: complete
      setExportPatchProgress({
        currentStep: totalSteps,
        totalSteps: totalSteps,
        stepLabel: 'Export complete',
        bytesSent: 0,
        bytesTotal: 0,
        bytesSentAllSteps: completedWaveBytes,
        bytesTotalAllSteps: completedWaveBytes,
      });

      // Refresh individual patches list
      const updatedPatches = await listIndividualPatches(libraryHandle);
      setIndividualPatches(updatedPatches);
    } catch (err) {
      console.error('[LibraryPage] Failed to export patch:', err);
      const message = err instanceof Error ? err.message : 'Failed to export patch';
      setExportPatchError(message);
      throw err;
    } finally {
      setIsExporting(false);
    }
  }, [libraryHandle, clientRef, exportPatchDialog, tones, setIndividualPatches]);

  return {
    exportToneDialog,
    exportProgress,
    exportError,
    exportPatchDialog,
    exportPatchProgress,
    exportPatchError,
    isExporting,
    handleDropDeviceTone,
    handleDropDevicePatch,
    handleExportTone,
    handleExportPatch,
    closeExportToneDialog,
    closeExportPatchDialog,
  };
}
