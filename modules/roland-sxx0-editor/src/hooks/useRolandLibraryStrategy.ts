/**
 * Roland Library Operations Strategy
 *
 * Provides device-specific delete and rename behavior for the shared
 * useLibraryOperations hook. Handles tones, patches, drum kits, directories,
 * and sets — all Roland-specific library categories.
 */

import { useMemo, useCallback } from 'react';
import { type LibraryOperationsStrategy, type StrategyResult, createTransferActionHandler, getNodePath, getNodeName } from '@audiocontrol/editor-core';
import type { TreeNode } from '@audiocontrol/editor-core';
import type { StorageDirectoryHandle, LibraryCategory } from '@audiocontrol/sampler-library/browser';
import {
  createDirectory,
  deleteIndividualTone,
  deleteIndividualPatch,
  deleteDirectory,
  renameIndividualTone,
  renameIndividualPatch,
  renameDirectory,
  deleteSet,
  renameSet,
  moveItem as moveLibraryItem,
} from '@/lib/library-service';
import type { RolandPageSelection } from '@/pages/LibraryPage';

// =========================================================================
// Helpers
// =========================================================================

/** Map plugin categoryId to the LibraryCategory type used by filesystem operations */
function toLibraryCategory(categoryId: string): LibraryCategory {
  if (categoryId === 'tones' || categoryId === 'patches') return categoryId;
  // samples/programs are handled by the shared hook's common-area path
  return 'tones';
}

// =========================================================================
// Types
// =========================================================================

interface UseRolandLibraryStrategyOptions {
  libraryHandle: StorageDirectoryHandle | null;
  selection: RolandPageSelection | null;
  setSelection: (selection: RolandPageSelection | null) => void;
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
    if (!libraryHandle) return;
    await deleteSet(libraryHandle, setName);
    if (selection?.type === 'set' && selection.name === setName) setSelection(null);
  }, [libraryHandle, selection, setSelection]);

  const handleRenameSet = useCallback(async (oldName: string, newName: string) => {
    if (!libraryHandle) return;
    await renameSet(libraryHandle, oldName, newName);
  }, [libraryHandle]);

  const strategy = useMemo<LibraryOperationsStrategy>(() => ({
    async createFolder(categoryId: string, parentPath: string[], name: string): Promise<StrategyResult> {
      if (!libraryHandle) return { handled: false };
      // Common-area categories use the shared hook's fallback
      if (categoryId === 'samples' || categoryId === 'programs') return { handled: false };
      await createDirectory(libraryHandle, toLibraryCategory(categoryId), parentPath, name);
      return { handled: true };
    },

    async deleteItem(categoryId: string, node: TreeNode): Promise<StrategyResult> {
      if (!libraryHandle) return { handled: false };

      const path = getNodePath(node);
      const name = getNodeName(node);

      // Common-area categories are not device-specific — let shared hook handle them
      if (categoryId === 'samples' || categoryId === 'programs') {
        return { handled: false };
      }

      if (node.type === 'directory') {
        await deleteDirectory(libraryHandle, toLibraryCategory(categoryId), path, true);
        return { handled: true };
      }
      if (node.type === 'tone') {
        await deleteIndividualTone(libraryHandle, name, path);
        if (selection?.type === 'individualTone' && selection.name === name) setSelection(null);
        return { handled: true };
      }
      if (node.type === 'patch') {
        await deleteIndividualPatch(libraryHandle, name, path);
        if (selection?.type === 'individualPatch' && selection.name === name) setSelection(null);
        return { handled: true };
      }
      return { handled: false };
    },

    async moveItem(categoryId: string, node: TreeNode, targetPath: string[]): Promise<StrategyResult> {
      if (!libraryHandle) return { handled: false };
      // Common-area categories live under library/common/samples — the
      // shared hook's common-area moveItem is correct for those.
      if (categoryId === 'samples' || categoryId === 'programs') {
        return { handled: false };
      }
      const sourcePath = getNodePath(node);
      const itemName = getNodeName(node);
      await moveLibraryItem(
        libraryHandle,
        toLibraryCategory(categoryId),
        sourcePath,
        itemName,
        targetPath,
      );
      // If the moved item was the page-level selection, clear it.
      // The selection's `path` field still points to the OLD parent
      // (e.g. ['DRUMS']) after the move; the preview pane's load
      // useEffect would then re-attempt `loadIndividualPatch(handle,
      // name, oldPath)` and the file-system-access call would throw
      // "file or directory could not be found" — visible to the
      // operator as a "FAILED TO LOAD" body even though the move
      // itself succeeded. Mirrors the same clear-on-mutation guard
      // that `deleteItem` above uses for the delete case.
      const samePath = (a: string[] | undefined, b: string[]) =>
        (a ?? []).length === b.length && (a ?? []).every((seg, i) => seg === b[i]);
      if (
        selection &&
        ((selection.type === 'individualTone' && node.type === 'tone' && selection.name === itemName && samePath(selection.path, sourcePath)) ||
          (selection.type === 'individualPatch' && node.type === 'patch' && selection.name === itemName && samePath(selection.path, sourcePath)))
      ) {
        setSelection(null);
      }
      return { handled: true };
    },

    async renameItem(categoryId: string, node: TreeNode, newName: string): Promise<StrategyResult> {
      if (!libraryHandle) return { handled: false };

      const path = getNodePath(node);
      const oldName = getNodeName(node);

      // Common-area categories are not device-specific — let shared hook handle them
      if (categoryId === 'samples' || categoryId === 'programs') {
        return { handled: false };
      }

      if (node.type === 'directory') {
        await renameDirectory(libraryHandle, toLibraryCategory(categoryId), [...path, oldName], newName);
        return { handled: true };
      }
      if (node.type === 'tone') {
        await renameIndividualTone(libraryHandle, oldName, newName, path);
        return { handled: true };
      }
      if (node.type === 'patch') {
        await renameIndividualPatch(libraryHandle, oldName, newName, path);
        return { handled: true };
      }
      return { handled: false };
    },

    // Roland declares no transfer actions (empty handler map).
    // When Roland adds device transfer support, add handlers here
    // and declare the actions in the category factories.
    handleContextMenuAction: createTransferActionHandler<never>({}),
  }), [libraryHandle, selection, setSelection]);

  return { strategy, handleDeleteSet, handleRenameSet };
}
