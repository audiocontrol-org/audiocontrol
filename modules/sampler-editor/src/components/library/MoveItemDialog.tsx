/**
 * Move Item Dialog
 *
 * Dialog for moving items or directories to a new location in the library.
 * Shows a tree picker to select the destination directory.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { LibraryTreeNode, LibraryCategory } from '@/lib/library-service';
import { cn } from '@/lib/utils';

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

// =========================================================================
// Directory Picker Node
// =========================================================================

interface DirectoryPickerNodeProps {
  node: LibraryTreeNode;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  isDisabled: boolean;
  expandedPaths: Set<string>;
  onToggleExpand: (nodeId: string) => void;
  onSelect: (path: string[]) => void;
  disabledPath?: string; // Path that cannot be selected (e.g., the item being moved)
}

function DirectoryPickerNode({
  node,
  depth,
  isExpanded,
  isSelected,
  isDisabled,
  expandedPaths,
  onToggleExpand,
  onSelect,
  disabledPath,
}: DirectoryPickerNodeProps): JSX.Element | null {
  // Only show directories
  if (node.type !== 'directory') {
    return null;
  }

  const handleClick = useCallback(() => {
    if (!isDisabled) {
      onSelect([...node.path, node.name]);
    }
  }, [node.path, node.name, isDisabled, onSelect]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand(node.id);
  }, [node.id, onToggleExpand]);

  const hasChildren = node.children && node.children.some((c) => c.type === 'directory');
  const paddingLeft = depth * 16 + 8;

  return (
    <div>
      <div
        className={cn(
          'w-full text-left py-1.5 rounded text-sm transition-colors',
          'flex items-center gap-2',
          isDisabled && 'opacity-50 cursor-not-allowed',
          !isDisabled && 'cursor-pointer',
          isSelected
            ? 'bg-s330-highlight/20 text-s330-highlight'
            : !isDisabled && 'text-s330-text hover:bg-s330-accent/30'
        )}
        style={{ paddingLeft }}
        onClick={handleClick}
        role="treeitem"
        tabIndex={isDisabled ? -1 : 0}
        aria-selected={isSelected}
        aria-disabled={isDisabled}
      >
        {hasChildren ? (
          <span className="cursor-pointer p-0.5 -ml-0.5" onClick={handleToggle}>
            <ChevronIcon isExpanded={isExpanded} />
          </span>
        ) : (
          <span className="w-4" /> // Spacer for alignment
        )}
        <FolderIcon isOpen={isExpanded} />
        <span className="flex-1 truncate">{node.name}</span>
      </div>

      {/* Children */}
      {isExpanded && node.children && (
        <div className="border-l border-s330-accent/30 ml-4">
          {node.children.map((child) => {
            const childPath = [...child.path, child.name].join('/');
            const isChildDisabled = disabledPath ? childPath.startsWith(disabledPath) : false;

            return (
              <DirectoryPickerNode
                key={child.id}
                node={child}
                depth={depth + 1}
                isExpanded={expandedPaths.has(child.id)}
                isSelected={false} // Selection is handled at the top level
                isDisabled={isChildDisabled}
                expandedPaths={expandedPaths}
                onToggleExpand={onToggleExpand}
                onSelect={onSelect}
                disabledPath={disabledPath}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// =========================================================================
// Move Item Dialog
// =========================================================================

interface MoveItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (targetPath: string[]) => Promise<void>;
  itemName: string;
  itemType: 'tone' | 'patch' | 'drum-kit' | 'directory';
  currentPath: string[];
  category: LibraryCategory;
  categoryTree: LibraryTreeNode[];
}

export function MoveItemDialog({
  open,
  onOpenChange,
  onConfirm,
  itemName,
  itemType,
  currentPath,
  category,
  categoryTree,
}: MoveItemDialogProps): JSX.Element {
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedPath([]);
      setError(null);
      setIsMoving(false);
      // Expand the current path so user can see where item is
      const pathsToExpand = new Set<string>();
      for (let i = 0; i < currentPath.length; i++) {
        pathsToExpand.add(currentPath.slice(0, i + 1).join('/'));
      }
      setExpandedPaths(pathsToExpand);
    }
  }, [open, currentPath]);

  const handleToggleExpand = useCallback((nodeId: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const handleSelectRoot = useCallback(() => {
    setSelectedPath([]);
  }, []);

  const handleSelect = useCallback((path: string[]) => {
    setSelectedPath(path);
  }, []);

  const handleConfirm = useCallback(async () => {
    // Check if the target is the same as current
    if (selectedPath.join('/') === currentPath.join('/')) {
      setError('Item is already in this folder');
      return;
    }

    setIsMoving(true);
    setError(null);

    try {
      await onConfirm(selectedPath);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move item');
    } finally {
      setIsMoving(false);
    }
  }, [selectedPath, currentPath, onConfirm, onOpenChange]);

  // The path that should be disabled (can't move into itself or its children)
  const disabledPath = itemType === 'directory'
    ? [...currentPath, itemName].join('/')
    : undefined;

  const isRootSelected = selectedPath.length === 0;
  const selectedPathDisplay = selectedPath.length > 0 ? selectedPath.join('/') : '(root)';
  const categoryLabel = category === 'drum-kits' ? 'Drum Kits' : category.charAt(0).toUpperCase() + category.slice(1);

  // Filter tree to only show directories
  const directoryTree = useMemo(() => {
    return categoryTree.filter((node) => node.type === 'directory');
  }, [categoryTree]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md">
          <div className="card p-6">
            <Dialog.Title className="text-lg font-bold text-s330-text mb-4">
              Move {itemType === 'drum-kit' ? 'Drum Kit' : itemType.charAt(0).toUpperCase() + itemType.slice(1)}
            </Dialog.Title>

            <div className="mb-4">
              <p className="text-s330-text">
                Move <span className="font-medium text-s330-highlight">"{itemName}"</span> to:
              </p>
            </div>

            {/* Directory picker */}
            <div className="mb-4 bg-s330-bg/50 rounded border border-s330-accent max-h-64 overflow-y-auto">
              {/* Root option */}
              <div
                className={cn(
                  'px-3 py-2 cursor-pointer flex items-center gap-2',
                  isRootSelected
                    ? 'bg-s330-highlight/20 text-s330-highlight'
                    : 'text-s330-text hover:bg-s330-accent/30'
                )}
                onClick={handleSelectRoot}
                role="treeitem"
                tabIndex={0}
                aria-selected={isRootSelected}
              >
                <FolderIcon isOpen={false} />
                <span className="font-medium">{categoryLabel} (root)</span>
              </div>

              {/* Directory tree */}
              {directoryTree.length > 0 && (
                <div className="border-t border-s330-accent/30" role="tree">
                  {directoryTree.map((node) => {
                    const nodePath = [...node.path, node.name].join('/');
                    const isNodeDisabled = disabledPath ? nodePath.startsWith(disabledPath) : false;
                    const isNodeSelected = selectedPath.join('/') === nodePath;

                    return (
                      <DirectoryPickerNode
                        key={node.id}
                        node={node}
                        depth={0}
                        isExpanded={expandedPaths.has(node.id)}
                        isSelected={isNodeSelected}
                        isDisabled={isNodeDisabled}
                        expandedPaths={expandedPaths}
                        onToggleExpand={handleToggleExpand}
                        onSelect={handleSelect}
                        disabledPath={disabledPath}
                      />
                    );
                  })}
                </div>
              )}

              {directoryTree.length === 0 && (
                <div className="px-3 py-4 text-sm text-s330-muted text-center italic">
                  No subfolders available
                </div>
              )}
            </div>

            {/* Selected destination */}
            <div className="mb-4 text-sm">
              <span className="text-s330-muted">Destination: </span>
              <span className="text-s330-text font-mono">
                {categoryLabel}/{selectedPathDisplay}
              </span>
            </div>

            {error && (
              <div className="mb-4 text-sm text-red-400 bg-red-900/20 rounded px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="ac-btn ac-btn-secondary"
                  disabled={isMoving}
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={handleConfirm}
                className="ac-btn ac-btn-primary"
                disabled={isMoving || selectedPath.join('/') === currentPath.join('/')}
              >
                {isMoving ? 'Moving...' : 'Move'}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
