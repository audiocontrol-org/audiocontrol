/**
 * Directory Operations Hook
 *
 * Custom hook for managing directory CRUD operations in the library.
 * Includes directory create/rename/delete, item move (dialog and drag-drop),
 * in-place rename for items and sets, and library item deletion.
 */

import { useState, useCallback } from 'react';
import {
  createDirectory,
  renameDirectory,
  deleteDirectory,
  moveItem,
  renameIndividualTone,
  renameIndividualPatch,
  renameSet,
  deleteSet,
  deleteIndividualTone,
  deleteIndividualPatch,
  listIndividualTones,
  listIndividualPatches,
  listIndividualTonesTree,
  listIndividualPatchesTree,
  type LibraryTreeNode,
  type LibraryCategory,
  type LibraryToneInfo,
  type LibraryPatchInfo,
  type StorageDirectoryHandle,
} from '@/lib/library-service';
import type { RolandPageSelection } from '@/pages/LibraryPage';

interface CreateDirectoryDialogState {
  category: LibraryCategory;
  parentPath: string[];
}

interface RenameDirectoryDialogState {
  category: LibraryCategory;
  path: string[];
  currentName: string;
}

interface DeleteDirectoryDialogState {
  category: LibraryCategory;
  path: string[];
  directoryName: string;
}

interface MoveItemDialogState {
  category: LibraryCategory;
  sourcePath: string[];
  itemName: string;
  itemType: 'tone' | 'patch' | 'directory';
}

interface UseDirectoryOperationsOptions {
  libraryHandle: StorageDirectoryHandle | null;
  handleRefreshLibrary: () => Promise<void>;
  setError: (error: string) => void;
  tonesTree: LibraryTreeNode[];
  patchesTree: LibraryTreeNode[];
  // Delete-related deps
  selection: RolandPageSelection | null;
  setSelection: (selection: RolandPageSelection | null) => void;
  setIndividualTones: (tones: LibraryToneInfo[]) => void;
  setIndividualPatches: (patches: LibraryPatchInfo[]) => void;
  setTonesTree: (tree: LibraryTreeNode[]) => void;
  setPatchesTree: (tree: LibraryTreeNode[]) => void;
}

export function useDirectoryOperations({
  libraryHandle,
  handleRefreshLibrary,
  setError,
  tonesTree,
  patchesTree,
  selection,
  setSelection,
  setIndividualTones,
  setIndividualPatches,
  setTonesTree,
  setPatchesTree,
}: UseDirectoryOperationsOptions) {
  // Dialog state
  const [createDirectoryDialog, setCreateDirectoryDialog] = useState<CreateDirectoryDialogState | null>(null);
  const [renameDirectoryDialog, setRenameDirectoryDialog] = useState<RenameDirectoryDialogState | null>(null);
  const [deleteDirectoryDialog, setDeleteDirectoryDialog] = useState<DeleteDirectoryDialogState | null>(null);
  const [moveItemDialog, setMoveItemDialog] = useState<MoveItemDialogState | null>(null);

  // Dialog openers
  const handleOpenCreateDirectory = useCallback((category: LibraryCategory, parentPath: string[]) => {
    setCreateDirectoryDialog({ category, parentPath });
  }, []);

  const handleOpenRenameDirectory = useCallback((category: LibraryCategory, path: string[]) => {
    const currentName = path[path.length - 1];
    setRenameDirectoryDialog({ category, path, currentName });
  }, []);

  const handleOpenDeleteDirectory = useCallback((category: LibraryCategory, path: string[]) => {
    const directoryName = path[path.length - 1];
    setDeleteDirectoryDialog({ category, path, directoryName });
  }, []);

  const handleOpenMoveItem = useCallback((category: LibraryCategory, sourcePath: string[], itemName: string) => {
    let itemType: 'tone' | 'patch' | 'directory' = 'directory';
    if (category === 'tones') itemType = 'tone';
    else if (category === 'patches') itemType = 'patch';
    setMoveItemDialog({ category, sourcePath, itemName, itemType });
  }, []);

  // Dialog closers
  const closeCreateDirectoryDialog = useCallback(() => setCreateDirectoryDialog(null), []);
  const closeRenameDirectoryDialog = useCallback(() => setRenameDirectoryDialog(null), []);
  const closeDeleteDirectoryDialog = useCallback(() => setDeleteDirectoryDialog(null), []);
  const closeMoveItemDialog = useCallback(() => setMoveItemDialog(null), []);

  // Create directory
  const handleCreateDirectory = useCallback(async (name: string) => {
    if (!libraryHandle || !createDirectoryDialog) return;
    try {
      await createDirectory(libraryHandle, createDirectoryDialog.category, createDirectoryDialog.parentPath, name);
      setCreateDirectoryDialog(null);
      await handleRefreshLibrary();
    } catch (err) {
      console.error('[LibraryPage] Failed to create directory:', err);
      throw err;
    }
  }, [libraryHandle, createDirectoryDialog, handleRefreshLibrary]);

  // Rename directory
  const handleRenameDirectory = useCallback(async (newName: string) => {
    if (!libraryHandle || !renameDirectoryDialog) return;
    try {
      await renameDirectory(libraryHandle, renameDirectoryDialog.category, renameDirectoryDialog.path, newName);
      setRenameDirectoryDialog(null);
      await handleRefreshLibrary();
    } catch (err) {
      console.error('[LibraryPage] Failed to rename directory:', err);
      throw err;
    }
  }, [libraryHandle, renameDirectoryDialog, handleRefreshLibrary]);

  // Delete directory
  const handleDeleteDirectory = useCallback(async () => {
    if (!libraryHandle || !deleteDirectoryDialog) return;
    try {
      await deleteDirectory(libraryHandle, deleteDirectoryDialog.category, deleteDirectoryDialog.path, true);
      setDeleteDirectoryDialog(null);
      await handleRefreshLibrary();
    } catch (err) {
      console.error('[LibraryPage] Failed to delete directory:', err);
      throw err;
    }
  }, [libraryHandle, deleteDirectoryDialog, handleRefreshLibrary]);

  // Move item (via dialog)
  const handleMoveItem = useCallback(async (targetPath: string[]) => {
    if (!libraryHandle || !moveItemDialog) return;
    try {
      await moveItem(libraryHandle, moveItemDialog.category, moveItemDialog.sourcePath, moveItemDialog.itemName, targetPath);
      setMoveItemDialog(null);
      await handleRefreshLibrary();
    } catch (err) {
      console.error('[LibraryPage] Failed to move item:', err);
      throw err;
    }
  }, [libraryHandle, moveItemDialog, handleRefreshLibrary]);

  // Handle drag-drop move (directly moves item without dialog)
  const handleDropMoveItem = useCallback(async (
    category: LibraryCategory, sourcePath: string[], itemName: string, targetPath: string[]
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
    category: LibraryCategory, path: string[], oldName: string, newName: string, isDirectory: boolean
  ) => {
    if (!libraryHandle) return;
    try {
      if (isDirectory) await renameDirectory(libraryHandle, category, [...path, oldName], newName);
      else if (category === 'tones') await renameIndividualTone(libraryHandle, oldName, newName, path);
      else if (category === 'patches') await renameIndividualPatch(libraryHandle, oldName, newName, path);
      await handleRefreshLibrary();
    } catch (err) {
      console.error('[LibraryPage] Failed to rename item:', err);
      setError(err instanceof Error ? err.message : 'Failed to rename item');
      throw err;
    }
  }, [libraryHandle, handleRefreshLibrary, setError]);

  // Handle set rename
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

  // =========================================================================
  // Delete operations
  // =========================================================================

  const handleDeleteSet = useCallback(async (setName: string) => {
    if (!libraryHandle) return;
    try {
      await deleteSet(libraryHandle, setName);
      if (selection?.type === 'set' && selection.name === setName) setSelection(null);
      await handleRefreshLibrary();
    } catch (err) {
      console.error('[LibraryPage] Failed to delete set:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete set');
    }
  }, [libraryHandle, selection, setSelection, handleRefreshLibrary, setError]);

  const handleDeleteIndividualTone = useCallback(async (fileName: string, path?: string[]) => {
    if (!libraryHandle) return;
    try {
      await deleteIndividualTone(libraryHandle, fileName, path);
      if (selection?.type === 'individualTone' && selection.name === fileName) setSelection(null);
      const [updatedTones, updatedTree] = await Promise.all([listIndividualTones(libraryHandle), listIndividualTonesTree(libraryHandle)]);
      setIndividualTones(updatedTones);
      setTonesTree(updatedTree);
    } catch (err) {
      console.error('[LibraryPage] Failed to delete tone:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete tone');
    }
  }, [libraryHandle, selection, setSelection, setIndividualTones, setTonesTree, setError]);

  const handleDeleteIndividualPatch = useCallback(async (directoryName: string, path?: string[]) => {
    if (!libraryHandle) return;
    try {
      await deleteIndividualPatch(libraryHandle, directoryName, path);
      if (selection?.type === 'individualPatch' && selection.name === directoryName) setSelection(null);
      const [updatedPatches, updatedTree] = await Promise.all([listIndividualPatches(libraryHandle), listIndividualPatchesTree(libraryHandle)]);
      setIndividualPatches(updatedPatches);
      setPatchesTree(updatedTree);
    } catch (err) {
      console.error('[LibraryPage] Failed to delete patch:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete patch');
    }
  }, [libraryHandle, selection, setSelection, setIndividualPatches, setPatchesTree, setError]);

  // Get tree for move dialog
  const getMoveDialogTree = useCallback((): LibraryTreeNode[] => {
    if (!moveItemDialog) return [];
    switch (moveItemDialog.category) {
      case 'tones': return tonesTree;
      case 'patches': return patchesTree;
      default: return [];
    }
  }, [moveItemDialog, tonesTree, patchesTree]);

  return {
    createDirectoryDialog, renameDirectoryDialog, deleteDirectoryDialog, moveItemDialog,
    handleOpenCreateDirectory, handleOpenRenameDirectory, handleOpenDeleteDirectory, handleOpenMoveItem,
    closeCreateDirectoryDialog, closeRenameDirectoryDialog, closeDeleteDirectoryDialog, closeMoveItemDialog,
    handleCreateDirectory, handleRenameDirectory, handleDeleteDirectory, handleMoveItem,
    handleDropMoveItem, handleRenameItem, handleRenameSet,
    handleDeleteSet, handleDeleteIndividualTone, handleDeleteIndividualPatch,
    getMoveDialogTree,
  };
}
