/**
 * Generic recursive tree view component.
 *
 * Renders a tree of nodes with expand/collapse, selection,
 * optional drag-drop zones, and optional context menu trigger.
 * Device-agnostic — consumers provide node data and callbacks.
 */

import React, { useCallback, useState } from 'react';
import { ChevronIcon, FolderIcon, DeleteIcon } from './TreeIcons';

// =========================================================================
// Types
// =========================================================================

export interface TreeNode {
  id: string;
  name: string;
  type: 'directory' | string;
  children?: TreeNode[];
  /** Arbitrary metadata for consumer rendering */
  meta?: Record<string, unknown>;
}

export interface TreeViewProps {
  nodes: TreeNode[];
  /** Set of expanded node IDs. If omitted, internal state is used. */
  expandedIds?: Set<string>;
  /** Called when a directory is toggled. Required if expandedIds is controlled. */
  onToggleExpand?: (nodeId: string) => void;
  /** Currently selected node ID */
  selectedId?: string;
  /** Called when a non-directory node is clicked */
  onSelect?: (node: TreeNode) => void;
  /** Called on right-click with screen position */
  onContextMenu?: (e: React.MouseEvent, node: TreeNode) => void;
  /** Called when something is dropped on a directory node */
  onDrop?: (targetNode: TreeNode, e: React.DragEvent) => void;
  /** Called during drag-over on a directory to determine if drop is allowed.
   *  Return true (or omit) to allow, false to prevent. */
  onDragOver?: (targetNode: TreeNode, e: React.DragEvent) => boolean;
  /** Render a custom icon for a node. Falls back to FolderIcon for directories. */
  renderIcon?: (node: TreeNode, isExpanded: boolean) => React.ReactNode;
  /** Render trailing content (metadata, action buttons) after the node name */
  renderTrailing?: (node: TreeNode) => React.ReactNode;
  /** Whether nodes (non-directory) are draggable */
  draggable?: boolean;
  /** Called when drag starts on a non-directory node */
  onDragStart?: (node: TreeNode, e: React.DragEvent) => void;
  /** Called when a node's delete button is clicked. When provided, renders a
   *  delete button on hover for each node. */
  onDelete?: (node: TreeNode) => void;
  /** Depth indentation in pixels per level. Default: 16. */
  indentPx?: number;
  /** Message shown for empty directories. Default: 'Empty folder'. */
  emptyDirectoryMessage?: string;
}

// =========================================================================
// TreeNodeRow — single node renderer
// =========================================================================

interface TreeNodeRowProps {
  node: TreeNode;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  onToggleExpand: (nodeId: string) => void;
  onSelect?: (node: TreeNode) => void;
  onContextMenu?: (e: React.MouseEvent, node: TreeNode) => void;
  onDrop?: (targetNode: TreeNode, e: React.DragEvent) => void;
  onDragOver?: (targetNode: TreeNode, e: React.DragEvent) => boolean;
  renderIcon?: (node: TreeNode, isExpanded: boolean) => React.ReactNode;
  renderTrailing?: (node: TreeNode) => React.ReactNode;
  draggable?: boolean;
  onDragStart?: (node: TreeNode, e: React.DragEvent) => void;
  onDelete?: (node: TreeNode) => void;
  indentPx: number;
  emptyDirectoryMessage: string;
  expandedIds: Set<string>;
  selectedId?: string;
}

function TreeNodeRow({
  node,
  depth,
  isExpanded,
  isSelected,
  onToggleExpand,
  onSelect,
  onContextMenu,
  onDrop,
  onDragOver,
  renderIcon,
  renderTrailing,
  draggable,
  onDragStart,
  onDelete,
  indentPx,
  emptyDirectoryMessage,
  expandedIds,
  selectedId,
}: TreeNodeRowProps): JSX.Element {
  const [isDragOver, setIsDragOver] = useState(false);
  const isDirectory = node.type === 'directory';
  const isDraggable = draggable && !isDirectory;
  const paddingLeft = depth * indentPx + 8;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDirectory) {
      onToggleExpand(node.id);
    } else {
      onSelect?.(node);
    }
  }, [node, isDirectory, onToggleExpand, onSelect]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(e, node);
  }, [node, onContextMenu]);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (!isDraggable) {
      e.preventDefault();
      return;
    }
    onDragStart?.(node, e);
  }, [node, isDraggable, onDragStart]);

  const handleDragOverEvent = useCallback((e: React.DragEvent) => {
    if (!isDirectory) return;
    const allowed = onDragOver ? onDragOver(node, e) : true;
    if (allowed) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
    }
  }, [node, isDirectory, onDragOver]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!isDirectory) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, [isDirectory]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!isDirectory) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const { clientX: x, clientY: y } = e;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false);
    }
  }, [isDirectory]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    if (!isDirectory) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    onDrop?.(node, e);
  }, [node, isDirectory, onDrop]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isDirectory) {
        onToggleExpand(node.id);
      } else {
        onSelect?.(node);
      }
    }
  }, [node, isDirectory, onToggleExpand, onSelect]);

  const icon = renderIcon
    ? renderIcon(node, isExpanded)
    : isDirectory
      ? <FolderIcon isOpen={isExpanded} />
      : null;

  const stateClass = isSelected
    ? 'ac-tree-node--selected'
    : isDragOver
      ? 'ac-tree-node--drag-over'
      : '';

  return (
    <div>
      <div
        className={`ac-tree-node ${stateClass}`}
        style={{ paddingLeft }}
        onClick={handleClick}
        onContextMenu={onContextMenu ? handleContextMenu : undefined}
        onKeyDown={handleKeyDown}
        draggable={isDraggable}
        onDragStart={isDraggable ? handleDragStart : undefined}
        onDragOver={isDirectory ? handleDragOverEvent : undefined}
        onDragEnter={isDirectory ? handleDragEnter : undefined}
        onDragLeave={isDirectory ? handleDragLeave : undefined}
        onDrop={isDirectory ? handleDrop : undefined}
        role="treeitem"
        tabIndex={0}
        aria-expanded={isDirectory ? isExpanded : undefined}
      >
        {isDirectory && (
          <span
            className="ac-tree-chevron-btn"
            onClick={(e) => { e.stopPropagation(); onToggleExpand(node.id); }}
          >
            <ChevronIcon isExpanded={isExpanded} />
          </span>
        )}

        {icon}

        <span className="ac-tree-node-name">{node.name}</span>

        {renderTrailing?.(node)}

        {onDelete && (
          <button
            className="ac-tree-delete-btn"
            onClick={(e) => { e.stopPropagation(); onDelete(node); }}
            title={`Delete ${node.name}`}
          >
            <DeleteIcon />
          </button>
        )}
      </div>

      {/* Children for expanded directories */}
      {isDirectory && isExpanded && node.children && node.children.length > 0 && (
        <div className="ac-tree-children">
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              isExpanded={expandedIds.has(child.id)}
              isSelected={selectedId === child.id}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              onDrop={onDrop}
              onDragOver={onDragOver}
              renderIcon={renderIcon}
              renderTrailing={renderTrailing}
              draggable={draggable}
              onDragStart={onDragStart}
              onDelete={onDelete}
              indentPx={indentPx}
              emptyDirectoryMessage={emptyDirectoryMessage}
              expandedIds={expandedIds}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}

      {/* Empty directory message */}
      {isDirectory && isExpanded && (!node.children || node.children.length === 0) && (
        <div
          className="ac-tree-empty"
          style={{ paddingLeft: paddingLeft + 20 }}
        >
          {emptyDirectoryMessage}
        </div>
      )}
    </div>
  );
}

// =========================================================================
// TreeView — public component
// =========================================================================

export function TreeView({
  nodes,
  expandedIds: controlledExpandedIds,
  onToggleExpand: controlledOnToggle,
  selectedId,
  onSelect,
  onContextMenu,
  onDrop,
  onDragOver,
  renderIcon,
  renderTrailing,
  onDelete,
  draggable,
  onDragStart,
  indentPx = 16,
  emptyDirectoryMessage = 'Empty folder',
}: TreeViewProps): JSX.Element {
  // Uncontrolled expand state fallback
  const [internalExpandedIds, setInternalExpandedIds] = useState<Set<string>>(new Set());

  const expandedIds = controlledExpandedIds ?? internalExpandedIds;
  const onToggleExpand = controlledOnToggle ?? ((nodeId: string) => {
    setInternalExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  });

  if (nodes.length === 0) {
    return <div className="ac-tree-empty" style={{ padding: '16px', textAlign: 'center' }}>No items</div>;
  }

  return (
    <div role="tree" className="ac-tree-view">
      {nodes.map((node) => (
        <TreeNodeRow
          key={node.id}
          node={node}
          depth={0}
          isExpanded={expandedIds.has(node.id)}
          isSelected={selectedId === node.id}
          onToggleExpand={onToggleExpand}
          onSelect={onSelect}
          onContextMenu={onContextMenu}
          onDrop={onDrop}
          onDragOver={onDragOver}
          renderIcon={renderIcon}
          renderTrailing={renderTrailing}
          draggable={draggable}
          onDragStart={onDragStart}
          onDelete={onDelete}
          indentPx={indentPx}
          emptyDirectoryMessage={emptyDirectoryMessage}
          expandedIds={expandedIds}
          selectedId={selectedId}
        />
      ))}
    </div>
  );
}
