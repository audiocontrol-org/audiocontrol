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
import type { ErrorReporter } from '@/hooks/useErrorReporter';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import {
  createFolder,
  deleteItem,
  moveItem,
  importWavToCommonArea,
  getNestedDirectory,
  moveDirectory,
  sanitizeForFilename,
} from '@audiocontrol/sampler-library/browser';
import type { TreeNode } from '@/components/library/TreeView';

// =========================================================================
// Transfer dialog state -- shared across all editors
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
// Transfer action types -- capability declaration system
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
  'edit-drum-kit': (name: string, nodeType: string, path?: string[]) => void;
  'import-instrument': (dirName: string, path: string[], fromProgramsDir: boolean) => void;
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
): (categoryId: string, actionId: string, node: TreeNode) => StrategyResult {
  const handlerMap = handlers as Partial<TransferHandlerMap>;
  return (categoryId, actionId, node) => {
    const meta = (node.meta ?? {}) as Record<string, unknown>;
    const name = node.name;

    switch (actionId) {
      case 'send-sample-to-device': {
        if (!handlerMap['send-sample-to-device']) return { handled: false };
        const path = (meta.path as string[] | undefined) ?? [];
        handlerMap['send-sample-to-device'](name, path);
        return { handled: true };
      }
      case 'import-drum-kit': {
        if (!handlerMap['import-drum-kit']) return { handled: false };
        const path = (meta.path as string[] | undefined) ?? [];
        handlerMap['import-drum-kit'](name, path);
        return { handled: true };
      }
      case 'edit-drum-kit': {
        if (!handlerMap['edit-drum-kit']) return { handled: false };
        const path = (meta.path as string[] | undefined) ?? [];
        handlerMap['edit-drum-kit'](name, node.type, path);
        return { handled: true };
      }
      case 'send-program-to-device': {
        if (!handlerMap['send-program-to-device']) return { handled: false };
        if (!deviceProgramCategories.includes(categoryId)) return { handled: false };
        const dirName = (meta.dirName as string | undefined) ?? name;
        handlerMap['send-program-to-device'](dirName, name);
        return { handled: true };
      }
      case 'promote-to-common-area': {
        if (!handlerMap['promote-to-common-area']) return { handled: false };
        if (!deviceProgramCategories.includes(categoryId)) return { handled: false };
        const dirName = (meta.dirName as string | undefined) ?? name;
        handlerMap['promote-to-common-area'](dirName);
        return { handled: true };
      }
      case 'import-instrument': {
        if (!handlerMap['import-instrument']) return { handled: false };
        if (deviceProgramCategories.includes(categoryId)) return { handled: false };
        const dirName = (meta.directoryName as string | undefined) ?? name;
        const path = (meta.path as string[] | undefined) ?? [];
        // Programs in 'programs' or 'common-programs' categories live in the programs root
        const fromProgramsDir = categoryId === 'programs' || categoryId === 'common-programs';
        handlerMap['import-instrument'](dirName, path, fromProgramsDir);
        return { handled: true };
      }
      default:
        return { handled: false };
    }
  };
}

// =========================================================================
// Strategy interface
// =========================================================================

/**
 * Result of a strategy method: either the strategy handled the operation,
 * or it didn't (fall through to default behavior).
 *
 * Replaces bare `boolean` returns which conflated "not applicable" with "failed silently."
 */
export type StrategyResult = { handled: true } | { handled: false };

export interface LibraryOperationsStrategy {
  /** Create a folder in a device-specific category. Return handled:true if handled, handled:false to use common-area create. */
  createFolder(categoryId: string, parentPath: string[], name: string): Promise<StrategyResult>;
  /** Delete a device-specific item. Return handled:true if handled, handled:false to use common-area delete. */
  deleteItem(categoryId: string, node: TreeNode): Promise<StrategyResult>;
  /** Rename a device-specific item. Return handled:true if handled, handled:false to use common-area rename. */
  renameItem(categoryId: string, node: TreeNode, newName: string): Promise<StrategyResult>;
  /**
   * Move a device-specific item to a new target path within the same
   * category. Return handled:true if handled, handled:false to fall back
   * to the common-area `moveItem` (which only knows the samples root).
   * Optional — strategies that don't implement it get the common-area
   * fallback, but device-specific categories whose files don't live in
   * `library/common/samples/` MUST provide this to avoid "file or
   * directory not found" errors when the common-area fallback resolves
   * against the wrong root.
   */
  moveItem?(categoryId: string, node: TreeNode, targetPath: string[]): Promise<StrategyResult>;
  /** Handle a context menu action. Required -- every editor must route actions. */
  handleContextMenuAction(categoryId: string, actionId: string, node: TreeNode): StrategyResult;
}

// =========================================================================
// Result interface
// =========================================================================

export interface LibraryOperationsResult {
  expandedPaths: Record<string, Set<string>>;
  onToggleExpand: (categoryId: string, nodeId: string) => void;
  onCreateFolder: (categoryId: string, parentPath: string[], name?: string) => Promise<void>;
  onDelete: (categoryId: string, node: TreeNode) => Promise<void>;
  onMove: (categoryId: string, node: TreeNode, targetPath: string[]) => Promise<void>;
  onRename: (categoryId: string, node: TreeNode, newName: string) => Promise<void>;
  onFileDrop: (categoryId: string, files: File[], targetPath: string[]) => Promise<void>;
  onContextMenuAction: (categoryId: string, actionId: string, node: TreeNode) => void;
  onBatchDelete: (categoryId: string, nodes: TreeNode[]) => Promise<void>;
  onBatchMove: (categoryId: string, nodes: TreeNode[], targetPath: string[]) => Promise<void>;
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

/** Programs categories use a different root directory than samples. */
const PROGRAM_CATEGORIES = new Set(['programs', 'common-programs']);
const PROGRAMS_ROOT = ['library', 'common', 'programs'];

/** Get the root directory for a category's filesystem operations. */
async function getCategoryDir(
  root: StorageDirectoryHandle,
  categoryId: string,
  subPath: string[],
): Promise<StorageDirectoryHandle> {
  if (PROGRAM_CATEGORIES.has(categoryId)) {
    return getNestedDirectory(root, [...PROGRAMS_ROOT, ...subPath]);
  }
  // Default: samples root (handled by the sampler-library createFolder/moveItem/deleteItem)
  throw new Error('USE_DEFAULT');
}

// =========================================================================
// Hook
// =========================================================================

export function useLibraryOperations(
  libraryRoot: StorageDirectoryHandle | null,
  strategy: LibraryOperationsStrategy | undefined,
  onRefresh: () => void,
  errorReporter: ErrorReporter,
  onEditorAction?: (actionId: string, name: string, nodeType: string, path?: string[]) => void,
): LibraryOperationsResult {
  const onError = errorReporter.report;
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
    async (categoryId: string, parentPath: string[], name?: string) => {
      if (!libraryRoot) {
        onError('Library is not connected');
        return;
      }
      const folderName = name?.trim();
      if (!folderName) return;
      try {
        const result = await strategy?.createFolder?.(categoryId, parentPath, folderName);
        if (!result?.handled) {
          if (PROGRAM_CATEGORIES.has(categoryId)) {
            const dir = await getCategoryDir(libraryRoot, categoryId, parentPath);
            await dir.getDirectoryHandle(folderName, { create: true });
          } else {
            await createFolder(libraryRoot, parentPath, folderName);
          }
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
      try {
        if (strategy?.deleteItem) {
          const result = await strategy.deleteItem(categoryId, node);
          if (result.handled) {
            onRefresh();
            return;
          }
        }
        const path = getNodePath(node);
        if (PROGRAM_CATEGORIES.has(categoryId)) {
          const dir = await getCategoryDir(libraryRoot, categoryId, path);
          await dir.removeEntry(name, { recursive: true });
        } else {
          await deleteItem(libraryRoot, name, path);
        }
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
        // Strategy first: device-specific categories (Roland's
        // library/<device>/<category>/, Akai's program tree) own the
        // path layout and must handle the move themselves. The
        // common-area `moveItem` only knows `library/common/samples/`
        // and will throw "not found" against any other root.
        if (strategy?.moveItem) {
          const result = await strategy.moveItem(categoryId, node, targetPath);
          if (result.handled) {
            onRefresh();
            return;
          }
        }
        if (PROGRAM_CATEGORIES.has(categoryId)) {
          const srcParent = await getCategoryDir(libraryRoot, categoryId, sourcePath);
          const destParent = await getCategoryDir(libraryRoot, categoryId, targetPath);
          await moveDirectory(srcParent, name, destParent);
        } else {
          await moveItem(libraryRoot, name, sourcePath, targetPath);
        }
        onRefresh();
      } catch (err) {
        onError(`Failed to move "${name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [libraryRoot, strategy, onRefresh, onError],
  );

  const onRename = useCallback(
    async (categoryId: string, node: TreeNode, newName: string) => {
      if (!libraryRoot) {
        onError('Library is not connected');
        return;
      }
      const oldDirName = getNodeName(node);
      const path = getNodePath(node);
      try {
        const result = await strategy?.renameItem(categoryId, node, newName);
        if (result?.handled) {
          onRefresh();
          return;
        }
        // Common-area fallback: rename directory bundle
        // 1. Resolve the parent directory and old item directory
        const isProgram = PROGRAM_CATEGORIES.has(categoryId);
        const parentDir = isProgram
          ? await getCategoryDir(libraryRoot, categoryId, path)
          : await getNestedDirectory(libraryRoot, ['library', 'common', 'samples', ...path]);
        const oldDir = await parentDir.getDirectoryHandle(oldDirName);

        // 2. Update the name field inside the YAML metadata
        const yamlFilename = isProgram ? 'program.yaml' : 'sample.yaml';
        const yamlHandle = await oldDir.getFileHandle(yamlFilename);
        const yamlFile = await yamlHandle.getFile();
        const yamlText = await yamlFile.text();
        const parsed = parseYaml(yamlText);
        parsed.name = newName;
        const writable = await yamlHandle.createWritable();
        await writable.write(stringifyYaml(parsed, { indent: 2, lineWidth: 120 }));
        await writable.close();

        // 3. Rename the directory (copy to new name, delete old)
        const safeName = sanitizeForFilename(newName);
        if (safeName !== oldDirName) {
          await moveDirectory(parentDir, oldDirName, parentDir, safeName);
        }
        onRefresh();
      } catch (err) {
        onError(
          `Failed to rename "${node.name}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    [libraryRoot, strategy, onRefresh, onError],
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
        const result = strategy.handleContextMenuAction(categoryId, actionId, node);
        if (result.handled) return;
      }

      // Editor actions -- delegate to consumer callback
      const editorActions = ['open-loop-editor', 'open-chopper', 'open-sample-editor'];
      if (editorActions.includes(actionId)) {
        if (!onEditorAction) {
          throw new Error(`Editor action "${actionId}" has no handler -- onEditorAction callback is missing`);
        }
        const name = getNodeName(node);
        const path = getNodePath(node);
        onEditorAction(actionId, name, node.type, path.length > 0 ? path : undefined);
        return;
      }

      // 'move' is intercepted by PluginLibraryBrowser before reaching here.
      // If it arrives, the component didn't handle it -- that's a bug.
      if (actionId === 'move') {
        throw new Error('Move action should be handled by PluginLibraryBrowser, not useLibraryOperations');
      }

      // If we reach here, no one handled the action -- this is a bug
      throw new Error(
        `Unhandled context menu action "${actionId}" for category "${categoryId}", ` +
        `node type "${node.type}". Either the action should not appear in the menu, ` +
        `or a handler is missing.`,
      );
    },
    [strategy, onEditorAction],
  );

  const onBatchDelete = useCallback(
    async (categoryId: string, nodes: TreeNode[]) => {
      if (!libraryRoot) {
        onError('Library is not connected');
        return;
      }
      const errors: string[] = [];
      for (const node of nodes) {
        try {
          const name = getNodeName(node);
          if (strategy?.deleteItem) {
            const result = await strategy.deleteItem(categoryId, node);
            if (result.handled) continue;
          }
          const path = getNodePath(node);
          if (PROGRAM_CATEGORIES.has(categoryId)) {
            const dir = await getCategoryDir(libraryRoot, categoryId, path);
            await dir.removeEntry(name, { recursive: true });
          } else {
            await deleteItem(libraryRoot, name, path);
          }
        } catch (err) {
          errors.push(`${node.name}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      onRefresh();
      if (errors.length > 0) {
        onError(`Failed to delete ${errors.length} item(s):\n${errors.join('\n')}`);
      }
    },
    [libraryRoot, strategy, onRefresh, onError],
  );

  const onBatchMove = useCallback(
    async (categoryId: string, nodes: TreeNode[], targetPath: string[]) => {
      if (!libraryRoot) {
        onError('Library is not connected');
        return;
      }
      const errors: string[] = [];
      for (const node of nodes) {
        try {
          // Same strategy-first routing as the single-item `onMove`.
          // Without this, device-specific categories whose files don't
          // live in `library/common/samples/` fall through to the
          // common-area `moveItem` per-item and emit one
          // "file or directory not found" per node.
          if (strategy?.moveItem) {
            const result = await strategy.moveItem(categoryId, node, targetPath);
            if (result.handled) continue;
          }
          const name = getNodeName(node);
          const sourcePath = getNodePath(node);
          if (PROGRAM_CATEGORIES.has(categoryId)) {
            const srcParent = await getCategoryDir(libraryRoot, categoryId, sourcePath);
            const destParent = await getCategoryDir(libraryRoot, categoryId, targetPath);
            await moveDirectory(srcParent, name, destParent);
          } else {
            await moveItem(libraryRoot, name, sourcePath, targetPath);
          }
        } catch (err) {
          errors.push(`${node.name}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      onRefresh();
      if (errors.length > 0) {
        onError(`Failed to move ${errors.length} item(s):\n${errors.join('\n')}`);
      }
    },
    [libraryRoot, strategy, onRefresh, onError],
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
    onBatchDelete,
    onBatchMove,
  };
}
