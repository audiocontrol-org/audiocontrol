/**
 * PluginLibraryBrowser — Plugin-driven library browser component.
 *
 * Renders a multi-section library layout with:
 * - Device memory panel slot (when deviceMemory config present)
 * - Library sections driven by plugin categories
 * - Preview panel slot
 *
 * The layout adapts based on plugin configuration:
 * - Three-column when deviceMemory present: [Device | Library | Preview]
 * - Two-column when no device memory: [Library | Preview]
 *
 * Device-agnostic — all device-specific behavior comes from the plugin.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { LoadingBar } from './LoadingBar';
import { CreateFolderDialog } from './CreateFolderDialog';
import { MoveDialog, type MoveDialogDirectory } from './MoveDialog';
import { TreeSection } from './TreeSection';
import type { TreeNode } from './TreeView';

/** Custom MIME type for dragging library items. */
export const LIBRARY_ITEM_MIME = 'application/x-library-item';

/** Serializable drag payload for library tree items. */
export interface LibraryDragPayload {
  categoryId: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  sourcePath: string[];
  meta: Record<string, unknown>;
}
import type {
  DeviceLibraryPlugin,
  DeviceMemoryAction,
  ItemSelection,
  CategoryCallbacks,
  PluginMenuAction,
} from './plugins';
import { ContextMenu, type ContextMenuAction } from './ContextMenu';
import type { OperationProgress } from '@/types/operation-progress';

// =========================================================================
// Types
// =========================================================================

export interface PluginLibraryBrowserProps {
  /** The device library plugin providing all configuration */
  plugin: DeviceLibraryPlugin;

  /** File system handle for the library (null if not connected).
   * Accepts FileSystemDirectoryHandle (native) or StorageDirectoryHandle
   * (sampler-library abstraction). Only checked for truthiness. */
  libraryHandle: { readonly name: string } | null;

  /** Tree data for each category, keyed by categoryId */
  categoryData: Record<string, TreeNode[]>;

  /** Expanded node IDs for each category, keyed by categoryId */
  expandedPaths: Record<string, Set<string>>;

  /** Currently selected item */
  selection: ItemSelection | null;

  /** Called when selection changes */
  onSelectionChange: (selection: ItemSelection | null) => void;

  /** Called when a category's expand state changes */
  onToggleExpand: (categoryId: string, nodeId: string) => void;

  /** Called to refresh library data */
  onRefresh: () => void;

  /** Called when a folder is created */
  onCreateFolder: (categoryId: string, parentPath: string[], name?: string) => Promise<void>;

  /** Called when a node is deleted */
  onDelete: (categoryId: string, node: TreeNode) => Promise<void>;

  /** Called when a node is moved */
  onMove: (categoryId: string, node: TreeNode, targetPath: string[]) => Promise<void>;

  /** Called when a node is renamed */
  onRename: (categoryId: string, node: TreeNode, newName: string) => Promise<void>;

  /** Called when a context menu action is selected. Action IDs are defined
   * by the plugin's ItemTypePlugin.getContextMenuActions(). Built-in actions
   * handled by PluginLibraryBrowser: 'rename', 'delete', 'move'. All others
   * are dispatched to this callback for the consumer to handle. */
  onContextMenuAction?: (categoryId: string, actionId: string, node: TreeNode) => void;

  /** Called when a file is dropped on a category */
  onFileDrop?: (categoryId: string, files: File[], targetPath: string[]) => Promise<void>;

  /** Called to delete multiple selected nodes at once */
  onBatchDelete?: (categoryId: string, nodes: TreeNode[]) => Promise<void>;

  /** Called to move multiple selected nodes at once */
  onBatchMove?: (categoryId: string, nodes: TreeNode[], targetPath: string[]) => Promise<void>;

  /** Called when a custom data item is dropped on a category.
   * targetPath is the directory path within the category (empty for root).
   * Returns true if the drop was handled. */
  onExternalDrop?: (categoryId: string, dataTransfer: DataTransfer, targetPath: string[]) => boolean;

  /** Device memory state (plugin-defined structure, opaque to framework) */
  deviceMemoryState?: unknown;

  /** Called when a device memory action occurs */
  onDeviceMemoryAction?: (action: DeviceMemoryAction) => void;

  /** Preview panel state (plugin-defined structure, opaque to framework) */
  previewState?: unknown;

  /** Whether the library is loading */
  loading?: boolean;

  /** Error message to display */
  error?: string;

  /** Current operation progress */
  operationProgress?: OperationProgress;

  /** Connection status slot (rendered at top of library column) */
  connectionSlot?: React.ReactNode;

  /** Optional sections rendered above plugin categories in the library column.
   * Used for device-specific content that doesn't fit the CategoryPlugin model
   * (e.g., Roland Sets with their two-level selection and lazy manifest loading). */
  headerSections?: React.ReactNode;

  /** Content rendered in its own column to the left of the device memory panel.
   * Use for device-adjacent UI like SCSI disk browsers. */
  devicePanelLeft?: React.ReactNode;
}

// =========================================================================
// PluginLibraryBrowser Component
// =========================================================================

/** Flatten a tree into all nodes (for resolving selected IDs to TreeNode objects). */
function flattenAllNodes(nodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children) result.push(...flattenAllNodes(node.children));
  }
  return result;
}

/** Flatten a tree of nodes into a list of IDs in tree order (for shift-click range). */
function flattenNodeIds(nodes: TreeNode[]): string[] {
  const result: string[] = [];
  for (const node of nodes) {
    if (node.type !== 'directory') result.push(node.id);
    if (node.children) result.push(...flattenNodeIds(node.children));
  }
  return result;
}

/** Flatten a tree of nodes into a list of directories for MoveDialog. */
function flattenDirectories(nodes: TreeNode[], path: string[] = [], depth = 0): MoveDialogDirectory[] {
  const result: MoveDialogDirectory[] = [];
  for (const node of nodes) {
    if (node.type !== 'directory') continue;
    result.push({ id: node.id, name: node.name, path, depth });
    if (node.children) {
      result.push(...flattenDirectories(node.children, [...path, node.name], depth + 1));
    }
  }
  return result;
}

/** Returns true if targetPath is NOT inside the source node's subtree. */
function isValidMoveTarget(sourceNode: TreeNode, sourcePath: string[], targetPath: string[]): boolean {
  const sourceFullPath = [...sourcePath, sourceNode.name].join('/');
  const targetFullPathStr = targetPath.join('/');
  // Can't move to same parent
  if (sourcePath.join('/') === targetFullPathStr) return false;
  // Can't move into self or descendants
  if (targetFullPathStr.startsWith(sourceFullPath + '/') || targetFullPathStr === sourceFullPath) return false;
  return true;
}

// =========================================================================
// Multi-select preview panel
// =========================================================================

function MultiSelectPreview({
  count,
  categoryId,
  selectedIds,
  categoryData,
  plugin,
  onContextMenuAction,
  onBatchMove,
  onBatchDelete,
  clearSelection,
  openMoveDialog,
}: {
  count: number;
  categoryId: string;
  selectedIds: ReadonlySet<string>;
  categoryData: Record<string, TreeNode[]>;
  plugin: DeviceLibraryPlugin;
  onContextMenuAction?: (categoryId: string, actionId: string, node: TreeNode) => void;
  onBatchMove?: (categoryId: string, nodes: TreeNode[], targetPath: string[]) => Promise<void>;
  onBatchDelete?: (categoryId: string, nodes: TreeNode[]) => Promise<void>;
  clearSelection: () => void;
  openMoveDialog: (categoryId: string, node: TreeNode) => void;
}): JSX.Element {
  // Determine item type label from the first selected node
  const data = categoryData[categoryId] ?? [];
  const allNodes = flattenAllNodes(data);
  const selected = allNodes.filter((n) => selectedIds.has(n.id));
  const firstNode = selected[0];

  const category = plugin.categories.find((c) => c.categoryId === categoryId);
  const itemTypePlugin = firstNode && category ? category.itemTypes[firstNode.type] : undefined;
  const typeName = itemTypePlugin?.displayName ?? 'Item';
  const typeLabel = count === 1 ? typeName : `${typeName}s`;

  // Get batchable actions from the item type
  const batchActions: PluginMenuAction[] = [];
  if (itemTypePlugin?.getContextMenuActions && firstNode) {
    const actions = itemTypePlugin.getContextMenuActions(firstNode.meta, firstNode);
    const fileOps = new Set(['rename', 'delete', 'move']);
    for (const action of actions) {
      if ('separator' in action) continue;
      const a = action as PluginMenuAction;
      if (!a.batchable || fileOps.has(a.id)) continue;
      batchActions.push(a);
    }
  }

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold text-gray-100 mb-3">
        {count} {typeLabel} Selected
      </h3>

      <div className="flex gap-2 flex-wrap">
        {batchActions.map((action) => (
          <button
            key={action.id}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
            onClick={() => {
              for (const node of selected) {
                onContextMenuAction?.(categoryId, action.id, node);
              }
              clearSelection();
            }}
          >
            {action.label}
          </button>
        ))}

        {onBatchMove && (
          <button
            className="px-3 py-1.5 text-sm bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
            onClick={() => {
              if (firstNode) openMoveDialog(categoryId, firstNode);
            }}
          >
            Move...
          </button>
        )}

        {onBatchDelete && (
          <button
            className="px-3 py-1.5 text-sm bg-red-700 hover:bg-red-600 text-white rounded transition-colors"
            onClick={() => {
              void onBatchDelete(categoryId, selected);
              clearSelection();
            }}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

export function PluginLibraryBrowser({
  plugin,
  libraryHandle,
  categoryData,
  expandedPaths,
  selection,
  onSelectionChange,
  onToggleExpand,
  onRefresh,
  onCreateFolder,
  onDelete,
  onRename,
  onContextMenuAction,
  onMove,
  onExternalDrop,
  onFileDrop,
  onBatchDelete,
  onBatchMove,
  deviceMemoryState,
  onDeviceMemoryAction,
  previewState,
  loading,
  error,
  operationProgress,
  connectionSlot,
  headerSections,
  devicePanelLeft,
}: PluginLibraryBrowserProps): JSX.Element {
  const hasDeviceMemory = !!plugin.deviceMemory;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputCategoryRef = useRef<string>('');

  // Move dialog state
  const [moveDialog, setMoveDialog] = useState<{
    open: boolean;
    categoryId: string;
    node: TreeNode;
  } | null>(null);

  // Create folder drawer state
  const [createFolderDrawer, setCreateFolderDrawer] = useState<{
    open: boolean;
    categoryId: string;
    parentPath: string[];
  } | null>(null);

  // Multi-select state
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());
  const [multiSelectCategoryId, setMultiSelectCategoryId] = useState<string | null>(null);
  const lastSelectedIdRef = useRef<string | null>(null);

  const handleMultiSelect = useCallback(
    (categoryId: string, node: TreeNode, modifiers: { ctrlKey: boolean; shiftKey: boolean }) => {
      // Multi-select only works within a single category
      if (multiSelectCategoryId && multiSelectCategoryId !== categoryId) {
        // Switching categories — reset
        setMultiSelectedIds(new Set([node.id]));
        setMultiSelectCategoryId(categoryId);
        lastSelectedIdRef.current = node.id;
        return;
      }

      if (modifiers.shiftKey && lastSelectedIdRef.current) {
        // Range select: find all nodes between last selected and current
        const nodes = categoryData[categoryId] ?? [];
        const flatIds = flattenNodeIds(nodes);
        const lastIdx = flatIds.indexOf(lastSelectedIdRef.current);
        const currIdx = flatIds.indexOf(node.id);
        if (lastIdx >= 0 && currIdx >= 0) {
          const start = Math.min(lastIdx, currIdx);
          const end = Math.max(lastIdx, currIdx);
          const rangeIds = flatIds.slice(start, end + 1);
          setMultiSelectedIds(new Set([...multiSelectedIds, ...rangeIds]));
        }
      } else {
        // Toggle select (Ctrl/Cmd)
        const next = new Set(multiSelectedIds);
        if (next.has(node.id)) {
          next.delete(node.id);
        } else {
          next.add(node.id);
        }
        setMultiSelectedIds(next);
        lastSelectedIdRef.current = node.id;
      }
      setMultiSelectCategoryId(categoryId);
    },
    [categoryData, multiSelectedIds, multiSelectCategoryId],
  );

  // Plain click clears multi-selection
  const handleSelect = useCallback(
    (categoryId: string, node: TreeNode) => {
      setMultiSelectedIds(new Set());
      setMultiSelectCategoryId(null);
      lastSelectedIdRef.current = node.id;
      onSelectionChange({
        categoryId,
        node,
        meta: node.meta ?? {},
      });
    },
    [onSelectionChange],
  );

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !onFileDrop) return;
    const categoryId = fileInputCategoryRef.current;
    void onFileDrop(categoryId, Array.from(files), []);
    // Reset so the same file can be selected again
    e.target.value = '';
  }, [onFileDrop]);

  // Create category callbacks factory
  const createCategoryCallbacks = useCallback(
    (categoryId: string): CategoryCallbacks => ({
      refresh: onRefresh,
      createFolder: () => setCreateFolderDrawer({ open: true, categoryId, parentPath: [] }),
      importFiles: () => {
        fileInputCategoryRef.current = categoryId;
        fileInputRef.current?.click();
      },
    }),
    [onRefresh, onCreateFolder],
  );

  // Handle rename with category context
  const handleRename = useCallback(
    (categoryId: string) => async (node: TreeNode, newName: string) => {
      await onRename(categoryId, node, newName);
    },
    [onRename],
  );

  // Handle delete with category context
  const handleDelete = useCallback(
    (categoryId: string) => (node: TreeNode) => {
      onDelete(categoryId, node);
    },
    [onDelete],
  );

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    categoryId: string;
    node: TreeNode;
  } | null>(null);

  // Handle context menu with category context — opens the plugin-driven menu
  const handleContextMenu = useCallback(
    (categoryId: string) => (e: React.MouseEvent, node: TreeNode) => {
      e.preventDefault();
      const category = plugin.categories.find((c) => c.categoryId === categoryId);
      if (!category) return;
      const itemTypePlugin = category.itemTypes[node.type];
      if (!itemTypePlugin?.getContextMenuActions) return;
      const actions = itemTypePlugin.getContextMenuActions(node.meta, node);
      if (actions.length === 0) return;
      setContextMenu({ x: e.clientX, y: e.clientY, categoryId, node });
    },
    [plugin.categories],
  );

  // Is the context menu target part of a multi-selection?
  const isBatchContext = contextMenu
    && multiSelectedIds.size > 1
    && multiSelectedIds.has(contextMenu.node.id)
    && multiSelectCategoryId === contextMenu.categoryId;

  // Build ContextMenuAction[] from plugin actions for the currently open menu
  const contextMenuActions: ContextMenuAction[] = (() => {
    if (!contextMenu) return [];

    // Batch context menu — transfer actions + move + delete for multiple items
    if (isBatchContext) {
      const count = multiSelectedIds.size;
      const { categoryId, node } = contextMenu;
      const actions: ContextMenuAction[] = [];

      // Include transfer actions from the item type plugin (Send to Device, etc.)
      const category = plugin.categories.find((c) => c.categoryId === categoryId);
      if (category) {
        const itemTypePlugin = category.itemTypes[node.type];
        if (itemTypePlugin?.getContextMenuActions) {
          const pluginActions = itemTypePlugin.getContextMenuActions(node.meta, node);
          // Only include batchable actions (not file ops — those are handled below)
          const fileOps = new Set(['rename', 'delete', 'move']);
          for (const action of pluginActions) {
            if ('separator' in action) continue;
            const a = action as PluginMenuAction;
            if (fileOps.has(a.id)) continue;
            if (!a.batchable) continue;
            actions.push({
              label: a.label,
              icon: a.icon,
              onClick: () => {
                // Fire the action for each selected node
                const data = categoryData[categoryId] ?? [];
                const allNodes = flattenAllNodes(data);
                const selected = allNodes.filter((n) => multiSelectedIds.has(n.id));
                for (const n of selected) {
                  onContextMenuAction?.(categoryId, a.id, n);
                }
                setMultiSelectedIds(new Set());
                setMultiSelectCategoryId(null);
              },
            });
          }
        }
      }

      // Move
      if (onBatchMove) {
        if (actions.length > 0) {
          actions.push({ label: '', onClick: () => {}, separator: true });
        }
        actions.push({
          label: `Move ${count} items...`,
          onClick: () => {
            setMoveDialog({ open: true, categoryId, node });
          },
        });
      }

      // Delete
      if (onBatchDelete) {
        if (actions.length > 0) {
          actions.push({ label: '', onClick: () => {}, separator: true });
        }
        actions.push({
          label: `Delete ${count} items`,
          danger: true,
          onClick: () => {
            // Batch delete is triggered from a context menu — the user already
            // chose "Delete N items" deliberately. No second confirmation needed.
            const data = categoryData[categoryId] ?? [];
            const allNodes = flattenAllNodes(data);
            const selected = allNodes.filter((n) => multiSelectedIds.has(n.id));
            void onBatchDelete(categoryId, selected);
            setMultiSelectedIds(new Set());
            setMultiSelectCategoryId(null);
          },
        });
      }
      return actions;
    }

    // Single-item context menu
    const category = plugin.categories.find((c) => c.categoryId === contextMenu.categoryId);
    if (!category) return [];
    const itemTypePlugin = category.itemTypes[contextMenu.node.type];
    if (!itemTypePlugin?.getContextMenuActions) return [];
    const pluginActions = itemTypePlugin.getContextMenuActions(contextMenu.node.meta, contextMenu.node);

    return pluginActions.map((action) => {
      if ('separator' in action) {
        return { label: '---', separator: true, onClick: () => {} };
      }
      const menuAction = action as PluginMenuAction;
      return {
        label: menuAction.label,
        icon: menuAction.icon,
        disabled: menuAction.disabled,
        danger: menuAction.danger,
        onClick: () => {
          const { categoryId, node } = contextMenu;
          if (menuAction.id === 'delete') {
            onDelete(categoryId, node);
          } else if (menuAction.id === 'move') {
            setMoveDialog({ open: true, categoryId, node });
          } else {
            onContextMenuAction?.(categoryId, menuAction.id, node);
          }
        },
      };
    });
  })();

  // Render icon for a node using the appropriate item type plugin
  const renderIcon = useCallback(
    (categoryId: string) => (node: TreeNode, isExpanded: boolean) => {
      const category = plugin.categories.find((c) => c.categoryId === categoryId);
      if (!category) return null;

      // Directories use default folder icon (from TreeView)
      if (node.type === 'directory') return undefined;

      const itemTypePlugin = category.itemTypes[node.type];
      if (!itemTypePlugin) return null;

      const isSelected = selection?.node.id === node.id;
      return itemTypePlugin.renderIcon(node.meta ?? {}, isSelected);
    },
    [plugin.categories, selection],
  );

  // Render trailing content for a node
  const renderTrailing = useCallback(
    (categoryId: string) => (node: TreeNode) => {
      const category = plugin.categories.find((c) => c.categoryId === categoryId);
      if (!category || node.type === 'directory') return null;

      const itemTypePlugin = category.itemTypes[node.type];
      return itemTypePlugin?.renderTrailing?.(node.meta ?? {}) ?? null;
    },
    [plugin.categories],
  );

  // Check if items in a category are draggable
  const isDraggable = useCallback(
    (categoryId: string) => {
      const category = plugin.categories.find((c) => c.categoryId === categoryId);
      if (!category) return false;

      // If any item type is draggable, enable dragging for the category
      return Object.values(category.itemTypes).some((itemType) =>
        itemType.isDraggable({}),
      );
    },
    [plugin.categories],
  );

  // Check if items in a category support rename
  const supportsRename = useCallback(
    (categoryId: string) => {
      const category = plugin.categories.find((c) => c.categoryId === categoryId);
      if (!category || category.isReadOnly) return false;

      // If any item type supports rename, enable it for the category
      return Object.values(category.itemTypes).some((itemType) => itemType.supportsRename);
    },
    [plugin.categories],
  );

  // External drop handling (e.g., disk browser items)
  const [dropTargetCategory, setDropTargetCategory] = useState<string | null>(null);
  const [dropIsMove, setDropIsMove] = useState(false);
  const activeDragRef = useRef<LibraryDragPayload | null>(null);

  const handleSectionDragOver = useCallback(
    (categoryId: string) => (e: React.DragEvent) => {
      // Library-item drag = move to category root (skip if already at root)
      if (e.dataTransfer.types.includes(LIBRARY_ITEM_MIME)) {
        const drag = activeDragRef.current;
        if (drag && drag.sourcePath.length === 0) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDropTargetCategory(categoryId);
        setDropIsMove(true);
        return;
      }
      // External file drops (OS files)
      if (onExternalDrop && e.dataTransfer.types.includes('Files')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDropTargetCategory(categoryId);
        setDropIsMove(false);
      }
    },
    [onExternalDrop],
  );

  const handleSectionDragLeave = useCallback(
    () => (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        setDropTargetCategory(null);
        setDropIsMove(false);
      }
    },
    [],
  );

  const handleSectionDrop = useCallback(
    (categoryId: string) => (e: React.DragEvent) => {
      e.preventDefault();
      setDropTargetCategory(null);
      setDropIsMove(false);
      activeDragRef.current = null;

      // Library-item drop = move to category root
      const raw = e.dataTransfer.getData(LIBRARY_ITEM_MIME);
      if (raw) {
        const payload = JSON.parse(raw) as LibraryDragPayload;
        if (payload.categoryId === categoryId) {
          // Batch move if dragged item is part of a multi-selection
          if (multiSelectedIds.size > 1 && multiSelectedIds.has(payload.nodeId) && onBatchMove) {
            const data = categoryData[categoryId] ?? [];
            const allNodes = flattenAllNodes(data);
            const selected = allNodes.filter((n) => multiSelectedIds.has(n.id));
            void onBatchMove(categoryId, selected, []);
            setMultiSelectedIds(new Set());
            setMultiSelectCategoryId(null);
          } else {
            void onMove(categoryId, {
              id: payload.nodeId,
              name: payload.nodeName,
              type: payload.nodeType,
              children: [],
              meta: { path: payload.sourcePath },
            }, []);
          }
        }
        return;
      }

      // External drop
      onExternalDrop?.(categoryId, e.dataTransfer, []);
    },
    [onExternalDrop, onMove, onBatchMove, multiSelectedIds, multiSelectCategoryId, categoryData],
  );

  // Layout classes
  const layoutClass = hasDeviceMemory
    ? 'ac-plugin-library-browser ac-plugin-library-browser--three-column'
    : 'ac-plugin-library-browser ac-plugin-library-browser--two-column';

  return (
    <div className={layoutClass}>
      {/* Hidden file input for import button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/wav,audio/x-wav,.wav"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {/* Device-adjacent panel (e.g., SCSI disk browser) */}
      {devicePanelLeft && (
        <div className="ac-plugin-library-browser-device-left">
          {devicePanelLeft}
        </div>
      )}

      {/* Device memory panel (if configured) */}
      {hasDeviceMemory && plugin.deviceMemory && (
        <div className="ac-plugin-library-browser-device">
          {plugin.deviceMemory.renderMemoryPanel({
            selectedSlot: null, // Selection is typically managed via customState
            onSelectSlot: (groupId, index) => {
              onDeviceMemoryAction?.({
                type: 'SELECT_SLOT',
                payload: { groupId, index },
              });
            },
            onDragStart: (groupId, index, dragData) => {
              onDeviceMemoryAction?.({
                type: 'DRAG_START',
                payload: { groupId, index, dragData },
              });
            },
            onDrop: (groupId, index, dragData) => {
              onDeviceMemoryAction?.({
                type: 'DROP',
                payload: { groupId, index, dragData },
              });
            },
            // Pass opaque state from consumer to plugin
            customState: deviceMemoryState,
          })}
        </div>
      )}

      {/* Library sections */}
      <div className="ac-plugin-library-browser-library">
        <div className="ac-panel-header">
          <span className="ac-panel-header-title">Library</span>
          <div className="ac-panel-header-actions">
            {connectionSlot}
            <button
              type="button"
              className="ac-panel-refresh-btn"
              onClick={onRefresh}
              title="Refresh library"
            >
              &#x21BB;
            </button>
          </div>
        </div>
        <LoadingBar active={loading ?? false} />

        {loading && (
          <div className="ac-plugin-library-browser-loading">
            <div className="ac-plugin-library-browser-skeleton">
              {plugin.categories.slice(0, 3).map((cat) => (
                <div key={cat.categoryId} className="ac-plugin-library-browser-skeleton-section">
                  <div className="ac-skeleton ac-skeleton-text--short" style={{ marginBottom: '0.5rem' }} />
                  <div className="ac-skeleton ac-skeleton-text--medium" style={{ marginBottom: '0.25rem' }} />
                  <div className="ac-skeleton ac-skeleton-text" style={{ marginBottom: '0.25rem' }} />
                  <div className="ac-skeleton ac-skeleton-text--short" />
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div style={{
            margin: 'var(--ac-space-2) var(--ac-space-3)',
            padding: 'var(--ac-space-2) var(--ac-space-3)',
            background: 'color-mix(in srgb, var(--ac-color-danger) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--ac-color-danger) 30%, transparent)',
            borderRadius: 'var(--ac-radius-sm)',
            fontSize: 'var(--ac-text-sm)',
            color: 'var(--ac-color-danger)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--ac-space-2)',
          }}>
            <span style={{ flex: 1 }}>{error}</span>
            <button
              style={{ background: 'none', border: 'none', color: 'var(--ac-color-danger)', cursor: 'pointer', padding: 0, fontSize: '1rem' }}
              onClick={onRefresh}
              title="Dismiss"
            >&times;</button>
          </div>
        )}

        {!loading && !libraryHandle && (
          <div className="ac-plugin-library-browser-empty-state">
            <svg className="ac-plugin-library-browser-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <p className="ac-plugin-library-browser-empty-text">Connect to a library folder to get started</p>
          </div>
        )}

        {!loading && libraryHandle && (
          <div className="ac-plugin-library-browser-sections">
            {headerSections}
            {plugin.categories.map((category) => (
              <TreeSection
                key={category.categoryId}
                data-testid={`library-${category.categoryId}-section`}
                title={category.title}
                nodes={categoryData[category.categoryId] ?? []}
                category={category.categoryId}
                expandedIds={expandedPaths[category.categoryId] ?? new Set()}
                selectedId={
                  selection?.categoryId === category.categoryId
                    ? selection.node.id
                    : undefined
                }
                onToggleExpand={(nodeId) =>
                  onToggleExpand(category.categoryId, nodeId)
                }
                selectedIds={multiSelectCategoryId === category.categoryId ? multiSelectedIds : undefined}
                selection={{
                  onSelect: (node) => handleSelect(category.categoryId, node),
                  onMultiSelect: (node, mods) => handleMultiSelect(category.categoryId, node, mods),
                }}
                edit={category.isReadOnly ? undefined : {
                  onDelete: handleDelete(category.categoryId),
                  onRename: supportsRename(category.categoryId)
                    ? handleRename(category.categoryId)
                    : undefined,
                  onCreateFolder: (parentNode) =>
                    setCreateFolderDrawer({
                      open: true,
                      categoryId: category.categoryId,
                      parentPath: [...(parentNode.meta?.path as string[] ?? []), parentNode.name],
                    }),
                  enableInlineRename: supportsRename(category.categoryId),
                }}
                contextMenu={{
                  onContextMenu: handleContextMenu(category.categoryId),
                }}
                drag={{
                  draggable: isDraggable(category.categoryId),
                  onDragStart: (node, e) => {
                    const nodePath = (node.meta as Record<string, unknown>)?.path as string[] ?? [];
                    const payload: LibraryDragPayload = {
                      categoryId: category.categoryId,
                      nodeId: node.id,
                      nodeName: node.name,
                      nodeType: node.type,
                      sourcePath: nodePath,
                      meta: node.meta ?? {},
                    };
                    activeDragRef.current = payload;
                    e.dataTransfer.setData(LIBRARY_ITEM_MIME, JSON.stringify(payload));
                    e.dataTransfer.setData(`${LIBRARY_ITEM_MIME}/${node.type}`, '');
                    e.dataTransfer.effectAllowed = 'copyMove';
                  },
                  onTreeDragOver: (targetNode, e) => {
                    // Accept library-item drags for same-category move
                    if (e.dataTransfer.types.includes(LIBRARY_ITEM_MIME)) {
                      const drag = activeDragRef.current;
                      if (drag) {
                        // Don't accept if dropping onto the item's current parent
                        const targetPath = [...((targetNode.meta as Record<string, unknown>)?.path as string[] ?? []), targetNode.name];
                        if (drag.sourcePath.join('/') === targetPath.join('/')) return false;
                        // Don't accept if dropping onto itself or a descendant
                        const sourceFullPath = [...drag.sourcePath, drag.nodeName].join('/');
                        if (targetPath.join('/').startsWith(sourceFullPath)) return false;
                      }
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      return true;
                    }
                    // Accept external drops (disk items, OS files)
                    if (onExternalDrop && e.dataTransfer.types.length > 0) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'copy';
                      return true;
                    }
                    return false;
                  },
                  onTreeDrop: (node, e) => {
                    setDropTargetCategory(null);
                    setDropIsMove(false);
                    activeDragRef.current = null;
                    const nodePath = (node.meta?.path as string[] | undefined) ?? [];
                    const targetPath = [...nodePath, node.name];

                    // Library item move within same category
                    const raw = e.dataTransfer.getData(LIBRARY_ITEM_MIME);
                    if (raw) {
                      const payload = JSON.parse(raw) as LibraryDragPayload;
                      if (payload.categoryId === category.categoryId) {
                        // Batch move if the dragged item is part of a multi-selection
                        if (multiSelectedIds.size > 1 && multiSelectedIds.has(payload.nodeId) && onBatchMove) {
                          const data = categoryData[category.categoryId] ?? [];
                          const allNodes = flattenAllNodes(data);
                          const selected = allNodes.filter((n) => multiSelectedIds.has(n.id));
                          void onBatchMove(category.categoryId, selected, targetPath);
                          setMultiSelectedIds(new Set());
                          setMultiSelectCategoryId(null);
                        } else {
                          void onMove(category.categoryId, {
                            id: payload.nodeId,
                            name: payload.nodeName,
                            type: payload.nodeType,
                            children: [],
                            meta: { path: payload.sourcePath },
                          }, targetPath);
                        }
                      }
                      return;
                    }

                    // External drop
                    if (onExternalDrop) {
                      onExternalDrop(category.categoryId, e.dataTransfer, targetPath);
                    }
                  },
                }}
                render={{
                  renderIcon: renderIcon(category.categoryId),
                  renderTrailing: renderTrailing(category.categoryId),
                }}
                emptyMessage={category.emptyMessage}
                dropMessage={dropIsMove ? 'Move to top level' : (category.dropMessage ?? 'Drop to add')}
                isDragOver={dropTargetCategory === category.categoryId}
                onDragOver={handleSectionDragOver(category.categoryId)}
                onDragLeave={handleSectionDragLeave()}
                onDrop={handleSectionDrop(category.categoryId)}
                headerActions={category.renderHeaderActions?.(
                  createCategoryCallbacks(category.categoryId),
                )}
              />
            ))}
          </div>
        )}

        {operationProgress && (
          <div className="ac-plugin-library-browser-progress">
            <span>{operationProgress.stepLabel}</span>
            {operationProgress.bytesTotalAllSteps > 0 && (
              <div className="ac-progress-bar">
                <div
                  className="ac-progress-bar-fill"
                  style={{ width: `${Math.min(100, (operationProgress.bytesSentAllSteps / operationProgress.bytesTotalAllSteps) * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preview panel */}
      <div className="ac-plugin-library-browser-preview" data-testid="library-preview-panel">
        {multiSelectedIds.size > 1 && multiSelectCategoryId ? (
          <MultiSelectPreview
            count={multiSelectedIds.size}
            categoryId={multiSelectCategoryId}
            selectedIds={multiSelectedIds}
            categoryData={categoryData}
            plugin={plugin}
            onContextMenuAction={onContextMenuAction}
            onBatchMove={onBatchMove}
            onBatchDelete={onBatchDelete}
            clearSelection={() => {
              setMultiSelectedIds(new Set());
              setMultiSelectCategoryId(null);
            }}
            openMoveDialog={(categoryId, node) => setMoveDialog({ open: true, categoryId, node })}
          />
        ) : (
          plugin.previewPanel.renderPreview(selection, {
            isLoading: loading ?? false,
            error: error,
            customState: previewState,
          })
        )}
      </div>

      {/* Context menu (portal-like, positioned absolutely) */}
      {contextMenu && contextMenuActions.length > 0 && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={contextMenuActions}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Move dialog */}
      {moveDialog && (() => {
        const { categoryId } = moveDialog;
        const data = categoryData[categoryId] ?? [];
        const dirs = flattenDirectories(data);
        const isBatchMove = multiSelectedIds.size > 1 && multiSelectCategoryId === categoryId;
        const itemName = isBatchMove ? `${multiSelectedIds.size} items` : moveDialog.node.name;
        const sourcePath = (moveDialog.node.meta as Record<string, unknown>)?.path as string[] ?? [];
        return (
          <MoveDialog
            open={moveDialog.open}
            itemName={itemName}
            directories={dirs}
            isValidTarget={isBatchMove ? undefined : (targetPath) => isValidMoveTarget(moveDialog.node, sourcePath, targetPath)}
            onMove={(targetPath) => {
              if (isBatchMove && onBatchMove) {
                const allNodes = flattenAllNodes(data);
                const selected = allNodes.filter((n) => multiSelectedIds.has(n.id));
                void onBatchMove(categoryId, selected, targetPath);
                setMultiSelectedIds(new Set());
                setMultiSelectCategoryId(null);
              } else {
                void onMove(categoryId, moveDialog.node, targetPath);
              }
              setMoveDialog(null);
            }}
            onCancel={() => setMoveDialog(null)}
          />
        );
      })()}

      {/* Create folder drawer */}
      <CreateFolderDialog
        open={createFolderDrawer?.open ?? false}
        parentPath={createFolderDrawer?.parentPath ?? []}
        onConfirm={(name) => {
          if (createFolderDrawer) {
            void onCreateFolder(createFolderDrawer.categoryId, createFolderDrawer.parentPath, name);
          }
          setCreateFolderDrawer(null);
        }}
        onCancel={() => setCreateFolderDrawer(null)}
      />
    </div>
  );
}
