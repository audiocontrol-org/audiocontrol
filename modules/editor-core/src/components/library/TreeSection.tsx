/**
 * TreeSection component — a collapsible section wrapper for TreeView.
 *
 * Provides:
 * - Section header with title and optional header actions
 * - Drop zone support with custom drop message
 * - Empty state display when no nodes
 * - Wraps TreeView with section-specific callbacks
 *
 * Device-agnostic — consumers provide node data and capability objects.
 */

import React from 'react';
import { TreeView, type TreeNode } from './TreeView';
import type {
  TreeSelectionCapability,
  TreeEditCapability,
  TreeContextMenuCapability,
  TreeDragCapability,
  TreeRenderCapability,
} from '@/components/library/tree-capabilities';

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
  /** Set of selected node IDs (multi-selection) */
  selectedIds?: ReadonlySet<string>;
  /** Called when a directory is toggled */
  onToggleExpand: (nodeId: string) => void;
  /** Selection capabilities (select, multi-select) */
  selection?: TreeSelectionCapability;
  /** Editing capabilities (delete, rename, create folder) */
  edit?: TreeEditCapability;
  /** Context menu capability */
  contextMenu?: TreeContextMenuCapability;
  /** Drag-and-drop capabilities for tree nodes */
  drag?: TreeDragCapability;
  /** Custom rendering capabilities */
  render?: TreeRenderCapability;
  /** Called when something is dropped on a directory node */
  onDropOnDirectory?: (targetPath: string[], dragData: unknown) => void;
  /** Message shown when section has no nodes */
  emptyMessage?: string;
  /** Whether the section is currently a drag target */
  isDragOver?: boolean;
  /** Drag-over handler for the section container */
  onDragOver?: (e: React.DragEvent) => void;
  /** Drag-enter handler for the section container */
  onDragEnter?: (e: React.DragEvent) => void;
  /** Drag-leave handler for the section container */
  onDragLeave?: (e: React.DragEvent) => void;
  /** Drop handler for the section container */
  onDrop?: (e: React.DragEvent) => void;
  /** Message shown in drop zone during drag */
  dropMessage?: string;
  /** Optional actions to render in the header */
  headerActions?: React.ReactNode;
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
  selectedIds,
  onToggleExpand,
  selection,
  edit,
  contextMenu,
  drag,
  render,
  emptyMessage = 'No items',
  isDragOver,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  dropMessage,
  headerActions,
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
      <div className="ac-tree-section-header" data-testid={testId ? `${testId}-header` : undefined}>
        <span className="ac-tree-section-title">{title}</span>
        {isDragOver && dropMessage && (
          <span className="ac-tree-section-drop-hint">
            &mdash; {dropMessage}
          </span>
        )}
        {headerActions && (
          <span className="ac-tree-section-actions" data-testid={testId ? `${testId}-actions` : undefined}>{headerActions}</span>
        )}
      </div>

      {/* Content area */}
      {nodes.length === 0 && !isDragOver ? (
        <div className="ac-tree-section-empty">{emptyMessage}</div>
      ) : (
        <div data-testid={testId ? `${testId}-content` : undefined}>
          <TreeView
            nodes={nodes}
            expandedIds={expandedIds}
            onToggleExpand={onToggleExpand}
            selectedId={selectedId}
            selectedIds={selectedIds}
            selection={selection}
            edit={edit}
            contextMenu={contextMenu}
            drag={drag}
            render={render}
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
