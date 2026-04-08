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

import React, { useCallback, useState } from 'react';
import { TreeSection } from './TreeSection';
import type { TreeNode } from './TreeView';
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
}

// =========================================================================
// PluginLibraryBrowser Component
// =========================================================================

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
  deviceMemoryState,
  onDeviceMemoryAction,
  previewState,
  loading,
  error,
  operationProgress,
  connectionSlot,
  headerSections,
}: PluginLibraryBrowserProps): JSX.Element {
  const hasDeviceMemory = !!plugin.deviceMemory;

  // Create category callbacks factory
  const createCategoryCallbacks = useCallback(
    (categoryId: string): CategoryCallbacks => ({
      refresh: onRefresh,
      createFolder: () => onCreateFolder(categoryId, []),
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
      return itemTypePlugin.renderIcon(node.meta, isSelected);
    },
    [plugin.categories, selection],
  );

  // Render trailing content for a node
  const renderTrailing = useCallback(
    (categoryId: string) => (node: TreeNode) => {
      const category = plugin.categories.find((c) => c.categoryId === categoryId);
      if (!category || node.type === 'directory') return null;

      const itemTypePlugin = category.itemTypes[node.type];
      return itemTypePlugin?.renderTrailing?.(node.meta) ?? null;
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

  // Layout classes
  const layoutClass = hasDeviceMemory
    ? 'ac-plugin-library-browser ac-plugin-library-browser--three-column'
    : 'ac-plugin-library-browser ac-plugin-library-browser--two-column';

  return (
    <div className={layoutClass}>
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

        {loading && (
          <div className="ac-plugin-library-browser-loading">
            Loading library...
          </div>
        )}

        {error && (
          <div className="ac-plugin-library-browser-error">
            {error}
          </div>
        )}

        {!loading && !error && !libraryHandle && (
          <div className="ac-plugin-library-browser-empty">
            Connect to a library folder to get started.
          </div>
        )}

        {!loading && !error && libraryHandle && (
          <div className="ac-plugin-library-browser-sections">
            {headerSections}
            {plugin.categories.map((category) => (
              <TreeSection
                key={category.categoryId}
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
                dropMessage={category.dropMessage}
                headerActions={category.renderHeaderActions?.(
                  createCategoryCallbacks(category.categoryId),
                )}
                renderIcon={renderIcon(category.categoryId)}
                renderTrailing={renderTrailing(category.categoryId)}
                draggable={isDraggable(category.categoryId)}
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
            {operationProgress.stepLabel}
          </div>
        )}
      </div>

      {/* Preview panel */}
      <div className="ac-plugin-library-browser-preview">
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
    </div>
  );
}
