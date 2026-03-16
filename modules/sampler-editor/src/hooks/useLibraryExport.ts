/**
 * Library Export Hook
 *
 * Manages state and callbacks for exporting tones and patches
 * from the device to the library (device -> library direction).
 */

import { useState, useCallback, type MutableRefObject } from 'react';
import type { SamplerClientInterface, SamplerTone, SamplerPatch } from '@/core/midi/SamplerClient';
import type { DeviceDragData } from '@/components/library/DeviceMemoryPanel';
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
  exportProgress: number | undefined;
  exportError: string | null;
  exportStatus: string | null;

  // Export patch dialog
  exportPatchDialog: ExportPatchDialogState | null;
  exportPatchProgress: number | undefined;
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
  const [exportProgress, setExportProgress] = useState<number | undefined>(undefined);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  // Export patch dialog state
  const [exportPatchDialog, setExportPatchDialog] = useState<ExportPatchDialogState | null>(null);
  const [exportPatchProgress, setExportPatchProgress] = useState<number | undefined>(undefined);
  const [exportPatchError, setExportPatchError] = useState<string | null>(null);

  // Shared
  const [isExporting, setIsExporting] = useState(false);

  // Close export tone dialog (only when not exporting)
  const closeExportToneDialog = useCallback(() => {
    if (!isExporting) {
      setExportToneDialog(null);
      setExportProgress(undefined);
      setExportError(null);
      setExportStatus(null);
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
    setExportStatus(null);
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
    setExportProgress(0);
    setExportStatus(`Fetching wave data...`);

    try {
      // Request wave data from device
      const waveData = await clientRef.current.requestWaveData(
        toneIndex,
        (received, total) => {
          const progress = total > 0 ? Math.floor((received / total) * 50) : 0;
          setExportProgress(progress);
        }
      );

      setExportStatus(`Writing to library...`);
      setExportProgress(50);

      // Export to library with the user-specified name
      await exportToneToDirectory(
        libraryHandle,
        { ...tone, name: toneName },
        waveData,
        toneName,
        (progress) => {
          setExportProgress(50 + Math.floor(progress / 2));
        }
      );

      setExportProgress(100);
      setExportStatus('Export complete');

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
    setExportPatchProgress(0);

    try {
      // Get all tone slots referenced by this patch
      const referencedSlots = getPatchToneDependencies(patch);
      const totalSlots = referencedSlots.length;

      // Fetch all referenced tones from the device
      const bundleTones: PatchBundleTone[] = [];

      for (let i = 0; i < referencedSlots.length; i++) {
        const slot = referencedSlots[i];
        const tone = tones[slot];

        if (!tone) {
          throw new Error(`Tone at slot ${slot} not loaded from device. Try refreshing device data first.`);
        }

        // Progress: 0-60% for fetching tones
        const baseProgress = Math.floor((i / totalSlots) * 60);
        setExportPatchProgress(baseProgress);

        // Fetch wave data for this tone
        const waveData = await client.requestWaveData(
          slot,
          (received, total) => {
            const fetchProgress = total > 0 ? (received / total) : 0;
            setExportPatchProgress(baseProgress + Math.floor(fetchProgress * (60 / totalSlots)));
          }
        );

        bundleTones.push({ slot, tone, waveData });
      }

      setExportPatchProgress(60);

      // Export to library with the user-specified name and all dependent tones
      await exportPatchToDirectory(
        libraryHandle,
        { ...patch, common: { ...patch.common, name: patchName } },
        bundleTones,
        patchName,
        (progress) => {
          // Progress: 60-100% for writing files
          setExportPatchProgress(60 + Math.floor(progress * 0.4));
        }
      );

      setExportPatchProgress(100);

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
    exportStatus,
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
