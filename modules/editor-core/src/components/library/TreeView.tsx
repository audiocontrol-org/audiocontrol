/**
 * Generic recursive tree view component.
 *
 * Renders a tree of nodes with expand/collapse, selection,
 * optional drag-drop zones, and optional context menu trigger.
 * Device-agnostic — consumers provide node data and capability objects.
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { ChevronIcon, FolderIcon, DeleteIcon, NewFolderIcon } from './TreeIcons';
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
  /** Currently selected node ID (single selection) */
  selectedId?: string;
  /** Set of selected node IDs (multi-selection). Takes precedence over selectedId for highlighting. */
  selectedIds?: ReadonlySet<string>;
  /** Selection capabilities (select, multi-select) */
  selection?: TreeSelectionCapability;
  /** Editing capabilities (delete, rename, create folder) */
  edit?: TreeEditCapability;
  /** Context menu capability */
  contextMenu?: TreeContextMenuCapability;
  /** Drag-and-drop capabilities */
  drag?: TreeDragCapability;
  /** Custom rendering capabilities */
  render?: TreeRenderCapability;
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
  selection?: TreeSelectionCapability;
  edit?: TreeEditCapability;
  contextMenu?: TreeContextMenuCapability;
  drag?: TreeDragCapability;
  render?: TreeRenderCapability;
  indentPx: number;
  emptyDirectoryMessage: string;
  expandedIds: Set<string>;
  selectedId?: string;
  selectedIds?: ReadonlySet<string>;
}

function TreeNodeRow({
  node,
  depth,
  isExpanded,
  isSelected,
  onToggleExpand,
  selection,
  edit,
  contextMenu,
  drag,
  render,
  indentPx,
  emptyDirectoryMessage,
  expandedIds,
  selectedId,
  selectedIds,
}: TreeNodeRowProps): JSX.Element {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isDirectory = node.type === 'directory';
  const hasChildren = !!node.children?.length;
  // Both directories and non-directories can be dragged
  const isDraggable = drag?.draggable ?? false;
  const paddingLeft = depth * indentPx + 8;
  const canRename = edit?.enableInlineRename && edit.onRename;

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEditing) return;

    // Multi-select with Ctrl/Cmd or Shift (non-directory items only)
    if (!isDirectory && selection?.onMultiSelect && (e.ctrlKey || e.metaKey || e.shiftKey)) {
      selection.onMultiSelect(node, { ctrlKey: e.ctrlKey || e.metaKey, shiftKey: e.shiftKey });
      return;
    }

    if (isDirectory) {
      onToggleExpand(node.id);
    } else if (hasChildren) {
      onToggleExpand(node.id);
      selection?.onSelect(node);
    } else {
      selection?.onSelect(node);
    }
  }, [node, isDirectory, onToggleExpand, selection, isEditing]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!canRename) return;
    setEditValue(node.name);
    setIsEditing(true);
  }, [node.name, canRename]);

  const handleRenameSubmit = useCallback(async () => {
    const trimmedValue = editValue.trim();
    if (!trimmedValue || trimmedValue === node.name || !edit?.onRename) {
      setIsEditing(false);
      return;
    }

    setIsRenaming(true);
    try {
      await edit.onRename(node, trimmedValue);
      setIsEditing(false);
    } catch (err) {
      // Keep editing mode open on error so user can try again
      console.error('[TreeView] Rename failed:', err);
    } finally {
      setIsRenaming(false);
    }
  }, [editValue, node, edit]);

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
    contextMenu?.onContextMenu(e, node);
  }, [node, contextMenu]);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (!isDraggable) {
      e.preventDefault();
      return;
    }
    drag?.onDragStart(node, e);
  }, [node, isDraggable, drag]);

  const handleDragOverEvent = useCallback((e: React.DragEvent) => {
    if (!isDirectory) return;
    const allowed = drag?.onTreeDragOver ? drag.onTreeDragOver(node, e) : true;
    if (allowed) {
      e.preventDefault();
      e.stopPropagation();
      // Use 'copy' if the source only allows copy (e.g., disk browser items)
      e.dataTransfer.dropEffect =
        e.dataTransfer.effectAllowed === 'copy' ? 'copy' : 'move';
    }
  }, [node, isDirectory, drag]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!isDirectory) return;
    // Only light up the row if the consumer's onTreeDragOver predicate
    // says it would accept the drop. Without this guard, dragenter
    // ALWAYS toggles the highlight regardless of MIME-type acceptance
    // — so a tone dragged over a patches-section folder still glows
    // even after onTreeDragOver correctly rejects the drop. Consumers
    // without an onTreeDragOver fall back to legacy "highlight any
    // dragenter" behavior so non-Roland editors aren't affected.
    const accepted = drag?.onTreeDragOver ? drag.onTreeDragOver(node, e) : true;
    if (!accepted) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, [node, isDirectory, drag]);

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
    drag?.onTreeDrop(node, e);
  }, [node, isDirectory, drag]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isEditing) return; // Don't handle while editing
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isDirectory) {
        onToggleExpand(node.id);
      } else {
        selection?.onSelect(node);
      }
    }
  }, [node, isDirectory, onToggleExpand, selection, isEditing]);

  const icon = render?.renderIcon
    ? render.renderIcon(node, isExpanded)
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
        data-kind={isDirectory ? 'folder' : 'item'}
        onClick={handleClick}
        onDoubleClick={canRename ? handleDoubleClick : undefined}
        onContextMenu={contextMenu ? handleContextMenu : undefined}
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
          <button
            type="button"
            className="ac-tree-disclosure-btn"
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${node.name}`}
            aria-expanded={isExpanded}
            onClick={(e) => { e.stopPropagation(); onToggleExpand(node.id); }}
          >
            <ChevronIcon isExpanded={isExpanded} />
          </button>
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

        {render?.renderTrailing?.(node)}

        {isDirectory && edit?.onCreateFolder && (
          <button
            className="ac-tree-add-btn"
            onClick={(e) => { e.stopPropagation(); edit.onCreateFolder?.(node); }}
            title={`New folder in ${node.name}`}
          >
            <NewFolderIcon />
          </button>
        )}

        {edit?.onDelete && (
          <button
            className="ac-tree-delete-btn"
            onClick={(e) => { e.stopPropagation(); edit.onDelete(node); }}
            title={`Delete ${node.name}`}
          >
            <DeleteIcon />
          </button>
        )}
      </div>

      {/* Children — always mounted so the .ac-collapse wrapper can
          animate the grid-template-rows transition. The
          `data-expanded` attribute drives the row size; .ac-tree-children
          carries the indent + rail styling for the children. */}
      {(isDirectory || hasChildren) && node.children && node.children.length > 0 && (
        <div className="ac-collapse" data-expanded={isExpanded}>
          <div>
            <div className="ac-tree-children">
              {node.children.map((child) => (
                <TreeNodeRow
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  isExpanded={expandedIds.has(child.id)}
                  isSelected={selectedIds ? selectedIds.has(child.id) : selectedId === child.id}
                  onToggleExpand={onToggleExpand}
                  selection={selection}
                  edit={edit}
                  contextMenu={contextMenu}
                  drag={drag}
                  render={render}
                  indentPx={indentPx}
                  emptyDirectoryMessage={emptyDirectoryMessage}
                  expandedIds={expandedIds}
                  selectedId={selectedId}
                  selectedIds={selectedIds}
                />
              ))}
            </div>
          </div>
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
  selectedIds,
  selection,
  edit,
  contextMenu,
  drag,
  render,
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
          isSelected={selectedIds ? selectedIds.has(node.id) : selectedId === node.id}
          onToggleExpand={onToggleExpand}
          selection={selection}
          edit={edit}
          contextMenu={contextMenu}
          drag={drag}
          render={render}
          indentPx={indentPx}
          emptyDirectoryMessage={emptyDirectoryMessage}
          expandedIds={expandedIds}
          selectedId={selectedId}
          selectedIds={selectedIds}
        />
      ))}
    </div>
  );
}
