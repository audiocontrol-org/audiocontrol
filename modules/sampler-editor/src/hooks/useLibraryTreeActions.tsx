/**
 * useLibraryTreeActions
 *
 * Encapsulates context menu state and actions, tree node
 * selection/delete handlers, selected-ID computation, and
 * directory drop-move / rename handlers for LibraryTreePanel.
 */

import { useState, useCallback } from 'react';
import type { LibraryTreeNode, LibraryCategory } from '@/lib/library-service';
import type { LibraryDragData } from '@/components/library/DeviceMemoryPanel';
import {
  type ContextMenuAction,
  NewFolderIcon,
  RenameIcon,
  MoveIcon,
  DeleteIcon,
} from '@/components/library/LibraryContextMenu';

export interface UseLibraryTreeActionsParams {
  selectedName?: string;
  selectedType?: 'tone' | 'patch' | 'set' | 'drumKit' | 'individualTone' | 'individualPatch';
  selectedPath?: string[];
  onSelectDrumKit: (name: string, path?: string[]) => void;
  onSelectIndividualTone: (name: string, path?: string[]) => void;
  onSelectIndividualPatch: (name: string, path?: string[]) => void;
  onToggleDirectoryExpanded?: (category: 'tones' | 'patches' | 'drumKits', path: string) => void;
  onDeleteIndividualTone?: (fileName: string, path?: string[]) => void;
  onDeleteIndividualPatch?: (fileName: string, path?: string[]) => void;
  onDeleteDrumKit?: (directoryName: string, path?: string[]) => void;
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
    category: 'tones' | 'patches' | 'drumKits';
  } | null;
  handleTreeContextMenu: (e: React.MouseEvent, node: LibraryTreeNode, category: 'tones' | 'patches' | 'drumKits') => void;
  closeContextMenu: () => void;
  getContextMenuActions: () => ContextMenuAction[];
  handleTreeNodeSelect: (node: LibraryTreeNode, category: 'tones' | 'patches' | 'drumKits') => void;
  handleTreeNodeDelete: (node: LibraryTreeNode, category: 'tones' | 'patches' | 'drumKits') => void;
  computeSelectedId: (category: 'tones' | 'patches' | 'drumKits') => string | undefined;
  handleDropOnDirectory: (category: 'tones' | 'patches' | 'drumKits', targetPath: string[], dragData: LibraryDragData) => void;
  handleRename: (category: 'tones' | 'patches' | 'drumKits', node: LibraryTreeNode, newName: string) => Promise<void>;
}

export function useLibraryTreeActions({
  selectedName,
  selectedType,
  selectedPath,
  onSelectDrumKit,
  onSelectIndividualTone,
  onSelectIndividualPatch,
  onToggleDirectoryExpanded,
  onDeleteIndividualTone,
  onDeleteIndividualPatch,
  onDeleteDrumKit,
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
    category: 'tones' | 'patches' | 'drumKits';
  } | null>(null);

  // Handle context menu for tree items
  const handleTreeContextMenu = useCallback((
    e: React.MouseEvent,
    node: LibraryTreeNode,
    category: 'tones' | 'patches' | 'drumKits'
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
    const actions: ContextMenuAction[] = [];
    const categoryForService = category === 'drumKits' ? 'drum-kits' : category;

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
          } else if (node.type === 'drum-kit') {
            onDeleteDrumKit?.(node.directoryName || node.name, node.path);
          }
        },
        danger: true,
      });
    }

    return actions;
  }, [contextMenu, onCreateDirectory, onRenameDirectory, onDeleteDirectory, onMoveItem, onDeleteIndividualTone, onDeleteIndividualPatch, onDeleteDrumKit]);

  // Handle tree node selection
  const handleTreeNodeSelect = useCallback((
    node: LibraryTreeNode,
    category: 'tones' | 'patches' | 'drumKits'
  ) => {
    if (node.type === 'directory') {
      // Toggle directory expansion
      onToggleDirectoryExpanded?.(category, node.id);
    } else if (node.type === 'tone') {
      onSelectIndividualTone(node.fileName || node.name, node.path);
    } else if (node.type === 'patch') {
      onSelectIndividualPatch(node.directoryName || node.name, node.path);
    } else if (node.type === 'drum-kit') {
      onSelectDrumKit(node.directoryName || node.name, node.path);
    }
  }, [onToggleDirectoryExpanded, onSelectIndividualTone, onSelectIndividualPatch, onSelectDrumKit]);

  // Handle tree node delete
  const handleTreeNodeDelete = useCallback((
    node: LibraryTreeNode,
    category: 'tones' | 'patches' | 'drumKits'
  ) => {
    if (node.type === 'directory') {
      const categoryForService = category === 'drumKits' ? 'drum-kits' : category;
      onDeleteDirectory?.(categoryForService, [...node.path, node.name]);
    } else if (node.type === 'tone') {
      onDeleteIndividualTone?.(node.fileName || node.name, node.path);
    } else if (node.type === 'patch') {
      onDeleteIndividualPatch?.(node.directoryName || node.name, node.path);
    } else if (node.type === 'drum-kit') {
      onDeleteDrumKit?.(node.directoryName || node.name, node.path);
    }
  }, [onDeleteDirectory, onDeleteIndividualTone, onDeleteIndividualPatch, onDeleteDrumKit]);

  // Compute selected ID for tree rendering
  const computeSelectedId = useCallback((category: 'tones' | 'patches' | 'drumKits'): string | undefined => {
    if (!selectedPath || !selectedName) return undefined;
    if (category === 'tones' && selectedType === 'individualTone') {
      return [...selectedPath, selectedName].join('/');
    }
    if (category === 'patches' && selectedType === 'individualPatch') {
      return [...selectedPath, selectedName].join('/');
    }
    if (category === 'drumKits' && selectedType === 'drumKit') {
      return [...selectedPath, selectedName].join('/');
    }
    return undefined;
  }, [selectedPath, selectedName, selectedType]);

  // Handle drag-drop move onto directory
  const handleDropOnDirectory = useCallback((
    category: 'tones' | 'patches' | 'drumKits',
    targetPath: string[],
    dragData: LibraryDragData
  ) => {
    if (!onDropMoveItem) return;

    // Map category back to LibraryCategory
    const libCategory = category === 'drumKits' ? 'drum-kits' : category;
    const sourcePath = dragData.path || [];
    const itemName = dragData.name;

    onDropMoveItem(libCategory as 'tones' | 'patches' | 'drum-kits', sourcePath, itemName, targetPath);
  }, [onDropMoveItem]);

  // Handle rename via double-click
  const handleRename = useCallback(async (
    category: 'tones' | 'patches' | 'drumKits',
    node: LibraryTreeNode,
    newName: string
  ) => {
    if (!onRenameItem) return;

    // Map category back to LibraryCategory
    const libCategory = category === 'drumKits' ? 'drum-kits' : category;
    const oldName = node.fileName || node.directoryName || node.name;
    const isDirectory = node.type === 'directory';

    await onRenameItem(libCategory as 'tones' | 'patches' | 'drum-kits', node.path, oldName, newName, isDirectory);
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
