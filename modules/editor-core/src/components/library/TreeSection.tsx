/**
 * TreeSection component — a collapsible section wrapper for TreeView.
 *
 * Provides:
 * - Section header with title and optional header actions
 * - Drop zone support with custom drop message
 * - Empty state display when no nodes
 * - Wraps TreeView with section-specific callbacks
 *
 * Device-agnostic — consumers provide node data and callbacks.
 */

import React from 'react';
import { TreeView, type TreeNode } from './TreeView';

// =========================================================================
// Types
// =========================================================================

export interface TreeSectionProps {
  /** Section header title */
  title: string;
  /** Nodes to render in this section */
  nodes: TreeNode[];
  /** Category identifier for this section */
  category: string;
  /** Test ID for e2e testing */
  'data-testid'?: string;
  /** Set of expanded node IDs */
  expandedIds: Set<string>;
  /** Currently selected node ID */
  selectedId?: string;
  /** Called when a directory is toggled */
  onToggleExpand: (nodeId: string) => void;
  /** Called when a node is selected */
  onSelect: (node: TreeNode) => void;
  /** Called when a node's delete button is clicked */
  onDelete?: (node: TreeNode) => void;
  /** Called on right-click with screen position */
  onContextMenu?: (e: React.MouseEvent, node: TreeNode) => void;
  /** Called when something is dropped on a directory node */
  onDropOnDirectory?: (targetPath: string[], dragData: unknown) => void;
  /** Called when a node is renamed via inline editing */
  onRename?: (node: TreeNode, newName: string) => Promise<void>;
  /** Message shown when section has no nodes */
  emptyMessage?: string;
  /** Whether the section is currently a drag target */
  isDragOver?: boolean;
  /** Drag-over handler for the section */
  onDragOver?: (e: React.DragEvent) => void;
  /** Drag-enter handler for the section */
  onDragEnter?: (e: React.DragEvent) => void;
  /** Drag-leave handler for the section */
  onDragLeave?: (e: React.DragEvent) => void;
  /** Drop handler for the section */
  onDrop?: (e: React.DragEvent) => void;
  /** Message shown in drop zone during drag */
  dropMessage?: string;
  /** Optional actions to render in the header */
  headerActions?: React.ReactNode;
  /** Custom icon renderer for nodes */
  renderIcon?: (node: TreeNode, isExpanded: boolean) => React.ReactNode;
  /** Custom trailing content renderer for nodes */
  renderTrailing?: (node: TreeNode) => React.ReactNode;
  /** Whether inline renaming is enabled */
  enableInlineRename?: boolean;
  /** Called when the add-folder button is clicked on a directory */
  onCreateFolder?: (parentNode: TreeNode) => void;
  /** Whether nodes are draggable */
  draggable?: boolean;
  /** Called when drag starts on a node */
  onDragStart?: (node: TreeNode, e: React.DragEvent) => void;
  /** Called when something is dropped on a directory (TreeView level) */
  onTreeDrop?: (targetNode: TreeNode, e: React.DragEvent) => void;
  /** Called during drag-over on a directory (TreeView level) */
  onTreeDragOver?: (targetNode: TreeNode, e: React.DragEvent) => boolean;
}

// =========================================================================
// TreeSection Component
// =========================================================================

export function TreeSection({
  title,
  nodes,
  category,
  'data-testid': testId,
  expandedIds,
  selectedId,
  onToggleExpand,
  onSelect,
  onDelete,
  onContextMenu,
  onRename,
  emptyMessage = 'No items',
  isDragOver,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  dropMessage,
  headerActions,
  renderIcon,
  renderTrailing,
  enableInlineRename,
  onCreateFolder,
  draggable,
  onDragStart,
  onTreeDrop,
  onTreeDragOver,
}: TreeSectionProps): JSX.Element {
  const sectionClasses = [
    'ac-tree-section',
    isDragOver ? 'ac-tree-section--drag-over' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={sectionClasses}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      data-category={category}
      data-testid={testId}
    >
      {/* Section header */}
      <div className="ac-tree-section-header">
        <span className="ac-tree-section-title">{title}</span>
        {isDragOver && dropMessage && (
          <span className="ac-tree-section-drop-hint">
            — {dropMessage}
          </span>
        )}
        {headerActions && (
          <span className="ac-tree-section-actions">{headerActions}</span>
        )}
      </div>

      {/* Content area */}
      {nodes.length === 0 && !isDragOver ? (
        <div className="ac-tree-section-empty">{emptyMessage}</div>
      ) : (
        <div data-testid={testId ? `${testId.replace('-tab', '-list')}` : undefined}>
          <TreeView
            nodes={nodes}
            expandedIds={expandedIds}
            onToggleExpand={onToggleExpand}
            selectedId={selectedId}
            onSelect={onSelect}
            onContextMenu={onContextMenu}
            onDrop={onTreeDrop}
            onDragOver={onTreeDragOver}
            renderIcon={renderIcon}
            renderTrailing={renderTrailing}
            onDelete={onDelete}
            onCreateFolder={onCreateFolder}
            draggable={draggable}
            onDragStart={onDragStart}
            onRename={onRename}
            enableInlineRename={enableInlineRename}
          />
        </div>
      )}

      {/* Drop zone indicator */}
      {isDragOver && dropMessage && (
        <div className="ac-tree-section-dropzone">
          {dropMessage}
        </div>
      )}
    </div>
  );
}
