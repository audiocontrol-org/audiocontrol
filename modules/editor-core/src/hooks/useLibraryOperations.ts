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
// Transfer dialog state — shared across all editors
// =========================================================================

/**
 * State for a "save device item to library" dialog.
 *
 * Used for both samples and programs being saved from device memory
 * to library storage. The dialog shows transfer progress.
 */
export interface SaveToLibraryDialogState {
  open: boolean;
  /** Device slot index of the item to save. */
  itemIndex: number;
  /** Display name of the item. */
  itemName: string;
  /** Skip the confirm phase and start the transfer immediately (context menu path). */
  autoStart?: boolean;
}

/**
 * State for a "send library item to device" dialog.
 *
 * Used for both samples and programs being sent from the library
 * to device memory. The dialog shows transfer progress.
 */
export interface SendToDeviceDialogState {
  open: boolean;
  /** Display name of the item. */
  itemName: string;
  /** Path within the library (for locating the item). */
  itemPath: string[];
}

export const SAVE_DIALOG_CLOSED: SaveToLibraryDialogState = {
  open: false, itemIndex: 0, itemName: '',
};

export const SEND_DIALOG_CLOSED: SendToDeviceDialogState = {
  open: false, itemName: '', itemPath: [],
};

// =========================================================================
// Transfer action types — capability declaration system
// =========================================================================

/** All transfer action IDs that can appear in shared item type context menus. */
export type TransferActionId =
  | 'send-sample-to-device'
  | 'send-program-to-device'
  | 'import-drum-kit'
  | 'edit-drum-kit'
  | 'import-instrument'
  | 'promote-to-common-area';

/**
 * Handler signatures for each transfer action.
 * Used with Required<Pick<...>> to enforce that declared actions have handlers.
 */
export interface TransferHandlerMap {
  'send-sample-to-device': (name: string, path?: string[]) => void;
  'send-program-to-device': (dirName: string, name: string) => void;
  'import-drum-kit': (name: string, path?: string[]) => void;
  'edit-drum-kit': (name: string, path?: string[]) => void;
  'import-instrument': (dirName: string, path: string[]) => void;
  'promote-to-common-area': (dirName: string) => void;
}

/**
 * Create a handleContextMenuAction function from declared transfer capabilities.
 *
 * The handlers parameter uses Required<Pick<...>> so the compiler enforces
 * that every declared action has a corresponding handler.
 */
export function createTransferActionHandler<T extends TransferActionId>(
  handlers: Required<Pick<TransferHandlerMap, T>>,
  /** Category IDs that contain device-specific programs (e.g., 's3k-programs'). */
  deviceProgramCategories: string[] = [],
): (categoryId: string, actionId: string, node: TreeNode) => boolean {
  const handlerMap = handlers as Partial<TransferHandlerMap>;
  return (categoryId, actionId, node) => {
    const meta = (node.meta ?? {}) as Record<string, unknown>;
    const name = node.name;

    switch (actionId) {
      case 'send-sample-to-device': {
        if (!handlerMap['send-sample-to-device']) return false;
        const path = (meta.path as string[] | undefined) ?? [];
        handlerMap['send-sample-to-device'](name, path);
        return true;
      }
      case 'import-drum-kit': {
        if (!handlerMap['import-drum-kit']) return false;
        const path = (meta.path as string[] | undefined) ?? [];
        handlerMap['import-drum-kit'](name, path);
        return true;
      }
      case 'edit-drum-kit': {
        if (!handlerMap['edit-drum-kit']) return false;
        const path = (meta.path as string[] | undefined) ?? [];
        handlerMap['edit-drum-kit'](name, path);
        return true;
      }
      case 'send-program-to-device': {
        if (!handlerMap['send-program-to-device']) return false;
        if (!deviceProgramCategories.includes(categoryId)) return false;
        const dirName = (meta.dirName as string | undefined) ?? name;
        handlerMap['send-program-to-device'](dirName, name);
        return true;
      }
      case 'promote-to-common-area': {
        if (!handlerMap['promote-to-common-area']) return false;
        if (!deviceProgramCategories.includes(categoryId)) return false;
        const dirName = (meta.dirName as string | undefined) ?? name;
        handlerMap['promote-to-common-area'](dirName);
        return true;
      }
      case 'import-instrument': {
        if (!handlerMap['import-instrument']) return false;
        if (deviceProgramCategories.includes(categoryId)) return false;
        const dirName = (meta.directoryName as string | undefined) ?? name;
        const path = (meta.path as string[] | undefined) ?? [];
        handlerMap['import-instrument'](dirName, path);
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
  /** Handle a context menu action. Required — every editor must route actions. */
  handleContextMenuAction(categoryId: string, actionId: string, node: TreeNode): boolean;
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
      // Let strategy handle transfer actions first
      if (strategy) {
        const handled = strategy.handleContextMenuAction(categoryId, actionId, node);
        if (handled) return;
      }

      // Editor actions — delegate to consumer callback
      const editorActions = ['open-loop-editor', 'open-chopper', 'open-sample-editor'];
      if (editorActions.includes(actionId)) {
        if (!onEditorAction) {
          throw new Error(`Editor action "${actionId}" has no handler — onEditorAction callback is missing`);
        }
        const name = getNodeName(node);
        const path = getNodePath(node);
        onEditorAction(actionId, name, node.type, path.length > 0 ? path : undefined);
        return;
      }

      // 'move' is intercepted by PluginLibraryBrowser before reaching here.
      // If it arrives, the component didn't handle it — that's a bug.
      if (actionId === 'move') {
        throw new Error('Move action should be handled by PluginLibraryBrowser, not useLibraryOperations');
      }

      // If we reach here, no one handled the action — this is a bug
      throw new Error(
        `Unhandled context menu action "${actionId}" for category "${categoryId}", ` +
        `node type "${node.type}". Either the action should not appear in the menu, ` +
        `or a handler is missing.`,
      );
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
