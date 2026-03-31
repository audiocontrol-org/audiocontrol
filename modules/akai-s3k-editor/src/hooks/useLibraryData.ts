/**
 * Hook for loading library tree data from storage.
 *
 * Scans the common-area samples directory (device-agnostic) and converts
 * the results into editor-core TreeNodes for display in the library browser.
 *
 * The S3000XL library currently uses only the common area. Device-specific
 * library categories (e.g., Akai program bundles) will be added in a future
 * phase when the sampler-library schema supports them.
 */

import { useCallback } from 'react';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import { listCommonSamplesTree } from '@audiocontrol/sampler-library/browser';
import { useLibraryStore } from '@/stores/libraryStore';
import { toTreeNode } from '@/lib/library-tree';

export interface UseLibraryDataResult {
  /** Scan the library root and populate the store */
  refresh: () => Promise<void>;
}

export function useLibraryData(
  root: StorageDirectoryHandle | null,
): UseLibraryDataResult {
  const setSampleNodes = useLibraryStore((s) => s.setSampleNodes);
  const setLoading = useLibraryStore((s) => s.setLoading);
  const setError = useLibraryStore((s) => s.setError);
  const clear = useLibraryStore((s) => s.clear);

  const refresh = useCallback(async () => {
    if (!root) {
      clear();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const sampleTreeNodes = await listCommonSamplesTree(root);
      setSampleNodes(sampleTreeNodes.map(toTreeNode));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to scan library';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [root, setSampleNodes, setLoading, setError, clear]);

  return { refresh };
}
