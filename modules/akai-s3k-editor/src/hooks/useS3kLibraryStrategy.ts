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
  type LibraryTransferCallbacks,
  createTransferActionHandler,
} from '@audiocontrol/editor-core';
import { deleteStoredProgram } from '@/lib/program-storage';

interface UseS3kLibraryStrategyArgs {
  root: StorageDirectoryHandle | null;
  refreshPrograms: () => Promise<void>;
  transfers: LibraryTransferCallbacks;
}

export function useS3kLibraryStrategy({
  root,
  refreshPrograms,
  transfers,
}: UseS3kLibraryStrategyArgs): LibraryOperationsStrategy {
  return useMemo<LibraryOperationsStrategy>(() => ({
    deleteItem: async (categoryId, node) => {
      if (categoryId !== 's3k-programs') return false;
      if (!root) return false;
      const meta = node.meta as { dirName?: string } | undefined;
      const dirName = meta?.dirName ?? node.name;
      await deleteStoredProgram(root, dirName);
      void refreshPrograms();
      return true;
    },

    handleContextMenuAction: createTransferActionHandler(transfers, ['s3k-programs']),
  }), [root, refreshPrograms, transfers]);
}
