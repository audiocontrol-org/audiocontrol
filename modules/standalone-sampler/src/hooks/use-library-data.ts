import { useCallback } from 'react';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import { listCommonSamplesTree, listCommonProgramsTree } from '@audiocontrol/sampler-library/browser';
import type { LibraryTreeNode } from '@audiocontrol/sampler-library/browser';
import type { TreeNode } from '@audiocontrol/editor-core';
import { useLibraryStore } from '@/stores/libraryStore';

function toTreeNode(node: LibraryTreeNode): TreeNode {
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    children: node.children?.map(toTreeNode),
    meta: {
      fileName: node.fileName,
      directoryName: node.directoryName,
      path: node.path,
      description: node.description,
    },
  };
}

export function useLibraryData(root: StorageDirectoryHandle | null) {
  const setSampleNodes = useLibraryStore((s) => s.setSampleNodes);
  const setProgramNodes = useLibraryStore((s) => s.setProgramNodes);
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
      const [sampleTreeNodes, programTreeNodes] = await Promise.all([
        listCommonSamplesTree(root),
        listCommonProgramsTree(root),
      ]);
      setSampleNodes(sampleTreeNodes.map(toTreeNode));
      setProgramNodes(programTreeNodes.map(toTreeNode));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to scan library';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [root, setSampleNodes, setProgramNodes, setLoading, setError, clear]);

  return { refresh };
}
