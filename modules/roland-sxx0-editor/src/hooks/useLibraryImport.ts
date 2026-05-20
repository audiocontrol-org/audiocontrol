/**
 * useLibraryImport Hook
 *
 * Handles importing tones and patches from library sets to the device.
 * Manages dialog state, progress tracking, and device communication.
 */

import { useState, useCallback, MutableRefObject } from 'react';
import type { OperationState, OperationProgress } from '@/types/import-operation';
import type { SamplerClientInterface, SamplerTone, SamplerPatch } from '@/core/midi/SamplerClient';

interface ImportToneDialogState {
  setName: string;
  toneFile: string;
}

interface ImportPatchDialogState {
  setName: string;
  patchFile: string;
}

interface UseLibraryImportOptions {
  clientRef: MutableRefObject<SamplerClientInterface | null>;
  setTone: (index: number, tone: SamplerTone) => void;
  setPatch: (index: number, patch: SamplerPatch) => void;
}

interface UseLibraryImportReturn extends OperationState {
  // Dialog state
  importToneDialog: ImportToneDialogState | null;
  importPatchDialog: ImportPatchDialogState | null;

  // Dialog handlers
  openImportToneDialog: (setName: string, toneFile: string) => void;
  openImportPatchDialog: (setName: string, patchFile: string) => void;
  closeImportToneDialog: () => void;
  closeImportPatchDialog: () => void;

  // Import handlers.
  //
  // `waveBank: number` is the editor-side contract for S-series devices: S-330
  // accepts 0/1, S-550 accepts 0..3. The device client validates the bank
  // against its own range at runtime — see `S330ImportToneInput`.
  handleImportTone: (params: {
    setName: string;
    toneFile: string;
    tone: SamplerTone;
    wavData: Uint8Array;
    targetSlot: number;
    waveBank: number;
    segmentTop: number;
  }) => Promise<void>;

  handleImportPatch: (params: {
    setName: string;
    patchFile: string;
    patch: SamplerPatch;
    targetPatchSlot: number;
    tones: Array<{
      tone: SamplerTone;
      wavData: Uint8Array;
      targetSlot: number;
      waveBank: number;
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
  const [importProgress, setImportProgress] = useState<OperationProgress | undefined>(undefined);
  const [importError, setImportError] = useState<string | null>(null);

  // Open import tone dialog
  const openImportToneDialog = useCallback((setName: string, toneFile: string) => {
    setImportError(null);
    setImportProgress(undefined);
    setImportToneDialog({ setName, toneFile });
  }, []);

  // Open import patch dialog
  const openImportPatchDialog = useCallback((setName: string, patchFile: string) => {
    setImportError(null);
    setImportProgress(undefined);
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
    tone: SamplerTone;
    wavData: Uint8Array;
    targetSlot: number;
    waveBank: number;
    segmentTop: number;
  }) => {
    if (!clientRef.current) return;

    setIsImporting(true);
    setImportProgress(undefined);
    setImportError(null);

    try {
      // Update tone wave parameters to match target allocation
      const toneWithNewWave: SamplerTone = {
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
          setImportProgress({
            currentStep: 1, totalSteps: 1,
            stepLabel: `Uploading ${params.tone.name}`,
            bytesSent, bytesTotal: totalBytes,
            bytesSentAllSteps: 0, bytesTotalAllSteps: totalBytes,
          });
        }
      );

      // Update local state
      setTone(params.targetSlot, toneWithNewWave);

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
    patch: SamplerPatch;
    targetPatchSlot: number;
    tones: Array<{
      tone: SamplerTone;
      wavData: Uint8Array;
      targetSlot: number;
      waveBank: number;
      segmentTop: number;
    }>;
  }) => {
    if (!clientRef.current) return;

    setIsImporting(true);
    setImportProgress(undefined);
    setImportError(null);

    try {
      const totalSteps = params.tones.length + 1;
      let completedSteps = 0;
      const bytesTotalAllSteps = params.tones.reduce((sum, t) => sum + t.wavData.length, 0);
      let bytesSentAllSteps = 0;

      // Import each required tone
      for (let i = 0; i < params.tones.length; i++) {
        const toneData = params.tones[i]!;
        const stepNum = completedSteps + 1;

        // Update tone wave parameters to match target allocation
        const toneWithNewWave: SamplerTone = {
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
            setImportProgress({
              currentStep: stepNum, totalSteps,
              stepLabel: `Uploading tone ${toneData.tone.name} (${i + 1} of ${params.tones.length})`,
              bytesSent, bytesTotal: totalBytes,
              bytesSentAllSteps, bytesTotalAllSteps,
            });
          }
        );

        // Update local state
        setTone(toneData.targetSlot, toneWithNewWave);
        bytesSentAllSteps += toneData.wavData.length;
        completedSteps++;

        // Give the S-330 time to process
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      // Import the patch
      setImportProgress({
        currentStep: totalSteps, totalSteps,
        stepLabel: `Creating patch ${params.patch.common.name}`,
        bytesSent: 0, bytesTotal: 0,
        bytesSentAllSteps, bytesTotalAllSteps,
      });
      await clientRef.current.sendPatchData(params.targetPatchSlot, params.patch.common);
      setPatch(params.targetPatchSlot, params.patch);

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
    isOperating: isImporting,
    progress: importProgress,
    error: importError,
    openImportToneDialog,
    openImportPatchDialog,
    closeImportToneDialog,
    closeImportPatchDialog,
    handleImportTone,
    handleImportPatch,
  };
}
