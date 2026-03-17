/**
 * Recursive Tree Node Component
 *
 * Renders a single node in the library tree, handling:
 * - Directories (expandable with children)
 * - Tones (draggable items)
 * - Patches (draggable items)
 * - Drum kits (draggable items)
 */

import { useCallback, useState, useRef, useEffect } from 'react';
import type { LibraryTreeNode as TreeNodeType } from '@/lib/library-service';
import { cn } from '@/lib/utils';
import { isValidMoveTarget } from '@audiocontrol/sampler-library/browser';
import { LIBRARY_DRAG_MIME, type LibraryDragData } from '@/components/library/DeviceMemoryPanel';

/** Internal MIME type for library-to-library drag operations (moving items) */
export const LIBRARY_MOVE_MIME = 'application/x-s330-library-move';

// =========================================================================
// Icons
// =========================================================================

function FolderIcon({ isOpen }: { isOpen: boolean }): JSX.Element {
  return (
    <svg
      className={cn('w-4 h-4 flex-shrink-0', isOpen ? 'text-s330-highlight' : 'text-s330-muted')}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      {isOpen ? (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
        />
      ) : (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
        />
      )}
    </svg>
  );
}

function ChevronIcon({ isExpanded }: { isExpanded: boolean }): JSX.Element {
  return (
    <svg
      className={cn(
        'w-3 h-3 text-s330-muted transition-transform flex-shrink-0',
        isExpanded && 'rotate-90'
      )}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

function WaveIcon(): JSX.Element {
  return (
    <svg className="w-3.5 h-3.5 text-s330-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
      />
    </svg>
  );
}

function PatchIcon(): JSX.Element {
  return (
    <svg className="w-3.5 h-3.5 text-s330-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
      />
    </svg>
  );
}

function DrumKitIcon(): JSX.Element {
  return (
    <svg className="w-3.5 h-3.5 text-s330-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="12" cy="12" r="8" strokeWidth={2} />
      <circle cx="12" cy="12" r="3" strokeWidth={2} />
    </svg>
  );
}

function DeleteButton({
  onClick,
  title = 'Delete',
}: {
  onClick: (e: React.MouseEvent) => void;
  title?: string;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'p-1 rounded opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
        'hover:bg-red-500/20 hover:text-red-400 text-s330-muted/50',
        'transition-opacity focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-red-400'
      )}
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
    </button>
  );
}

// =========================================================================
// Tree Node Component
// =========================================================================

export interface LibraryTreeNodeProps {
  node: TreeNodeType;
  category: 'tones' | 'patches' | 'drumKits';
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  onToggleExpand: (nodeId: string) => void;
  onSelect: (node: TreeNodeType) => void;
  onDelete?: (node: TreeNodeType) => void;
  onContextMenu?: (e: React.MouseEvent, node: TreeNodeType) => void;
  /** Called when an item is dropped onto a directory */
  onDropOnDirectory?: (targetPath: string[], dragData: LibraryDragData) => void;
  /** Called when an item is renamed (double-click to edit) */
  onRename?: (node: TreeNodeType, newName: string) => Promise<void>;
  expandedPaths: Set<string>;
  selectedId?: string;
}

export function LibraryTreeNodeComponent({
  node,
  category,
  depth,
  isExpanded,
  isSelected,
  onToggleExpand,
  onSelect,
  onDelete,
  onContextMenu,
  onDropOnDirectory,
  onRename,
  expandedPaths,
  selectedId,
}: LibraryTreeNodeProps): JSX.Element {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (node.type === 'directory') {
      onToggleExpand(node.id);
    } else {
      onSelect(node);
    }
  }, [node, onToggleExpand, onSelect, isEditing]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!onRename) return;
    setEditValue(node.name);
    setIsEditing(true);
  }, [node.name, onRename]);

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
      console.error('[LibraryTreeNode] Rename failed:', err);
      // Keep editing mode open on error so user can try again
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

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(node);
  }, [node, onDelete]);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    let dragData: LibraryDragData;

    if (node.type === 'tone') {
      dragData = {
        source: 'library',
        type: 'tone',
        name: node.fileName || node.name,
        path: node.path,
      };
    } else if (node.type === 'patch') {
      dragData = {
        source: 'library',
        type: 'patch',
        name: node.directoryName || node.name,
        path: node.path,
      };
    } else if (node.type === 'drum-kit') {
      dragData = {
        source: 'library',
        type: 'drumKit',
        name: node.directoryName || node.name,
        path: node.path,
      };
    } else {
      // Directories are not draggable for now
      e.preventDefault();
      return;
    }

    // Set both MIME types - one for device import, one for library move
    e.dataTransfer.setData(LIBRARY_DRAG_MIME, JSON.stringify(dragData));
    e.dataTransfer.setData(LIBRARY_MOVE_MIME, JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'copyMove';
  }, [node]);

  // Drag-over handler for directories (to accept drops)
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (node.type !== 'directory') return;
    if (!e.dataTransfer.types.includes(LIBRARY_MOVE_MIME)) return;

    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  }, [node.type]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (node.type !== 'directory') return;
    if (!e.dataTransfer.types.includes(LIBRARY_MOVE_MIME)) return;

    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, [node.type]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (node.type !== 'directory') return;

    // Only clear if we're actually leaving this element (not entering a child)
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false);
    }
  }, [node.type]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    if (node.type !== 'directory') return;

    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const jsonData = e.dataTransfer.getData(LIBRARY_MOVE_MIME);
    if (!jsonData) return;

    try {
      const dragData = JSON.parse(jsonData) as LibraryDragData;
      const targetPath = [...node.path, node.name];
      const sourcePath = dragData.path || [];

      if (!isValidMoveTarget(sourcePath, dragData.name, targetPath)) {
        return;
      }

      onDropOnDirectory?.(targetPath, dragData);
    } catch (err) {
      console.error('[LibraryTreeNode] Failed to parse drop data:', err);
    }
  }, [node, onDropOnDirectory]);

  const handleContextMenuClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(e, node);
  }, [node, onContextMenu]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (node.type === 'directory') {
        onToggleExpand(node.id);
      } else {
        onSelect(node);
      }
    }
  }, [node, onToggleExpand, onSelect]);

  const paddingLeft = depth * 16 + 8;
  const isDirectory = node.type === 'directory';
  const isDraggable = !isDirectory;

  return (
    <div>
      <div
        className={cn(
          'group w-full text-left py-1.5 rounded text-sm transition-colors',
          'flex items-center gap-2',
          isDraggable && !isEditing && 'cursor-grab active:cursor-grabbing',
          isSelected
            ? 'bg-s330-highlight/20 text-s330-highlight'
            : isDragOver
            ? 'bg-s330-highlight/30 ring-2 ring-s330-highlight ring-inset'
            : 'text-s330-text hover:bg-s330-accent/30'
        )}
        style={{ paddingLeft }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenuClick}
        onKeyDown={handleKeyDown}
        draggable={isDraggable && !isEditing}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="treeitem"
        tabIndex={isEditing ? -1 : 0}
        aria-expanded={isDirectory ? isExpanded : undefined}
      >
        {/* Expand/collapse chevron for directories */}
        {isDirectory && (
          <span className="cursor-pointer p-0.5 -ml-0.5" onClick={(e) => { e.stopPropagation(); onToggleExpand(node.id); }}>
            <ChevronIcon isExpanded={isExpanded} />
          </span>
        )}

        {/* Icon based on type */}
        {isDirectory && <FolderIcon isOpen={isExpanded} />}
        {node.type === 'tone' && <WaveIcon />}
        {node.type === 'patch' && <PatchIcon />}
        {node.type === 'drum-kit' && <DrumKitIcon />}

        {/* Name (editable on double-click) */}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameBlur}
            disabled={isRenaming}
            className={cn(
              'flex-1 bg-s330-bg border border-s330-highlight rounded px-1 py-0.5',
              'text-s330-text font-medium text-sm',
              'focus:outline-none focus:ring-1 focus:ring-s330-highlight',
              isRenaming && 'opacity-50'
            )}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 truncate font-medium">{node.name}</span>
        )}

        {/* Metadata */}
        {node.type === 'patch' && node.toneCount !== undefined && (
          <span className="text-xs text-s330-muted">
            {node.toneCount} tone{node.toneCount !== 1 ? 's' : ''}
          </span>
        )}
        {node.type === 'drum-kit' && (
          <span className="text-xs text-s330-muted">
            {node.kitCount} kit{node.kitCount !== 1 ? 's' : ''} / {node.sampleCount} samples
          </span>
        )}

        {/* Delete button */}
        {onDelete && !isDirectory && (
          <DeleteButton
            onClick={handleDelete}
            title={`Delete ${node.type}`}
          />
        )}
      </div>

      {/* Children (only for expanded directories) */}
      {isDirectory && isExpanded && node.children && node.children.length > 0 && (
        <div className="border-l border-s330-accent/30 ml-4">
          {node.children.map((child) => (
            <LibraryTreeNodeComponent
              key={child.id}
              node={child}
              category={category}
              depth={depth + 1}
              isExpanded={expandedPaths.has(child.id)}
              isSelected={selectedId === child.id}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onDelete={onDelete}
              onContextMenu={onContextMenu}
              onDropOnDirectory={onDropOnDirectory}
              onRename={onRename}
              expandedPaths={expandedPaths}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}

      {/* Empty directory message */}
      {isDirectory && isExpanded && (!node.children || node.children.length === 0) && (
        <div
          className="text-xs text-s330-muted/50 italic py-2"
          style={{ paddingLeft: paddingLeft + 20 }}
        >
          Empty folder
        </div>
      )}
    </div>
  );
}

// =========================================================================
// Tree Section Component
// =========================================================================

export interface TreeSectionProps {
  title: string;
  nodes: TreeNodeType[];
  category: 'tones' | 'patches' | 'drumKits';
  expandedPaths: Set<string>;
  selectedId?: string;
  onToggleExpand: (nodeId: string) => void;
  onSelect: (node: TreeNodeType) => void;
  onDelete?: (node: TreeNodeType) => void;
  onContextMenu?: (e: React.MouseEvent, node: TreeNodeType) => void;
  /** Called when an item is dropped onto a directory */
  onDropOnDirectory?: (targetPath: string[], dragData: LibraryDragData) => void;
  /** Called when an item is renamed (double-click to edit) */
  onRename?: (node: TreeNodeType, newName: string) => Promise<void>;
  emptyMessage?: string;
  isDragOver?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnter?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  dropMessage?: string;
  headerActions?: React.ReactNode;
}

export function TreeSection({
  title,
  nodes,
  category,
  expandedPaths,
  selectedId,
  onToggleExpand,
  onSelect,
  onDelete,
  onContextMenu,
  onDropOnDirectory,
  onRename,
  emptyMessage = 'No items',
  isDragOver,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  dropMessage,
  headerActions,
}: TreeSectionProps): JSX.Element {
  return (
    <div
      className={cn(
        'p-2 border-t border-s330-accent/30 transition-colors',
        isDragOver && 'bg-s330-highlight/10 border-s330-highlight'
      )}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="text-xs font-medium text-s330-muted uppercase tracking-wide px-2 py-1 flex items-center gap-2">
        {title}
        {isDragOver && dropMessage && (
          <span className="text-s330-highlight font-normal normal-case">
            — {dropMessage}
          </span>
        )}
        {headerActions && <span className="ml-auto">{headerActions}</span>}
      </div>

      {nodes.length === 0 && !isDragOver ? (
        <div className="text-sm text-s330-muted/70 px-2 py-4 text-center italic">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-0.5" role="tree">
          {nodes.map((node) => (
            <LibraryTreeNodeComponent
              key={node.id}
              node={node}
              category={category}
              depth={0}
              isExpanded={expandedPaths.has(node.id)}
              isSelected={selectedId === node.id}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onDelete={onDelete}
              onContextMenu={onContextMenu}
              onDropOnDirectory={onDropOnDirectory}
              onRename={onRename}
              expandedPaths={expandedPaths}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}

      {isDragOver && dropMessage && (
        <div className="mt-2 p-3 border-2 border-dashed border-s330-highlight/50 rounded text-center text-sm text-s330-highlight">
          {dropMessage}
        </div>
      )}
    </div>
  );
}
