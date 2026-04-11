/**
 * Hook for managing program import/export dialog state.
 *
 * Encapsulates the dialog open/close state and callbacks for both
 * export (device -> library) and import (library -> device) flows.
 * Keeps the LibraryPage lean by extracting dialog orchestration.
 */

import { useState, useCallback } from 'react';
import { SAVE_DIALOG_CLOSED, type SaveToLibraryDialogState } from '@audiocontrol/editor-core';

// =========================================================================
// Dialog state types
// =========================================================================

export type ExportDialogState = SaveToLibraryDialogState;

export interface ImportDialogState {
  open: boolean;
  programDirName: string;
  programName: string;
  targetProgramIndex: number;
}

const EXPORT_DIALOG_CLOSED: ExportDialogState = SAVE_DIALOG_CLOSED;

const IMPORT_DIALOG_CLOSED: ImportDialogState = {
  open: false,
  programDirName: '',
  programName: '',
  targetProgramIndex: 0,
};

// =========================================================================
// Hook
// =========================================================================

export interface UseProgramTransferResult {
  /** Current export dialog state */
  exportDialog: ExportDialogState;
  /** Current import dialog state */
  importDialog: ImportDialogState;

  /** Open the export dialog for a device program (shows confirm phase) */
  openExportDialog: (programIndex: number, programName: string) => void;
  /** Open the export dialog and start immediately (no confirm phase) */
  openExportDialogDirect: (programIndex: number, programName: string) => void;
  /** Close the export dialog */
  closeExportDialog: () => void;

  /** Open the import dialog for a library program */
  openImportDialog: (
    programDirName: string,
    programName: string,
    targetProgramIndex: number,
  ) => void;
  /** Close the import dialog */
  closeImportDialog: () => void;
}

/**
 * Manages program transfer dialog state.
 *
 * @param isDeviceConnected Whether the MIDI device is connected
 * @param hasLibraryRoot Whether a library storage root is available
 */
export function useProgramTransfer(
  isDeviceConnected: boolean,
  hasLibraryRoot: boolean,
): UseProgramTransferResult {
  const [exportDialog, setExportDialog] = useState(EXPORT_DIALOG_CLOSED);
  const [importDialog, setImportDialog] = useState(IMPORT_DIALOG_CLOSED);

  const openExportDialog = useCallback(
    (programIndex: number, programName: string) => {
      if (!isDeviceConnected || !hasLibraryRoot) return;
      setExportDialog({ open: true, itemIndex: programIndex, itemName: programName });
    },
    [isDeviceConnected, hasLibraryRoot],
  );

  const openExportDialogDirect = useCallback(
    (programIndex: number, programName: string) => {
      if (!isDeviceConnected || !hasLibraryRoot) return;
      setExportDialog({ open: true, itemIndex: programIndex, itemName: programName, autoStart: true });
    },
    [isDeviceConnected, hasLibraryRoot],
  );

  const closeExportDialog = useCallback(() => {
    setExportDialog(EXPORT_DIALOG_CLOSED);
  }, []);

  const openImportDialog = useCallback(
    (programDirName: string, programName: string, targetProgramIndex: number) => {
      if (!isDeviceConnected || !hasLibraryRoot) return;
      setImportDialog({
        open: true,
        programDirName,
        programName,
        targetProgramIndex,
      });
    },
    [isDeviceConnected, hasLibraryRoot],
  );

  const closeImportDialog = useCallback(() => {
    setImportDialog(IMPORT_DIALOG_CLOSED);
  }, []);

  return {
    exportDialog,
    importDialog,
    openExportDialog,
    openExportDialogDirect,
    closeExportDialog,
    openImportDialog,
    closeImportDialog,
  };
}
