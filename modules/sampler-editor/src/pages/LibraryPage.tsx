/**
 * Library Page - View and manage S-330 library sets
 *
 * Three-column layout:
 * - Left: Device memory (tones and patches loaded on device)
 * - Center: Library browser (sets, global tones, patches)
 * - Right: Preview/details of selected item with import/export actions
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useMidiStore } from '@/stores/midiStore';
import { useDeviceDataStore } from '@/stores/deviceDataStore';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { useLibraryStore } from '@/stores/libraryStore';
import type { SamplerClientInterface, SamplerTone, SamplerPatch } from '@/core/midi/SamplerClient';
import { DeviceMemoryPanel, type DeviceDragData, type LibraryDragData } from '@/components/library/DeviceMemoryPanel';
import { LibraryTreePanel } from '@/components/library/LibraryTreePanel';
import { ItemPreviewPanel } from '@/components/library/ItemPreviewPanel';
import { DrumKitPreviewPanel } from '@/components/library/DrumKitPreviewPanel';
import { SaveSetDialog } from '@/components/library/SaveSetDialog';
import { LoadSetDialog } from '@/components/library/LoadSetDialog';
import { ImportLibraryToneDialog } from '@/components/library/ImportLibraryToneDialog';
import { ImportLibraryPatchDialog } from '@/components/library/ImportLibraryPatchDialog';
import { ImportDrumKitDialog } from '@/components/library/ImportDrumKitDialog';
import { SampleChopperDialog, type SliceDefinitionOutput, type InitialSliceDefinition } from '@/components/library/SampleChopperDialog';
import { ExportToneDialog } from '@/components/library/ExportToneDialog';
import { ExportPatchDialog } from '@/components/library/ExportPatchDialog';
import { useImportDrumKit } from '@/hooks/useImportDrumKit';
import {
  hasFileSystemAccess,
  pickLibraryDirectory,
  getCachedLibraryDirectory,
  setCachedLibraryDirectory,
  listSets,
  listDrumKits,
  listIndividualTones,
  listIndividualPatches,
  listIndividualTonesTree,
  listIndividualPatchesTree,
  listDrumKitsTree,
  loadDrumKitBundle,
  loadDrumKitSource,
  updateDrumKitSlices,
  saveDeviceToSetIncremental,
  loadSetToDevice,
  exportToneToDirectory,
  exportPatchToDirectory,
  getPatchToneDependencies,
  deleteSet,
  deleteIndividualTone,
  deleteIndividualPatch,
  deleteDrumKit,
  createDirectory,
  renameDirectory,
  deleteDirectory,
  moveItem,
  renameIndividualTone,
  renameIndividualPatch,
  renameDrumKit,
  renameSet,
  type DrumKitInfo,
  type LibraryToneInfo,
  type LibraryPatchInfo,
  type LibraryTreeNode,
  type LibraryCategory,
  type PatchBundleTone,
} from '@/lib/library-service';
import { CreateDirectoryDialog } from '@/components/library/CreateDirectoryDialog';
import { RenameDirectoryDialog } from '@/components/library/RenameDirectoryDialog';
import { DeleteDirectoryDialog } from '@/components/library/DeleteDirectoryDialog';
import { MoveItemDialog } from '@/components/library/MoveItemDialog';
import type { ResolvedDrumKitBundle } from '@audiocontrol/sampler-library/browser';
import type { ImportProgress } from '@/types/import-operation';
import { getOverallPercent } from '@/types/import-operation';
import { cn } from '@/lib/utils';

/**
 * Selection state for items in either panel
 */
export interface ItemSelection {
  source: 'device' | 'library';
  type: 'tone' | 'patch' | 'set' | 'drumKit' | 'individualTone' | 'individualPatch';
  index?: number;
  name?: string;
  setName?: string;
  /** Path segments for hierarchical items */
  path?: string[];
}

export function LibraryPage() {
  const config = useDeviceConfig();
  const { totalPatches, totalTones, patchesPerBank, tonesPerBank } = config;

  const { adapter, deviceId, status } = useMidiStore();
  const isConnected = status === 'connected' && adapter !== null;

  // Device data store
  const {
    tones,
    patches,
    loadedToneBanks,
    loadedPatchBanks,
    setTone,
    setPatch,
    ensureToneArraySize,
    ensurePatchArraySize,
    markToneBankLoaded,
    markPatchBankLoaded,
  } = useDeviceDataStore();

  // Library store
  const {
    sets,
    setSets,
    isLoading,
    setLoading,
    setError,
    error,
    expandedPaths,
    toggleDirectoryExpanded,
  } = useLibraryStore();

  // Drum kit state
  const [drumKits, setDrumKits] = useState<DrumKitInfo[]>([]);
  const [selectedDrumKitBundle, setSelectedDrumKitBundle] = useState<ResolvedDrumKitBundle | null>(null);

  // Slice editing state
  const [sliceEditDialog, setSliceEditDialog] = useState<{
    open: boolean;
    kitName: string;
    path?: string[];
    samples: Int16Array | null;
    sampleRate: number;
    slices: InitialSliceDefinition[];
    kitConfig: {
      name: string;
      sampleRate: 15000 | 30000;
      baseNote: number;
      transpose?: number;
      velocitySensitivity?: number;
    };
  } | null>(null);

  // Individual tones state
  const [individualTones, setIndividualTones] = useState<LibraryToneInfo[]>([]);

  // Individual patches state
  const [individualPatches, setIndividualPatches] = useState<LibraryPatchInfo[]>([]);

  // Hierarchical tree state
  const [tonesTree, setTonesTree] = useState<LibraryTreeNode[]>([]);
  const [patchesTree, setPatchesTree] = useState<LibraryTreeNode[]>([]);
  const [drumKitsTree, setDrumKitsTree] = useState<LibraryTreeNode[]>([]);

  // Directory dialog state
  const [createDirectoryDialog, setCreateDirectoryDialog] = useState<{
    category: LibraryCategory;
    parentPath: string[];
  } | null>(null);
  const [renameDirectoryDialog, setRenameDirectoryDialog] = useState<{
    category: LibraryCategory;
    path: string[];
    currentName: string;
  } | null>(null);
  const [deleteDirectoryDialog, setDeleteDirectoryDialog] = useState<{
    category: LibraryCategory;
    path: string[];
    directoryName: string;
  } | null>(null);
  const [moveItemDialog, setMoveItemDialog] = useState<{
    category: LibraryCategory;
    sourcePath: string[];
    itemName: string;
    itemType: 'tone' | 'patch' | 'drum-kit' | 'directory';
  } | null>(null);

  // Export tone dialog state
  const [exportToneDialog, setExportToneDialog] = useState<{
    tone: SamplerTone;
    toneIndex: number;
  } | null>(null);
  const [exportProgress, setExportProgress] = useState<number | undefined>(undefined);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  // Export patch dialog state
  const [exportPatchDialog, setExportPatchDialog] = useState<{
    patch: SamplerPatch;
    patchIndex: number;
  } | null>(null);
  const [exportPatchProgress, setExportPatchProgress] = useState<number | undefined>(undefined);
  const [exportPatchError, setExportPatchError] = useState<string | null>(null);

  // Local state
  const [selection, setSelection] = useState<ItemSelection | null>(null);
  const [libraryHandle, setLibraryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
  const [operationProgress, setOperationProgress] = useState<ImportProgress | undefined>(undefined);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Import dialog state
  const [importToneDialog, setImportToneDialog] = useState<{
    setName: string;
    toneFile: string;
    initialTargetSlot?: number;
  } | null>(null);
  const [importPatchDialog, setImportPatchDialog] = useState<{
    setName: string;
    patchFile: string;
    patchPath?: string[];
    initialTargetSlot?: number;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // S330 client ref
  const clientRef = useRef<SamplerClientInterface | null>(null);

  // Initialize client when adapter changes
  useEffect(() => {
    if (!adapter) {
      clientRef.current = null;
      return;
    }
    const client = config.createClient(adapter, { deviceId });
    clientRef.current = client;
  }, [adapter, deviceId]);

  // Drum kit import hook - wrap setTone/setPatch with config-aware versions
  const setToneForHook = useCallback(
    (index: number, tone: SamplerTone) => setTone(index, tone, totalTones),
    [setTone, totalTones]
  );
  const setPatchForHook = useCallback(
    (index: number, patch: SamplerPatch) => setPatch(index, patch, totalPatches),
    [setPatch, totalPatches]
  );

  const {
    importDrumKitDialog,
    isImporting: isDrumKitImporting,
    importProgress: drumKitImportProgress,
    importError: drumKitImportError,
    openImportDrumKitDialog,
    closeImportDrumKitDialog,
    handleImportDrumKit,
  } = useImportDrumKit({
    clientRef,
    libraryHandle,
    setTone: setToneForHook,
    setPatch: setPatchForHook,
  });

  // Initialize library directory
  useEffect(() => {
    async function initLibrary() {
      if (!hasFileSystemAccess()) return;

      const cached = await getCachedLibraryDirectory();
      if (cached) {
        setLibraryHandle(cached);
        // Load sets, drum kits, individual tones, individual patches, and hierarchical trees
        try {
          const [setList, kitList, toneList, patchList, tonesTreeData, patchesTreeData, drumKitsTreeData] = await Promise.all([
            listSets(cached),
            listDrumKits(cached),
            listIndividualTones(cached),
            listIndividualPatches(cached),
            listIndividualTonesTree(cached),
            listIndividualPatchesTree(cached),
            listDrumKitsTree(cached),
          ]);
          setSets(setList);
          setDrumKits(kitList);
          setIndividualTones(toneList);
          setIndividualPatches(patchList);
          setTonesTree(tonesTreeData);
          setPatchesTree(patchesTreeData);
          setDrumKitsTree(drumKitsTreeData);
        } catch (err) {
          console.error('[LibraryPage] Failed to load library:', err);
        }
      }
    }
    initLibrary();
  }, [setSets]);

  // Pick library directory (requires user gesture)
  const handlePickDirectory = useCallback(async () => {
    const handle = await pickLibraryDirectory();
    if (handle) {
      setLibraryHandle(handle);
      setCachedLibraryDirectory(handle);
      // Load sets, drum kits, individual tones, individual patches, and hierarchical trees
      try {
        const [setList, kitList, toneList, patchList, tonesTreeData, patchesTreeData, drumKitsTreeData] = await Promise.all([
          listSets(handle),
          listDrumKits(handle),
          listIndividualTones(handle),
          listIndividualPatches(handle),
          listIndividualTonesTree(handle),
          listIndividualPatchesTree(handle),
          listDrumKitsTree(handle),
        ]);
        setSets(setList);
        setDrumKits(kitList);
        setIndividualTones(toneList);
        setIndividualPatches(patchList);
        setTonesTree(tonesTreeData);
        setPatchesTree(patchesTreeData);
        setDrumKitsTree(drumKitsTreeData);
      } catch (err) {
        console.error('[LibraryPage] Failed to load library:', err);
        setError(err instanceof Error ? err.message : 'Failed to load library');
      }
    }
  }, [setSets, setError]);

  // Refresh library contents
  const handleRefreshLibrary = useCallback(async () => {
    if (!libraryHandle) return;

    setLoading(true, 'Refreshing library...');
    try {
      const [setList, kitList, toneList, patchList, tonesTreeData, patchesTreeData, drumKitsTreeData] = await Promise.all([
        listSets(libraryHandle),
        listDrumKits(libraryHandle),
        listIndividualTones(libraryHandle),
        listIndividualPatches(libraryHandle),
        listIndividualTonesTree(libraryHandle),
        listIndividualPatchesTree(libraryHandle),
        listDrumKitsTree(libraryHandle),
      ]);
      setSets(setList);
      setDrumKits(kitList);
      setIndividualTones(toneList);
      setIndividualPatches(patchList);
      setTonesTree(tonesTreeData);
      setPatchesTree(patchesTreeData);
      setDrumKitsTree(drumKitsTreeData);
    } catch (err) {
      console.error('[LibraryPage] Failed to refresh library:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh library');
    } finally {
      setLoading(false);
    }
  }, [libraryHandle, setSets, setLoading, setError]);

  // Delete a set from library
  const handleDeleteSet = useCallback(async (setName: string) => {
    if (!libraryHandle) return;

    if (!window.confirm(`Delete set "${setName}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteSet(libraryHandle, setName);
      // Clear selection if the deleted item was selected
      if (selection?.type === 'set' && selection.name === setName) {
        setSelection(null);
      }
      // Refresh library
      await handleRefreshLibrary();
    } catch (err) {
      console.error('[LibraryPage] Failed to delete set:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete set');
    }
  }, [libraryHandle, selection, handleRefreshLibrary, setError]);

  // Delete an individual tone from library
  const handleDeleteIndividualTone = useCallback(async (fileName: string, path?: string[]) => {
    if (!libraryHandle) return;

    if (!window.confirm(`Delete tone "${fileName}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteIndividualTone(libraryHandle, fileName, path);
      // Clear selection if the deleted item was selected
      if (selection?.type === 'individualTone' && selection.name === fileName) {
        setSelection(null);
      }
      // Refresh individual tones list and tree
      const [updatedTones, updatedTree] = await Promise.all([
        listIndividualTones(libraryHandle),
        listIndividualTonesTree(libraryHandle),
      ]);
      setIndividualTones(updatedTones);
      setTonesTree(updatedTree);
    } catch (err) {
      console.error('[LibraryPage] Failed to delete tone:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete tone');
    }
  }, [libraryHandle, selection, setError]);

  // Delete an individual patch bundle from library
  const handleDeleteIndividualPatch = useCallback(async (directoryName: string, path?: string[]) => {
    if (!libraryHandle) return;

    if (!window.confirm(`Delete patch "${directoryName}" and all its tones? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteIndividualPatch(libraryHandle, directoryName, path);
      // Clear selection if the deleted item was selected
      if (selection?.type === 'individualPatch' && selection.name === directoryName) {
        setSelection(null);
      }
      // Refresh individual patches list and tree
      const [updatedPatches, updatedTree] = await Promise.all([
        listIndividualPatches(libraryHandle),
        listIndividualPatchesTree(libraryHandle),
      ]);
      setIndividualPatches(updatedPatches);
      setPatchesTree(updatedTree);
    } catch (err) {
      console.error('[LibraryPage] Failed to delete patch:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete patch');
    }
  }, [libraryHandle, selection, setError]);

  // Delete a drum kit from library
  const handleDeleteDrumKit = useCallback(async (directoryName: string, path?: string[]) => {
    if (!libraryHandle) return;

    if (!window.confirm(`Delete drum kit "${directoryName}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteDrumKit(libraryHandle, directoryName, path);
      // Clear selection if the deleted item was selected
      if (selection?.type === 'drumKit' && selection.name === directoryName) {
        setSelection(null);
        setSelectedDrumKitBundle(null);
      }
      // Refresh drum kits list and tree
      const [updatedKits, updatedTree] = await Promise.all([
        listDrumKits(libraryHandle),
        listDrumKitsTree(libraryHandle),
      ]);
      setDrumKits(updatedKits);
      setDrumKitsTree(updatedTree);
    } catch (err) {
      console.error('[LibraryPage] Failed to delete drum kit:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete drum kit');
    }
  }, [libraryHandle, selection, setError]);

  // =========================================================================
  // Directory Operations
  // =========================================================================

  // Open create directory dialog
  const handleOpenCreateDirectory = useCallback((category: LibraryCategory, parentPath: string[]) => {
    setCreateDirectoryDialog({ category, parentPath });
  }, []);

  // Create a new directory
  const handleCreateDirectory = useCallback(async (name: string) => {
    if (!libraryHandle || !createDirectoryDialog) return;

    try {
      await createDirectory(
        libraryHandle,
        createDirectoryDialog.category,
        createDirectoryDialog.parentPath,
        name
      );
      setCreateDirectoryDialog(null);
      await handleRefreshLibrary();
    } catch (err) {
      console.error('[LibraryPage] Failed to create directory:', err);
      throw err;
    }
  }, [libraryHandle, createDirectoryDialog, handleRefreshLibrary]);

  // Open rename directory dialog
  const handleOpenRenameDirectory = useCallback((category: LibraryCategory, path: string[]) => {
    const currentName = path[path.length - 1];
    setRenameDirectoryDialog({ category, path, currentName });
  }, []);

  // Rename a directory
  const handleRenameDirectory = useCallback(async (newName: string) => {
    if (!libraryHandle || !renameDirectoryDialog) return;

    try {
      await renameDirectory(
        libraryHandle,
        renameDirectoryDialog.category,
        renameDirectoryDialog.path,
        newName
      );
      setRenameDirectoryDialog(null);
      await handleRefreshLibrary();
    } catch (err) {
      console.error('[LibraryPage] Failed to rename directory:', err);
      throw err;
    }
  }, [libraryHandle, renameDirectoryDialog, handleRefreshLibrary]);

  // Open delete directory dialog
  const handleOpenDeleteDirectory = useCallback((category: LibraryCategory, path: string[]) => {
    const directoryName = path[path.length - 1];
    setDeleteDirectoryDialog({ category, path, directoryName });
  }, []);

  // Delete a directory
  const handleDeleteDirectory = useCallback(async () => {
    if (!libraryHandle || !deleteDirectoryDialog) return;

    try {
      await deleteDirectory(
        libraryHandle,
        deleteDirectoryDialog.category,
        deleteDirectoryDialog.path,
        true // recursive
      );
      setDeleteDirectoryDialog(null);
      await handleRefreshLibrary();
    } catch (err) {
      console.error('[LibraryPage] Failed to delete directory:', err);
      throw err;
    }
  }, [libraryHandle, deleteDirectoryDialog, handleRefreshLibrary]);

  // Open move item dialog
  const handleOpenMoveItem = useCallback((
    category: LibraryCategory,
    sourcePath: string[],
    itemName: string
  ) => {
    // Determine item type based on what's in the library at that path
    // For now, we'll infer from category - this could be enhanced
    let itemType: 'tone' | 'patch' | 'drum-kit' | 'directory' = 'directory';
    if (category === 'tones') itemType = 'tone';
    else if (category === 'patches') itemType = 'patch';
    else if (category === 'drum-kits') itemType = 'drum-kit';

    setMoveItemDialog({ category, sourcePath, itemName, itemType });
  }, []);

  // Move an item to a new location
  const handleMoveItem = useCallback(async (targetPath: string[]) => {
    if (!libraryHandle || !moveItemDialog) return;

    try {
      await moveItem(
        libraryHandle,
        moveItemDialog.category,
        moveItemDialog.sourcePath,
        moveItemDialog.itemName,
        targetPath
      );
      setMoveItemDialog(null);
      await handleRefreshLibrary();
    } catch (err) {
      console.error('[LibraryPage] Failed to move item:', err);
      throw err;
    }
  }, [libraryHandle, moveItemDialog, handleRefreshLibrary]);

  // Get the tree for the current category in move dialog
  const getMoveDialogTree = useCallback((): LibraryTreeNode[] => {
    if (!moveItemDialog) return [];
    switch (moveItemDialog.category) {
      case 'tones': return tonesTree;
      case 'patches': return patchesTree;
      case 'drum-kits': return drumKitsTree;
      default: return [];
    }
  }, [moveItemDialog, tonesTree, patchesTree, drumKitsTree]);

  // Handle drag-drop move (directly moves item without dialog)
  const handleDropMoveItem = useCallback(async (
    category: LibraryCategory,
    sourcePath: string[],
    itemName: string,
    targetPath: string[]
  ) => {
    if (!libraryHandle) return;

    try {
      await moveItem(libraryHandle, category, sourcePath, itemName, targetPath);
      await handleRefreshLibrary();
    } catch (err) {
      console.error('[LibraryPage] Failed to move item via drag-drop:', err);
      setError(err instanceof Error ? err.message : 'Failed to move item');
    }
  }, [libraryHandle, handleRefreshLibrary, setError]);

  // Handle in-place rename (double-click to edit)
  const handleRenameItem = useCallback(async (
    category: LibraryCategory,
    path: string[],
    oldName: string,
    newName: string,
    isDirectory: boolean
  ) => {
    if (!libraryHandle) return;

    try {
      if (isDirectory) {
        // Rename a subdirectory
        await renameDirectory(libraryHandle, category, [...path, oldName], newName);
      } else if (category === 'tones') {
        // Tones are stored as .yaml files
        await renameIndividualTone(libraryHandle, oldName, newName, path);
      } else if (category === 'patches') {
        // Patches are stored as directories
        await renameIndividualPatch(libraryHandle, oldName, newName, path);
      } else if (category === 'drum-kits') {
        // Drum kits are stored as directories
        await renameDrumKit(libraryHandle, oldName, newName, path);
      }

      await handleRefreshLibrary();
    } catch (err) {
      console.error('[LibraryPage] Failed to rename item:', err);
      setError(err instanceof Error ? err.message : 'Failed to rename item');
      throw err; // Re-throw so the UI knows the rename failed
    }
  }, [libraryHandle, handleRefreshLibrary, setError]);

  // Handle set rename (double-click to edit)
  const handleRenameSet = useCallback(async (oldName: string, newName: string) => {
    if (!libraryHandle) return;

    try {
      await renameSet(libraryHandle, oldName, newName);
      await handleRefreshLibrary();
    } catch (err) {
      console.error('[LibraryPage] Failed to rename set:', err);
      setError(err instanceof Error ? err.message : 'Failed to rename set');
      throw err;
    }
  }, [libraryHandle, handleRefreshLibrary, setError]);

  // Load all data from device (tones and patches)
  const handleLoadDeviceData = useCallback(async () => {
    if (!clientRef.current) return;

    // Calculate number of banks from config
    const toneBankCount = Math.ceil(totalTones / tonesPerBank);
    const patchBankCount = Math.ceil(totalPatches / patchesPerBank);

    setLoading(true, 'Loading data from device...');
    try {
      await clientRef.current.connect();

      // Ensure arrays are properly sized
      ensureToneArraySize(totalTones);
      ensurePatchArraySize(totalPatches);

      // Load all tones
      for (let bank = 0; bank < toneBankCount; bank++) {
        setLoading(true, `Loading tones (bank ${bank + 1}/${toneBankCount})...`);
        await clientRef.current.loadToneRange(
          bank * tonesPerBank,
          tonesPerBank,
          () => {},
          (index: number, tone: SamplerTone) => setTone(index, tone, totalTones),
          false
        );
        markToneBankLoaded(bank);
      }

      // Load all patches
      for (let bank = 0; bank < patchBankCount; bank++) {
        setLoading(true, `Loading patches (bank ${bank + 1}/${patchBankCount})...`);
        await clientRef.current.loadPatchRange(
          bank * patchesPerBank,
          patchesPerBank,
          () => {},
          (index: number, patch: SamplerPatch) => setPatch(index, patch, totalPatches),
          false
        );
        markPatchBankLoaded(bank);
      }
    } catch (err) {
      console.error('[LibraryPage] Failed to load device data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load from device');
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setTone, setPatch, ensureToneArraySize, ensurePatchArraySize, markToneBankLoaded, markPatchBankLoaded, totalTones, tonesPerBank, totalPatches, patchesPerBank]);

  // Open save set dialog
  const handleOpenSaveDialog = useCallback(() => {
    setOperationError(null);
    setOperationProgress(undefined);
    setIsSaveDialogOpen(true);
  }, []);

  // Save device state to set - fetches ALL data fresh from device
  const handleSaveSet = useCallback(async (setName: string, description?: string) => {
    if (!libraryHandle || !clientRef.current) return;

    setOperationProgress({ currentStep: 0, totalSteps: 1, stepLabel: 'Preparing...', bytesSent: 0, bytesTotal: 0, bytesSentAllSteps: 0, bytesTotalAllSteps: 100 });
    setOperationError(null);

    const client = clientRef.current;

    try {
      // Use incremental save - fetches ALL data from device (ignores UI cache)
      await saveDeviceToSetIncremental(
        libraryHandle,
        setName,
        description,
        // Fetch tone data callback - fetches fresh from device
        async (toneIndex) => {
          return await client.requestToneData(toneIndex);
        },
        // Fetch patch data callback - fetches fresh from device
        async (patchIndex) => {
          return await client.requestPatchData(patchIndex);
        },
        // Fetch wave data callback - fetches fresh from device
        async (toneIndex, onWaveProgress) => {
          return await client.requestWaveData(toneIndex, onWaveProgress ?? (() => {}));
        },
        (progress) => setOperationProgress((prev) => prev ? { ...prev, bytesSent: Math.floor(progress), bytesTotal: 100 } : { currentStep: 1, totalSteps: 1, stepLabel: 'Saving...', bytesSent: Math.floor(progress), bytesTotal: 100, bytesSentAllSteps: 0, bytesTotalAllSteps: 100 }),
        (status) => setOperationProgress((prev) => prev ? { ...prev, stepLabel: status } : { currentStep: 1, totalSteps: 1, stepLabel: status, bytesSent: 0, bytesTotal: 0, bytesSentAllSteps: 0, bytesTotalAllSteps: 100 })
      );

      setOperationProgress({ currentStep: 1, totalSteps: 1, stepLabel: 'Save complete', bytesSent: 100, bytesTotal: 100, bytesSentAllSteps: 0, bytesTotalAllSteps: 100 });

      // Refresh library
      await handleRefreshLibrary();
      setIsSaveDialogOpen(false);
    } catch (err) {
      console.error('[LibraryPage] Failed to save set:', err);
      setOperationError(err instanceof Error ? err.message : 'Failed to save set');
    }
  }, [libraryHandle, handleRefreshLibrary]);

  // Open load set dialog
  const handleOpenLoadDialog = useCallback(() => {
    if (!selection || selection.type !== 'set' || !selection.name) return;
    setOperationError(null);
    setOperationProgress(undefined);
    setIsLoadDialogOpen(true);
  }, [selection]);


  // Load set to device using the selected import target's offsets
  const handleLoadSet = useCallback(async (target: { toneIndexOffset: number; waveBankOffset: number }) => {
    if (!libraryHandle || !clientRef.current || !selection?.name) return;

    const toneOffset = target.toneIndexOffset;
    const waveBankOffset = target.waveBankOffset;

    setOperationProgress({ currentStep: 1, totalSteps: 1, stepLabel: 'Reading set from library...', bytesSent: 0, bytesTotal: 0, bytesSentAllSteps: 0, bytesTotalAllSteps: 0 });
    setOperationError(null);

    try {
      // Load and convert set
      const deviceState = await loadSetToDevice(
        libraryHandle,
        selection.name,
        (progress) => {
          let stepLabel = 'Reading manifest...';
          if (progress >= 60) stepLabel = 'Loading patch data...';
          else if (progress >= 30) stepLabel = 'Loading tone data...';
          setOperationProgress({ currentStep: 1, totalSteps: 1, stepLabel, bytesSent: Math.floor(progress), bytesTotal: 100, bytesSentAllSteps: 0, bytesTotalAllSteps: 0 });
        }
      );

      // Upload to device
      let uploadCount = 0;
      const loadedToneCount = deviceState.tones.size;
      const loadedPatchCount = deviceState.patches.size;
      const totalItems = loadedToneCount + loadedPatchCount;
      const bytesTotalAllSteps = Array.from(deviceState.tones.values()).reduce((sum, d) => sum + d.wavData.length, 0);
      let bytesSentAllSteps = 0;

      for (const [slot, data] of deviceState.tones) {
        const targetSlot = slot + toneOffset;
        const targetBank = (data.tone.wave.bank + waveBankOffset) as 0 | 1 | 2 | 3;
        const toneSlot = `T${Math.floor(targetSlot / 8) + 1}${(targetSlot % 8) + 1}`;
        const toneName = data.tone.name || toneSlot;
        // Upload wave data and tone to device
        // Pass the full tone object to preserve all parameters (pitchFollow, envelopes, etc.)
        await clientRef.current.importTone(
          {
            toneIndex: targetSlot,
            waveData: data.wavData,
            waveBank: targetBank,
            segmentTop: data.tone.wave.segmentTop,
            segmentLength: data.tone.wave.segmentLength,
            tone: data.tone,
          },
          (bytesSent, totalBytes) => {
            setOperationProgress({
              currentStep: uploadCount + 1,
              totalSteps: totalItems,
              stepLabel: `Uploading ${toneName}`,
              bytesSent,
              bytesTotal: totalBytes,
              bytesSentAllSteps,
              bytesTotalAllSteps,
            });
          }
        );
        setTone(targetSlot, data.tone, totalTones);
        bytesSentAllSteps += data.wavData.length;
        uploadCount++;

        // Give the device time to process before next import
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      for (const [slot, patch] of deviceState.patches) {
        const patchSlot = `P${String(slot + 1).padStart(2, '0')}`;
        const patchName = patch.common.name || patchSlot;

        setOperationProgress({
          currentStep: uploadCount + 1,
          totalSteps: totalItems,
          stepLabel: `Uploading patch ${patchName}`,
          bytesSent: 0, bytesTotal: 0,
          bytesSentAllSteps, bytesTotalAllSteps,
        });

        await clientRef.current.sendPatchData(slot, patch.common);
        uploadCount++;

        // Give the device time to process
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      setOperationProgress({
        currentStep: totalItems,
        totalSteps: totalItems,
        stepLabel: `Loaded ${loadedToneCount} tones and ${loadedPatchCount} patches`,
        bytesSent: 0, bytesTotal: 0,
        bytesSentAllSteps: bytesTotalAllSteps, bytesTotalAllSteps,
      });

      // Brief delay to show completion message
      await new Promise((resolve) => setTimeout(resolve, 500));
      setIsLoadDialogOpen(false);
    } catch (err) {
      console.error('[LibraryPage] Failed to load set:', err);
      setOperationError(err instanceof Error ? err.message : 'Failed to load set');
    }
  }, [libraryHandle, selection, setTone, totalTones]);

  // Handle item selection from either panel
  const handleSelectDevice = useCallback((type: 'tone' | 'patch', index: number) => {
    setSelection({ source: 'device', type, index });
  }, []);

  const handleSelectLibrary = useCallback((type: 'tone' | 'patch' | 'set', name: string, setName?: string) => {
    setSelection({ source: 'library', type, name, setName });
    // Clear drum kit bundle when selecting non-drum-kit item
    setSelectedDrumKitBundle(null);
  }, []);

  // Handle drum kit selection
  const handleSelectDrumKit = useCallback(async (directoryName: string, path?: string[]) => {
    setSelection({ source: 'library', type: 'drumKit', name: directoryName, path });
    setSelectedDrumKitBundle(null);

    // Load the full bundle
    if (libraryHandle) {
      try {
        const bundle = await loadDrumKitBundle(libraryHandle, directoryName, path);
        setSelectedDrumKitBundle(bundle);
      } catch (err) {
        console.error('[LibraryPage] Failed to load drum kit bundle:', err);
      }
    }
  }, [libraryHandle]);

  // Handle edit kit for v2 drum kits
  const handleEditKit = useCallback(async () => {
    if (!libraryHandle || !selection || selection.type !== 'drumKit' || !selectedDrumKitBundle) {
      return;
    }

    const bundle = selectedDrumKitBundle;

    // Only v2 format kits can be edited
    if (!bundle.source || !bundle.slices) {
      console.error('[LibraryPage] Cannot edit kit: kit is not in v2 format');
      return;
    }

    setLoading(true, 'Loading source audio...');
    try {
      // Load the source WAV
      const sourceWav = await loadDrumKitSource(libraryHandle, selection.name!, bundle.source, selection.path);

      // Open the slice editor dialog
      setSliceEditDialog({
        open: true,
        kitName: selection.name!,
        path: selection.path,
        samples: sourceWav.samples,
        sampleRate: sourceWav.sampleRate,
        slices: bundle.slices.map((s) => ({
          label: s.label,
          startSample: s.startSample,
          endSample: s.endSample,
        })),
        kitConfig: {
          name: bundle.name,
          sampleRate: bundle.sampleRate,
          baseNote: bundle.baseNote,
          transpose: bundle.transpose,
          velocitySensitivity: bundle.velocitySensitivity,
        },
      });
    } catch (err) {
      console.error('[LibraryPage] Failed to load source audio for editing:', err);
      setError(err instanceof Error ? err.message : 'Failed to load source audio');
    } finally {
      setLoading(false);
    }
  }, [libraryHandle, selection, selectedDrumKitBundle, setLoading, setError]);

  // Handle saving updated slices and kit config
  const handleSlicesUpdated = useCallback(async (
    slices: SliceDefinitionOutput[],
    kitConfig: { transpose?: number; velocitySensitivity?: number }
  ) => {
    if (!libraryHandle || !sliceEditDialog) {
      return;
    }

    setLoading(true, 'Saving slice changes...');
    try {
      await updateDrumKitSlices(libraryHandle, sliceEditDialog.kitName, slices, kitConfig, sliceEditDialog.path);

      // Refresh the drum kit bundle
      const updatedBundle = await loadDrumKitBundle(libraryHandle, sliceEditDialog.kitName, sliceEditDialog.path);
      setSelectedDrumKitBundle(updatedBundle);

      console.log(`[LibraryPage] Updated slices for ${sliceEditDialog.kitName}`);
    } catch (err) {
      console.error('[LibraryPage] Failed to update slices:', err);
      setError(err instanceof Error ? err.message : 'Failed to save slices');
    } finally {
      setLoading(false);
      setSliceEditDialog(null);
    }
  }, [libraryHandle, sliceEditDialog, setLoading, setError]);

  // Handle individual tone selection
  const handleSelectIndividualTone = useCallback((toneName: string, path?: string[]) => {
    setSelection({ source: 'library', type: 'individualTone', name: toneName, path });
    setSelectedDrumKitBundle(null);
  }, []);

  // Handle individual patch selection
  const handleSelectIndividualPatch = useCallback((patchName: string, path?: string[]) => {
    setSelection({ source: 'library', type: 'individualPatch', name: patchName, path });
    setSelectedDrumKitBundle(null);
  }, []);

  // Handle drum kit import button click
  const handleOpenDrumKitImport = useCallback(() => {
    if (!selection || selection.type !== 'drumKit' || !selectedDrumKitBundle) return;
    openImportDrumKitDialog(selection.name!, selectedDrumKitBundle, selection.path);
  }, [selection, selectedDrumKitBundle, openImportDrumKitDialog]);

  // Open import tone dialog
  const handleOpenImportToneDialog = useCallback((setName: string, toneFile: string) => {
    setOperationError(null);
    setOperationProgress(undefined);
    setImportToneDialog({ setName, toneFile });
  }, []);

  // Open import patch dialog
  const handleOpenImportPatchDialog = useCallback((setName: string, patchFile: string) => {
    setOperationError(null);
    setOperationProgress(undefined);
    setImportPatchDialog({ setName, patchFile });
  }, []);

  // Open import individual tone dialog (tones outside of sets)
  const handleOpenImportIndividualToneDialog = useCallback((toneFile: string) => {
    setOperationError(null);
    setOperationProgress(undefined);
    // For now, use the same dialog with a special marker for individual tones
    setImportToneDialog({ setName: '__individual__', toneFile });
  }, []);

  // Open import individual patch dialog (patches outside of sets)
  const handleOpenImportIndividualPatchDialog = useCallback((patchDirectoryName: string, path?: string[]) => {
    setOperationError(null);
    setOperationProgress(undefined);
    // Use the same dialog with a special marker for individual patches
    setImportPatchDialog({ setName: '__individual__', patchFile: patchDirectoryName, patchPath: path });
  }, []);

  // Handle drop from device memory to library (export tone) - opens dialog
  const handleDropDeviceTone = useCallback((data: DeviceDragData) => {
    if (!libraryHandle || !clientRef.current) {
      window.alert('Library or device not connected');
      return;
    }

    if (data.type !== 'tone') {
      return;
    }

    const tone = tones[data.index];
    if (!tone) {
      window.alert('Tone not loaded from device. Try refreshing device data first.');
      return;
    }

    // Open the export dialog
    setExportToneDialog({ tone, toneIndex: data.index });
    setExportProgress(undefined);
    setExportError(null);
    setExportStatus(null);
  }, [libraryHandle, tones]);

  // Handle drop from device memory to library (export patch) - opens dialog
  const handleDropDevicePatch = useCallback((data: DeviceDragData) => {
    if (!libraryHandle) {
      window.alert('Library not connected');
      return;
    }

    if (data.type !== 'patch') {
      return;
    }

    const patch = patches[data.index];
    if (!patch) {
      window.alert('Patch not loaded from device. Try refreshing device data first.');
      return;
    }

    // Open the export dialog
    setExportPatchDialog({ patch, patchIndex: data.index });
    setExportPatchProgress(undefined);
    setExportPatchError(null);
  }, [libraryHandle, patches]);

  // Handle export tone from dialog
  const handleExportTone = useCallback(async (toneName: string, toneIndex: number) => {
    if (!libraryHandle || !clientRef.current || !exportToneDialog) {
      throw new Error('Library or device not connected');
    }

    const tone = exportToneDialog.tone;

    setIsExporting(true);
    setExportError(null);
    setExportProgress(0);
    setExportStatus(`Fetching wave data...`);

    try {
      // Request wave data from device
      const waveData = await clientRef.current.requestWaveData(
        toneIndex,
        (received, total) => {
          const progress = total > 0 ? Math.floor((received / total) * 50) : 0;
          setExportProgress(progress);
        }
      );

      setExportStatus(`Writing to library...`);
      setExportProgress(50);

      // Export to library with the user-specified name
      await exportToneToDirectory(
        libraryHandle,
        { ...tone, name: toneName },
        waveData,
        toneName,
        (progress) => {
          setExportProgress(50 + Math.floor(progress / 2));
        }
      );

      setExportProgress(100);
      setExportStatus('Export complete');

      // Refresh individual tones list
      const updatedTones = await listIndividualTones(libraryHandle);
      setIndividualTones(updatedTones);
    } catch (err) {
      console.error('[LibraryPage] Failed to export tone:', err);
      const message = err instanceof Error ? err.message : 'Failed to export tone';
      setExportError(message);
      throw err;
    } finally {
      setIsExporting(false);
    }
  }, [libraryHandle, exportToneDialog]);

  // Handle export patch from dialog
  const handleExportPatch = useCallback(async (patchName: string, _patchIndex: number) => {
    if (!libraryHandle || !exportPatchDialog || !clientRef.current) {
      throw new Error('Library or device not connected');
    }

    const patch = exportPatchDialog.patch;
    const client = clientRef.current;

    setIsExporting(true);
    setExportPatchError(null);
    setExportPatchProgress(0);

    try {
      // Get all tone slots referenced by this patch
      const referencedSlots = getPatchToneDependencies(patch);
      const totalSlots = referencedSlots.length;

      // Fetch all referenced tones from the device
      const bundleTones: PatchBundleTone[] = [];

      for (let i = 0; i < referencedSlots.length; i++) {
        const slot = referencedSlots[i];
        const tone = tones[slot];

        if (!tone) {
          throw new Error(`Tone at slot ${slot} not loaded from device. Try refreshing device data first.`);
        }

        // Progress: 0-60% for fetching tones
        const baseProgress = Math.floor((i / totalSlots) * 60);
        setExportPatchProgress(baseProgress);

        // Fetch wave data for this tone
        const waveData = await client.requestWaveData(
          slot,
          (received, total) => {
            const fetchProgress = total > 0 ? (received / total) : 0;
            setExportPatchProgress(baseProgress + Math.floor(fetchProgress * (60 / totalSlots)));
          }
        );

        bundleTones.push({ slot, tone, waveData });
      }

      setExportPatchProgress(60);

      // Export to library with the user-specified name and all dependent tones
      await exportPatchToDirectory(
        libraryHandle,
        { ...patch, common: { ...patch.common, name: patchName } },
        bundleTones,
        patchName,
        (progress) => {
          // Progress: 60-100% for writing files
          setExportPatchProgress(60 + Math.floor(progress * 0.4));
        }
      );

      setExportPatchProgress(100);

      // Refresh individual patches list
      const updatedPatches = await listIndividualPatches(libraryHandle);
      setIndividualPatches(updatedPatches);
    } catch (err) {
      console.error('[LibraryPage] Failed to export patch:', err);
      const message = err instanceof Error ? err.message : 'Failed to export patch';
      setExportPatchError(message);
      throw err;
    } finally {
      setIsExporting(false);
    }
  }, [libraryHandle, exportPatchDialog, tones]);

  // Handle drop from library to device tone slot (import tone)
  const handleDropLibraryTone = useCallback((data: LibraryDragData, targetSlot: number) => {
    if (!libraryHandle || !clientRef.current) {
      window.alert('Library or device not connected');
      return;
    }

    if (data.type !== 'tone') {
      window.alert('Can only drop tones on tone slots');
      return;
    }

    // Reset operation state to prevent stale "success" from previous operations
    setOperationError(null);
    setOperationProgress(undefined);

    // Determine if this is from a set or an individual tone
    if (data.setName && data.toneFile) {
      // Tone from a set
      setImportToneDialog({ setName: data.setName, toneFile: data.toneFile, initialTargetSlot: targetSlot });
    } else {
      // Individual tone
      setImportToneDialog({ setName: '__individual__', toneFile: data.name, initialTargetSlot: targetSlot });
    }
  }, [libraryHandle]);

  // Handle drop from library to device patch slot (import patch)
  const handleDropLibraryPatch = useCallback((data: LibraryDragData, targetSlot: number) => {
    if (!libraryHandle || !clientRef.current) {
      window.alert('Library or device not connected');
      return;
    }

    if (data.type === 'drumKit') {
      // Handle drum kit drop - open drum kit import dialog
      // Use path from drag data for kits in subdirectories
      loadDrumKitBundle(libraryHandle, data.name, data.path)
        .then(bundle => {
          openImportDrumKitDialog(data.name, bundle, data.path);
        })
        .catch(err => {
          console.error('[LibraryPage] Failed to load drum kit for import:', err);
          window.alert('Failed to load drum kit');
        });
      return;
    }

    if (data.type !== 'patch') {
      window.alert('Can only drop patches or drum kits on patch slots');
      return;
    }

    // Reset operation state to prevent stale "success" from previous operations
    setOperationError(null);
    setOperationProgress(undefined);

    // Determine if this is from a set or an individual patch
    if (data.setName && data.patchFile) {
      // Patch from a set
      setImportPatchDialog({ setName: data.setName, patchFile: data.patchFile, initialTargetSlot: targetSlot });
    } else {
      // Individual patch - use the directory name and path
      setImportPatchDialog({ setName: '__individual__', patchFile: data.name, patchPath: data.path, initialTargetSlot: targetSlot });
    }
  }, [libraryHandle, drumKits, openImportDrumKitDialog]);

  // Import single tone from library
  const handleImportLibraryTone = useCallback(async (params: {
    setName: string;
    toneFile: string;
    tone: SamplerTone;
    wavData: Uint8Array;
    targetSlot: number;
    waveBank: 0 | 1 | 2 | 3;
    segmentTop: number;
    segmentLength: number;
  }) => {
    if (!clientRef.current) return;

    setIsImporting(true);
    setOperationProgress(undefined);
    setOperationError(null);

    try {
      // Update tone wave parameters to match target allocation
      const toneWithNewWave: SamplerTone = {
        ...params.tone,
        wave: {
          ...params.tone.wave,
          bank: params.waveBank,
          segmentTop: params.segmentTop,
          segmentLength: params.segmentLength,
        },
      };

      await clientRef.current.importTone(
        {
          toneIndex: params.targetSlot,
          waveData: params.wavData,
          // Cast to S-330 wave bank type; S-550 client will accept 0-3 when implemented
          waveBank: params.waveBank as 0 | 1,
          segmentTop: params.segmentTop,
          segmentLength: params.segmentLength,
          tone: toneWithNewWave,
        },
        (bytesSent, totalBytes) => {
          setOperationProgress({
            currentStep: 1,
            totalSteps: 1,
            stepLabel: `Uploading ${params.tone.name}`,
            bytesSent, bytesTotal: totalBytes,
            bytesSentAllSteps: 0, bytesTotalAllSteps: totalBytes,
          });
        }
      );

      // Update local state
      setTone(params.targetSlot, toneWithNewWave, totalTones);

      // Brief delay to show completion message
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      console.error('[LibraryPage] Failed to import tone:', err);
      setOperationError(err instanceof Error ? err.message : 'Failed to import tone');
      throw err;
    } finally {
      setIsImporting(false);
    }
  }, [setTone, totalTones]);

  // Import patch with its tones from library
  const handleImportLibraryPatch = useCallback(async (params: {
    setName: string;
    patchFile: string;
    patch: SamplerPatch;
    targetPatchSlot: number;
    tones: Array<{
      tone: SamplerTone;
      wavData: Uint8Array;
      targetSlot: number;
      waveBank: 0 | 1 | 2 | 3;
      segmentTop: number;
      segmentLength: number;
    }>;
  }) => {
    if (!clientRef.current) return;

    setIsImporting(true);
    setOperationProgress(undefined);
    setOperationError(null);

    try {
      const totalSteps = params.tones.length + 1;
      let completedSteps = 0;
      const patchBytesTotalAll = params.tones.reduce((sum, t) => sum + t.wavData.length, 0);
      let patchBytesSentAll = 0;

      // Import each required tone
      for (let i = 0; i < params.tones.length; i++) {
        const toneData = params.tones[i];

        // Update tone wave parameters to match target allocation
        const toneWithNewWave: SamplerTone = {
          ...toneData.tone,
          wave: {
            ...toneData.tone.wave,
            bank: toneData.waveBank,
            segmentTop: toneData.segmentTop,
            segmentLength: toneData.segmentLength,
          },
        };

        await clientRef.current.importTone(
          {
            toneIndex: toneData.targetSlot,
            waveData: toneData.wavData,
            // Cast to S-330 wave bank type; S-550 client will accept 0-3 when implemented
            waveBank: toneData.waveBank as 0 | 1,
            segmentTop: toneData.segmentTop,
            segmentLength: toneData.segmentLength,
            tone: toneWithNewWave,
          },
          (bytesSent, totalBytes) => {
            setOperationProgress({
              currentStep: completedSteps + 1,
              totalSteps,
              stepLabel: `Uploading tone ${toneData.tone.name} (${i + 1} of ${params.tones.length})`,
              bytesSent, bytesTotal: totalBytes,
              bytesSentAllSteps: patchBytesSentAll, bytesTotalAllSteps: patchBytesTotalAll,
            });
          }
        );

        // Update local state
        setTone(toneData.targetSlot, toneWithNewWave, totalTones);
        patchBytesSentAll += toneData.wavData.length;
        completedSteps++;

        // Give the device time to process
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      // Import the patch
      setOperationProgress({
        currentStep: totalSteps,
        totalSteps,
        stepLabel: `Creating patch ${params.patch.common.name}`,
        bytesSent: 0, bytesTotal: 0,
        bytesSentAllSteps: patchBytesSentAll, bytesTotalAllSteps: patchBytesTotalAll,
      });
      await clientRef.current.sendPatchData(params.targetPatchSlot, params.patch.common);
      setPatch(params.targetPatchSlot, params.patch, totalPatches);

      // Brief delay to show completion message
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      console.error('[LibraryPage] Failed to import patch:', err);
      setOperationError(err instanceof Error ? err.message : 'Failed to import patch');
      throw err;
    } finally {
      setIsImporting(false);
    }
  }, [setTone, setPatch, totalTones, totalPatches]);

  // Render not connected state
  if (!isConnected) {
    return (
      <div className="ac-page">
        <div className="card text-center py-12">
          <h2 className="text-xl font-bold text-s330-text mb-2">Not Connected</h2>
          <p className="text-s330-muted mb-4">
            Connect to your S-330 to manage the library.
          </p>
          <a href="/" className="ac-btn ac-btn-primary inline-block">
            Go to Connection
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="ac-page ac-page-shell">
      {/* Header */}
      <div className="ac-page-sticky-header">
        <div className="ac-page-header">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-s330-text">Library</h2>
            {!libraryHandle && hasFileSystemAccess() && (
              <button
                onClick={handlePickDirectory}
                className="ac-btn ac-btn-sm ac-btn-primary"
              >
                Select Library Folder
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadDeviceData}
              disabled={isLoading}
              className={cn('ac-btn ac-btn-sm ac-btn-secondary', isLoading && 'opacity-50')}
            >
              Refresh Device
            </button>
            <button
              onClick={handleOpenSaveDialog}
              disabled={!libraryHandle || isLoading}
              className={cn('ac-btn ac-btn-sm ac-btn-primary', (!libraryHandle || isLoading) && 'opacity-50')}
            >
              Save to Library...
            </button>
            <button
              onClick={handleOpenLoadDialog}
              disabled={!libraryHandle || !selection || selection.type !== 'set'}
              className={cn(
                'ac-btn ac-btn-sm ac-btn-secondary',
                (!libraryHandle || !selection || selection.type !== 'set') && 'opacity-50'
              )}
            >
              Load Selected Set
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="ac-alert ac-alert-error">
          <p className="ac-text-error text-sm">{error}</p>
        </div>
      )}

      {/* Three-Column Layout - fixed height to enable internal scrolling */}
      <div className="grid grid-cols-3 gap-4 h-[calc(100vh-12rem)]">
        {/* Left: Device Memory */}
        <div className="card p-0 overflow-hidden h-full">
          <DeviceMemoryPanel
            tones={tones}
            patches={patches}
            loadedToneBanks={loadedToneBanks}
            loadedPatchBanks={loadedPatchBanks}
            selectedIndex={selection?.source === 'device' ? selection.index : undefined}
            selectedType={selection?.source === 'device' && (selection.type === 'tone' || selection.type === 'patch') ? selection.type : undefined}
            onSelectTone={(index) => handleSelectDevice('tone', index)}
            onSelectPatch={(index) => handleSelectDevice('patch', index)}
            onDropLibraryTone={handleDropLibraryTone}
            onDropLibraryPatch={handleDropLibraryPatch}
          />
        </div>

        {/* Center: Library Tree */}
        <div className="card p-0 overflow-hidden h-full">
          <LibraryTreePanel
            libraryHandle={libraryHandle}
            sets={sets}
            drumKits={drumKits}
            individualTones={individualTones}
            individualPatches={individualPatches}
            tonesTree={tonesTree}
            patchesTree={patchesTree}
            drumKitsTree={drumKitsTree}
            expandedPaths={expandedPaths}
            selectedName={selection?.source === 'library' ? selection.name : undefined}
            selectedType={selection?.source === 'library' ? selection.type : undefined}
            selectedSetName={selection?.source === 'library' ? selection.setName : undefined}
            selectedPath={selection?.source === 'library' ? selection.path : undefined}
            onSelectSet={(name) => handleSelectLibrary('set', name)}
            onSelectTone={(name, setName) => handleSelectLibrary('tone', name, setName)}
            onSelectPatch={(name, setName) => handleSelectLibrary('patch', name, setName)}
            onSelectDrumKit={handleSelectDrumKit}
            onSelectIndividualTone={handleSelectIndividualTone}
            onSelectIndividualPatch={handleSelectIndividualPatch}
            onRefresh={handleRefreshLibrary}
            isLoading={isLoading || isExporting}
            onDropDeviceTone={handleDropDeviceTone}
            onDropDevicePatch={handleDropDevicePatch}
            onDeleteSet={handleDeleteSet}
            onDeleteIndividualTone={handleDeleteIndividualTone}
            onDeleteIndividualPatch={handleDeleteIndividualPatch}
            onDeleteDrumKit={handleDeleteDrumKit}
            onToggleDirectoryExpanded={toggleDirectoryExpanded}
            onCreateDirectory={handleOpenCreateDirectory}
            onRenameDirectory={handleOpenRenameDirectory}
            onDeleteDirectory={handleOpenDeleteDirectory}
            onMoveItem={handleOpenMoveItem}
            onDropMoveItem={handleDropMoveItem}
            onRenameItem={handleRenameItem}
            onRenameSet={handleRenameSet}
          />
        </div>

        {/* Right: Preview */}
        <div className="card p-0 overflow-hidden h-full">
          {selection?.type === 'drumKit' ? (
            <DrumKitPreviewPanel
              kitInfo={drumKits.find((k) => k.directoryName === selection.name) ?? null}
              libraryHandle={libraryHandle}
              preloadedBundle={selectedDrumKitBundle}
              onImport={handleOpenDrumKitImport}
              onEditKit={handleEditKit}
            />
          ) : (
            <ItemPreviewPanel
              selection={selection}
              deviceTones={tones}
              devicePatches={patches}
              libraryHandle={libraryHandle}
              onImportTone={handleOpenImportToneDialog}
              onImportPatch={handleOpenImportPatchDialog}
              onImportIndividualTone={handleOpenImportIndividualToneDialog}
              onImportIndividualPatch={handleOpenImportIndividualPatchDialog}
              onLoadSet={handleOpenLoadDialog}
            />
          )}
        </div>
      </div>

      {/* Save Set Dialog */}
      <SaveSetDialog
        open={isSaveDialogOpen}
        onOpenChange={setIsSaveDialogOpen}
        onSave={handleSaveSet}
        isSaving={operationProgress !== undefined}
        progress={operationProgress ? getOverallPercent(operationProgress) : undefined}
        error={operationError}
        statusMessage={operationProgress?.stepLabel ?? null}
      />

      {/* Load Set Dialog */}
      <LoadSetDialog
        open={isLoadDialogOpen}
        onOpenChange={setIsLoadDialogOpen}
        setName={selection?.name ?? ''}
        onLoad={handleLoadSet}
        isImporting={operationProgress !== undefined}
        importProgress={operationProgress}
        importError={operationError}
        importTargets={config.memoryLayout.importTargets}
        deviceTones={tones}
        toneGroups={config.memoryLayout.toneGroups}
        formatToneSlot={config.memoryLayout.formatToneSlot}
      />

      {/* Import Library Tone Dialog */}
      {importToneDialog && libraryHandle && (
        <ImportLibraryToneDialog
          open={!!importToneDialog}
          onOpenChange={(open) => {
            if (!open) setImportToneDialog(null);
          }}
          libraryHandle={libraryHandle}
          setName={importToneDialog.setName}
          toneFile={importToneDialog.toneFile}
          deviceTones={tones}
          initialTargetSlot={importToneDialog.initialTargetSlot}
          onImport={handleImportLibraryTone}
          isImporting={isImporting}
          importProgress={operationProgress}
          importError={operationError}
        />
      )}

      {/* Import Library Patch Dialog */}
      {importPatchDialog && libraryHandle && (
        <ImportLibraryPatchDialog
          open={!!importPatchDialog}
          onOpenChange={(open) => {
            if (!open) setImportPatchDialog(null);
          }}
          libraryHandle={libraryHandle}
          setName={importPatchDialog.setName}
          patchFile={importPatchDialog.patchFile}
          patchPath={importPatchDialog.patchPath}
          deviceTones={tones}
          devicePatches={patches}
          initialTargetSlot={importPatchDialog.initialTargetSlot}
          onImport={handleImportLibraryPatch}
          isImporting={isImporting}
          importProgress={operationProgress}
          importError={operationError}
        />
      )}

      {/* Import Drum Kit Dialog */}
      {importDrumKitDialog && (
        <ImportDrumKitDialog
          open={!!importDrumKitDialog}
          onOpenChange={(open) => {
            if (!open) closeImportDrumKitDialog();
          }}
          bundle={importDrumKitDialog.bundle}
          deviceTones={tones}
          devicePatches={patches}
          onImport={handleImportDrumKit}
          isImporting={isDrumKitImporting}
          importProgress={drumKitImportProgress}
          importError={drumKitImportError}
        />
      )}

      {/* Slice Edit Dialog */}
      {sliceEditDialog && (
        <SampleChopperDialog
          open={sliceEditDialog.open}
          onOpenChange={(open) => {
            if (!open) setSliceEditDialog(null);
          }}
          samples={sliceEditDialog.samples}
          sampleRate={sliceEditDialog.sampleRate}
          sourceName={sliceEditDialog.kitName}
          onKitCreated={() => {}} // Not used in edit mode
          editMode={true}
          initialSlices={sliceEditDialog.slices}
          initialKitConfig={sliceEditDialog.kitConfig}
          onSlicesUpdated={handleSlicesUpdated}
        />
      )}

      {/* Export Tone Dialog */}
      <ExportToneDialog
        open={!!exportToneDialog}
        onOpenChange={(open) => {
          if (!open && !isExporting) {
            setExportToneDialog(null);
            setExportProgress(undefined);
            setExportError(null);
            setExportStatus(null);
          }
        }}
        tone={exportToneDialog?.tone ?? null}
        toneIndex={exportToneDialog?.toneIndex ?? 0}
        onExport={handleExportTone}
        isExporting={isExporting}
        exportProgress={exportProgress}
        exportError={exportError}
        statusMessage={exportStatus}
      />

      {/* Export Patch Dialog */}
      <ExportPatchDialog
        open={!!exportPatchDialog}
        onOpenChange={(open) => {
          if (!open && !isExporting) {
            setExportPatchDialog(null);
            setExportPatchProgress(undefined);
            setExportPatchError(null);
          }
        }}
        patch={exportPatchDialog?.patch ?? null}
        patchIndex={exportPatchDialog?.patchIndex ?? 0}
        onExport={handleExportPatch}
        isExporting={isExporting}
        exportProgress={exportPatchProgress}
        exportError={exportPatchError}
      />

      {/* Create Directory Dialog */}
      <CreateDirectoryDialog
        open={!!createDirectoryDialog}
        onOpenChange={(open) => {
          if (!open) setCreateDirectoryDialog(null);
        }}
        onConfirm={handleCreateDirectory}
        parentPath={createDirectoryDialog?.parentPath ?? []}
        category={createDirectoryDialog?.category ?? 'tones'}
      />

      {/* Rename Directory Dialog */}
      <RenameDirectoryDialog
        open={!!renameDirectoryDialog}
        onOpenChange={(open) => {
          if (!open) setRenameDirectoryDialog(null);
        }}
        onConfirm={handleRenameDirectory}
        currentName={renameDirectoryDialog?.currentName ?? ''}
        path={renameDirectoryDialog?.path ?? []}
        category={renameDirectoryDialog?.category ?? 'tones'}
      />

      {/* Delete Directory Dialog */}
      <DeleteDirectoryDialog
        open={!!deleteDirectoryDialog}
        onOpenChange={(open) => {
          if (!open) setDeleteDirectoryDialog(null);
        }}
        onConfirm={handleDeleteDirectory}
        directoryName={deleteDirectoryDialog?.directoryName ?? ''}
        path={deleteDirectoryDialog?.path ?? []}
        category={deleteDirectoryDialog?.category ?? 'tones'}
        libraryHandle={libraryHandle}
      />

      {/* Move Item Dialog */}
      <MoveItemDialog
        open={!!moveItemDialog}
        onOpenChange={(open) => {
          if (!open) setMoveItemDialog(null);
        }}
        onConfirm={handleMoveItem}
        itemName={moveItemDialog?.itemName ?? ''}
        itemType={moveItemDialog?.itemType ?? 'tone'}
        currentPath={moveItemDialog?.sourcePath ?? []}
        category={moveItemDialog?.category ?? 'tones'}
        categoryTree={getMoveDialogTree()}
      />
    </div>
  );
}
