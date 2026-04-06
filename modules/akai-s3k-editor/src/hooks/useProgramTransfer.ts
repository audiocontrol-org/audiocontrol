/**
 * Hook for managing program import/export dialog state.
 *
 * Encapsulates the dialog open/close state and callbacks for both
 * export (device -> library) and import (library -> device) flows.
 * Keeps the LibraryPage lean by extracting dialog orchestration.
 */

import { useState, useCallback } from 'react';

// =========================================================================
// Dialog state types
// =========================================================================

export interface ExportDialogState {
  open: boolean;
  programIndex: number;
  programName: string;
}

export interface ImportDialogState {
  open: boolean;
  programDirName: string;
  programName: string;
  targetProgramIndex: number;
}

const EXPORT_DIALOG_CLOSED: ExportDialogState = {
  open: false,
  programIndex: 0,
  programName: '',
};

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

  /** Open the export dialog for a device program */
  openExportDialog: (programIndex: number, programName: string) => void;
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
      setExportDialog({ open: true, programIndex, programName });
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
    closeExportDialog,
    openImportDialog,
    closeImportDialog,
  };
}
