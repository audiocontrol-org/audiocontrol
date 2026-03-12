/**
 * Library Tree Panel
 *
 * Center panel showing library contents in a tree structure:
 * - Sets (expandable folders showing their tones/patches)
 * - Individual Tones (hierarchical with subdirectories)
 * - Individual Patches (hierarchical with subdirectories)
 * - Drum Kits (hierarchical with subdirectories)
 *
 * Supports drag and drop from device memory to export items to library.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { SetInfo, SetYaml } from '@audiocontrol/sampler-library/browser';
import {
  loadSetManifest,
  type DrumKitInfo,
  type LibraryToneInfo,
  type LibraryPatchInfo,
  type LibraryTreeNode,
  type LibraryCategory,
} from '@/lib/library-service';
import { cn } from '@/lib/utils';
import { DEVICE_DRAG_MIME, type DeviceDragData, LIBRARY_DRAG_MIME, type LibraryDragData } from './DeviceMemoryPanel';
import { TreeSection } from './LibraryTreeNode';
import {
  LibraryContextMenu,
  type ContextMenuAction,
  NewFolderIcon,
  RenameIcon,
  MoveIcon,
  DeleteIcon,
} from './LibraryContextMenu';

interface LibraryTreePanelProps {
  libraryHandle: FileSystemDirectoryHandle | null;
  sets: SetInfo[];
  drumKits: DrumKitInfo[];
  individualTones: LibraryToneInfo[];
  individualPatches: LibraryPatchInfo[];
  /** Hierarchical tree for tones (optional, falls back to flat list) */
  tonesTree?: LibraryTreeNode[];
  /** Hierarchical tree for patches (optional, falls back to flat list) */
  patchesTree?: LibraryTreeNode[];
  /** Hierarchical tree for drum kits (optional, falls back to flat list) */
  drumKitsTree?: LibraryTreeNode[];
  /** Expanded directory paths per category */
  expandedPaths?: {
    tones: Set<string>;
    patches: Set<string>;
    drumKits: Set<string>;
  };
  selectedName?: string;
  selectedType?: 'tone' | 'patch' | 'set' | 'drumKit' | 'individualTone' | 'individualPatch';
  selectedSetName?: string;
  /** Selected path for hierarchical items */
  selectedPath?: string[];
  onSelectSet: (name: string) => void;
  onSelectTone: (name: string, setName: string) => void;
  onSelectPatch: (name: string, setName: string) => void;
  onSelectDrumKit: (name: string, path?: string[]) => void;
  onSelectIndividualTone: (name: string, path?: string[]) => void;
  onSelectIndividualPatch: (name: string, path?: string[]) => void;
  onRefresh: () => void;
  isLoading: boolean;
  /** Callback when a device tone is dropped to export to library */
  onDropDeviceTone?: (data: DeviceDragData, targetPath?: string[]) => void;
  /** Callback when a device patch is dropped to export to library */
  onDropDevicePatch?: (data: DeviceDragData, targetPath?: string[]) => void;
  /** Callback to delete a set */
  onDeleteSet?: (name: string) => void;
  /** Callback to delete an individual tone */
  onDeleteIndividualTone?: (fileName: string, path?: string[]) => void;
  /** Callback to delete an individual patch */
  onDeleteIndividualPatch?: (fileName: string, path?: string[]) => void;
  /** Callback to delete a drum kit */
  onDeleteDrumKit?: (directoryName: string, path?: string[]) => void;
  /** Callback to toggle directory expansion */
  onToggleDirectoryExpanded?: (category: 'tones' | 'patches' | 'drumKits', path: string) => void;
  /** Callback to create a new directory */
  onCreateDirectory?: (category: LibraryCategory, parentPath: string[]) => void;
  /** Callback to rename a directory */
  onRenameDirectory?: (category: LibraryCategory, path: string[]) => void;
  /** Callback to delete a directory */
  onDeleteDirectory?: (category: LibraryCategory, path: string[]) => void;
  /** Callback to move an item (via dialog) */
  onMoveItem?: (category: LibraryCategory, sourcePath: string[], itemName: string) => void;
  /** Callback when an item is dropped onto a directory (drag-drop move) */
  onDropMoveItem?: (category: LibraryCategory, sourcePath: string[], itemName: string, targetPath: string[]) => void;
  /** Callback to rename an item (double-click to edit) */
  onRenameItem?: (category: LibraryCategory, path: string[], oldName: string, newName: string, isDirectory: boolean) => Promise<void>;
  /** Callback to rename a set (double-click to edit) */
  onRenameSet?: (oldName: string, newName: string) => Promise<void>;
}

/**
 * Folder icon component
 */
function FolderIcon({ isOpen }: { isOpen: boolean }): JSX.Element {
  return (
    <svg
      className={cn('w-4 h-4', isOpen ? 'text-s330-highlight' : 'text-s330-muted')}
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

/**
 * Chevron icon for expandable items
 */
function ChevronIcon({ isExpanded }: { isExpanded: boolean }): JSX.Element {
  return (
    <svg
      className={cn(
        'w-3 h-3 text-s330-muted transition-transform',
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

/**
 * Wave icon for tones
 */
function WaveIcon(): JSX.Element {
  return (
    <svg className="w-3.5 h-3.5 text-s330-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
      />
    </svg>
  );
}

/**
 * Patch icon
 */
function PatchIcon(): JSX.Element {
  return (
    <svg className="w-3.5 h-3.5 text-s330-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
      />
    </svg>
  );
}

/**
 * Drum kit icon
 */
function DrumKitIcon(): JSX.Element {
  return (
    <svg className="w-3.5 h-3.5 text-s330-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="12" cy="12" r="8" strokeWidth={2} />
      <circle cx="12" cy="12" r="3" strokeWidth={2} />
    </svg>
  );
}

/**
 * Delete button that appears on hover/focus
 */
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

/**
 * Drum kit item
 */
function DrumKitItem({
  kitInfo,
  isSelected,
  onSelect,
  onDelete,
  onDragStart,
}: {
  kitInfo: DrumKitInfo;
  isSelected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
}): JSX.Element {
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  }, [onDelete]);

  return (
    <div
      className={cn(
        'group w-full text-left px-2 py-1.5 rounded text-sm transition-colors',
        'flex items-center gap-2 cursor-grab active:cursor-grabbing',
        isSelected
          ? 'bg-s330-highlight/20 text-s330-highlight'
          : 'text-s330-text hover:bg-s330-accent/30'
      )}
      onClick={onSelect}
      draggable
      onDragStart={onDragStart}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
    >
      <DrumKitIcon />
      <span className="flex-1 truncate font-medium">{kitInfo.name}</span>
      <span className="text-xs text-s330-muted">
        {kitInfo.kitCount} kit{kitInfo.kitCount !== 1 ? 's' : ''} / {kitInfo.sampleCount} samples
      </span>
      {onDelete && <DeleteButton onClick={handleDelete} title="Delete drum kit" />}
    </div>
  );
}

/**
 * Set item with expandable contents showing individual tones/patches
 */
function SetItem({
  setInfo,
  manifest,
  isSelected,
  isExpanded,
  selectedItemName,
  selectedItemType,
  onToggle,
  onSelect,
  onSelectTone,
  onSelectPatch,
  onToneDragStart,
  onPatchDragStart,
  isLoadingManifest,
  onDelete,
  onRename,
}: {
  setInfo: SetInfo;
  manifest: SetYaml | null;
  isSelected: boolean;
  isExpanded: boolean;
  selectedItemName?: string;
  selectedItemType?: 'tone' | 'patch' | 'set';
  onToggle: () => void;
  onSelect: () => void;
  onSelectTone: (toneFile: string) => void;
  onSelectPatch: (patchFile: string) => void;
  onToneDragStart?: (e: React.DragEvent, toneFile: string) => void;
  onPatchDragStart?: (e: React.DragEvent, patchFile: string) => void;
  isLoadingManifest: boolean;
  onDelete?: () => void;
  onRename?: (newName: string) => Promise<void>;
}): JSX.Element {
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

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  }, [onDelete]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!onRename) return;
    setEditValue(setInfo.name);
    setIsEditing(true);
  }, [setInfo.name, onRename]);

  const handleRenameSubmit = useCallback(async () => {
    const trimmedValue = editValue.trim();
    if (!trimmedValue || trimmedValue === setInfo.name || !onRename) {
      setIsEditing(false);
      return;
    }

    setIsRenaming(true);
    try {
      await onRename(trimmedValue);
      setIsEditing(false);
    } catch (err) {
      console.error('[SetItem] Rename failed:', err);
    } finally {
      setIsRenaming(false);
    }
  }, [editValue, setInfo.name, onRename]);

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
    if (!isRenaming) {
      handleRenameSubmit();
    }
  }, [isRenaming, handleRenameSubmit]);

  return (
    <div>
      <div
        className={cn(
          'group w-full text-left px-2 py-1.5 rounded text-sm transition-colors',
          'flex items-center gap-2',
          isSelected
            ? 'bg-s330-highlight/20 text-s330-highlight'
            : 'text-s330-text hover:bg-s330-accent/30'
        )}
        onClick={(e) => {
          if (isEditing) return;
          if ((e.target as HTMLElement).closest('.expand-toggle')) {
            onToggle();
          } else if (!(e.target as HTMLElement).closest('.delete-btn')) {
            onSelect();
          }
        }}
        onDoubleClick={handleDoubleClick}
        role="button"
        tabIndex={isEditing ? -1 : 0}
        onKeyDown={(e) => !isEditing && e.key === 'Enter' && onSelect()}
      >
        <span className="expand-toggle cursor-pointer p-0.5 -ml-0.5">
          <ChevronIcon isExpanded={isExpanded} />
        </span>
        <FolderIcon isOpen={isExpanded} />
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
          <span className="flex-1 truncate font-medium">{setInfo.name}</span>
        )}
        <span className="text-xs text-s330-muted">
          {setInfo.toneCount}T / {setInfo.patchCount}P
        </span>
        {onDelete && (
          <span className="delete-btn">
            <DeleteButton onClick={handleDelete} title="Delete set" />
          </span>
        )}
      </div>

      {/* Expanded contents with individual items */}
      {isExpanded && (
        <div className="ml-6 mt-0.5 space-y-0.5 border-l border-s330-accent/30 pl-2">
          {isLoadingManifest ? (
            <div className="text-xs text-s330-muted py-2 flex items-center gap-2">
              <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              Loading...
            </div>
          ) : manifest ? (
            <>
              {/* Tones section */}
              {manifest.tones.length > 0 && (
                <div className="py-1">
                  <div className="text-xs text-s330-muted uppercase tracking-wide mb-1">
                    Tones
                  </div>
                  <div className="space-y-0.5">
                    {manifest.tones.map((entry) => (
                      <div
                        key={entry.file}
                        onClick={() => onSelectTone(entry.file)}
                        draggable
                        onDragStart={(e) => onToneDragStart?.(e, entry.file)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && onSelectTone(entry.file)}
                        className={cn(
                          'w-full text-left px-2 py-1 rounded text-xs transition-colors',
                          'flex items-center gap-2 cursor-grab active:cursor-grabbing',
                          selectedItemType === 'tone' && selectedItemName === entry.file
                            ? 'bg-s330-highlight/20 text-s330-highlight'
                            : 'text-s330-text hover:bg-s330-accent/30'
                        )}
                      >
                        <WaveIcon />
                        <span className="truncate">{entry.file}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Patches section */}
              {manifest.patches.length > 0 && (
                <div className="py-1">
                  <div className="text-xs text-s330-muted uppercase tracking-wide mb-1">
                    Patches
                  </div>
                  <div className="space-y-0.5">
                    {manifest.patches.map((entry) => (
                      <div
                        key={entry.file}
                        onClick={() => onSelectPatch(entry.file)}
                        draggable
                        onDragStart={(e) => onPatchDragStart?.(e, entry.file)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && onSelectPatch(entry.file)}
                        className={cn(
                          'w-full text-left px-2 py-1 rounded text-xs transition-colors',
                          'flex items-center gap-2 cursor-grab active:cursor-grabbing',
                          selectedItemType === 'patch' && selectedItemName === entry.file
                            ? 'bg-s330-highlight/20 text-s330-highlight'
                            : 'text-s330-text hover:bg-s330-accent/30'
                        )}
                      >
                        <PatchIcon />
                        <span className="truncate">{entry.file}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Description if present */}
              {setInfo.description && (
                <div className="text-xs text-s330-muted/70 py-1 italic">
                  {setInfo.description}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Fallback when manifest not loaded */}
              {setInfo.toneCount > 0 && (
                <div className="text-xs text-s330-muted py-1">
                  {setInfo.toneCount} tone{setInfo.toneCount !== 1 ? 's' : ''}
                </div>
              )}
              {setInfo.patchCount > 0 && (
                <div className="text-xs text-s330-muted py-1">
                  {setInfo.patchCount} patch{setInfo.patchCount !== 1 ? 'es' : ''}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function LibraryTreePanel({
  libraryHandle,
  sets,
  drumKits,
  individualTones,
  individualPatches,
  tonesTree,
  patchesTree,
  drumKitsTree,
  expandedPaths,
  selectedName,
  selectedType,
  selectedSetName,
  selectedPath,
  onSelectSet,
  onSelectTone,
  onSelectPatch,
  onSelectDrumKit,
  onSelectIndividualTone,
  onSelectIndividualPatch,
  onRefresh,
  isLoading,
  onDropDeviceTone,
  onDropDevicePatch,
  onDeleteSet,
  onDeleteIndividualTone,
  onDeleteIndividualPatch,
  onDeleteDrumKit,
  onToggleDirectoryExpanded,
  onCreateDirectory,
  onRenameDirectory,
  onDeleteDirectory,
  onMoveItem,
  onDropMoveItem,
  onRenameItem,
  onRenameSet,
}: LibraryTreePanelProps): JSX.Element {
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());
  const [manifests, setManifests] = useState<Map<string, SetYaml>>(new Map());
  const [loadingManifests, setLoadingManifests] = useState<Set<string>>(new Set());
  const [isToneDragOver, setIsToneDragOver] = useState(false);
  const [isPatchDragOver, setIsPatchDragOver] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: LibraryTreeNode;
    category: 'tones' | 'patches' | 'drumKits';
  } | null>(null);

  // Handle drag over for tone drop zone
  const handleToneDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DEVICE_DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleToneDragEnter = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DEVICE_DRAG_MIME)) {
      e.preventDefault();
      setIsToneDragOver(true);
    }
  }, []);

  const handleToneDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsToneDragOver(false);
    }
  }, []);

  const handleToneDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsToneDragOver(false);

    const jsonData = e.dataTransfer.getData(DEVICE_DRAG_MIME);
    if (!jsonData) return;

    try {
      const data = JSON.parse(jsonData) as DeviceDragData;
      onDropDeviceTone?.(data);
    } catch (err) {
      console.error('[LibraryTreePanel] Failed to parse drop data:', err);
    }
  }, [onDropDeviceTone]);

  // Handle drag over for patch drop zone
  const handlePatchDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DEVICE_DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handlePatchDragEnter = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DEVICE_DRAG_MIME)) {
      e.preventDefault();
      setIsPatchDragOver(true);
    }
  }, []);

  const handlePatchDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsPatchDragOver(false);
    }
  }, []);

  const handlePatchDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsPatchDragOver(false);

    const jsonData = e.dataTransfer.getData(DEVICE_DRAG_MIME);
    if (!jsonData) return;

    try {
      const data = JSON.parse(jsonData) as DeviceDragData;
      onDropDevicePatch?.(data);
    } catch (err) {
      console.error('[LibraryTreePanel] Failed to parse drop data:', err);
    }
  }, [onDropDevicePatch]);

  // Handle drag start for individual tones (library -> device)
  const handleIndividualToneDragStart = useCallback((e: React.DragEvent, toneInfo: LibraryToneInfo) => {
    const dragData: LibraryDragData = {
      source: 'library',
      type: 'tone',
      name: toneInfo.fileName,
    };
    e.dataTransfer.setData(LIBRARY_DRAG_MIME, JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  // Handle drag start for individual patches (library -> device)
  const handleIndividualPatchDragStart = useCallback((e: React.DragEvent, patchInfo: LibraryPatchInfo) => {
    const dragData: LibraryDragData = {
      source: 'library',
      type: 'patch',
      name: patchInfo.directoryName,
    };
    e.dataTransfer.setData(LIBRARY_DRAG_MIME, JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  // Handle drag start for drum kits (library -> device)
  const handleDrumKitDragStart = useCallback((e: React.DragEvent, kitInfo: DrumKitInfo) => {
    const dragData: LibraryDragData = {
      source: 'library',
      type: 'drumKit',
      name: kitInfo.directoryName,
    };
    e.dataTransfer.setData(LIBRARY_DRAG_MIME, JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  // Handle drag start for tones within sets (library -> device)
  const handleSetToneDragStart = useCallback((e: React.DragEvent, toneFile: string, setName: string) => {
    const dragData: LibraryDragData = {
      source: 'library',
      type: 'tone',
      name: toneFile,
      setName,
      toneFile,
    };
    e.dataTransfer.setData(LIBRARY_DRAG_MIME, JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  // Handle drag start for patches within sets (library -> device)
  const handleSetPatchDragStart = useCallback((e: React.DragEvent, patchFile: string, setName: string) => {
    const dragData: LibraryDragData = {
      source: 'library',
      type: 'patch',
      name: patchFile,
      setName,
      patchFile,
    };
    e.dataTransfer.setData(LIBRARY_DRAG_MIME, JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  const toggleSet = useCallback((name: string) => {
    setExpandedSets((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

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

  // Load manifest when a set is expanded
  useEffect(() => {
    if (!libraryHandle) return;

    for (const setName of expandedSets) {
      if (manifests.has(setName) || loadingManifests.has(setName)) continue;

      setLoadingManifests((prev) => new Set(prev).add(setName));

      loadSetManifest(libraryHandle, setName)
        .then((manifest) => {
          setManifests((prev) => new Map(prev).set(setName, manifest));
        })
        .catch((err) => {
          console.error(`[LibraryTreePanel] Failed to load manifest for ${setName}:`, err);
        })
        .finally(() => {
          setLoadingManifests((prev) => {
            const next = new Set(prev);
            next.delete(setName);
            return next;
          });
        });
    }
  }, [expandedSets, libraryHandle, manifests, loadingManifests]);

  if (!libraryHandle) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-s330-accent">
          <h3 className="font-bold text-s330-text">Library</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-s330-muted text-sm">
            <p className="mb-2">No library folder selected</p>
            <p className="text-xs">
              Click "Select Library Folder" above to connect your library.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-s330-accent">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-s330-text">Library</h3>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className={cn(
              'text-s330-muted hover:text-s330-text transition-colors p-1',
              isLoading && 'animate-spin'
            )}
            title="Refresh library"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
        <p className="text-xs text-s330-muted mt-1">
          {sets.length} set{sets.length !== 1 ? 's' : ''}
          {drumKits.length > 0 && ` / ${drumKits.length} drum kit${drumKits.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Sets Section */}
        <div className="p-2">
          <div className="text-xs font-medium text-s330-muted uppercase tracking-wide px-2 py-1">
            Sets
          </div>

          {sets.length === 0 ? (
            <div className="text-sm text-s330-muted/70 px-2 py-4 text-center italic">
              No sets in library
            </div>
          ) : (
            <div className="space-y-0.5">
              {sets.map((setInfo) => (
                <SetItem
                  key={setInfo.name}
                  setInfo={setInfo}
                  manifest={manifests.get(setInfo.name) ?? null}
                  isSelected={selectedType === 'set' && selectedName === setInfo.name}
                  isExpanded={expandedSets.has(setInfo.name)}
                  selectedItemName={selectedSetName === setInfo.name ? selectedName : undefined}
                  selectedItemType={selectedSetName === setInfo.name && selectedType !== 'drumKit' && selectedType !== 'individualTone' && selectedType !== 'individualPatch' ? selectedType : undefined}
                  onToggle={() => toggleSet(setInfo.name)}
                  onSelect={() => onSelectSet(setInfo.name)}
                  onSelectTone={(toneFile) => onSelectTone(toneFile, setInfo.name)}
                  onSelectPatch={(patchFile) => onSelectPatch(patchFile, setInfo.name)}
                  onToneDragStart={(e, toneFile) => handleSetToneDragStart(e, toneFile, setInfo.name)}
                  onPatchDragStart={(e, patchFile) => handleSetPatchDragStart(e, patchFile, setInfo.name)}
                  isLoadingManifest={loadingManifests.has(setInfo.name)}
                  onDelete={onDeleteSet ? () => onDeleteSet(setInfo.name) : undefined}
                  onRename={onRenameSet ? (newName) => onRenameSet(setInfo.name, newName) : undefined}
                />
              ))}
            </div>
          )}
        </div>

        {/* Individual Tones Section - Drop Zone */}
        {tonesTree ? (
          // Hierarchical tree view
          <TreeSection
            title="Individual Tones"
            nodes={tonesTree}
            category="tones"
            expandedPaths={expandedPaths?.tones ?? new Set()}
            selectedId={computeSelectedId('tones')}
            onToggleExpand={(nodeId) => onToggleDirectoryExpanded?.('tones', nodeId)}
            onSelect={(node) => handleTreeNodeSelect(node, 'tones')}
            onDelete={(node) => handleTreeNodeDelete(node, 'tones')}
            onContextMenu={(e, node) => handleTreeContextMenu(e, node, 'tones')}
            onDropOnDirectory={(targetPath, dragData) => handleDropOnDirectory('tones', targetPath, dragData)}
            onRename={(node, newName) => handleRename('tones', node, newName)}
            emptyMessage="Drag tones from device to export"
            isDragOver={isToneDragOver}
            onDragOver={handleToneDragOver}
            onDragEnter={handleToneDragEnter}
            onDragLeave={handleToneDragLeave}
            onDrop={handleToneDrop}
            dropMessage="Drop to export"
            headerActions={
              onCreateDirectory && (
                <button
                  onClick={() => onCreateDirectory('tones', [])}
                  className="text-s330-muted hover:text-s330-text p-0.5"
                  title="New folder"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                </button>
              )
            }
          />
        ) : (
          // Flat list view (legacy)
          <div
            className={cn(
              'p-2 border-t border-s330-accent/30 transition-colors',
              isToneDragOver && 'bg-s330-highlight/10 border-s330-highlight'
            )}
            onDragOver={handleToneDragOver}
            onDragEnter={handleToneDragEnter}
            onDragLeave={handleToneDragLeave}
            onDrop={handleToneDrop}
          >
            <div className="text-xs font-medium text-s330-muted uppercase tracking-wide px-2 py-1 flex items-center gap-2">
              Individual Tones
              {isToneDragOver && (
                <span className="text-s330-highlight font-normal normal-case">
                  — Drop to export
                </span>
              )}
            </div>

            {individualTones.length === 0 && !isToneDragOver ? (
              <div className="text-sm text-s330-muted/70 px-2 py-4 text-center italic">
                Drag tones from device to export
              </div>
            ) : (
              <div className="space-y-0.5">
                {individualTones.map((toneInfo) => (
                  <div
                    key={toneInfo.fileName}
                    onClick={() => onSelectIndividualTone(toneInfo.fileName)}
                    draggable
                    onDragStart={(e) => handleIndividualToneDragStart(e, toneInfo)}
                    className={cn(
                      'group w-full text-left px-2 py-1.5 rounded text-sm transition-colors',
                      'flex items-center gap-2 cursor-grab active:cursor-grabbing',
                      selectedType === 'individualTone' && selectedName === toneInfo.fileName
                        ? 'bg-s330-highlight/20 text-s330-highlight'
                        : 'text-s330-text hover:bg-s330-accent/30'
                    )}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && onSelectIndividualTone(toneInfo.fileName)}
                  >
                    <WaveIcon />
                    <span className="flex-1 truncate font-medium">{toneInfo.name}</span>
                    {onDeleteIndividualTone && (
                      <DeleteButton
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteIndividualTone(toneInfo.fileName);
                        }}
                        title="Delete tone"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {isToneDragOver && (
              <div className="mt-2 p-3 border-2 border-dashed border-s330-highlight/50 rounded text-center text-sm text-s330-highlight">
                Drop tone here to export
              </div>
            )}
          </div>
        )}

        {/* Individual Patches Section - Drop Zone */}
        {patchesTree ? (
          // Hierarchical tree view
          <TreeSection
            title="Individual Patches"
            nodes={patchesTree}
            category="patches"
            expandedPaths={expandedPaths?.patches ?? new Set()}
            selectedId={computeSelectedId('patches')}
            onToggleExpand={(nodeId) => onToggleDirectoryExpanded?.('patches', nodeId)}
            onSelect={(node) => handleTreeNodeSelect(node, 'patches')}
            onDelete={(node) => handleTreeNodeDelete(node, 'patches')}
            onContextMenu={(e, node) => handleTreeContextMenu(e, node, 'patches')}
            onDropOnDirectory={(targetPath, dragData) => handleDropOnDirectory('patches', targetPath, dragData)}
            onRename={(node, newName) => handleRename('patches', node, newName)}
            emptyMessage="Drag patches from device to export"
            isDragOver={isPatchDragOver}
            onDragOver={handlePatchDragOver}
            onDragEnter={handlePatchDragEnter}
            onDragLeave={handlePatchDragLeave}
            onDrop={handlePatchDrop}
            dropMessage="Drop to export"
            headerActions={
              onCreateDirectory && (
                <button
                  onClick={() => onCreateDirectory('patches', [])}
                  className="text-s330-muted hover:text-s330-text p-0.5"
                  title="New folder"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                </button>
              )
            }
          />
        ) : (
          // Flat list view (legacy)
          <div
            className={cn(
              'p-2 border-t border-s330-accent/30 transition-colors',
              isPatchDragOver && 'bg-s330-highlight/10 border-s330-highlight'
            )}
            onDragOver={handlePatchDragOver}
            onDragEnter={handlePatchDragEnter}
            onDragLeave={handlePatchDragLeave}
            onDrop={handlePatchDrop}
          >
            <div className="text-xs font-medium text-s330-muted uppercase tracking-wide px-2 py-1 flex items-center gap-2">
              Individual Patches
              {isPatchDragOver && (
                <span className="text-s330-highlight font-normal normal-case">
                  — Drop to export
                </span>
              )}
            </div>

            {individualPatches.length === 0 && !isPatchDragOver ? (
              <div className="text-sm text-s330-muted/70 px-2 py-4 text-center italic">
                Drag patches from device to export
              </div>
            ) : (
              <div className="space-y-0.5">
                {individualPatches.map((patchInfo) => (
                  <div
                    key={patchInfo.directoryName}
                    onClick={() => onSelectIndividualPatch(patchInfo.directoryName)}
                    draggable
                    onDragStart={(e) => handleIndividualPatchDragStart(e, patchInfo)}
                    className={cn(
                      'group w-full text-left px-2 py-1.5 rounded text-sm transition-colors',
                      'flex items-center gap-2 cursor-grab active:cursor-grabbing',
                      selectedType === 'individualPatch' && selectedName === patchInfo.directoryName
                        ? 'bg-s330-highlight/20 text-s330-highlight'
                        : 'text-s330-text hover:bg-s330-accent/30'
                    )}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && onSelectIndividualPatch(patchInfo.directoryName)}
                  >
                    <PatchIcon />
                    <span className="flex-1 truncate font-medium">{patchInfo.name}</span>
                    <span className="text-xs text-s330-muted">
                      {patchInfo.toneCount} tone{patchInfo.toneCount !== 1 ? 's' : ''}
                    </span>
                    {onDeleteIndividualPatch && (
                      <DeleteButton
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteIndividualPatch(patchInfo.directoryName);
                        }}
                        title="Delete patch bundle"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {isPatchDragOver && (
              <div className="mt-2 p-3 border-2 border-dashed border-s330-highlight/50 rounded text-center text-sm text-s330-highlight">
                Drop patch here to export
              </div>
            )}
          </div>
        )}

        {/* Drum Kits Section */}
        {drumKitsTree ? (
          // Hierarchical tree view
          <TreeSection
            title="Drum Kits"
            nodes={drumKitsTree}
            category="drumKits"
            expandedPaths={expandedPaths?.drumKits ?? new Set()}
            selectedId={computeSelectedId('drumKits')}
            onToggleExpand={(nodeId) => onToggleDirectoryExpanded?.('drumKits', nodeId)}
            onSelect={(node) => handleTreeNodeSelect(node, 'drumKits')}
            onDelete={(node) => handleTreeNodeDelete(node, 'drumKits')}
            onContextMenu={(e, node) => handleTreeContextMenu(e, node, 'drumKits')}
            onDropOnDirectory={(targetPath, dragData) => handleDropOnDirectory('drumKits', targetPath, dragData)}
            onRename={(node, newName) => handleRename('drumKits', node, newName)}
            emptyMessage="No drum kits in library"
            headerActions={
              onCreateDirectory && (
                <button
                  onClick={() => onCreateDirectory('drum-kits', [])}
                  className="text-s330-muted hover:text-s330-text p-0.5"
                  title="New folder"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                </button>
              )
            }
          />
        ) : (
          // Flat list view (legacy)
          <div className="p-2 border-t border-s330-accent/30">
            <div className="text-xs font-medium text-s330-muted uppercase tracking-wide px-2 py-1">
              Drum Kits
            </div>

            {drumKits.length === 0 ? (
              <div className="text-sm text-s330-muted/70 px-2 py-4 text-center italic">
                No drum kits in library
              </div>
            ) : (
              <div className="space-y-0.5">
                {drumKits.map((kitInfo) => (
                  <DrumKitItem
                    key={kitInfo.directoryName}
                    kitInfo={kitInfo}
                    isSelected={selectedType === 'drumKit' && selectedName === kitInfo.directoryName}
                    onSelect={() => onSelectDrumKit(kitInfo.directoryName)}
                    onDelete={onDeleteDrumKit ? () => onDeleteDrumKit(kitInfo.directoryName) : undefined}
                    onDragStart={(e) => handleDrumKitDragStart(e, kitInfo)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <LibraryContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={getContextMenuActions()}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}
