/**
 * Set Item
 *
 * Expandable tree node representing a set in the library.
 * Shows contained tones and patches when expanded, supports
 * inline rename via double-click, drag-start for child items,
 * and delete.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { SetInfo, SetYaml } from '@audiocontrol/sampler-library/browser';
import { cn } from '@/lib/utils';
import { FolderIcon, ChevronIcon, WaveIcon, PatchIcon, DeleteButton } from './LibraryTreeIcons';

export interface SetItemProps {
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
}

export function SetItem({
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
}: SetItemProps): JSX.Element {
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
    <div data-testid={`set-item-${setInfo.name}`}>
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
