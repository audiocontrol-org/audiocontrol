/**
 * Generic recursive tree view component.
 *
 * Renders a tree of nodes with expand/collapse, selection,
 * optional drag-drop zones, and optional context menu trigger.
 * Device-agnostic — consumers provide node data and callbacks.
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { ChevronIcon, FolderIcon, DeleteIcon, NewFolderIcon } from './TreeIcons';

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
  /** Called when the add-folder button is clicked on a directory. When provided,
   *  renders an add-folder button on hover for each directory node. */
  onCreateFolder?: (parentNode: TreeNode) => void;
  /** Depth indentation in pixels per level. Default: 16. */
  indentPx?: number;
  /** Message shown for empty directories. Default: 'Empty folder'. */
  emptyDirectoryMessage?: string;
  /** Called when a node is renamed via inline editing (double-click to edit) */
  onRename?: (node: TreeNode, newName: string) => Promise<void>;
  /** Whether inline renaming is enabled. Requires onRename to be provided. */
  enableInlineRename?: boolean;
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
  onCreateFolder?: (parentNode: TreeNode) => void;
  indentPx: number;
  emptyDirectoryMessage: string;
  expandedIds: Set<string>;
  selectedId?: string;
  onRename?: (node: TreeNode, newName: string) => Promise<void>;
  enableInlineRename?: boolean;
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
  onCreateFolder,
  indentPx,
  emptyDirectoryMessage,
  expandedIds,
  selectedId,
  onRename,
  enableInlineRename,
}: TreeNodeRowProps): JSX.Element {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isDirectory = node.type === 'directory';
  const hasChildren = !!node.children?.length;
  // Both directories and non-directories can be dragged
  const isDraggable = draggable ?? false;
  const paddingLeft = depth * indentPx + 8;
  const canRename = enableInlineRename && onRename;

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEditing) return; // Don't handle clicks while editing
    if (isDirectory) {
      onToggleExpand(node.id);
    } else if (hasChildren) {
      onToggleExpand(node.id);
      onSelect?.(node);
    } else {
      onSelect?.(node);
    }
  }, [node, isDirectory, onToggleExpand, onSelect, isEditing]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!canRename) return;
    setEditValue(node.name);
    setIsEditing(true);
  }, [node.name, canRename]);

  const handleRenameSubmit = useCallback(async () => {
    const trimmedValue = editValue.trim();
    if (!trimmedValue || trimmedValue === node.name || !onRename) {
      setIsEditing(false);
      return;
    }

    setIsRenaming(true);
    try {
      await onRename(node, trimmedValue);
      setIsEditing(false);
    } catch (err) {
      // Keep editing mode open on error so user can try again
      console.error('[TreeView] Rename failed:', err);
    } finally {
      setIsRenaming(false);
    }
  }, [editValue, node, onRename]);

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditing(false);
    }
  }, [handleRenameSubmit]);

  const handleRenameBlur = useCallback(() => {
    // Submit on blur (unless already submitting)
    if (!isRenaming) {
      handleRenameSubmit();
    }
  }, [isRenaming, handleRenameSubmit]);

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
      // Use 'copy' if the source only allows copy (e.g., disk browser items)
      e.dataTransfer.dropEffect =
        e.dataTransfer.effectAllowed === 'copy' ? 'copy' : 'move';
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
    if (isEditing) return; // Don't handle while editing
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isDirectory) {
        onToggleExpand(node.id);
      } else {
        onSelect?.(node);
      }
    }
  }, [node, isDirectory, onToggleExpand, onSelect, isEditing]);

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

  // Generate data-testid for e2e testing
  // Pattern: library-{type}-{slugified-id} (e.g., library-tone-my-tone, library-patch-bass-patch)
  const testId = node.type !== 'directory'
    ? `library-${node.type}-${node.id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
    : undefined;

  return (
    <div>
      <div
        className={`ac-tree-node ${stateClass}${isEditing ? ' ac-tree-node--editing' : ''}${isDraggable && !isEditing ? ' ac-tree-node--draggable' : ''}`}
        style={{ paddingLeft }}
        data-testid={testId}
        onClick={handleClick}
        onDoubleClick={canRename ? handleDoubleClick : undefined}
        onContextMenu={onContextMenu ? handleContextMenu : undefined}
        onKeyDown={handleKeyDown}
        draggable={isDraggable && !isEditing}
        onDragStart={isDraggable && !isEditing ? handleDragStart : undefined}
        onDragOver={isDirectory ? handleDragOverEvent : undefined}
        onDragEnter={isDirectory ? handleDragEnter : undefined}
        onDragLeave={isDirectory ? handleDragLeave : undefined}
        onDrop={isDirectory ? handleDrop : undefined}
        role="treeitem"
        tabIndex={isEditing ? -1 : 0}
        aria-expanded={(isDirectory || hasChildren) ? isExpanded : undefined}
      >
        {(isDirectory || hasChildren) && (
          <span
            className="ac-tree-chevron-btn"
            onClick={(e) => { e.stopPropagation(); onToggleExpand(node.id); }}
          >
            <ChevronIcon isExpanded={isExpanded} />
          </span>
        )}

        {icon}

        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className="ac-tree-rename-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameBlur}
            disabled={isRenaming}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="ac-tree-node-name">{node.name}</span>
        )}

        {renderTrailing?.(node)}

        {isDirectory && onCreateFolder && (
          <button
            className="ac-tree-add-btn"
            onClick={(e) => { e.stopPropagation(); onCreateFolder(node); }}
            title={`New folder in ${node.name}`}
          >
            <NewFolderIcon />
          </button>
        )}

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

      {/* Children for expanded nodes */}
      {(isDirectory || hasChildren) && isExpanded && node.children && node.children.length > 0 && (
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
              onCreateFolder={onCreateFolder}
              indentPx={indentPx}
              emptyDirectoryMessage={emptyDirectoryMessage}
              expandedIds={expandedIds}
              selectedId={selectedId}
              onRename={onRename}
              enableInlineRename={enableInlineRename}
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
  onCreateFolder,
  draggable,
  onDragStart,
  indentPx = 16,
  emptyDirectoryMessage = 'Empty folder',
  onRename,
  enableInlineRename,
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
          onCreateFolder={onCreateFolder}
          indentPx={indentPx}
          emptyDirectoryMessage={emptyDirectoryMessage}
          expandedIds={expandedIds}
          selectedId={selectedId}
          onRename={onRename}
          enableInlineRename={enableInlineRename}
        />
      ))}
    </div>
  );
}
