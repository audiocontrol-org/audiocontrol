/**
 * Hook managing library data loading and tree state for the Roland Library page.
 *
 * Loads sets, drum kits, tones, patches, and common samples from the library
 * storage handle. Provides tree data for the plugin category format and a
 * refresh callback for re-scanning after mutations.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  listSets, listIndividualTones, listIndividualPatches,
  listIndividualTonesTree, listIndividualPatchesTree,
  listCommonSamplesTree,
  type LibraryToneInfo, type LibraryPatchInfo, type LibraryTreeNode,
  type StorageDirectoryHandle,
} from '@/lib/library-service';
import { useLibraryStore } from '@/stores/libraryStore';

// =========================================================================
// Data loading
// =========================================================================

/**
 * Pack `{ directoryName, fileName, path }` into each node's `meta` so
 * `PluginLibraryBrowser` can forward it to the selection-mapping layer.
 * Without this, `useRolandSelectionMapping` falls back to `node.name`
 * (the YAML display name) and any caller that needs the on-disk
 * directory name (e.g., `loadIndividualPatch`) gets the wrong identity
 * whenever the YAML `name` differs from the directory name. See #418.
 */
function packLibraryTreeMeta(nodes: LibraryTreeNode[]): LibraryTreeNode[] {
  return nodes.map((node) => ({
    ...node,
    meta: {
      directoryName: node.directoryName,
      fileName: node.fileName,
      path: node.path,
    },
    children: node.children ? packLibraryTreeMeta(node.children) : undefined,
  }));
}

async function loadAllLibraryData(handle: StorageDirectoryHandle) {
  const [setList, toneList, patchList, tonesTreeData, patchesTreeData, commonSamplesTreeData] = await Promise.all([
    listSets(handle), listIndividualTones(handle), listIndividualPatches(handle),
    listIndividualTonesTree(handle), listIndividualPatchesTree(handle),
    listCommonSamplesTree(handle),
  ]);
  return {
    setList,
    toneList,
    patchList,
    tonesTreeData: packLibraryTreeMeta(tonesTreeData),
    patchesTreeData: packLibraryTreeMeta(patchesTreeData),
    commonSamplesTreeData: packLibraryTreeMeta(commonSamplesTreeData),
  };
}

// =========================================================================
// Result interface
// =========================================================================

export interface RolandLibraryDataResult {
  // Tree data for plugin categories
  tonesTree: LibraryTreeNode[];
  patchesTree: LibraryTreeNode[];
  commonSamplesTree: LibraryTreeNode[];
  categoryData: Record<string, LibraryTreeNode[]>;

  // Flat lists (used by legacy hooks)
  setIndividualTones: React.Dispatch<React.SetStateAction<LibraryToneInfo[]>>;
  setIndividualPatches: React.Dispatch<React.SetStateAction<LibraryPatchInfo[]>>;
  setTonesTree: React.Dispatch<React.SetStateAction<LibraryTreeNode[]>>;
  setPatchesTree: React.Dispatch<React.SetStateAction<LibraryTreeNode[]>>;

  // Refresh
  handleRefreshLibrary: () => Promise<void>;
}

// =========================================================================
// Hook
// =========================================================================

export function useRolandLibraryData(
  libraryHandle: StorageDirectoryHandle | null,
): RolandLibraryDataResult {
  const { setSets, setLoading, setError } = useLibraryStore();

  // Flat lists used for legacy hooks but not read directly (trees used for display)
  const [, setIndividualTones] = useState<LibraryToneInfo[]>([]);
  const [, setIndividualPatches] = useState<LibraryPatchInfo[]>([]);
  const [tonesTree, setTonesTree] = useState<LibraryTreeNode[]>([]);
  const [patchesTree, setPatchesTree] = useState<LibraryTreeNode[]>([]);
  const [commonSamplesTree, setCommonSamplesTree] = useState<LibraryTreeNode[]>([]);

  const applyLibraryData = useCallback((data: Awaited<ReturnType<typeof loadAllLibraryData>>) => {
    setSets(data.setList);
    setIndividualTones(data.toneList);
    setIndividualPatches(data.patchList);
    setTonesTree(data.tonesTreeData);
    setPatchesTree(data.patchesTreeData);
    setCommonSamplesTree(data.commonSamplesTreeData);
  }, [setSets]);

  const handleRefreshLibrary = useCallback(async () => {
    if (!libraryHandle) return;
    setLoading(true, 'Refreshing library...');
    try {
      applyLibraryData(await loadAllLibraryData(libraryHandle));
    } catch (err) {
      console.error('[useRolandLibraryData] Failed to refresh library:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh library');
    } finally {
      setLoading(false);
    }
  }, [libraryHandle, applyLibraryData, setLoading, setError]);

  // Load library data when connection becomes available
  useEffect(() => {
    if (!libraryHandle) return;
    setLoading(true, 'Loading library...');
    loadAllLibraryData(libraryHandle)
      .then(applyLibraryData)
      .catch((err) => {
        console.error('[useRolandLibraryData] Failed to load library:', err);
        setError(err instanceof Error ? err.message : 'Failed to load library');
      })
      .finally(() => setLoading(false));
  }, [libraryHandle, applyLibraryData, setLoading, setError]);

  const categoryData = useMemo(() => ({
    tones: tonesTree,
    patches: patchesTree,
    samples: commonSamplesTree,
  }), [tonesTree, patchesTree, commonSamplesTree]);

  return {
    tonesTree,
    patchesTree,
    commonSamplesTree,
    categoryData,
    setIndividualTones,
    setIndividualPatches,
    setTonesTree,
    setPatchesTree,
    handleRefreshLibrary,
  };
}
