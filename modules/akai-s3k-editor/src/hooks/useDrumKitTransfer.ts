/**
 * Hook for managing drum kit import dialog state.
 *
 * Encapsulates the dialog open/close state for the drum kit import flow.
 * Mirrors the useProgramTransfer pattern to keep LibraryPage lean.
 */

import { useState, useCallback } from 'react';

// =========================================================================
// Dialog state types
// =========================================================================

export interface DrumKitDialogState {
  open: boolean;
  sampleName: string;
  samplePath: string[];
}

const DIALOG_CLOSED: DrumKitDialogState = {
  open: false,
  sampleName: '',
  samplePath: [],
};

// =========================================================================
// Hook
// =========================================================================

export interface UseDrumKitTransferResult {
  /** Current dialog state */
  dialog: DrumKitDialogState;
  /** Open the import dialog for a drum kit */
  openDialog: (name: string, path?: string[]) => void;
  /** Close the import dialog */
  closeDialog: () => void;
}

/**
 * Manages drum kit import dialog state.
 *
 * @param isDeviceConnected Whether the MIDI device is connected
 * @param hasLibraryRoot Whether a library storage root is available
 */
export function useDrumKitTransfer(
  isDeviceConnected: boolean,
  hasLibraryRoot: boolean,
): UseDrumKitTransferResult {
  const [dialog, setDialog] = useState(DIALOG_CLOSED);

  const openDialog = useCallback(
    (name: string, path?: string[]) => {
      if (!isDeviceConnected || !hasLibraryRoot) return;
      setDialog({ open: true, sampleName: name, samplePath: path ?? [] });
    },
    [isDeviceConnected, hasLibraryRoot],
  );

  const closeDialog = useCallback(() => {
    setDialog(DIALOG_CLOSED);
  }, []);

  return { dialog, openDialog, closeDialog };
}
