/**
 * Shared hook for library file-tree operations.
 *
 * Unifies create-folder, delete, rename, move, file-drop, context-menu,
 * and expand/collapse across all sampler editors that use PluginLibraryBrowser.
 *
 * Device-specific behavior is injected via LibraryOperationsStrategy.
 */

import { useCallback, useState } from 'react';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import {
  createFolder,
  deleteItem,
  moveItem,
  importWavToCommonArea,
} from '@audiocontrol/sampler-library/browser';
import type { TreeNode } from '@/components/library/TreeView';

// =========================================================================
// Transfer callbacks — shared interface for context menu transfer actions
// =========================================================================

/**
 * Callbacks for library context menu transfer actions.
 *
 * These are the same across all editors — the action IDs in item-types.tsx
 * map to these callbacks. Each editor provides its own implementations
 * (wired to its transfer dialogs/hooks), but the routing is shared.
 *
 * Omit a callback to hide the corresponding context menu action.
 */
export interface LibraryTransferCallbacks {
  onSendSampleToDevice?: (name: string, path?: string[]) => void;
  onSendProgramToDevice?: (dirName: string, name: string) => void;
  onImportDrumKit?: (name: string, path?: string[]) => void;
  onEditDrumKit?: (name: string, path?: string[]) => void;
  onImportInstrument?: (dirName: string, path: string[]) => void;
  onPromoteToCommonArea?: (dirName: string) => void;
}

/**
 * Create a handleContextMenuAction function from transfer callbacks.
 *
 * Maps standardized context menu action IDs (from item-types.tsx) to the
 * editor's transfer callbacks. Used by all editors — no per-editor strategy
 * needed for transfer actions.
 */
export function createTransferActionHandler(
  transfers: LibraryTransferCallbacks,
  /** Category IDs that contain device-specific programs (e.g., 's3k-programs'). */
  deviceProgramCategories: string[] = [],
): (categoryId: string, actionId: string, node: TreeNode) => boolean {
  return (categoryId, actionId, node) => {
    const meta = (node.meta ?? {}) as Record<string, unknown>;
    const name = node.name;

    switch (actionId) {
      case 'send-sample-to-device': {
        if (!transfers.onSendSampleToDevice) return false;
        const path = (meta.path as string[] | undefined) ?? [];
        transfers.onSendSampleToDevice(name, path);
        return true;
      }
      case 'import-drum-kit': {
        if (!transfers.onImportDrumKit) return false;
        const path = (meta.path as string[] | undefined) ?? [];
        transfers.onImportDrumKit(name, path);
        return true;
      }
      case 'edit-drum-kit': {
        if (!transfers.onEditDrumKit) return false;
        const path = (meta.path as string[] | undefined) ?? [];
        transfers.onEditDrumKit(name, path);
        return true;
      }
      case 'send-program-to-device': {
        if (!transfers.onSendProgramToDevice) return false;
        if (!deviceProgramCategories.includes(categoryId)) return false;
        const dirName = (meta.dirName as string | undefined) ?? name;
        transfers.onSendProgramToDevice(dirName, name);
        return true;
      }
      case 'promote-to-common-area': {
        if (!transfers.onPromoteToCommonArea) return false;
        if (!deviceProgramCategories.includes(categoryId)) return false;
        const dirName = (meta.dirName as string | undefined) ?? name;
        transfers.onPromoteToCommonArea(dirName);
        return true;
      }
      case 'import-instrument': {
        if (!transfers.onImportInstrument) return false;
        if (deviceProgramCategories.includes(categoryId)) return false;
        const dirName = (meta.directoryName as string | undefined) ?? name;
        const path = (meta.path as string[] | undefined) ?? [];
        transfers.onImportInstrument(dirName, path);
        return true;
      }
      default:
        return false;
    }
  };
}

// =========================================================================
// Strategy interface
// =========================================================================

export interface LibraryOperationsStrategy {
  /** Create a folder in a device-specific category. Return true if handled, false to use common-area create. */
  createFolder?(categoryId: string, parentPath: string[], name: string): Promise<boolean>;
  /** Delete a device-specific item. Return true if handled, false to use common-area delete. */
  deleteItem?(categoryId: string, node: TreeNode): Promise<boolean>;
  /** Rename a device-specific item. Return true if handled, false to use common-area rename. */
  renameItem?(categoryId: string, node: TreeNode, newName: string): Promise<boolean>;
  /** Handle a device-specific context menu action. Return true if handled. */
  handleContextMenuAction?(categoryId: string, actionId: string, node: TreeNode): boolean;
}

// =========================================================================
// Result interface
// =========================================================================

export interface LibraryOperationsResult {
  expandedPaths: Record<string, Set<string>>;
  onToggleExpand: (categoryId: string, nodeId: string) => void;
  onCreateFolder: (categoryId: string, parentPath: string[]) => Promise<void>;
  onDelete: (categoryId: string, node: TreeNode) => Promise<void>;
  onMove: (categoryId: string, node: TreeNode, targetPath: string[]) => Promise<void>;
  onRename: (categoryId: string, node: TreeNode, newName: string) => Promise<void>;
  onFileDrop: (categoryId: string, files: File[], targetPath: string[]) => Promise<void>;
  onContextMenuAction: (categoryId: string, actionId: string, node: TreeNode) => void;
}

// =========================================================================
// Helpers
// =========================================================================

export function getNodeName(node: TreeNode): string {
  const meta = node.meta;
  if (!meta) return node.name;
  const candidate = meta['fileName'] ?? meta['directoryName'] ?? meta['dirName'];
  if (typeof candidate === 'string') return candidate;
  return node.name;
}

export function getNodePath(node: TreeNode): string[] {
  const meta = node.meta;
  if (!meta) return [];
  const path = meta['path'];
  if (Array.isArray(path) && path.every((p): p is string => typeof p === 'string')) {
    return path;
  }
  return [];
}

// =========================================================================
// Hook
// =========================================================================

export function useLibraryOperations(
  libraryRoot: StorageDirectoryHandle | null,
  strategy: LibraryOperationsStrategy | undefined,
  onRefresh: () => void,
  onError: (message: string) => void,
  onEditorAction?: (actionId: string, name: string, nodeType: string, path?: string[]) => void,
): LibraryOperationsResult {
  const [expandedPaths, setExpandedPaths] = useState<Record<string, Set<string>>>({});

  const onToggleExpand = useCallback((categoryId: string, nodeId: string) => {
    setExpandedPaths((prev) => {
      const categorySet = new Set(prev[categoryId]);
      if (categorySet.has(nodeId)) {
        categorySet.delete(nodeId);
      } else {
        categorySet.add(nodeId);
      }
      return { ...prev, [categoryId]: categorySet };
    });
  }, []);

  const onCreateFolder = useCallback(
    async (categoryId: string, parentPath: string[]) => {
      if (!libraryRoot) {
        onError('Library is not connected');
        return;
      }
      const name = window.prompt('Folder name:');
      if (!name) return;
      try {
        // Try device-specific strategy first
        const handled = await strategy?.createFolder?.(categoryId, parentPath, name);
        if (!handled) {
          // Fallback to common-area create
          await createFolder(libraryRoot, parentPath, name);
        }
        onRefresh();
      } catch (err) {
        onError(`Failed to create folder: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [libraryRoot, strategy, onRefresh, onError],
  );

  const onDelete = useCallback(
    async (categoryId: string, node: TreeNode) => {
      if (!libraryRoot) {
        onError('Library is not connected');
        return;
      }
      const name = getNodeName(node);
      const confirmed = window.confirm(`Delete "${name}"?`);
      if (!confirmed) return;
      try {
        if (strategy?.deleteItem) {
          const handled = await strategy.deleteItem(categoryId, node);
          if (handled) {
            onRefresh();
            return;
          }
        }
        const path = getNodePath(node);
        await deleteItem(libraryRoot, name, path);
        onRefresh();
      } catch (err) {
        onError(`Failed to delete "${name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [libraryRoot, strategy, onRefresh, onError],
  );

  const onMove = useCallback(
    async (categoryId: string, node: TreeNode, targetPath: string[]) => {
      if (!libraryRoot) {
        onError('Library is not connected');
        return;
      }
      const name = getNodeName(node);
      const sourcePath = getNodePath(node);
      try {
        await moveItem(libraryRoot, name, sourcePath, targetPath);
        onRefresh();
      } catch (err) {
        onError(`Failed to move "${name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [libraryRoot, onRefresh, onError],
  );

  const onRename = useCallback(
    async (categoryId: string, node: TreeNode, newName: string) => {
      try {
        if (strategy?.renameItem) {
          const handled = await strategy.renameItem(categoryId, node, newName);
          if (handled) {
            onRefresh();
            return;
          }
        }
        throw new Error(
          `Rename is not supported for item type "${node.type}" in category "${categoryId}". ` +
            'A LibraryOperationsStrategy.renameItem implementation is required.',
        );
      } catch (err) {
        onError(
          `Failed to rename "${node.name}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    [strategy, onRefresh, onError],
  );

  const onFileDrop = useCallback(
    async (categoryId: string, files: File[], targetPath: string[]) => {
      if (!libraryRoot) {
        onError('Library is not connected');
        return;
      }
      try {
        for (const file of files) {
          const buffer = await file.arrayBuffer();
          const data = new Uint8Array(buffer);
          await importWavToCommonArea(libraryRoot, file.name, data, { targetPath });
        }
        onRefresh();
      } catch (err) {
        onError(`Failed to import files: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [libraryRoot, onRefresh, onError],
  );

  const onContextMenuAction = useCallback(
    (categoryId: string, actionId: string, node: TreeNode) => {
      // Let strategy handle device-specific actions first
      if (strategy?.handleContextMenuAction) {
        const handled = strategy.handleContextMenuAction(categoryId, actionId, node);
        if (handled) return;
      }

      // Editor actions — delegate to consumer callback
      const editorActions = ['open-loop-editor', 'open-chopper', 'open-sample-editor'];
      if (editorActions.includes(actionId)) {
        if (onEditorAction) {
          const name = getNodeName(node);
          const path = getNodePath(node);
          onEditorAction(actionId, name, node.type, path.length > 0 ? path : undefined);
        }
        return;
      }

      // 'move' action — requires target path from the move dialog, which is handled
      // by the PluginLibraryBrowser's move flow. The hook's onMove is called directly
      // by the component when the user completes the move dialog.
    },
    [strategy, onEditorAction],
  );

  return {
    expandedPaths,
    onToggleExpand,
    onCreateFolder,
    onDelete,
    onMove,
    onRename,
    onFileDrop,
    onContextMenuAction,
  };
}
