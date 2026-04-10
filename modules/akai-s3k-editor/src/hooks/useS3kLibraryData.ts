/**
 * Hook for loading sample and program tree data from the library store.
 *
 * Wraps the library scanning logic (common samples + programs) and
 * exposes a single `refresh` callback that reloads both categories.
 */

import { useCallback } from 'react';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import { listCommonSamplesTree, listCommonProgramsTree } from '@audiocontrol/sampler-library/browser';
import { useLibraryStore } from '@/stores/libraryStore';
import { toTreeNode } from '@/lib/library-tree';
import { useLibraryPrograms } from '@/hooks/useLibraryPrograms';

export function useS3kLibraryData(root: StorageDirectoryHandle | null) {
  const setSampleNodes = useLibraryStore((s) => s.setSampleNodes);
  const setCommonProgramNodes = useLibraryStore((s) => s.setCommonProgramNodes);
  const setLoading = useLibraryStore((s) => s.setLoading);
  const setError = useLibraryStore((s) => s.setError);
  const clear = useLibraryStore((s) => s.clear);
  const { refreshPrograms } = useLibraryPrograms(root);

  const refresh = useCallback(async () => {
    if (!root) { clear(); return; }
    setLoading(true);
    setError(null);
    try {
      const [sampleTreeNodes, commonProgramTreeNodes] = await Promise.all([
        listCommonSamplesTree(root),
        listCommonProgramsTree(root),
      ]);
      setSampleNodes(sampleTreeNodes.map(toTreeNode));
      setCommonProgramNodes(commonProgramTreeNodes.map(toTreeNode));
      await refreshPrograms();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to scan library';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [root, setSampleNodes, setCommonProgramNodes, setLoading, setError, clear, refreshPrograms]);

  return { refresh, refreshPrograms };
}
