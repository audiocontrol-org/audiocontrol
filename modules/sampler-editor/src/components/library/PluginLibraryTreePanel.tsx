/**
 * PluginLibraryTreePanel — Plugin-driven library tree panel.
 *
 * Replaces LibraryTreePanel with a plugin-driven implementation that uses
 * the device-agnostic TreeSection component from editor-core.
 *
 * This component handles:
 * - Sets section (device-specific, not in plugin categories)
 * - Plugin-defined categories (tones, patches, drum kits, etc.)
 * - Context menus, inline rename, drag-drop
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { SetInfo, SetYaml, StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import { TreeSection, ContextMenu, type TreeNode } from '@audiocontrol/editor-core';
import type { DeviceLibraryPlugin, ItemSelection } from '@audiocontrol/editor-core';
import {
  loadSetManifest,
  type LibraryTreeNode,
  type LibraryCategory,
} from '@/lib/library-service';
import { cn } from '@/lib/utils';
import { SetItem } from './SetItem';
import type { DeviceDragData, LibraryDragData } from './DeviceMemoryPanel';
import { LIBRARY_MOVE_MIME } from './LibraryTreeNode';

// =========================================================================
// Types
// =========================================================================

interface PluginLibraryTreePanelProps {
  /** Device library plugin */
  plugin: DeviceLibraryPlugin;
  /** File system handle for the library */
  libraryHandle: StorageDirectoryHandle | null;
  /** Sets in the library (not part of plugin categories) */
  sets: SetInfo[];
  /** Tree data for each category, keyed by categoryId */
  categoryData: Record<string, LibraryTreeNode[]>;
  /** Expanded node IDs for each category */
  expandedPaths: Record<string, Set<string>>;
  /** Currently selected item */
  selection: ItemSelection | null;
  /** Called when selection changes */
  onSelectionChange: (selection: ItemSelection | null) => void;
  /** Called when a category's expand state changes */
  onToggleExpand: (categoryId: string, nodeId: string) => void;
  /** Called to refresh library data */
  onRefresh: () => void;
  /** Whether the library is loading */
  isLoading: boolean;

  // Set-specific callbacks
  onSelectSet: (name: string) => void;
  onSelectTone: (name: string, setName: string) => void;
  onSelectPatch: (name: string, setName: string) => void;
  onDeleteSet?: (name: string) => void;
  onRenameSet?: (oldName: string, newName: string) => Promise<void>;

  // Device export drop handlers
  onDropDeviceTone?: (data: DeviceDragData, targetPath?: string[]) => void;
  onDropDevicePatch?: (data: DeviceDragData, targetPath?: string[]) => void;

  // Directory operations
  onCreateDirectory?: (category: LibraryCategory, parentPath: string[]) => void;
  onRenameDirectory?: (category: LibraryCategory, path: string[]) => void;
  onDeleteDirectory?: (category: LibraryCategory, path: string[]) => void;
  onMoveItem?: (category: LibraryCategory, sourcePath: string[], itemName: string) => void;
  onDropMoveItem?: (category: LibraryCategory, sourcePath: string[], itemName: string, targetPath: string[]) => void;
  onRenameItem?: (category: LibraryCategory, path: string[], oldName: string, newName: string, isDirectory: boolean) => Promise<void>;

  // Item deletion
  onDeleteIndividualTone?: (fileName: string, path?: string[]) => void;
  onDeleteIndividualPatch?: (fileName: string, path?: string[]) => void;
  onDeleteDrumKit?: (directoryName: string, path?: string[]) => void;

  // Tool actions
  onOpenInLoopEditor?: (name: string, nodeType: string, path?: string[]) => void;
  onOpenInChopper?: (name: string, nodeType: string, path?: string[]) => void;
  onOpenInSampleEditor?: (name: string, nodeType: string, path?: string[]) => void;
}

// MIME type for device drag data
const DEVICE_DRAG_MIME = 'application/x-s330-device-item';

// =========================================================================
// Context Menu State
// =========================================================================

interface ContextMenuState {
  x: number;
  y: number;
  node: TreeNode;
  categoryId: string;
}

// =========================================================================
// Helper Functions
// =========================================================================

/** Convert LibraryTreeNode to editor-core TreeNode */
function toTreeNode(node: LibraryTreeNode): TreeNode {
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    children: node.children?.map(toTreeNode),
    meta: {
      fileName: node.fileName,
      directoryName: node.directoryName,
      toneCount: node.toneCount,
      kitCount: node.kitCount,
      sampleCount: node.sampleCount,
      path: node.path,
    },
  };
}

/** Map plugin categoryId to LibraryCategory (only for categories that support directory operations) */
function toLibraryCategory(categoryId: string): LibraryCategory {
  switch (categoryId) {
    case 'tones': return 'tones';
    case 'patches': return 'patches';
    case 'drumKits': return 'drum-kits';
    // Note: chopped-samples, common-samples, common-programs don't support directory operations
    // They would need a different handling mechanism if needed in the future
    default: return 'tones';
  }
}

/** Map LibraryCategory to expanded paths key */
function toExpandedPathsKey(categoryId: string): keyof typeof DEFAULT_EXPANDED_PATHS {
  switch (categoryId) {
    case 'tones': return 'tones';
    case 'patches': return 'patches';
    case 'drumKits': return 'drumKits';
    case 'commonSamples': return 'commonSamples';
    default: return 'tones';
  }
}

const DEFAULT_EXPANDED_PATHS = {
  tones: new Set<string>(),
  patches: new Set<string>(),
  drumKits: new Set<string>(),
  commonSamples: new Set<string>(),
};

// =========================================================================
// Component
// =========================================================================

export function PluginLibraryTreePanel({
  plugin,
  libraryHandle,
  sets,
  categoryData,
  expandedPaths,
  selection,
  onSelectionChange,
  onToggleExpand,
  onRefresh,
  isLoading,
  onSelectSet,
  onSelectTone,
  onSelectPatch,
  onDeleteSet,
  onRenameSet,
  onDropDeviceTone,
  onDropDevicePatch,
  onCreateDirectory,
  onDeleteDirectory,
  onMoveItem,
  onDropMoveItem,
  onRenameItem,
  onDeleteIndividualTone,
  onDeleteIndividualPatch,
  onDeleteDrumKit,
  onOpenInLoopEditor,
  onOpenInChopper,
  onOpenInSampleEditor,
}: PluginLibraryTreePanelProps): JSX.Element {
  // Sets section state
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());
  const [manifests, setManifests] = useState<Map<string, SetYaml>>(new Map());
  const [loadingManifests, setLoadingManifests] = useState<Set<string>>(new Set());

  // Drag state for device drops
  const [toneDragOver, setToneDragOver] = useState(false);
  const [patchDragOver, setPatchDragOver] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Toggle set expansion
  const toggleSet = useCallback((name: string) => {
    setExpandedSets((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  // Load manifest when a set is expanded
  useEffect(() => {
    if (!libraryHandle) return;
    for (const setName of expandedSets) {
      if (manifests.has(setName) || loadingManifests.has(setName)) continue;
      setLoadingManifests((prev) => new Set(prev).add(setName));
      loadSetManifest(libraryHandle, setName)
        .then((manifest) => setManifests((prev) => new Map(prev).set(setName, manifest)))
        .catch((err) => console.error(`[PluginLibraryTreePanel] Failed to load manifest for ${setName}:`, err))
        .finally(() => setLoadingManifests((prev) => { const next = new Set(prev); next.delete(setName); return next; }));
    }
  }, [expandedSets, libraryHandle, manifests, loadingManifests]);

  // Convert category data to TreeNode arrays
  const categoryTreeNodes = useMemo(() => {
    const result: Record<string, TreeNode[]> = {};
    for (const [categoryId, nodes] of Object.entries(categoryData)) {
      result[categoryId] = nodes.map(toTreeNode);
    }
    return result;
  }, [categoryData]);

  // Compute selected node ID for a category
  const computeSelectedId = useCallback((categoryId: string): string | undefined => {
    if (!selection || selection.categoryId !== categoryId) return undefined;
    return selection.node.id;
  }, [selection]);

  // Handle node selection
  const handleNodeSelect = useCallback((categoryId: string, node: TreeNode) => {
    onSelectionChange({
      categoryId,
      node,
      meta: node.meta,
    });
  }, [onSelectionChange]);

  // Handle node deletion
  const handleNodeDelete = useCallback((categoryId: string, node: TreeNode) => {
    const meta = node.meta as { fileName?: string; directoryName?: string; path?: string[] };
    const path = meta.path;

    if (node.type === 'tone' && onDeleteIndividualTone) {
      onDeleteIndividualTone(meta.fileName ?? node.name, path);
    } else if (node.type === 'patch' && onDeleteIndividualPatch) {
      onDeleteIndividualPatch(meta.directoryName ?? node.name, path);
    } else if (node.type === 'drum-kit' && onDeleteDrumKit) {
      onDeleteDrumKit(meta.directoryName ?? node.name, path);
    } else if (node.type === 'directory' && onDeleteDirectory) {
      onDeleteDirectory(toLibraryCategory(categoryId), [...(path ?? []), node.name]);
    }
  }, [onDeleteIndividualTone, onDeleteIndividualPatch, onDeleteDrumKit, onDeleteDirectory]);

  // Handle inline rename
  const handleRename = useCallback(async (categoryId: string, node: TreeNode, newName: string) => {
    if (!onRenameItem) return;
    const meta = node.meta as { path?: string[] };
    const isDirectory = node.type === 'directory';
    await onRenameItem(toLibraryCategory(categoryId), meta.path ?? [], node.name, newName, isDirectory);
  }, [onRenameItem]);

  // Handle context menu
  const handleContextMenu = useCallback((categoryId: string, e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node, categoryId });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  // Get context menu actions
  const getContextMenuActions = useCallback(() => {
    if (!contextMenu) return [];

    const { node, categoryId } = contextMenu;
    const category = plugin.categories.find((c) => c.categoryId === categoryId);
    if (!category) return [];

    const itemType = category.itemTypes[node.type];
    if (!itemType?.getContextMenuActions) return [];

    const pluginActions = itemType.getContextMenuActions(node.meta, node);

    // Convert plugin actions to ContextMenu actions with onClick handlers
    // Filter out pure separator objects and convert to ContextMenuAction format
    const result: Array<{ label: string; icon?: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean; separator?: boolean }> = [];

    for (const action of pluginActions) {
      if ('separator' in action && action.separator) {
        // Add separator flag to the next action
        continue;
      }
      if (!('id' in action)) continue;

      const needsSeparator = result.length > 0 &&
        pluginActions[pluginActions.indexOf(action) - 1] &&
        'separator' in pluginActions[pluginActions.indexOf(action) - 1];

      result.push({
        label: action.label,
        icon: action.icon,
        disabled: action.disabled,
        danger: action.danger,
        separator: needsSeparator,
        onClick: () => {
          closeContextMenu();
          if (action.id === 'move' && onMoveItem) {
            const nodeMeta = node.meta as { path?: string[]; fileName?: string; directoryName?: string };
            onMoveItem(toLibraryCategory(categoryId), nodeMeta.path ?? [], nodeMeta.fileName ?? nodeMeta.directoryName ?? node.name);
          } else if (action.id === 'delete') {
            handleNodeDelete(categoryId, node);
          } else if (action.id === 'open-loop-editor' && onOpenInLoopEditor) {
            const nodeMeta = node.meta as { fileName?: string; directoryName?: string; path?: string[] };
            onOpenInLoopEditor(nodeMeta.fileName ?? nodeMeta.directoryName ?? node.name, node.type, nodeMeta.path);
          } else if (action.id === 'open-chopper' && onOpenInChopper) {
            const nodeMeta = node.meta as { fileName?: string; directoryName?: string; path?: string[] };
            onOpenInChopper(nodeMeta.fileName ?? nodeMeta.directoryName ?? node.name, node.type, nodeMeta.path);
          } else if (action.id === 'open-sample-editor' && onOpenInSampleEditor) {
            const nodeMeta = node.meta as { fileName?: string; directoryName?: string; path?: string[] };
            onOpenInSampleEditor(nodeMeta.fileName ?? nodeMeta.directoryName ?? node.name, node.type, nodeMeta.path);
          }
          // Note: rename is handled via inline rename, not context menu action
        },
      });
    }

    return result;
  }, [contextMenu, plugin.categories, closeContextMenu, onMoveItem, handleNodeDelete, onOpenInLoopEditor, onOpenInChopper, onOpenInSampleEditor]);

  // Handle drop on directory
  const handleDropOnDirectory = useCallback((categoryId: string, node: TreeNode, e: React.DragEvent) => {
    const moveData = e.dataTransfer.getData(LIBRARY_MOVE_MIME);
    if (moveData && onDropMoveItem) {
      try {
        const dragData = JSON.parse(moveData) as LibraryDragData;
        const meta = node.meta as { path?: string[] };
        const targetPath = [...(meta.path ?? []), node.name];
        onDropMoveItem(toLibraryCategory(categoryId), dragData.path ?? [], dragData.name, targetPath);
      } catch (err) {
        console.error('[PluginLibraryTreePanel] Failed to parse drop data:', err);
      }
    }
  }, [onDropMoveItem]);

  // Drag handlers for device exports
  const handleToneDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DEVICE_DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleToneDragEnter = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DEVICE_DRAG_MIME)) {
      e.preventDefault();
      setToneDragOver(true);
    }
  }, []);

  const handleToneDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setToneDragOver(false);
    }
  }, []);

  const handleToneDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setToneDragOver(false);
    const jsonData = e.dataTransfer.getData(DEVICE_DRAG_MIME);
    if (jsonData && onDropDeviceTone) {
      try {
        const data = JSON.parse(jsonData) as DeviceDragData;
        if (data.type === 'tone') onDropDeviceTone(data);
      } catch (err) {
        console.error('[PluginLibraryTreePanel] Failed to parse drop data:', err);
      }
    }
  }, [onDropDeviceTone]);

  const handlePatchDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DEVICE_DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handlePatchDragEnter = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DEVICE_DRAG_MIME)) {
      e.preventDefault();
      setPatchDragOver(true);
    }
  }, []);

  const handlePatchDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setPatchDragOver(false);
    }
  }, []);

  const handlePatchDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setPatchDragOver(false);
    const jsonData = e.dataTransfer.getData(DEVICE_DRAG_MIME);
    if (jsonData && onDropDevicePatch) {
      try {
        const data = JSON.parse(jsonData) as DeviceDragData;
        if (data.type === 'patch') onDropDevicePatch(data);
      } catch (err) {
        console.error('[PluginLibraryTreePanel] Failed to parse drop data:', err);
      }
    }
  }, [onDropDevicePatch]);

  // Render icon for a node
  const renderIcon = useCallback((categoryId: string) => (node: TreeNode, _isExpanded: boolean) => {
    const category = plugin.categories.find((c) => c.categoryId === categoryId);
    if (!category || node.type === 'directory') return undefined;
    const itemType = category.itemTypes[node.type];
    if (!itemType) return null;
    const isSelected = selection?.node.id === node.id;
    return itemType.renderIcon(node.meta, isSelected);
  }, [plugin.categories, selection]);

  // Render trailing content for a node
  const renderTrailing = useCallback((categoryId: string) => (node: TreeNode) => {
    const category = plugin.categories.find((c) => c.categoryId === categoryId);
    if (!category || node.type === 'directory') return null;
    const itemType = category.itemTypes[node.type];
    return itemType?.renderTrailing?.(node.meta) ?? null;
  }, [plugin.categories]);

  // No library connected
  if (!libraryHandle) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-s330-accent">
          <h3 className="font-bold text-s330-text">Library</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-s330-muted text-sm">
            <p className="mb-2">No library folder selected</p>
            <p className="text-xs">Click "Select Library Folder" above to connect your library.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-s330-accent">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-s330-text">Library</h3>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className={cn('text-s330-muted hover:text-s330-text transition-colors p-1', isLoading && 'animate-spin')}
            title="Refresh library"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-s330-muted mt-1">
          {sets.length} set{sets.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Sets Section (device-specific, not in plugin) */}
        <div className="p-2">
          <div className="text-xs font-medium text-s330-muted uppercase tracking-wide px-2 py-1">
            Sets
          </div>
          {sets.length === 0 ? (
            <div className="text-sm text-s330-muted/70 px-2 py-4 text-center italic">
              No sets in library
            </div>
          ) : (
            <div className="space-y-0.5">
              {sets.map((setInfo) => (
                <SetItem
                  key={setInfo.name}
                  setInfo={setInfo}
                  manifest={manifests.get(setInfo.name) ?? null}
                  isSelected={selection?.categoryId === 'sets' && selection?.node.name === setInfo.name}
                  isExpanded={expandedSets.has(setInfo.name)}
                  selectedItemName={undefined}
                  selectedItemType={undefined}
                  onToggle={() => toggleSet(setInfo.name)}
                  onSelect={() => onSelectSet(setInfo.name)}
                  onSelectTone={(toneFile) => onSelectTone(toneFile, setInfo.name)}
                  onSelectPatch={(patchFile) => onSelectPatch(patchFile, setInfo.name)}
                  onToneDragStart={() => {}}
                  onPatchDragStart={() => {}}
                  isLoadingManifest={loadingManifests.has(setInfo.name)}
                  onDelete={onDeleteSet ? () => onDeleteSet(setInfo.name) : undefined}
                  onRename={onRenameSet ? (newName) => onRenameSet(setInfo.name, newName) : undefined}
                />
              ))}
            </div>
          )}
        </div>

        {/* Plugin-defined categories */}
        {plugin.categories.map((category) => {
          const nodes = categoryTreeNodes[category.categoryId] ?? [];
          const expanded = expandedPaths[toExpandedPathsKey(category.categoryId)] ?? new Set();

          // Determine drag handlers based on category
          const isDragOver = category.categoryId === 'tones' ? toneDragOver : category.categoryId === 'patches' ? patchDragOver : false;
          const dragHandlers = category.categoryId === 'tones'
            ? { onDragOver: handleToneDragOver, onDragEnter: handleToneDragEnter, onDragLeave: handleToneDragLeave, onDrop: handleToneDrop }
            : category.categoryId === 'patches'
            ? { onDragOver: handlePatchDragOver, onDragEnter: handlePatchDragEnter, onDragLeave: handlePatchDragLeave, onDrop: handlePatchDrop }
            : {};

          return (
            <TreeSection
              key={category.categoryId}
              title={category.title}
              nodes={nodes}
              category={category.categoryId}
              expandedIds={expanded}
              selectedId={computeSelectedId(category.categoryId)}
              onToggleExpand={(nodeId) => onToggleExpand(category.categoryId, nodeId)}
              onSelect={(node) => handleNodeSelect(category.categoryId, node)}
              onDelete={category.isReadOnly ? undefined : (node) => handleNodeDelete(category.categoryId, node)}
              onContextMenu={(e, node) => handleContextMenu(category.categoryId, e, node)}
              onRename={category.isReadOnly ? undefined : (node, newName) => handleRename(category.categoryId, node, newName)}
              enableInlineRename={!category.isReadOnly}
              emptyMessage={category.emptyMessage}
              dropMessage={category.dropMessage}
              isDragOver={isDragOver}
              {...dragHandlers}
              headerActions={
                onCreateDirectory && !category.isReadOnly && (
                  <button
                    onClick={() => onCreateDirectory(toLibraryCategory(category.categoryId), [])}
                    className="text-s330-muted hover:text-s330-text p-0.5"
                    title="New folder"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    </svg>
                  </button>
                )
              }
              renderIcon={renderIcon(category.categoryId)}
              renderTrailing={renderTrailing(category.categoryId)}
              draggable={true}
              onTreeDrop={(node, e) => handleDropOnDirectory(category.categoryId, node, e)}
            />
          );
        })}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={getContextMenuActions()}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}
