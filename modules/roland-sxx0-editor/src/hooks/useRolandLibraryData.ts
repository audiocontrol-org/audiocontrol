/**
 * Hook managing library data loading and tree state for the Roland Library page.
 *
 * Loads sets, drum kits, tones, patches, and common samples from the library
 * storage handle. Provides tree data for the plugin category format and a
 * refresh callback for re-scanning after mutations.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  listSets, listDrumKits, listIndividualTones, listIndividualPatches,
  listIndividualTonesTree, listIndividualPatchesTree, listDrumKitsTree,
  listCommonSamplesTree,
  type DrumKitInfo, type LibraryToneInfo, type LibraryPatchInfo, type LibraryTreeNode,
  type StorageDirectoryHandle,
} from '@/lib/library-service';
import { useLibraryStore } from '@/stores/libraryStore';
import type { ResolvedDrumKitBundle } from '@audiocontrol/sampler-library/browser';

// =========================================================================
// Data loading
// =========================================================================

async function loadAllLibraryData(handle: StorageDirectoryHandle) {
  const [setList, kitList, toneList, patchList, tonesTreeData, patchesTreeData, drumKitsTreeData, commonSamplesTreeData] = await Promise.all([
    listSets(handle), listDrumKits(handle), listIndividualTones(handle), listIndividualPatches(handle),
    listIndividualTonesTree(handle), listIndividualPatchesTree(handle), listDrumKitsTree(handle),
    listCommonSamplesTree(handle),
  ]);
  return { setList, kitList, toneList, patchList, tonesTreeData, patchesTreeData, drumKitsTreeData, commonSamplesTreeData };
}

// =========================================================================
// Result interface
// =========================================================================

export interface RolandLibraryDataResult {
  // Tree data for plugin categories
  tonesTree: LibraryTreeNode[];
  patchesTree: LibraryTreeNode[];
  drumKitsTree: LibraryTreeNode[];
  commonSamplesTree: LibraryTreeNode[];
  categoryData: Record<string, LibraryTreeNode[]>;

  // Flat lists (used by legacy hooks)
  drumKits: DrumKitInfo[];
  setIndividualTones: React.Dispatch<React.SetStateAction<LibraryToneInfo[]>>;
  setIndividualPatches: React.Dispatch<React.SetStateAction<LibraryPatchInfo[]>>;
  setTonesTree: React.Dispatch<React.SetStateAction<LibraryTreeNode[]>>;
  setPatchesTree: React.Dispatch<React.SetStateAction<LibraryTreeNode[]>>;
  setDrumKits: React.Dispatch<React.SetStateAction<DrumKitInfo[]>>;
  setDrumKitsTree: React.Dispatch<React.SetStateAction<LibraryTreeNode[]>>;

  // Drum kit bundle selection
  selectedDrumKitBundle: ResolvedDrumKitBundle | null;
  setSelectedDrumKitBundle: (bundle: ResolvedDrumKitBundle | null) => void;

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

  const [drumKits, setDrumKits] = useState<DrumKitInfo[]>([]);
  const [selectedDrumKitBundle, setSelectedDrumKitBundle] = useState<ResolvedDrumKitBundle | null>(null);
  // Flat lists used for legacy hooks but not read directly (trees used for display)
  const [, setIndividualTones] = useState<LibraryToneInfo[]>([]);
  const [, setIndividualPatches] = useState<LibraryPatchInfo[]>([]);
  const [tonesTree, setTonesTree] = useState<LibraryTreeNode[]>([]);
  const [patchesTree, setPatchesTree] = useState<LibraryTreeNode[]>([]);
  const [drumKitsTree, setDrumKitsTree] = useState<LibraryTreeNode[]>([]);
  const [commonSamplesTree, setCommonSamplesTree] = useState<LibraryTreeNode[]>([]);

  const applyLibraryData = useCallback((data: Awaited<ReturnType<typeof loadAllLibraryData>>) => {
    setSets(data.setList);
    setDrumKits(data.kitList);
    setIndividualTones(data.toneList);
    setIndividualPatches(data.patchList);
    setTonesTree(data.tonesTreeData);
    setPatchesTree(data.patchesTreeData);
    setDrumKitsTree(data.drumKitsTreeData);
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
    drumKits: drumKitsTree,
    samples: commonSamplesTree,
  }), [tonesTree, patchesTree, drumKitsTree, commonSamplesTree]);

  return {
    tonesTree,
    patchesTree,
    drumKitsTree,
    commonSamplesTree,
    categoryData,
    drumKits,
    setIndividualTones,
    setIndividualPatches,
    setTonesTree,
    setPatchesTree,
    setDrumKits,
    setDrumKitsTree,
    selectedDrumKitBundle,
    setSelectedDrumKitBundle,
    handleRefreshLibrary,
  };
}
