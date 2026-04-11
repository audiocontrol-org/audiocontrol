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
  onCreateFolder: (categoryId: string, parentPath: string[]) => Promise<void>;

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
      createFolder: () => onCreateFolder(categoryId, []),
      importFiles: () => {
        fileInputCategoryRef.current = categoryId;
        fileInputRef.current?.click();
      },
    }),
    [onRefresh, onCreateFolder],
  );

  // Handle node selection
  const handleSelect = useCallback(
    (categoryId: string, node: TreeNode) => {
      onSelectionChange({
        categoryId,
        node,
        meta: node.meta,
      });
    },
    [onSelectionChange],
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

  // Build ContextMenuAction[] from plugin actions for the currently open menu
  const contextMenuActions: ContextMenuAction[] = (() => {
    if (!contextMenu) return [];
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

  const handleSectionDragOver = useCallback(
    (categoryId: string) => (e: React.DragEvent) => {
      if (!onExternalDrop) return;
      // Only accept drags that have custom data types (not plain OS file drags
      // unless we specifically handle those elsewhere)
      if (e.dataTransfer.types.length === 0) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDropTargetCategory(categoryId);
    },
    [onExternalDrop],
  );

  const handleSectionDragLeave = useCallback(
    () => (e: React.DragEvent) => {
      // Only clear if leaving the section entirely (not entering a child)
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        setDropTargetCategory(null);
      }
    },
    [],
  );

  const handleSectionDrop = useCallback(
    (categoryId: string) => (e: React.DragEvent) => {
      e.preventDefault();
      setDropTargetCategory(null);
      onExternalDrop?.(categoryId, e.dataTransfer, []);
    },
    [onExternalDrop],
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
        {connectionSlot && (
          <div className="ac-plugin-library-browser-connection">
            {connectionSlot}
          </div>
        )}

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

        {!loading && error && (
          <div className="ac-plugin-library-browser-error-state">
            <svg className="ac-plugin-library-browser-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="ac-plugin-library-browser-error-message">{error}</p>
            <button className="ac-library-connection-btn" onClick={onRefresh}>Retry</button>
          </div>
        )}

        {!loading && !error && !libraryHandle && (
          <div className="ac-plugin-library-browser-empty-state">
            <svg className="ac-plugin-library-browser-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <p className="ac-plugin-library-browser-empty-text">Connect to a library folder to get started</p>
          </div>
        )}

        {!loading && !error && libraryHandle && (
          <div className="ac-plugin-library-browser-sections">
            <div className="ac-plugin-library-browser-toolbar">
              <button
                type="button"
                className="ac-plugin-library-browser-refresh-btn"
                onClick={onRefresh}
                title="Refresh library"
              >
                &#x21BB;
              </button>
            </div>
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
                onSelect={(node) => handleSelect(category.categoryId, node)}
                onDelete={
                  category.isReadOnly
                    ? undefined
                    : handleDelete(category.categoryId)
                }
                onContextMenu={handleContextMenu(category.categoryId)}
                onRename={
                  supportsRename(category.categoryId)
                    ? handleRename(category.categoryId)
                    : undefined
                }
                enableInlineRename={supportsRename(category.categoryId)}
                emptyMessage={category.emptyMessage}
                dropMessage={category.dropMessage ?? 'Drop to add'}
                isDragOver={dropTargetCategory === category.categoryId}
                onDragOver={handleSectionDragOver(category.categoryId)}
                onDragLeave={handleSectionDragLeave()}
                onDrop={handleSectionDrop(category.categoryId)}
                onTreeDragOver={(_node, e) => {
                  // Accept library-item drags for same-category move
                  if (e.dataTransfer.types.includes(LIBRARY_ITEM_MIME)) {
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
                }}
                onTreeDrop={(node, e) => {
                  const nodePath = (node.meta?.path as string[] | undefined) ?? [];
                  const targetPath = [...nodePath, node.name];

                  // Library item move within same category
                  const raw = e.dataTransfer.getData(LIBRARY_ITEM_MIME);
                  if (raw) {
                    const payload = JSON.parse(raw) as LibraryDragPayload;
                    if (payload.categoryId === category.categoryId) {
                      void onMove(category.categoryId, {
                        id: payload.nodeId,
                        name: payload.nodeName,
                        type: payload.nodeType,
                        children: [],
                        meta: { path: payload.sourcePath },
                      }, targetPath);
                    }
                    return;
                  }

                  // External drop
                  if (onExternalDrop) {
                    onExternalDrop(category.categoryId, e.dataTransfer, targetPath);
                  }
                }}
                headerActions={category.renderHeaderActions?.(
                  createCategoryCallbacks(category.categoryId),
                )}
                renderIcon={renderIcon(category.categoryId)}
                renderTrailing={renderTrailing(category.categoryId)}
                draggable={isDraggable(category.categoryId)}
                onDragStart={(node, e) => {
                  const nodePath = (node.meta as Record<string, unknown>)?.path as string[] ?? [];
                  const payload: LibraryDragPayload = {
                    categoryId: category.categoryId,
                    nodeId: node.id,
                    nodeName: node.name,
                    nodeType: node.type,
                    sourcePath: nodePath,
                    meta: node.meta ?? {},
                  };
                  e.dataTransfer.setData(LIBRARY_ITEM_MIME, JSON.stringify(payload));
                  // Set a type-specific hint so drop zones can filter during
                  // dragover (browsers allow reading types but not data).
                  e.dataTransfer.setData(`${LIBRARY_ITEM_MIME}/${node.type}`, '');
                  e.dataTransfer.effectAllowed = 'copyMove';
                }}
                onCreateFolder={
                  category.isReadOnly
                    ? undefined
                    : (parentNode) =>
                        onCreateFolder(
                          category.categoryId,
                          [...(parentNode.meta?.path as string[] ?? []), parentNode.name],
                        )
                }
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
        {plugin.previewPanel.renderPreview(selection, {
          isLoading: loading ?? false,
          error: error,
          customState: previewState,
        })}
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
        const data = categoryData[moveDialog.categoryId] ?? [];
        const dirs = flattenDirectories(data);
        const sourcePath = (moveDialog.node.meta as Record<string, unknown>)?.path as string[] ?? [];
        return (
          <MoveDialog
            open={moveDialog.open}
            itemName={moveDialog.node.name}
            directories={dirs}
            isValidTarget={(targetPath) => isValidMoveTarget(moveDialog.node, sourcePath, targetPath)}
            onMove={(targetPath) => {
              void onMove(moveDialog.categoryId, moveDialog.node, targetPath);
              setMoveDialog(null);
            }}
            onCancel={() => setMoveDialog(null)}
          />
        );
      })()}
    </div>
  );
}
