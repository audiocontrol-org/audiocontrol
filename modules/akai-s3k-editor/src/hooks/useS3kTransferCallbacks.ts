/**
 * Hook for transfer dialog callbacks.
 *
 * Provides callbacks for sending/receiving samples, importing/exporting
 * programs, importing instruments, and deleting device items. Each callback
 * opens a dialog or performs an immediate device operation.
 */

import { useCallback } from 'react';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import type { S3000xlClientInterface } from '@audiocontrol/sampler-devices/s3k';
import type { useProgramTransfer } from '@/hooks/useProgramTransfer';
import type { useInstrumentTransfer } from '@/hooks/useInstrumentTransfer';

interface SendDialogState {
  open: boolean;
  sampleName: string;
  samplePath: string[];
}

interface ReceiveDialogState {
  open: boolean;
  sampleIndex: number;
  sampleName: string;
}

interface UseS3kTransferCallbacksArgs {
  client: S3000xlClientInterface | null;
  root: StorageDirectoryHandle | null;
  deviceProgramNames: string[];
  selectedDeviceType: 'program' | 'sample' | null;
  selectedDeviceIndex: number | null;
  programTransfer: ReturnType<typeof useProgramTransfer>;
  instrumentTransfer: ReturnType<typeof useInstrumentTransfer>;
  refreshDevice: () => Promise<void>;
  refreshPrograms: () => Promise<void>;
  setError: (msg: string | null) => void;
  setSelection: (selection: null) => void;
  setSendDialog: (state: SendDialogState) => void;
  setReceiveDialog: (state: ReceiveDialogState) => void;
}

export function useS3kTransferCallbacks({
  client,
  root,
  deviceProgramNames,
  selectedDeviceType,
  selectedDeviceIndex,
  programTransfer,
  instrumentTransfer,
  refreshDevice,
  refreshPrograms,
  setError,
  setSelection,
  setSendDialog,
  setReceiveDialog,
}: UseS3kTransferCallbacksArgs) {
  const handleSendSampleToDevice = useCallback(
    (name: string, path?: string[]) => {
      if (!client || !root) return;
      setSendDialog({ open: true, sampleName: name, samplePath: path ?? [] });
    },
    [client, root, setSendDialog],
  );

  const handleSaveDeviceSampleToLibrary = useCallback(
    (index: number, name: string) => {
      if (!client || !root) return;
      setReceiveDialog({ open: true, sampleIndex: index, sampleName: name });
    },
    [client, root, setReceiveDialog],
  );

  const handleSaveDeviceProgramToLibrary = useCallback(
    (index: number, name: string) => { programTransfer.openExportDialog(index, name); },
    [programTransfer],
  );

  const handleSendProgramToDevice = useCallback(
    (dirName: string, name: string) => {
      const targetSlot = selectedDeviceType === 'program' && selectedDeviceIndex !== null
        ? selectedDeviceIndex
        : deviceProgramNames.length;
      programTransfer.openImportDialog(dirName, name, targetSlot);
    },
    [programTransfer, selectedDeviceType, selectedDeviceIndex, deviceProgramNames.length],
  );

  const handleImportInstrument = useCallback(
    (dirName: string, path: string[]) => { instrumentTransfer.openDialog(dirName, path); },
    [instrumentTransfer],
  );

  const handleDeleteDeviceProgram = useCallback(
    async (index: number, name: string) => {
      if (!client) return;
      if (!window.confirm(`Delete program "${name.trim()}" (#${index}) from device?`)) return;
      try {
        await client.deleteProgram(index);
        await refreshDevice();
        setSelection(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete program');
      }
    },
    [client, refreshDevice, setError, setSelection],
  );

  const handleDeleteDeviceSample = useCallback(
    async (index: number, name: string) => {
      if (!client) return;
      if (!window.confirm(`Delete sample "${name.trim()}" (#${index}) from device?`)) return;
      try {
        await client.deleteSample(index);
        await refreshDevice();
        setSelection(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete sample');
      }
    },
    [client, refreshDevice, setError, setSelection],
  );

  const handleExportComplete = useCallback(
    async () => { await refreshPrograms(); },
    [refreshPrograms],
  );

  const handleImportComplete = useCallback(
    async () => { await refreshDevice(); },
    [refreshDevice],
  );

  return {
    handleSendSampleToDevice,
    handleSaveDeviceSampleToLibrary,
    handleSaveDeviceProgramToLibrary,
    handleSendProgramToDevice,
    handleImportInstrument,
    handleDeleteDeviceProgram,
    handleDeleteDeviceSample,
    handleExportComplete,
    handleImportComplete,
  };
}
