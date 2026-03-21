/**
 * Move Item Dialog
 *
 * Thin wrapper around the shared MoveDialog from editor-core.
 * Flattens the category tree into the directory list format that
 * MoveDialog expects, and handles async move operations with
 * loading state.
 */

import { useCallback, useMemo, useRef } from 'react';
import { MoveDialog } from '@audiocontrol/editor-core';
import type { MoveDialogDirectory } from '@audiocontrol/editor-core';
import type { LibraryTreeNode, LibraryCategory } from '@/lib/library-service';

// =========================================================================
// Tree flattening
// =========================================================================

/**
 * Recursively flatten a tree of LibraryTreeNode into a flat list of
 * MoveDialogDirectory entries, keeping only directory nodes.
 */
function flattenDirectories(
  nodes: LibraryTreeNode[],
  depth: number,
): MoveDialogDirectory[] {
  const result: MoveDialogDirectory[] = [];

  for (const node of nodes) {
    if (node.type !== 'directory') continue;

    result.push({
      id: node.id,
      name: node.name,
      path: node.path,
      depth,
    });

    if (node.children) {
      result.push(...flattenDirectories(node.children, depth + 1));
    }
  }

  return result;
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
  category: _category,
  categoryTree,
}: MoveItemDialogProps): JSX.Element | null {
  void _category; // Preserved in props contract for LibraryPage; not used by the shared MoveDialog
  const movingRef = useRef(false);

  const directories = useMemo(
    () => flattenDirectories(categoryTree, 0),
    [categoryTree],
  );

  // The path that should be disabled (can't move a directory into itself or its children)
  const disabledPathPrefix = useMemo(() => {
    if (itemType !== 'directory') return undefined;
    return [...currentPath, itemName].join('/');
  }, [itemType, currentPath, itemName]);

  const isValidTarget = useCallback(
    (targetPath: string[]): boolean => {
      // Can't move to the same location
      if (targetPath.join('/') === currentPath.join('/')) return false;

      // Can't move a directory into itself or a descendant
      if (disabledPathPrefix !== undefined) {
        const targetStr = targetPath.join('/');
        if (
          targetStr === disabledPathPrefix ||
          targetStr.startsWith(disabledPathPrefix + '/')
        ) {
          return false;
        }
      }

      return true;
    },
    [currentPath, disabledPathPrefix],
  );

  const handleMove = useCallback(
    (targetPath: string[]) => {
      if (movingRef.current) return;
      movingRef.current = true;

      onConfirm(targetPath)
        .then(() => {
          onOpenChange(false);
        })
        .catch((err: unknown) => {
          // Re-throw so the error propagates to the console; the dialog
          // stays open so the user can retry or cancel.
          console.error('Move failed:', err);
        })
        .finally(() => {
          movingRef.current = false;
        });
    },
    [onConfirm, onOpenChange],
  );

  const handleCancel = useCallback(() => {
    if (!movingRef.current) {
      onOpenChange(false);
    }
  }, [onOpenChange]);

  const itemTypeLabel =
    itemType === 'drum-kit'
      ? 'Drum Kit'
      : itemType.charAt(0).toUpperCase() + itemType.slice(1);

  return (
    <MoveDialog
      open={open}
      itemName={`${itemTypeLabel}: ${itemName}`}
      directories={directories}
      isValidTarget={isValidTarget}
      onMove={handleMove}
      onCancel={handleCancel}
    />
  );
}
