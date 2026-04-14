/**
 * Capability interfaces for tree components.
 *
 * Groups related callbacks into cohesive capability objects,
 * replacing the "optional bag of callbacks" anti-pattern.
 * Each capability represents a distinct behavioral concern
 * that a tree consumer can opt into.
 */

import type React from 'react';
import type { TreeNode } from '@/components/library/TreeView';

/** Selection capabilities for tree nodes */
export interface TreeSelectionCapability {
  onSelect(node: TreeNode): void;
  onMultiSelect?(node: TreeNode, modifiers: { ctrlKey: boolean; shiftKey: boolean }): void;
}

/** Editing capabilities (delete, rename, create folder) */
export interface TreeEditCapability {
  onDelete(node: TreeNode): void;
  onRename?(node: TreeNode, newName: string): Promise<void>;
  onCreateFolder?(parentNode: TreeNode): void;
  /** Whether inline renaming is enabled. Requires onRename to be provided. */
  enableInlineRename?: boolean;
}

/** Context menu capability */
export interface TreeContextMenuCapability {
  onContextMenu(e: React.MouseEvent, node: TreeNode): void;
}

/** Drag-and-drop capabilities for tree nodes */
export interface TreeDragCapability {
  /** Whether nodes are draggable */
  draggable: boolean;
  onDragStart(node: TreeNode, e: React.DragEvent): void;
  onTreeDrop(targetNode: TreeNode, e: React.DragEvent): void;
  onTreeDragOver(targetNode: TreeNode, e: React.DragEvent): boolean;
}

/** Custom rendering for tree nodes */
export interface TreeRenderCapability {
  renderIcon?(node: TreeNode, isExpanded: boolean): React.ReactNode;
  renderTrailing?(node: TreeNode): React.ReactNode;
}
