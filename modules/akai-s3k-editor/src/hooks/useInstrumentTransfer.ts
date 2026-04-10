/**
 * Hook for managing instrument (common-area program) import dialog state.
 *
 * Encapsulates the dialog open/close state for importing a common-area
 * ProgramYaml to the device. Mirrors the useDrumKitTransfer pattern.
 */

import { useState, useCallback } from 'react';

// =========================================================================
// Dialog state types
// =========================================================================

export interface InstrumentDialogState {
  open: boolean;
  programDirName: string;
  programPath: string[];
  fromProgramsDir: boolean;
}

const DIALOG_CLOSED: InstrumentDialogState = {
  open: false,
  programDirName: '',
  programPath: [],
  fromProgramsDir: false,
};

// =========================================================================
// Hook
// =========================================================================

export interface UseInstrumentTransferResult {
  /** Current dialog state */
  dialog: InstrumentDialogState;
  /** Open the import dialog for a common-area program */
  openDialog: (dirName: string, path: string[], fromProgramsDir?: boolean) => void;
  /** Close the import dialog */
  closeDialog: () => void;
}

/**
 * Manages instrument import dialog state.
 *
 * @param isDeviceConnected Whether the MIDI device is connected
 * @param hasLibraryRoot Whether a library storage root is available
 */
export function useInstrumentTransfer(
  isDeviceConnected: boolean,
  hasLibraryRoot: boolean,
): UseInstrumentTransferResult {
  const [dialog, setDialog] = useState(DIALOG_CLOSED);

  const openDialog = useCallback(
    (dirName: string, path: string[], fromProgramsDir = false) => {
      if (!isDeviceConnected || !hasLibraryRoot) return;
      setDialog({ open: true, programDirName: dirName, programPath: path, fromProgramsDir });
    },
    [isDeviceConnected, hasLibraryRoot],
  );

  const closeDialog = useCallback(() => {
    setDialog(DIALOG_CLOSED);
  }, []);

  return { dialog, openDialog, closeDialog };
}
