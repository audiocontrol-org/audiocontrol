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

import type { SendToDeviceDialogState, SaveToLibraryDialogState } from '@audiocontrol/editor-core';
export type { SendToDeviceDialogState, SaveToLibraryDialogState } from '@audiocontrol/editor-core';

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
  setSendDialog: (state: SendToDeviceDialogState) => void;
  setReceiveDialog: (state: SaveToLibraryDialogState) => void;
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
      setSendDialog({ open: true, itemName: name, itemPath: path ?? [] });
    },
    [client, root, setSendDialog],
  );

  const handleSaveDeviceSampleToLibrary = useCallback(
    (index: number, name: string) => {
      if (!client || !root) return;
      setReceiveDialog({ open: true, itemIndex: index, itemName: name });
    },
    [client, root, setReceiveDialog],
  );

  /** Same as handleSaveDeviceSampleToLibrary but skips confirm and starts transfer immediately. */
  const handleSaveDeviceSampleToLibraryDirect = useCallback(
    (index: number, name: string) => {
      if (!client || !root) return;
      setReceiveDialog({ open: true, itemIndex: index, itemName: name, autoStart: true });
    },
    [client, root, setReceiveDialog],
  );

  const handleSaveDeviceProgramToLibrary = useCallback(
    (index: number, name: string) => { programTransfer.openExportDialog(index, name); },
    [programTransfer],
  );

  /** Same as handleSaveDeviceProgramToLibrary but skips confirm and starts export immediately. */
  const handleSaveDeviceProgramToLibraryDirect = useCallback(
    (index: number, name: string) => { programTransfer.openExportDialogDirect(index, name); },
    [programTransfer],
  );

  /** Save device program to common area (converts to program.yaml with zones). */
  const handleSaveDeviceProgramToCommonArea = useCallback(
    (index: number, name: string) => { programTransfer.openExportDialogToCommonArea(index, name); },
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
    (dirName: string, path: string[], fromProgramsDir: boolean) => {
      instrumentTransfer.openDialog(dirName, path, fromProgramsDir);
    },
    [instrumentTransfer],
  );

  const handleRenameDeviceSample = useCallback(
    async (index: number, currentName: string) => {
      if (!client) return;
      const newName = window.prompt('Rename sample:', currentName.trim());
      if (!newName || newName.trim() === currentName.trim()) return;
      try {
        await client.renameSample(index, newName.trim());
        await refreshDevice();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to rename sample');
      }
    },
    [client, refreshDevice, setError],
  );

  const handleRenameDeviceProgram = useCallback(
    async (index: number, currentName: string) => {
      if (!client) return;
      const newName = window.prompt('Rename program:', currentName.trim());
      if (!newName || newName.trim() === currentName.trim()) return;
      try {
        await client.renameProgram(index, newName.trim());
        await refreshDevice();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to rename program');
      }
    },
    [client, refreshDevice, setError],
  );

  const handleDeleteDeviceProgram = useCallback(
    async (index: number, _name: string) => {
      if (!client) return;
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
    async (index: number, _name: string) => {
      if (!client) return;
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
    handleSaveDeviceSampleToLibraryDirect,
    handleSaveDeviceProgramToLibrary,
    handleSaveDeviceProgramToLibraryDirect,
    handleSaveDeviceProgramToCommonArea,
    handleSendProgramToDevice,
    handleImportInstrument,
    handleRenameDeviceSample,
    handleRenameDeviceProgram,
    handleDeleteDeviceProgram,
    handleDeleteDeviceSample,
    handleExportComplete,
    handleImportComplete,
  };
}
