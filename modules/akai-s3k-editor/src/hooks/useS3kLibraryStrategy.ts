/**
 * Hook for building the library operations strategy.
 *
 * Returns a LibraryOperationsStrategy that handles common-area operations
 * such as deleting stored programs from the library.
 */

import { useMemo } from 'react';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import type { LibraryOperationsStrategy } from '@audiocontrol/editor-core';
import { deleteStoredProgram } from '@/lib/program-storage';

interface UseS3kLibraryStrategyArgs {
  root: StorageDirectoryHandle | null;
  refreshPrograms: () => Promise<void>;
}

export function useS3kLibraryStrategy({
  root,
  refreshPrograms,
}: UseS3kLibraryStrategyArgs): LibraryOperationsStrategy {
  return useMemo<LibraryOperationsStrategy>(() => ({
    deleteItem: async (categoryId, node) => {
      if (categoryId !== 'programs') return false;
      if (!root) return false;
      const meta = node.meta as { dirName?: string } | undefined;
      const dirName = meta?.dirName ?? node.name;
      await deleteStoredProgram(root, dirName);
      void refreshPrograms();
      return true;
    },
  }), [root, refreshPrograms]);
}
