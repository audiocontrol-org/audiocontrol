/**
 * Hook for building the S3K library operations strategy.
 *
 * Composes:
 * - Device-specific deleteItem for s3k-programs
 * - Shared transfer action handler from editor-core
 */

import { useMemo } from 'react';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import {
  type LibraryOperationsStrategy,
  type TransferHandlerMap,
  createTransferActionHandler,
} from '@audiocontrol/editor-core';
import { deleteStoredProgram } from '@/lib/program-storage';

/**
 * S3K transfer handlers — Required<Pick<...>> enforces that every action
 * declared in S3K_TRANSFER_ACTIONS has a handler. If a new action is
 * added to the set without a handler here, the compiler complains.
 */
type S3kTransferHandlers = Required<Pick<TransferHandlerMap,
  | 'send-sample-to-device'
  | 'send-program-to-device'
  | 'import-drum-kit'
  | 'edit-drum-kit'
  | 'import-instrument'
  | 'promote-to-common-area'
>>;

interface UseS3kLibraryStrategyArgs {
  root: StorageDirectoryHandle | null;
  refreshPrograms: () => Promise<void>;
  transfers: S3kTransferHandlers;
}

export function useS3kLibraryStrategy({
  root,
  refreshPrograms,
  transfers,
}: UseS3kLibraryStrategyArgs): LibraryOperationsStrategy {
  return useMemo<LibraryOperationsStrategy>(() => ({
    createFolder: async () => false,

    deleteItem: async (categoryId, node) => {
      if (categoryId !== 's3k-programs') return false;
      if (!root) return false;
      const meta = node.meta as { dirName?: string } | undefined;
      const dirName = meta?.dirName ?? node.name;
      await deleteStoredProgram(root, dirName);
      void refreshPrograms();
      return true;
    },

    renameItem: async () => false,

    handleContextMenuAction: createTransferActionHandler(transfers, ['s3k-programs']),
  }), [root, refreshPrograms, transfers]);
}
