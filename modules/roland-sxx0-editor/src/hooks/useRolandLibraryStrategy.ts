/**
 * Roland Library Operations Strategy
 *
 * Provides device-specific delete and rename behavior for the shared
 * useLibraryOperations hook. Handles tones, patches, drum kits, directories,
 * and sets — all Roland-specific library categories.
 */

import { useMemo, useCallback } from 'react';
import { type LibraryOperationsStrategy, getNodePath, getNodeName } from '@audiocontrol/editor-core';
import type { TreeNode } from '@audiocontrol/editor-core';
import type { StorageDirectoryHandle, LibraryCategory } from '@audiocontrol/sampler-library/browser';
import {
  createDirectory,
  deleteIndividualTone,
  deleteIndividualPatch,
  deleteDrumKit,
  deleteDirectory,
  renameIndividualTone,
  renameIndividualPatch,
  renameDrumKit,
  renameDirectory,
  deleteSet,
  renameSet,
} from '@/lib/library-service';
import type { ItemSelection } from '@/pages/LibraryPage';

// =========================================================================
// Helpers
// =========================================================================

/** Map plugin categoryId to the LibraryCategory type used by filesystem operations */
function toLibraryCategory(categoryId: string): LibraryCategory {
  if (categoryId === 'drumKits') return 'drum-kits';
  if (categoryId === 'tones' || categoryId === 'patches') return categoryId;
  // samples/programs are handled by the shared hook's common-area path
  return 'tones';
}

// =========================================================================
// Types
// =========================================================================

interface UseRolandLibraryStrategyOptions {
  libraryHandle: StorageDirectoryHandle | null;
  selection: ItemSelection | null;
  setSelection: (selection: ItemSelection | null) => void;
}

interface UseRolandLibraryStrategyResult {
  strategy: LibraryOperationsStrategy;
  handleDeleteSet: (setName: string) => Promise<void>;
  handleRenameSet: (oldName: string, newName: string) => Promise<void>;
}

// =========================================================================
// Hook
// =========================================================================

export function useRolandLibraryStrategy({
  libraryHandle,
  selection,
  setSelection,
}: UseRolandLibraryStrategyOptions): UseRolandLibraryStrategyResult {

  const handleDeleteSet = useCallback(async (setName: string) => {
    if (!libraryHandle || !window.confirm(`Delete set "${setName}"? This cannot be undone.`)) return;
    await deleteSet(libraryHandle, setName);
    if (selection?.type === 'set' && selection.name === setName) setSelection(null);
  }, [libraryHandle, selection, setSelection]);

  const handleRenameSet = useCallback(async (oldName: string, newName: string) => {
    if (!libraryHandle) return;
    await renameSet(libraryHandle, oldName, newName);
  }, [libraryHandle]);

  const strategy = useMemo<LibraryOperationsStrategy>(() => ({
    async createFolder(categoryId: string, parentPath: string[], name: string): Promise<boolean> {
      if (!libraryHandle) return false;
      // Common-area categories use the shared hook's fallback
      if (categoryId === 'samples' || categoryId === 'programs') return false;
      await createDirectory(libraryHandle, toLibraryCategory(categoryId), parentPath, name);
      return true;
    },

    async deleteItem(categoryId: string, node: TreeNode): Promise<boolean> {
      if (!libraryHandle) return false;

      const path = getNodePath(node);
      const name = getNodeName(node);

      // Common-area categories are not device-specific — let shared hook handle them
      if (categoryId === 'samples' || categoryId === 'programs') {
        return false;
      }

      if (node.type === 'directory') {
        await deleteDirectory(libraryHandle, toLibraryCategory(categoryId), path, true);
        return true;
      }
      if (node.type === 'tone') {
        await deleteIndividualTone(libraryHandle, name, path);
        if (selection?.type === 'individualTone' && selection.name === name) setSelection(null);
        return true;
      }
      if (node.type === 'patch') {
        await deleteIndividualPatch(libraryHandle, name, path);
        if (selection?.type === 'individualPatch' && selection.name === name) setSelection(null);
        return true;
      }
      if (node.type === 'drum-kit') {
        await deleteDrumKit(libraryHandle, name, path);
        if (selection?.type === 'drumKit' && selection.name === name) setSelection(null);
        return true;
      }

      return false;
    },

    async renameItem(categoryId: string, node: TreeNode, newName: string): Promise<boolean> {
      if (!libraryHandle) return false;

      const path = getNodePath(node);
      const oldName = getNodeName(node);

      // Common-area categories are not device-specific — let shared hook handle them
      if (categoryId === 'samples' || categoryId === 'programs') {
        return false;
      }

      if (node.type === 'directory') {
        await renameDirectory(libraryHandle, toLibraryCategory(categoryId), [...path, oldName], newName);
        return true;
      }
      if (node.type === 'tone') {
        await renameIndividualTone(libraryHandle, oldName, newName, path);
        return true;
      }
      if (node.type === 'patch') {
        await renameIndividualPatch(libraryHandle, oldName, newName, path);
        return true;
      }
      if (node.type === 'drum-kit') {
        await renameDrumKit(libraryHandle, oldName, newName, path);
        return true;
      }

      return false;
    },
  }), [libraryHandle, selection, setSelection]);

  return { strategy, handleDeleteSet, handleRenameSet };
}
