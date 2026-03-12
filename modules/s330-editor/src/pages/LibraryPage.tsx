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
import { useDeviceDataStore, TONES_PER_BANK, PATCHES_PER_BANK } from '@/stores/deviceDataStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { createS330Client } from '@/core/midi/S330Client';
import type { S330ClientInterface, S330Tone, S330Patch } from '@/core/midi/S330Client';
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
    tone: S330Tone;
    toneIndex: number;
  } | null>(null);
  const [exportProgress, setExportProgress] = useState<number | undefined>(undefined);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  // Export patch dialog state
  const [exportPatchDialog, setExportPatchDialog] = useState<{
    patch: S330Patch;
    patchIndex: number;
  } | null>(null);
  const [exportPatchProgress, setExportPatchProgress] = useState<number | undefined>(undefined);
  const [exportPatchError, setExportPatchError] = useState<string | null>(null);

  // Local state
  const [selection, setSelection] = useState<ItemSelection | null>(null);
  const [libraryHandle, setLibraryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
  const [operationProgress, setOperationProgress] = useState<number | undefined>(undefined);
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
    initialTargetSlot?: number;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // S330 client ref
  const clientRef = useRef<S330ClientInterface | null>(null);

  // Initialize client when adapter changes
  useEffect(() => {
    if (!adapter) {
      clientRef.current = null;
      return;
    }
    const client = createS330Client(adapter, { deviceId });
    clientRef.current = client;
  }, [adapter, deviceId]);

  // Drum kit import hook
  const {
    importDrumKitDialog,
    isImporting: isDrumKitImporting,
    importProgress: drumKitImportProgress,
    importError: drumKitImportError,
    importStatus: drumKitImportStatus,
    openImportDrumKitDialog,
    closeImportDrumKitDialog,
    handleImportDrumKit,
  } = useImportDrumKit({
    clientRef,
    libraryHandle,
    setTone,
    setPatch,
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

  // Load all data from device (tones and patches)
  const handleLoadDeviceData = useCallback(async () => {
    if (!clientRef.current) return;

    setLoading(true, 'Loading data from device...');
    try {
      await clientRef.current.connect();

      // Ensure arrays are properly sized
      ensureToneArraySize();
      ensurePatchArraySize();

      // Load all tones
      for (let bank = 0; bank < 4; bank++) {
        setLoading(true, `Loading tones (bank ${bank + 1}/4)...`);
        await clientRef.current.loadToneRange(
          bank * TONES_PER_BANK,
          TONES_PER_BANK,
          () => {},
          (index: number, tone: S330Tone) => setTone(index, tone),
          false
        );
        markToneBankLoaded(bank);
      }

      // Load all patches
      for (let bank = 0; bank < 2; bank++) {
        setLoading(true, `Loading patches (bank ${bank + 1}/2)...`);
        await clientRef.current.loadPatchRange(
          bank * PATCHES_PER_BANK,
          PATCHES_PER_BANK,
          () => {},
          (index: number, patch: S330Patch) => setPatch(index, patch),
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
  }, [setLoading, setError, setTone, setPatch, ensureToneArraySize, ensurePatchArraySize, markToneBankLoaded, markPatchBankLoaded]);

  // Open save set dialog
  const handleOpenSaveDialog = useCallback(() => {
    setOperationError(null);
    setOperationProgress(undefined);
    setIsSaveDialogOpen(true);
  }, []);

  // Status message for save operation
  const [operationStatus, setOperationStatus] = useState<string | null>(null);

  // Save device state to set - fetches ALL data fresh from device
  const handleSaveSet = useCallback(async (setName: string, description?: string) => {
    if (!libraryHandle || !clientRef.current) return;

    setOperationProgress(0);
    setOperationError(null);
    setOperationStatus(null);

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
        (progress) => setOperationProgress(progress),
        (status) => setOperationStatus(status)
      );

      setOperationProgress(100);

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

  // Load set to device
  const handleLoadSet = useCallback(async () => {
    if (!libraryHandle || !clientRef.current || !selection?.name) return;

    setOperationProgress(0);
    setOperationError(null);
    setOperationStatus('Reading set from library...');

    try {
      // Load and convert set
      setOperationStatus('Parsing tones and patches...');
      const deviceState = await loadSetToDevice(
        libraryHandle,
        selection.name,
        (progress) => {
          setOperationProgress(Math.floor(progress * 0.5));
          if (progress < 30) {
            setOperationStatus('Reading manifest...');
          } else if (progress < 60) {
            setOperationStatus('Loading tone data...');
          } else {
            setOperationStatus('Loading patch data...');
          }
        }
      );

      // Upload to device
      let uploadCount = 0;
      const totalTones = deviceState.tones.size;
      const totalPatches = deviceState.patches.size;
      const totalItems = totalTones + totalPatches;

      for (const [slot, data] of deviceState.tones) {
        const toneSlot = `T${Math.floor(slot / 8) + 1}${(slot % 8) + 1}`;
        const toneName = data.tone.name || toneSlot;
        const sampleCount = data.wavData.length / 2;

        setOperationStatus(`Uploading ${toneName} (${sampleCount.toLocaleString()} samples)...`);

        // Upload wave data and tone to device
        // Pass the full tone object to preserve all parameters (pitchFollow, envelopes, etc.)
        await clientRef.current.importTone(
          {
            toneIndex: slot,
            waveData: data.wavData,
            waveBank: data.tone.wave.bank as 0 | 1,
            segmentTop: data.tone.wave.segmentTop,
            segmentLength: data.tone.wave.segmentLength,
            tone: data.tone,
          },
          (bytesSent, totalBytes) => {
            const pct = totalBytes > 0 ? Math.floor((bytesSent / totalBytes) * 100) : 0;
            setOperationStatus(`Uploading ${toneName}: ${pct}% (${bytesSent.toLocaleString()}/${totalBytes.toLocaleString()} bytes)`);
          }
        );
        setTone(slot, data.tone);
        uploadCount++;
        setOperationProgress(50 + Math.floor((uploadCount / totalItems) * 50));

        // Give the S-330 time to process before next import
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      for (const [slot, patch] of deviceState.patches) {
        const patchSlot = `P${String(slot + 1).padStart(2, '0')}`;
        const patchName = patch.common.name || patchSlot;

        setOperationStatus(`Uploading patch ${patchName}...`);

        await clientRef.current.sendPatchData(slot, patch.common);
        uploadCount++;
        setOperationProgress(50 + Math.floor((uploadCount / totalItems) * 50));

        // Give the S-330 time to process
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      setOperationProgress(100);
      setOperationStatus(`Loaded ${totalTones} tones and ${totalPatches} patches`);

      // Brief delay to show completion message
      await new Promise((resolve) => setTimeout(resolve, 500));
      setIsLoadDialogOpen(false);
    } catch (err) {
      console.error('[LibraryPage] Failed to load set:', err);
      setOperationError(err instanceof Error ? err.message : 'Failed to load set');
      setOperationStatus(null);
    }
  }, [libraryHandle, selection, setTone]);

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
      const sourceWav = await loadDrumKitSource(libraryHandle, selection.name!, bundle.source);

      // Open the slice editor dialog
      setSliceEditDialog({
        open: true,
        kitName: selection.name!,
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
      await updateDrumKitSlices(libraryHandle, sliceEditDialog.kitName, slices, kitConfig);

      // Refresh the drum kit bundle
      const updatedBundle = await loadDrumKitBundle(libraryHandle, sliceEditDialog.kitName);
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
    openImportDrumKitDialog(selection.name!, selectedDrumKitBundle);
  }, [selection, selectedDrumKitBundle, openImportDrumKitDialog]);

  // Open import tone dialog
  const handleOpenImportToneDialog = useCallback((setName: string, toneFile: string) => {
    setOperationError(null);
    setOperationProgress(undefined);
    setOperationStatus(null);
    setImportToneDialog({ setName, toneFile });
  }, []);

  // Open import patch dialog
  const handleOpenImportPatchDialog = useCallback((setName: string, patchFile: string) => {
    setOperationError(null);
    setOperationProgress(undefined);
    setOperationStatus(null);
    setImportPatchDialog({ setName, patchFile });
  }, []);

  // Open import individual tone dialog (tones outside of sets)
  const handleOpenImportIndividualToneDialog = useCallback((toneFile: string) => {
    setOperationError(null);
    setOperationProgress(undefined);
    setOperationStatus(null);
    // For now, use the same dialog with a special marker for individual tones
    setImportToneDialog({ setName: '__individual__', toneFile });
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
    setOperationStatus(null);

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
      const kitInfo = drumKits.find(k => k.directoryName === data.name);
      if (kitInfo) {
        loadDrumKitBundle(libraryHandle, data.name)
          .then(bundle => {
            openImportDrumKitDialog(data.name, bundle);
          })
          .catch(err => {
            console.error('[LibraryPage] Failed to load drum kit for import:', err);
            window.alert('Failed to load drum kit');
          });
      }
      return;
    }

    if (data.type !== 'patch') {
      window.alert('Can only drop patches or drum kits on patch slots');
      return;
    }

    // Reset operation state to prevent stale "success" from previous operations
    setOperationError(null);
    setOperationProgress(undefined);
    setOperationStatus(null);

    // Determine if this is from a set or an individual patch
    if (data.setName && data.patchFile) {
      // Patch from a set
      setImportPatchDialog({ setName: data.setName, patchFile: data.patchFile, initialTargetSlot: targetSlot });
    } else {
      // Individual patch - use the directory name
      setImportPatchDialog({ setName: '__individual__', patchFile: data.name, initialTargetSlot: targetSlot });
    }
  }, [libraryHandle, drumKits, openImportDrumKitDialog]);

  // Import single tone from library
  const handleImportLibraryTone = useCallback(async (params: {
    setName: string;
    toneFile: string;
    tone: S330Tone;
    wavData: Uint8Array;
    targetSlot: number;
    waveBank: 0 | 1;
    segmentTop: number;
    segmentLength: number;
  }) => {
    if (!clientRef.current) return;

    setIsImporting(true);
    setOperationProgress(0);
    setOperationError(null);
    setOperationStatus(`Uploading ${params.tone.name}...`);

    try {
      // Update tone wave parameters to match target allocation
      const toneWithNewWave: S330Tone = {
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
          waveBank: params.waveBank,
          segmentTop: params.segmentTop,
          segmentLength: params.segmentLength,
          tone: toneWithNewWave,
        },
        (bytesSent, totalBytes) => {
          const pct = totalBytes > 0 ? Math.floor((bytesSent / totalBytes) * 100) : 0;
          setOperationProgress(pct);
          setOperationStatus(`Uploading: ${pct}%`);
        }
      );

      // Update local state
      setTone(params.targetSlot, toneWithNewWave);

      setOperationProgress(100);
      setOperationStatus('Import complete!');

      // Brief delay to show completion message
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      console.error('[LibraryPage] Failed to import tone:', err);
      setOperationError(err instanceof Error ? err.message : 'Failed to import tone');
      throw err;
    } finally {
      setIsImporting(false);
    }
  }, [setTone]);

  // Import patch with its tones from library
  const handleImportLibraryPatch = useCallback(async (params: {
    setName: string;
    patchFile: string;
    patch: S330Patch;
    targetPatchSlot: number;
    tones: Array<{
      tone: S330Tone;
      wavData: Uint8Array;
      targetSlot: number;
      waveBank: 0 | 1;
      segmentTop: number;
      segmentLength: number;
    }>;
  }) => {
    if (!clientRef.current) return;

    setIsImporting(true);
    setOperationProgress(0);
    setOperationError(null);

    try {
      const totalSteps = params.tones.length + 1;
      let completedSteps = 0;

      // Import each required tone
      for (const toneData of params.tones) {
        setOperationStatus(`Uploading tone ${toneData.tone.name}...`);

        // Update tone wave parameters to match target allocation
        const toneWithNewWave: S330Tone = {
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
            waveBank: toneData.waveBank,
            segmentTop: toneData.segmentTop,
            segmentLength: toneData.segmentLength,
            tone: toneWithNewWave,
          },
          (bytesSent, totalBytes) => {
            const tonePct = totalBytes > 0 ? (bytesSent / totalBytes) : 0;
            const overallPct = ((completedSteps + tonePct) / totalSteps) * 100;
            setOperationProgress(Math.floor(overallPct));
          }
        );

        // Update local state
        setTone(toneData.targetSlot, toneWithNewWave);
        completedSteps++;

        // Give the S-330 time to process
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      // Import the patch
      setOperationStatus(`Uploading patch ${params.patch.common.name}...`);
      await clientRef.current.sendPatchData(params.targetPatchSlot, params.patch.common);
      setPatch(params.targetPatchSlot, params.patch);
      completedSteps++;

      setOperationProgress(100);
      setOperationStatus('Import complete!');

      // Brief delay to show completion message
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      console.error('[LibraryPage] Failed to import patch:', err);
      setOperationError(err instanceof Error ? err.message : 'Failed to import patch');
      throw err;
    } finally {
      setIsImporting(false);
    }
  }, [setTone, setPatch]);

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
          />
        </div>

        {/* Right: Preview */}
        <div className="card p-0 overflow-hidden h-full">
          {selection?.type === 'drumKit' ? (
            <DrumKitPreviewPanel
              kitInfo={drumKits.find((k) => k.directoryName === selection.name) ?? null}
              libraryHandle={libraryHandle}
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
            />
          )}
        </div>
      </div>

      {/* Save Set Dialog */}
      <SaveSetDialog
        open={isSaveDialogOpen}
        onOpenChange={setIsSaveDialogOpen}
        onSave={handleSaveSet}
        isSaving={operationProgress !== undefined && operationProgress < 100}
        progress={operationProgress}
        error={operationError}
        statusMessage={operationStatus}
      />

      {/* Load Set Dialog */}
      <LoadSetDialog
        open={isLoadDialogOpen}
        onOpenChange={setIsLoadDialogOpen}
        setName={selection?.name ?? ''}
        onLoad={handleLoadSet}
        isLoading={operationProgress !== undefined && operationProgress < 100}
        progress={operationProgress}
        error={operationError}
        statusMessage={operationStatus}
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
          statusMessage={operationStatus}
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
          deviceTones={tones}
          devicePatches={patches}
          initialTargetSlot={importPatchDialog.initialTargetSlot}
          onImport={handleImportLibraryPatch}
          isImporting={isImporting}
          importProgress={operationProgress}
          importError={operationError}
          statusMessage={operationStatus}
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
          statusMessage={drumKitImportStatus}
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
