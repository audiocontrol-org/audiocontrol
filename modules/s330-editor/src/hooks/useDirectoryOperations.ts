/**
 * Directory Operations Hook
 *
 * Custom hook for managing directory CRUD operations in the library.
 */

import { useState, useCallback } from 'react';
import {
  createDirectory,
  renameDirectory,
  deleteDirectory,
  moveItem,
  listIndividualTonesTree,
  listIndividualPatchesTree,
  listDrumKitsTree,
  type LibraryTreeNode,
  type LibraryCategory,
} from '@/lib/library-service';

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
  itemType: 'tone' | 'patch' | 'drum-kit' | 'directory';
}

interface UseDirectoryOperationsOptions {
  libraryHandle: FileSystemDirectoryHandle | null;
  onRefreshComplete?: () => void;
}

interface UseDirectoryOperationsResult {
  // Tree data
  tonesTree: LibraryTreeNode[];
  patchesTree: LibraryTreeNode[];
  drumKitsTree: LibraryTreeNode[];

  // Tree setters (for initialization from parent)
  setTonesTree: React.Dispatch<React.SetStateAction<LibraryTreeNode[]>>;
  setPatchesTree: React.Dispatch<React.SetStateAction<LibraryTreeNode[]>>;
  setDrumKitsTree: React.Dispatch<React.SetStateAction<LibraryTreeNode[]>>;

  // Dialog state
  createDirectoryDialog: CreateDirectoryDialogState | null;
  renameDirectoryDialog: RenameDirectoryDialogState | null;
  deleteDirectoryDialog: DeleteDirectoryDialogState | null;
  moveItemDialog: MoveItemDialogState | null;

  // Dialog openers
  handleOpenCreateDirectory: (category: LibraryCategory, parentPath: string[]) => void;
  handleOpenRenameDirectory: (category: LibraryCategory, path: string[]) => void;
  handleOpenDeleteDirectory: (category: LibraryCategory, path: string[]) => void;
  handleOpenMoveItem: (category: LibraryCategory, sourcePath: string[], itemName: string) => void;

  // Dialog closers
  closeCreateDirectoryDialog: () => void;
  closeRenameDirectoryDialog: () => void;
  closeDeleteDirectoryDialog: () => void;
  closeMoveItemDialog: () => void;

  // Operations
  handleCreateDirectory: (name: string) => Promise<void>;
  handleRenameDirectory: (newName: string) => Promise<void>;
  handleDeleteDirectory: () => Promise<void>;
  handleMoveItem: (targetPath: string[]) => Promise<void>;

  // Helper for move dialog
  getMoveDialogTree: () => LibraryTreeNode[];

  // Refresh trees
  refreshTrees: () => Promise<void>;
}

export function useDirectoryOperations({
  libraryHandle,
  onRefreshComplete,
}: UseDirectoryOperationsOptions): UseDirectoryOperationsResult {
  // Tree state
  const [tonesTree, setTonesTree] = useState<LibraryTreeNode[]>([]);
  const [patchesTree, setPatchesTree] = useState<LibraryTreeNode[]>([]);
  const [drumKitsTree, setDrumKitsTree] = useState<LibraryTreeNode[]>([]);

  // Dialog state
  const [createDirectoryDialog, setCreateDirectoryDialog] = useState<CreateDirectoryDialogState | null>(null);
  const [renameDirectoryDialog, setRenameDirectoryDialog] = useState<RenameDirectoryDialogState | null>(null);
  const [deleteDirectoryDialog, setDeleteDirectoryDialog] = useState<DeleteDirectoryDialogState | null>(null);
  const [moveItemDialog, setMoveItemDialog] = useState<MoveItemDialogState | null>(null);

  // Refresh trees
  const refreshTrees = useCallback(async () => {
    if (!libraryHandle) return;

    const [tonesTreeData, patchesTreeData, drumKitsTreeData] = await Promise.all([
      listIndividualTonesTree(libraryHandle),
      listIndividualPatchesTree(libraryHandle),
      listDrumKitsTree(libraryHandle),
    ]);
    setTonesTree(tonesTreeData);
    setPatchesTree(patchesTreeData);
    setDrumKitsTree(drumKitsTreeData);
    onRefreshComplete?.();
  }, [libraryHandle, onRefreshComplete]);

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

  const handleOpenMoveItem = useCallback((
    category: LibraryCategory,
    sourcePath: string[],
    itemName: string
  ) => {
    // Determine item type based on category
    let itemType: 'tone' | 'patch' | 'drum-kit' | 'directory' = 'directory';
    if (category === 'tones') itemType = 'tone';
    else if (category === 'patches') itemType = 'patch';
    else if (category === 'drum-kits') itemType = 'drum-kit';

    setMoveItemDialog({ category, sourcePath, itemName, itemType });
  }, []);

  // Dialog closers
  const closeCreateDirectoryDialog = useCallback(() => {
    setCreateDirectoryDialog(null);
  }, []);

  const closeRenameDirectoryDialog = useCallback(() => {
    setRenameDirectoryDialog(null);
  }, []);

  const closeDeleteDirectoryDialog = useCallback(() => {
    setDeleteDirectoryDialog(null);
  }, []);

  const closeMoveItemDialog = useCallback(() => {
    setMoveItemDialog(null);
  }, []);

  // Create directory
  const handleCreateDirectory = useCallback(async (name: string) => {
    if (!libraryHandle || !createDirectoryDialog) return;

    await createDirectory(
      libraryHandle,
      createDirectoryDialog.category,
      createDirectoryDialog.parentPath,
      name
    );
    setCreateDirectoryDialog(null);
    await refreshTrees();
  }, [libraryHandle, createDirectoryDialog, refreshTrees]);

  // Rename directory
  const handleRenameDirectory = useCallback(async (newName: string) => {
    if (!libraryHandle || !renameDirectoryDialog) return;

    await renameDirectory(
      libraryHandle,
      renameDirectoryDialog.category,
      renameDirectoryDialog.path,
      newName
    );
    setRenameDirectoryDialog(null);
    await refreshTrees();
  }, [libraryHandle, renameDirectoryDialog, refreshTrees]);

  // Delete directory
  const handleDeleteDirectory = useCallback(async () => {
    if (!libraryHandle || !deleteDirectoryDialog) return;

    await deleteDirectory(
      libraryHandle,
      deleteDirectoryDialog.category,
      deleteDirectoryDialog.path,
      true // recursive
    );
    setDeleteDirectoryDialog(null);
    await refreshTrees();
  }, [libraryHandle, deleteDirectoryDialog, refreshTrees]);

  // Move item
  const handleMoveItem = useCallback(async (targetPath: string[]) => {
    if (!libraryHandle || !moveItemDialog) return;

    await moveItem(
      libraryHandle,
      moveItemDialog.category,
      moveItemDialog.sourcePath,
      moveItemDialog.itemName,
      targetPath
    );
    setMoveItemDialog(null);
    await refreshTrees();
  }, [libraryHandle, moveItemDialog, refreshTrees]);

  // Get tree for move dialog
  const getMoveDialogTree = useCallback((): LibraryTreeNode[] => {
    if (!moveItemDialog) return [];
    switch (moveItemDialog.category) {
      case 'tones': return tonesTree;
      case 'patches': return patchesTree;
      case 'drum-kits': return drumKitsTree;
      default: return [];
    }
  }, [moveItemDialog, tonesTree, patchesTree, drumKitsTree]);

  return {
    // Tree data
    tonesTree,
    patchesTree,
    drumKitsTree,
    setTonesTree,
    setPatchesTree,
    setDrumKitsTree,

    // Dialog state
    createDirectoryDialog,
    renameDirectoryDialog,
    deleteDirectoryDialog,
    moveItemDialog,

    // Dialog openers
    handleOpenCreateDirectory,
    handleOpenRenameDirectory,
    handleOpenDeleteDirectory,
    handleOpenMoveItem,

    // Dialog closers
    closeCreateDirectoryDialog,
    closeRenameDirectoryDialog,
    closeDeleteDirectoryDialog,
    closeMoveItemDialog,

    // Operations
    handleCreateDirectory,
    handleRenameDirectory,
    handleDeleteDirectory,
    handleMoveItem,

    // Helper
    getMoveDialogTree,

    // Refresh
    refreshTrees,
  };
}
