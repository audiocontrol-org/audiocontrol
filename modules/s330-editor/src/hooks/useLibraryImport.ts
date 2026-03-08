/**
 * useLibraryImport Hook
 *
 * Handles importing tones and patches from library sets to the device.
 * Manages dialog state, progress tracking, and device communication.
 */

import { useState, useCallback, MutableRefObject } from 'react';
import type { S330ClientInterface, S330Tone, S330Patch } from '@/core/midi/S330Client';

interface ImportToneDialogState {
  setName: string;
  toneFile: string;
}

interface ImportPatchDialogState {
  setName: string;
  patchFile: string;
}

interface UseLibraryImportOptions {
  clientRef: MutableRefObject<S330ClientInterface | null>;
  setTone: (index: number, tone: S330Tone) => void;
  setPatch: (index: number, patch: S330Patch) => void;
}

interface UseLibraryImportReturn {
  // Dialog state
  importToneDialog: ImportToneDialogState | null;
  importPatchDialog: ImportPatchDialogState | null;
  isImporting: boolean;
  importProgress: number | undefined;
  importError: string | null;
  importStatus: string | null;

  // Dialog handlers
  openImportToneDialog: (setName: string, toneFile: string) => void;
  openImportPatchDialog: (setName: string, patchFile: string) => void;
  closeImportToneDialog: () => void;
  closeImportPatchDialog: () => void;

  // Import handlers
  handleImportTone: (params: {
    setName: string;
    toneFile: string;
    tone: S330Tone;
    wavData: Uint8Array;
    targetSlot: number;
    waveBank: 0 | 1;
    segmentTop: number;
  }) => Promise<void>;

  handleImportPatch: (params: {
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
    }>;
  }) => Promise<void>;
}

export function useLibraryImport({
  clientRef,
  setTone,
  setPatch,
}: UseLibraryImportOptions): UseLibraryImportReturn {
  // Dialog state
  const [importToneDialog, setImportToneDialog] = useState<ImportToneDialogState | null>(null);
  const [importPatchDialog, setImportPatchDialog] = useState<ImportPatchDialogState | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<number | undefined>(undefined);
  const [importError, setImportError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Open import tone dialog
  const openImportToneDialog = useCallback((setName: string, toneFile: string) => {
    setImportError(null);
    setImportProgress(undefined);
    setImportStatus(null);
    setImportToneDialog({ setName, toneFile });
  }, []);

  // Open import patch dialog
  const openImportPatchDialog = useCallback((setName: string, patchFile: string) => {
    setImportError(null);
    setImportProgress(undefined);
    setImportStatus(null);
    setImportPatchDialog({ setName, patchFile });
  }, []);

  // Close dialogs
  const closeImportToneDialog = useCallback(() => {
    setImportToneDialog(null);
  }, []);

  const closeImportPatchDialog = useCallback(() => {
    setImportPatchDialog(null);
  }, []);

  // Import single tone from library
  const handleImportTone = useCallback(async (params: {
    setName: string;
    toneFile: string;
    tone: S330Tone;
    wavData: Uint8Array;
    targetSlot: number;
    waveBank: 0 | 1;
    segmentTop: number;
  }) => {
    if (!clientRef.current) return;

    setIsImporting(true);
    setImportProgress(0);
    setImportError(null);
    setImportStatus(`Uploading ${params.tone.name}...`);

    try {
      // Update tone wave parameters to match target allocation
      const toneWithNewWave: S330Tone = {
        ...params.tone,
        wave: {
          ...params.tone.wave,
          bank: params.waveBank,
          segmentTop: params.segmentTop,
        },
      };

      await clientRef.current.importTone(
        {
          toneIndex: params.targetSlot,
          waveData: params.wavData,
          waveBank: params.waveBank,
          segmentTop: params.segmentTop,
          segmentLength: params.tone.wave.segmentLength,
          tone: toneWithNewWave,
        },
        (bytesSent, totalBytes) => {
          const pct = totalBytes > 0 ? Math.floor((bytesSent / totalBytes) * 100) : 0;
          setImportProgress(pct);
          setImportStatus(`Uploading: ${pct}%`);
        }
      );

      // Update local state
      setTone(params.targetSlot, toneWithNewWave);

      setImportProgress(100);
      setImportStatus('Import complete!');

      // Brief delay to show completion message
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      console.error('[useLibraryImport] Failed to import tone:', err);
      setImportError(err instanceof Error ? err.message : 'Failed to import tone');
      throw err;
    } finally {
      setIsImporting(false);
    }
  }, [clientRef, setTone]);

  // Import patch with its tones from library
  const handleImportPatch = useCallback(async (params: {
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
    }>;
  }) => {
    if (!clientRef.current) return;

    setIsImporting(true);
    setImportProgress(0);
    setImportError(null);

    try {
      const totalSteps = params.tones.length + 1;
      let completedSteps = 0;

      // Import each required tone
      for (const toneData of params.tones) {
        setImportStatus(`Uploading tone ${toneData.tone.name}...`);

        // Update tone wave parameters to match target allocation
        const toneWithNewWave: S330Tone = {
          ...toneData.tone,
          wave: {
            ...toneData.tone.wave,
            bank: toneData.waveBank,
            segmentTop: toneData.segmentTop,
          },
        };

        await clientRef.current.importTone(
          {
            toneIndex: toneData.targetSlot,
            waveData: toneData.wavData,
            waveBank: toneData.waveBank,
            segmentTop: toneData.segmentTop,
            segmentLength: toneData.tone.wave.segmentLength,
            tone: toneWithNewWave,
          },
          (bytesSent, totalBytes) => {
            const tonePct = totalBytes > 0 ? (bytesSent / totalBytes) : 0;
            const overallPct = ((completedSteps + tonePct) / totalSteps) * 100;
            setImportProgress(Math.floor(overallPct));
          }
        );

        // Update local state
        setTone(toneData.targetSlot, toneWithNewWave);
        completedSteps++;

        // Give the S-330 time to process
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      // Import the patch
      setImportStatus(`Uploading patch ${params.patch.common.name}...`);
      await clientRef.current.sendPatchData(params.targetPatchSlot, params.patch.common);
      setPatch(params.targetPatchSlot, params.patch);
      completedSteps++;

      setImportProgress(100);
      setImportStatus('Import complete!');

      // Brief delay to show completion message
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      console.error('[useLibraryImport] Failed to import patch:', err);
      setImportError(err instanceof Error ? err.message : 'Failed to import patch');
      throw err;
    } finally {
      setIsImporting(false);
    }
  }, [clientRef, setTone, setPatch]);

  return {
    importToneDialog,
    importPatchDialog,
    isImporting,
    importProgress,
    importError,
    importStatus,
    openImportToneDialog,
    openImportPatchDialog,
    closeImportToneDialog,
    closeImportPatchDialog,
    handleImportTone,
    handleImportPatch,
  };
}
