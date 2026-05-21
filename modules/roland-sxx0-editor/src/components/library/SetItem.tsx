/**
 * Set Item
 *
 * Expandable tree node for a library set. The set row itself + the
 * expanded patches/tones list under it all use the shared .ac-tree-*
 * chrome so visual weight matches the rest of the library tree
 * (chevron, hairline left-border for selection, lean uppercase
 * sub-section labels, mono-tabular trailing count).
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
    if (!isRenaming) handleRenameSubmit();
  }, [isRenaming, handleRenameSubmit]);

  return (
    <div data-testid={`set-item-${setInfo.name}`}>
      {/* Set row — same .ac-tree-node chrome as every other tree node. */}
      <div
        className={cn('ac-tree-node', isSelected && 'ac-tree-node--selected')}
        onClick={(e) => {
          if (isEditing) return;
          if ((e.target as HTMLElement).closest('.expand-toggle')) {
            onToggle();
          } else if (!(e.target as HTMLElement).closest('.ac-tree-delete-btn')) {
            onSelect();
          }
        }}
        onDoubleClick={handleDoubleClick}
        role="button"
        tabIndex={isEditing ? -1 : 0}
        onKeyDown={(e) => !isEditing && e.key === 'Enter' && onSelect()}
      >
        <span className="expand-toggle ac-tree-disclosure-btn">
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
            className="ac-tree-rename-input"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="ac-tree-node-name">{setInfo.name}</span>
        )}
        <span className="ac-tree-node-meta">
          {setInfo.toneCount}T / {setInfo.patchCount}P
        </span>
        {onDelete && <DeleteButton onClick={handleDelete} title="Delete set" />}
      </div>

      {/* Expanded contents — always mounted inside the .ac-collapse
          wrapper so the expand/collapse animates rather than snapping.
          .ac-tree-children inside still carries the indent rail. */}
      <div className="ac-collapse" data-expanded={isExpanded}>
        <div>
          <div className="ac-tree-children">
          {isLoadingManifest ? (
            <div className="ac-tree-empty">Loading…</div>
          ) : manifest ? (
            <>
              {manifest.tones.length > 0 && (
                <>
                  <div className="ac-tree-section-title" style={{ padding: 'var(--ac-space-1) var(--ac-space-2)' }}>
                    Tones
                  </div>
                  {manifest.tones.map((entry) => {
                    const selected = selectedItemType === 'tone' && selectedItemName === entry.file;
                    return (
                      <div
                        key={entry.file}
                        role="button"
                        tabIndex={0}
                        aria-selected={selected}
                        onClick={() => onSelectTone(entry.file)}
                        onKeyDown={(e) => e.key === 'Enter' && onSelectTone(entry.file)}
                        draggable
                        onDragStart={(e) => onToneDragStart?.(e, entry.file)}
                        className={cn(
                          'ac-tree-node',
                          'ac-tree-node--draggable',
                          selected && 'ac-tree-node--selected',
                        )}
                      >
                        <WaveIcon />
                        <span className="ac-tree-node-name">{entry.file}</span>
                      </div>
                    );
                  })}
                </>
              )}
              {manifest.patches.length > 0 && (
                <>
                  <div className="ac-tree-section-title" style={{ padding: 'var(--ac-space-1) var(--ac-space-2)' }}>
                    Patches
                  </div>
                  {manifest.patches.map((entry) => {
                    const selected = selectedItemType === 'patch' && selectedItemName === entry.file;
                    return (
                      <div
                        key={entry.file}
                        role="button"
                        tabIndex={0}
                        aria-selected={selected}
                        onClick={() => onSelectPatch(entry.file)}
                        onKeyDown={(e) => e.key === 'Enter' && onSelectPatch(entry.file)}
                        draggable
                        onDragStart={(e) => onPatchDragStart?.(e, entry.file)}
                        className={cn(
                          'ac-tree-node',
                          'ac-tree-node--draggable',
                          selected && 'ac-tree-node--selected',
                        )}
                      >
                        <PatchIcon />
                        <span className="ac-tree-node-name">{entry.file}</span>
                      </div>
                    );
                  })}
                </>
              )}
              {setInfo.description && (
                <div className="ac-tree-description">{setInfo.description}</div>
              )}
            </>
          ) : (
            <>
              {setInfo.toneCount > 0 && (
                <div className="ac-tree-description">
                  {setInfo.toneCount} tone{setInfo.toneCount !== 1 ? 's' : ''}
                </div>
              )}
              {setInfo.patchCount > 0 && (
                <div className="ac-tree-description">
                  {setInfo.patchCount} patch{setInfo.patchCount !== 1 ? 'es' : ''}
                </div>
              )}
            </>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
