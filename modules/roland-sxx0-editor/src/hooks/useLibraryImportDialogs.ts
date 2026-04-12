/**
 * Library Import Dialogs Hook
 *
 * Manages state and callbacks for importing tones and patches from the
 * library to the device (library -> device direction). Also manages
 * save/load set operations since they share operation progress state.
 */

import { useState, useCallback, type MutableRefObject } from 'react';
import type { SamplerClientInterface, SamplerTone, SamplerPatch } from '@/core/midi/SamplerClient';
import type { LibraryDragData } from '@/components/library/DeviceMemoryPanel';
import type { OperationProgress } from '@/types/import-operation';
import { saveDeviceToSetIncremental, loadSetToDevice, type StorageDirectoryHandle } from '@/lib/library-service';
import type { RolandPageSelection } from '@/pages/LibraryPage';


export interface ImportToneDialogState {
  setName: string;
  toneFile: string;
  initialTargetSlot?: number;
}

export interface ImportPatchDialogState {
  setName: string;
  patchFile: string;
  patchPath?: string[];
  initialTargetSlot?: number;
}

export interface ImportToneParams {
  setName: string; toneFile: string; tone: SamplerTone; wavData: Uint8Array;
  targetSlot: number; waveBank: 0 | 1 | 2 | 3; segmentTop: number; segmentLength: number;
}

export interface ImportPatchParams {
  setName: string; patchFile: string; patch: SamplerPatch; targetPatchSlot: number;
  tones: Array<{
    tone: SamplerTone; wavData: Uint8Array; targetSlot: number;
    waveBank: 0 | 1 | 2 | 3; segmentTop: number; segmentLength: number;
  }>;
}

interface Options {
  clientRef: MutableRefObject<SamplerClientInterface | null>;
  libraryHandle: StorageDirectoryHandle | null;
  setTone: (index: number, tone: SamplerTone, totalTones: number) => void;
  setPatch: (index: number, patch: SamplerPatch, totalPatches: number) => void;
  totalTones: number;
  totalPatches: number;
  selection: RolandPageSelection | null;
  handleRefreshLibrary: () => Promise<void>;
}

export function useLibraryImportDialogs({
  clientRef, libraryHandle, setTone, setPatch, totalTones, totalPatches,
  selection, handleRefreshLibrary,
}: Options) {
  const [importToneDialog, setImportToneDialog] = useState<ImportToneDialogState | null>(null);
  const [importPatchDialog, setImportPatchDialog] = useState<ImportPatchDialogState | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [operationProgress, setOperationProgress] = useState<OperationProgress | undefined>(undefined);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loadSuccess, setLoadSuccess] = useState(false);

  const resetProgress = useCallback(() => {
    setOperationError(null);
    setOperationProgress(undefined);
    setSaveSuccess(false);
    setLoadSuccess(false);
  }, []);

  const handleOpenImportToneDialog = useCallback((setName: string, toneFile: string) => {
    resetProgress(); setImportToneDialog({ setName, toneFile });
  }, [resetProgress]);

  const handleOpenImportPatchDialog = useCallback((setName: string, patchFile: string) => {
    resetProgress(); setImportPatchDialog({ setName, patchFile });
  }, [resetProgress]);

  const handleOpenImportIndividualToneDialog = useCallback((toneFile: string) => {
    resetProgress(); setImportToneDialog({ setName: '__individual__', toneFile });
  }, [resetProgress]);

  const handleOpenImportIndividualPatchDialog = useCallback((patchDirectoryName: string, path?: string[]) => {
    resetProgress(); setImportPatchDialog({ setName: '__individual__', patchFile: patchDirectoryName, patchPath: path });
  }, [resetProgress]);

  const handleOpenSaveDialog = useCallback(() => { resetProgress(); setIsSaveDialogOpen(true); }, [resetProgress]);

  const handleOpenLoadDialog = useCallback(() => {
    if (!selection || selection.type !== 'set' || !selection.name) return;
    resetProgress(); setIsLoadDialogOpen(true);
  }, [selection, resetProgress]);

  const handleDropLibraryTone = useCallback((data: LibraryDragData, targetSlot: number) => {
    if (!libraryHandle || !clientRef.current) { throw new Error('Library or device not connected'); }
    if (data.type !== 'tone') { throw new Error('Can only drop tones on tone slots'); }
    resetProgress();
    if (data.setName && data.toneFile) setImportToneDialog({ setName: data.setName, toneFile: data.toneFile, initialTargetSlot: targetSlot });
    else setImportToneDialog({ setName: '__individual__', toneFile: data.name, initialTargetSlot: targetSlot });
  }, [libraryHandle, clientRef, resetProgress]);

  const handleDropLibraryPatch = useCallback((data: LibraryDragData, targetSlot: number) => {
    if (!libraryHandle || !clientRef.current) { throw new Error('Library or device not connected'); }
    if (data.type !== 'patch') { throw new Error('Can only drop patches on patch slots'); }
    resetProgress();
    if (data.setName && data.patchFile) setImportPatchDialog({ setName: data.setName, patchFile: data.patchFile, initialTargetSlot: targetSlot });
    else setImportPatchDialog({ setName: '__individual__', patchFile: data.name, patchPath: data.path, initialTargetSlot: targetSlot });
  }, [libraryHandle, clientRef, resetProgress]);

  const handleImportLibraryTone = useCallback(async (params: ImportToneParams) => {
    if (!clientRef.current) return;
    setIsImporting(true); setOperationProgress(undefined); setOperationError(null);
    try {
      const toneWithNewWave: SamplerTone = {
        ...params.tone, wave: { ...params.tone.wave, bank: params.waveBank, segmentTop: params.segmentTop, segmentLength: params.segmentLength },
      };
      await clientRef.current.importTone(
        { toneIndex: params.targetSlot, waveData: params.wavData, waveBank: params.waveBank as 0 | 1, segmentTop: params.segmentTop, segmentLength: params.segmentLength, tone: toneWithNewWave },
        (bytesSent, totalBytes) => {
          setOperationProgress({ currentStep: 1, totalSteps: 1, stepLabel: `Uploading ${params.tone.name}`, bytesSent, bytesTotal: totalBytes, bytesSentAllSteps: 0, bytesTotalAllSteps: totalBytes });
        }
      );
      setTone(params.targetSlot, toneWithNewWave, totalTones);
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      console.error('[LibraryPage] Failed to import tone:', err);
      setOperationError(err instanceof Error ? err.message : 'Failed to import tone');
      throw err;
    } finally { setIsImporting(false); }
  }, [clientRef, setTone, totalTones]);

  const handleImportLibraryPatch = useCallback(async (params: ImportPatchParams) => {
    if (!clientRef.current) return;
    setIsImporting(true); setOperationProgress(undefined); setOperationError(null);
    try {
      const totalSteps = params.tones.length + 1;
      let completedSteps = 0;
      const patchBytesTotalAll = params.tones.reduce((sum, t) => sum + t.wavData.length, 0);
      let patchBytesSentAll = 0;

      for (let i = 0; i < params.tones.length; i++) {
        const td = params.tones[i];
        const toneWithNewWave: SamplerTone = { ...td.tone, wave: { ...td.tone.wave, bank: td.waveBank, segmentTop: td.segmentTop, segmentLength: td.segmentLength } };
        await clientRef.current.importTone(
          { toneIndex: td.targetSlot, waveData: td.wavData, waveBank: td.waveBank as 0 | 1, segmentTop: td.segmentTop, segmentLength: td.segmentLength, tone: toneWithNewWave },
          (bytesSent, totalBytes) => {
            setOperationProgress({ currentStep: completedSteps + 1, totalSteps, stepLabel: `Uploading tone ${td.tone.name} (${i + 1} of ${params.tones.length})`, bytesSent, bytesTotal: totalBytes, bytesSentAllSteps: patchBytesSentAll, bytesTotalAllSteps: patchBytesTotalAll });
          }
        );
        setTone(td.targetSlot, toneWithNewWave, totalTones);
        patchBytesSentAll += td.wavData.length;
        completedSteps++;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      setOperationProgress({ currentStep: totalSteps, totalSteps, stepLabel: `Creating patch ${params.patch.common.name}`, bytesSent: 0, bytesTotal: 0, bytesSentAllSteps: patchBytesSentAll, bytesTotalAllSteps: patchBytesTotalAll });
      await clientRef.current.sendPatchData(params.targetPatchSlot, params.patch.common);
      setPatch(params.targetPatchSlot, params.patch, totalPatches);
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      console.error('[LibraryPage] Failed to import patch:', err);
      setOperationError(err instanceof Error ? err.message : 'Failed to import patch');
      throw err;
    } finally { setIsImporting(false); }
  }, [clientRef, setTone, setPatch, totalTones, totalPatches]);

  const handleSaveSet = useCallback(async (setName: string, description?: string) => {
    if (!libraryHandle || !clientRef.current) return;
    const mkProgress = (p: Partial<OperationProgress>): OperationProgress => ({ currentStep: 1, totalSteps: 1, stepLabel: 'Saving...', bytesSent: 0, bytesTotal: 100, bytesSentAllSteps: 0, bytesTotalAllSteps: 100, ...p });
    setOperationProgress(mkProgress({ currentStep: 0, stepLabel: 'Preparing...' }));
    setOperationError(null);
    setSaveSuccess(false);
    const client = clientRef.current;
    try {
      await saveDeviceToSetIncremental(
        libraryHandle, setName, description,
        async (toneIndex) => await client.requestToneData(toneIndex),
        async (patchIndex) => await client.requestPatchData(patchIndex),
        async (toneIndex, onWaveProgress) => await client.requestWaveData(toneIndex, onWaveProgress ?? (() => {})),
        (progress) => setOperationProgress((prev) => prev ? { ...prev, bytesSent: Math.floor(progress) } : mkProgress({ bytesSent: Math.floor(progress) })),
        (status) => setOperationProgress((prev) => prev ? { ...prev, stepLabel: status } : mkProgress({ stepLabel: status }))
      );
      setSaveSuccess(true);
      setOperationProgress(undefined); // Clear progress so dialog can close (isSaving=false)
      await handleRefreshLibrary();
    } catch (err) {
      console.error('[LibraryPage] Failed to save set:', err);
      setOperationError(err instanceof Error ? err.message : 'Failed to save set');
    }
  }, [libraryHandle, clientRef, handleRefreshLibrary]);

  const handleLoadSet = useCallback(async (target: { toneIndexOffset: number; waveBankOffset: number }) => {
    if (!libraryHandle || !clientRef.current || !selection?.name) return;
    const { toneIndexOffset: toneOffset, waveBankOffset } = target;
    setOperationProgress({ currentStep: 1, totalSteps: 1, stepLabel: 'Reading set from library...', bytesSent: 0, bytesTotal: 0, bytesSentAllSteps: 0, bytesTotalAllSteps: 0 });
    setOperationError(null);
    setLoadSuccess(false);
    try {
      const deviceState = await loadSetToDevice(libraryHandle, selection.name, (progress) => {
        let stepLabel = 'Reading manifest...';
        if (progress >= 60) stepLabel = 'Loading patch data...';
        else if (progress >= 30) stepLabel = 'Loading tone data...';
        setOperationProgress({ currentStep: 1, totalSteps: 1, stepLabel, bytesSent: Math.floor(progress), bytesTotal: 100, bytesSentAllSteps: 0, bytesTotalAllSteps: 0 });
      });

      let uploadCount = 0;
      const totalItems = deviceState.tones.size + deviceState.patches.size;
      const bytesTotalAllSteps = Array.from(deviceState.tones.values()).reduce((sum, d) => sum + d.wavData.length, 0);
      let bytesSentAllSteps = 0;

      for (const [slot, data] of deviceState.tones) {
        const targetSlot = slot + toneOffset;
        const targetBank = (data.tone.wave.bank + waveBankOffset) as 0 | 1;
        const toneName = data.tone.name || `T${Math.floor(targetSlot / 8) + 1}${(targetSlot % 8) + 1}`;
        await clientRef.current.importTone(
          { toneIndex: targetSlot, waveData: data.wavData, waveBank: targetBank, segmentTop: data.tone.wave.segmentTop, segmentLength: data.tone.wave.segmentLength, tone: data.tone },
          (bytesSent, totalBytes) => { setOperationProgress({ currentStep: uploadCount + 1, totalSteps: totalItems, stepLabel: `Uploading ${toneName}`, bytesSent, bytesTotal: totalBytes, bytesSentAllSteps, bytesTotalAllSteps }); }
        );
        setTone(targetSlot, data.tone, totalTones);
        bytesSentAllSteps += data.wavData.length;
        uploadCount++;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      for (const [slot, patch] of deviceState.patches) {
        const patchName = patch.common.name || `P${String(slot + 1).padStart(2, '0')}`;
        setOperationProgress({ currentStep: uploadCount + 1, totalSteps: totalItems, stepLabel: `Uploading patch ${patchName}`, bytesSent: 0, bytesTotal: 0, bytesSentAllSteps, bytesTotalAllSteps });
        await clientRef.current.sendPatchData(slot, patch.common);
        uploadCount++;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      setOperationProgress({ currentStep: totalItems, totalSteps: totalItems, stepLabel: `Loaded ${deviceState.tones.size} tones and ${deviceState.patches.size} patches`, bytesSent: 0, bytesTotal: 0, bytesSentAllSteps: bytesTotalAllSteps, bytesTotalAllSteps });
      setLoadSuccess(true);
      setOperationProgress(undefined); // Clear progress so dialog can close (isOperating=false)
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      console.error('[LibraryPage] Failed to load set:', err);
      setOperationError(err instanceof Error ? err.message : 'Failed to load set');
    }
  }, [libraryHandle, clientRef, selection, setTone, totalTones]);

  // Wrapped setters that reset success state
  const handleSetIsSaveDialogOpen = useCallback((open: boolean) => {
    if (!open) {
      setSaveSuccess(false);
    }
    setIsSaveDialogOpen(open);
  }, []);

  const handleSetIsLoadDialogOpen = useCallback((open: boolean) => {
    if (!open) {
      setLoadSuccess(false);
    }
    setIsLoadDialogOpen(open);
  }, []);

  return {
    importToneDialog, importPatchDialog, isImporting, operationProgress, operationError,
    isSaveDialogOpen, setIsSaveDialogOpen: handleSetIsSaveDialogOpen,
    isLoadDialogOpen, setIsLoadDialogOpen: handleSetIsLoadDialogOpen,
    saveSuccess, loadSuccess,
    setImportToneDialog, setImportPatchDialog,
    handleOpenImportToneDialog, handleOpenImportPatchDialog,
    handleOpenImportIndividualToneDialog, handleOpenImportIndividualPatchDialog,
    handleOpenSaveDialog, handleOpenLoadDialog,
    handleDropLibraryTone, handleDropLibraryPatch,
    handleImportLibraryTone, handleImportLibraryPatch,
    handleSaveSet, handleLoadSet,
  };
}
