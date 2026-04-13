/**
 * useLibraryTreeCapabilities
 *
 * Adapts Roland-specific tree callbacks into editor-core's capability objects
 * (TreeDragCapability, TreeSelectionCapability, TreeEditCapability, etc.).
 * This allows LibraryTreePanel to use editor-core's shared TreeSection
 * instead of the Roland-specific duplicate.
 */

import React, { useMemo, useCallback } from 'react';
import type {
  TreeNode,
  TreeSelectionCapability,
  TreeEditCapability,
  TreeContextMenuCapability,
  TreeDragCapability,
  TreeRenderCapability,
} from '@audiocontrol/editor-core';
import type { LibraryTreeNode } from '@/lib/library-service';
import { isValidMoveTarget } from '@audiocontrol/sampler-library/browser';
import {
  LIBRARY_ITEM_MIME,
  buildRolandDragPayload,
} from '@/lib/library-drag-types';
import { FolderIcon, WaveIcon, PatchIcon } from '@/components/library/LibraryTreeIcons';

/** MIME type for within-tree library move operations */
const LIBRARY_MOVE_MIME = 'application/x-s330-library-move';

// =========================================================================
// Type narrowing
// =========================================================================

/**
 * Type guard to narrow a TreeNode to LibraryTreeNode.
 *
 * LibraryTreeNode (from sampler-library) is a structural superset of TreeNode
 * (from editor-core) with additional fields like `path`, `fileName`, and
 * `directoryName`. Since the nodes passed to TreeSection are always
 * LibraryTreeNode[], the runtime objects will always satisfy this guard.
 */
function isLibraryTreeNode(node: TreeNode): node is LibraryTreeNode {
  return 'path' in node && Array.isArray((node as Record<string, unknown>)['path']);
}

/**
 * Narrows a TreeNode to LibraryTreeNode, throwing if the guard fails.
 * This should never throw at runtime because LibraryTreePanel always
 * passes LibraryTreeNode[] as the nodes prop.
 */
function requireLibraryNode(node: TreeNode): LibraryTreeNode {
  if (!isLibraryTreeNode(node)) {
    throw new Error(
      `Expected LibraryTreeNode but received a TreeNode without 'path'. Node id: ${node.id}`
    );
  }
  return node;
}

// =========================================================================
// Drag data types (internal to within-tree moves)
// =========================================================================

interface LibraryMoveData {
  source: 'library';
  type: string;
  name: string;
  path: string[];
}

// =========================================================================
// Hook interface
// =========================================================================

type CategoryId = 'tones' | 'patches' | 'samples';

export interface UseLibraryTreeCapabilitiesParams {
  category: CategoryId;
  onSelect: (node: LibraryTreeNode, category: CategoryId) => void;
  onDelete?: (node: LibraryTreeNode, category: CategoryId) => void;
  onContextMenu?: (
    e: React.MouseEvent,
    node: LibraryTreeNode,
    category: CategoryId,
  ) => void;
  onDropOnDirectory?: (
    category: CategoryId,
    targetPath: string[],
    dragData: LibraryMoveData,
  ) => void;
  onRename?: (
    category: CategoryId,
    node: LibraryTreeNode,
    newName: string,
  ) => Promise<void>;
}

export interface LibraryTreeCapabilities {
  selection: TreeSelectionCapability;
  edit: TreeEditCapability | undefined;
  contextMenu: TreeContextMenuCapability | undefined;
  drag: TreeDragCapability;
  render: TreeRenderCapability;
}

export function useLibraryTreeCapabilities({
  category,
  onSelect,
  onDelete,
  onContextMenu,
  onDropOnDirectory,
  onRename,
}: UseLibraryTreeCapabilitiesParams): LibraryTreeCapabilities {
  // -----------------------------------------------------------------------
  // Selection
  // -----------------------------------------------------------------------
  const selection: TreeSelectionCapability = useMemo(
    () => ({
      onSelect(node: TreeNode) {
        onSelect(requireLibraryNode(node), category);
      },
    }),
    [category, onSelect],
  );

  // -----------------------------------------------------------------------
  // Edit
  // -----------------------------------------------------------------------
  const edit: TreeEditCapability | undefined = useMemo(() => {
    if (!onDelete && !onRename) return undefined;

    const capability: TreeEditCapability = {
      onDelete(node: TreeNode) {
        if (!onDelete) {
          throw new Error('onDelete called but no handler was provided');
        }
        onDelete(requireLibraryNode(node), category);
      },
    };

    if (onRename) {
      capability.enableInlineRename = true;
      capability.onRename = async (node: TreeNode, newName: string) => {
        await onRename(category, requireLibraryNode(node), newName);
      };
    }

    return capability;
  }, [category, onDelete, onRename]);

  // -----------------------------------------------------------------------
  // Context menu
  // -----------------------------------------------------------------------
  const contextMenu: TreeContextMenuCapability | undefined = useMemo(() => {
    if (!onContextMenu) return undefined;
    return {
      onContextMenu(e: React.MouseEvent, node: TreeNode) {
        onContextMenu(e, requireLibraryNode(node), category);
      },
    };
  }, [category, onContextMenu]);

  // -----------------------------------------------------------------------
  // Drag (within-tree moves + library-to-device drag)
  // -----------------------------------------------------------------------
  const handleDragStart = useCallback(
    (node: TreeNode, e: React.DragEvent) => {
      const libNode = requireLibraryNode(node);

      // Build move data for within-tree moves
      const moveData: LibraryMoveData = {
        source: 'library',
        type: libNode.type,
        name: libNode.fileName ?? libNode.directoryName ?? libNode.name,
        path: libNode.path,
      };
      e.dataTransfer.setData(LIBRARY_MOVE_MIME, JSON.stringify(moveData));

      // Also set the canonical library item MIME for library-to-device drag
      const payload = buildRolandDragPayload({
        categoryId: category,
        nodeId: libNode.id,
        nodeName:
          libNode.fileName ?? libNode.directoryName ?? libNode.name,
        nodeType: libNode.type,
        sourcePath: libNode.path,
      });
      e.dataTransfer.setData(LIBRARY_ITEM_MIME, JSON.stringify(payload));
      e.dataTransfer.effectAllowed = 'copyMove';
    },
    [category],
  );

  const handleTreeDragOver = useCallback(
    (_node: TreeNode, e: React.DragEvent): boolean => {
      return e.dataTransfer.types.includes(LIBRARY_MOVE_MIME);
    },
    [],
  );

  const handleTreeDrop = useCallback(
    (targetNode: TreeNode, e: React.DragEvent) => {
      const libTarget = requireLibraryNode(targetNode);
      const jsonData = e.dataTransfer.getData(LIBRARY_MOVE_MIME);
      if (!jsonData) return;

      try {
        const dragData = JSON.parse(jsonData) as LibraryMoveData;
        const targetPath = [...libTarget.path, libTarget.name];
        const sourcePath = dragData.path;

        if (!isValidMoveTarget(sourcePath, dragData.name, targetPath)) {
          return;
        }

        onDropOnDirectory?.(category, targetPath, dragData);
      } catch (err) {
        console.error(
          '[useLibraryTreeCapabilities] Failed to parse drop data:',
          err,
        );
      }
    },
    [category, onDropOnDirectory],
  );

  const drag: TreeDragCapability = useMemo(
    () => ({
      draggable: true,
      onDragStart: handleDragStart,
      onTreeDrop: handleTreeDrop,
      onTreeDragOver: handleTreeDragOver,
    }),
    [handleDragStart, handleTreeDrop, handleTreeDragOver],
  );

  // -----------------------------------------------------------------------
  // Render (icons + trailing metadata)
  // -----------------------------------------------------------------------

  /** Style for trailing metadata (e.g. tone count) */
  const trailingStyle: React.CSSProperties = {
    fontSize: 'var(--ac-text-xs)',
    color: 'var(--ac-color-text-muted)',
  };

  const render: TreeRenderCapability = useMemo(
    () => ({
      renderIcon(node: TreeNode, isExpanded: boolean): React.ReactNode {
        if (node.type === 'directory') {
          return <FolderIcon isOpen={isExpanded} />;
        }
        if (node.type === 'tone' || node.type === 'sample') {
          return <WaveIcon />;
        }
        if (node.type === 'patch' || node.type === 'program') {
          return <PatchIcon />;
        }
        return null;
      },

      renderTrailing(node: TreeNode): React.ReactNode {
        if (!isLibraryTreeNode(node)) return null;
        if (node.type === 'patch' && node.toneCount !== undefined) {
          return (
            <span style={trailingStyle}>
              {node.toneCount} tone{node.toneCount !== 1 ? 's' : ''}
            </span>
          );
        }
        return null;
      },
    }),
    [],
  );

  return { selection, edit, contextMenu, drag, render };
}
