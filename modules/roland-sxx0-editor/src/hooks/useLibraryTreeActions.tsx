/**
 * useLibraryTreeActions
 *
 * Encapsulates context menu state and actions, tree node
 * selection/delete handlers, selected-ID computation, and
 * directory drop-move / rename handlers for LibraryTreePanel.
 */

import { useState, useCallback } from 'react';
import type { LibraryTreeNode, LibraryCategory } from '@/lib/library-service';
import {
  type ContextMenuAction,
  NewFolderIcon,
  RenameIcon,
  MoveIcon,
  DeleteIcon,
} from '@audiocontrol/editor-core';

/** Minimal interface for drag data used in within-tree move operations. */
export interface TreeMoveData {
  name: string;
  path: string[];
}

export interface UseLibraryTreeActionsParams {
  selectedName?: string;
  selectedType?: 'tone' | 'patch' | 'set' | 'individualTone' | 'individualPatch' | 'sample' | 'program';
  selectedPath?: string[];
  onSelectIndividualTone: (name: string, path?: string[]) => void;
  onSelectIndividualPatch: (name: string, path?: string[]) => void;
  onSelectSample?: (name: string, path?: string[]) => void;
  onSelectProgram?: (name: string, path?: string[]) => void;
  onToggleDirectoryExpanded?: (category: 'tones' | 'patches' | 'samples', path: string) => void;
  onDeleteIndividualTone?: (fileName: string, path?: string[]) => void;
  onDeleteIndividualPatch?: (fileName: string, path?: string[]) => void;
  onDeleteDirectory?: (category: LibraryCategory, path: string[]) => void;
  onCreateDirectory?: (category: LibraryCategory, parentPath: string[]) => void;
  onRenameDirectory?: (category: LibraryCategory, path: string[]) => void;
  onMoveItem?: (category: LibraryCategory, sourcePath: string[], itemName: string) => void;
  onDropMoveItem?: (category: LibraryCategory, sourcePath: string[], itemName: string, targetPath: string[]) => void;
  onRenameItem?: (category: LibraryCategory, path: string[], oldName: string, newName: string, isDirectory: boolean) => Promise<void>;
}

export interface LibraryTreeActionsResult {
  contextMenu: {
    x: number;
    y: number;
    node: LibraryTreeNode;
    category: 'tones' | 'patches' | 'samples';
  } | null;
  handleTreeContextMenu: (e: React.MouseEvent, node: LibraryTreeNode, category: 'tones' | 'patches' | 'samples') => void;
  closeContextMenu: () => void;
  getContextMenuActions: () => ContextMenuAction[];
  handleTreeNodeSelect: (node: LibraryTreeNode, category: 'tones' | 'patches' | 'samples') => void;
  handleTreeNodeDelete: (node: LibraryTreeNode, category: 'tones' | 'patches' | 'samples') => void;
  computeSelectedId: (category: 'tones' | 'patches' | 'samples') => string | undefined;
  handleDropOnDirectory: (category: 'tones' | 'patches' | 'samples', targetPath: string[], dragData: TreeMoveData) => void;
  handleRename: (category: 'tones' | 'patches' | 'samples', node: LibraryTreeNode, newName: string) => Promise<void>;
}

export function useLibraryTreeActions({
  selectedName,
  selectedType,
  selectedPath,
  onSelectIndividualTone,
  onSelectIndividualPatch,
  onSelectSample,
  onSelectProgram,
  onToggleDirectoryExpanded,
  onDeleteIndividualTone,
  onDeleteIndividualPatch,
  onDeleteDirectory,
  onCreateDirectory,
  onRenameDirectory,
  onMoveItem,
  onDropMoveItem,
  onRenameItem,
}: UseLibraryTreeActionsParams): LibraryTreeActionsResult {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: LibraryTreeNode;
    category: 'tones' | 'patches' | 'samples';
  } | null>(null);

  // Handle context menu for tree items
  const handleTreeContextMenu = useCallback((
    e: React.MouseEvent,
    node: LibraryTreeNode,
    category: 'tones' | 'patches' | 'samples'
  ) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node, category });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Build context menu actions for a node
  const getContextMenuActions = useCallback((): ContextMenuAction[] => {
    if (!contextMenu) return [];

    const { node, category } = contextMenu;
    // Common-area items are read-only for now — no context menu actions
    if (category === 'samples') return [];

    const actions: ContextMenuAction[] = [];
    const categoryForService: LibraryCategory = category;

    if (node.type === 'directory') {
      // Directory actions
      actions.push({
        label: 'New Folder',
        icon: <NewFolderIcon />,
        onClick: () => onCreateDirectory?.(categoryForService, [...node.path, node.name]),
      });
      actions.push({
        label: 'Rename',
        icon: <RenameIcon />,
        onClick: () => onRenameDirectory?.(categoryForService, [...node.path, node.name]),
      });
      actions.push({ label: '', separator: true, onClick: () => {} });
      actions.push({
        label: 'Delete',
        icon: <DeleteIcon />,
        onClick: () => onDeleteDirectory?.(categoryForService, [...node.path, node.name]),
        danger: true,
      });
    } else {
      // Item actions (tone, patch, drum-kit)
      actions.push({
        label: 'Move to...',
        icon: <MoveIcon />,
        onClick: () => onMoveItem?.(categoryForService, node.path, node.fileName || node.directoryName || node.name),
      });
      actions.push({ label: '', separator: true, onClick: () => {} });
      actions.push({
        label: 'Delete',
        icon: <DeleteIcon />,
        onClick: () => {
          if (node.type === 'tone') {
            onDeleteIndividualTone?.(node.fileName || node.name, node.path);
          } else if (node.type === 'patch') {
            onDeleteIndividualPatch?.(node.directoryName || node.name, node.path);
          }
        },
        danger: true,
      });
    }

    return actions;
  }, [contextMenu, onCreateDirectory, onRenameDirectory, onDeleteDirectory, onMoveItem, onDeleteIndividualTone, onDeleteIndividualPatch]);

  // Handle tree node selection
  const handleTreeNodeSelect = useCallback((
    node: LibraryTreeNode,
    category: 'tones' | 'patches' | 'samples'
  ) => {
    if (node.type === 'directory') {
      // Toggle directory expansion
      onToggleDirectoryExpanded?.(category, node.id);
    } else if (node.type === 'tone') {
      onSelectIndividualTone(node.fileName || node.name, node.path);
    } else if (node.type === 'patch') {
      onSelectIndividualPatch(node.directoryName || node.name, node.path);
    } else if (node.type === 'sample') {
      onSelectSample?.(node.fileName || node.name, node.path);
    } else if (node.type === 'program') {
      onSelectProgram?.(node.directoryName || node.name, node.path);
    }
  }, [onToggleDirectoryExpanded, onSelectIndividualTone, onSelectIndividualPatch, onSelectSample, onSelectProgram]);

  // Handle tree node delete
  const handleTreeNodeDelete = useCallback((
    node: LibraryTreeNode,
    category: 'tones' | 'patches' | 'samples'
  ) => {
    // Common-area items are read-only for now
    if (category === 'samples') return;

    if (node.type === 'directory') {
      onDeleteDirectory?.(category, [...node.path, node.name]);
    } else if (node.type === 'tone') {
      onDeleteIndividualTone?.(node.fileName || node.name, node.path);
    } else if (node.type === 'patch') {
      onDeleteIndividualPatch?.(node.directoryName || node.name, node.path);
    }
  }, [onDeleteDirectory, onDeleteIndividualTone, onDeleteIndividualPatch]);

  // Compute selected ID for tree rendering
  const computeSelectedId = useCallback((category: 'tones' | 'patches' | 'samples'): string | undefined => {
    if (!selectedPath || !selectedName) return undefined;
    if (category === 'tones' && selectedType === 'individualTone') {
      return [...selectedPath, selectedName].join('/');
    }
    if (category === 'patches' && selectedType === 'individualPatch') {
      return [...selectedPath, selectedName].join('/');
    }
    if (category === 'samples' && (selectedType === 'sample' || selectedType === 'program')) {
      return [...selectedPath, selectedName].join('/');
    }
    return undefined;
  }, [selectedPath, selectedName, selectedType]);

  // Handle drag-drop move onto directory
  const handleDropOnDirectory = useCallback((
    category: 'tones' | 'patches' | 'samples',
    targetPath: string[],
    dragData: TreeMoveData
  ) => {
    if (!onDropMoveItem || category === 'samples') return;

    const libCategory: LibraryCategory = category;
    const sourcePath = dragData.path;
    const itemName = dragData.name;

    onDropMoveItem(libCategory, sourcePath, itemName, targetPath);
  }, [onDropMoveItem]);

  // Handle rename via double-click
  const handleRename = useCallback(async (
    category: 'tones' | 'patches' | 'samples',
    node: LibraryTreeNode,
    newName: string
  ) => {
    if (!onRenameItem || category === 'samples') return;

    const libCategory: LibraryCategory = category;
    const oldName = node.fileName || node.directoryName || node.name;
    const isDirectory = node.type === 'directory';

    await onRenameItem(libCategory, node.path, oldName, newName, isDirectory);
  }, [onRenameItem]);

  return {
    contextMenu,
    handleTreeContextMenu,
    closeContextMenu,
    getContextMenuActions,
    handleTreeNodeSelect,
    handleTreeNodeDelete,
    computeSelectedId,
    handleDropOnDirectory,
    handleRename,
  };
}
