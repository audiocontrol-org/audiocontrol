/**
 * Move dialog — directory tree picker for relocating items.
 *
 * Shows a tree of directories and lets the user select a target.
 * Consumers provide directory data and validate the target.
 */

import React, { useCallback, useEffect, useState } from 'react';

export interface MoveDialogDirectory {
  id: string;
  name: string;
  path: string[];
  depth: number;
}

export interface MoveDialogProps {
  open: boolean;
  /** Name of the item being moved (displayed in the title) */
  itemName: string;
  /** Flattened directory list */
  directories: MoveDialogDirectory[];
  /** Returns true if the target is a valid destination */
  isValidTarget?: (targetPath: string[]) => boolean;
  /** Called when the user confirms the move */
  onMove: (targetPath: string[]) => void;
  /** Called when the user cancels */
  onCancel: () => void;
}

export function MoveDialog({
  open,
  itemName,
  directories,
  isValidTarget,
  onMove,
  onCancel,
}: MoveDialogProps): JSX.Element | null {
  const [selectedPath, setSelectedPath] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setSelectedPath([]);
    }
  }, [open]);

  const handleMove = useCallback(() => {
    onMove(selectedPath);
  }, [selectedPath, onMove]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleMove();
    }
  }, [onCancel, handleMove]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  }, [onCancel]);

  if (!open) return null;

  const isCurrentTargetValid = isValidTarget ? isValidTarget(selectedPath) : true;

  return (
    <div className="ac-modal-overlay" onClick={handleOverlayClick}>
      <div className="ac-modal" style={{ maxWidth: '28rem' }} role="dialog" onKeyDown={handleKeyDown}>
        <div className="ac-modal-header">
          <h2 className="ac-modal-title">Move "{itemName}"</h2>
          <button className="ac-modal-close" onClick={onCancel}>&times;</button>
        </div>

        <div className="ac-modal-content">
          <p className="ac-text-muted" style={{ margin: '0 0 12px', fontSize: 'var(--ac-text-sm)' }}>
            Select the destination directory:
          </p>

          <div className="ac-save-dialog-tree">
            <button
              className={`ac-save-dialog-dir ${selectedPath.length === 0 ? 'ac-save-dialog-dir--selected' : ''}`}
              onClick={() => setSelectedPath([])}
            >
              / (top level)
            </button>
            {directories.map((dir) => {
              const dirFullPath = [...dir.path, dir.name];
              const isSelected = dirFullPath.join('/') === selectedPath.join('/');
              const valid = isValidTarget ? isValidTarget(dirFullPath) : true;
              return (
                <button
                  key={dir.id}
                  className={`ac-save-dialog-dir ${isSelected ? 'ac-save-dialog-dir--selected' : ''} ${!valid ? 'ac-save-dialog-dir--disabled' : ''}`}
                  style={{ paddingLeft: `${0.5 + (dir.depth + 1) * 1.25}rem` }}
                  onClick={() => valid && setSelectedPath(dirFullPath)}
                  disabled={!valid}
                >
                  {dir.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="ac-modal-footer">
          <div />
          <div className="ac-modal-footer-actions">
            <button className="ac-btn ac-btn-sm" onClick={onCancel}>Cancel</button>
            <button
              className="ac-btn ac-btn-sm ac-btn-primary"
              onClick={handleMove}
              disabled={!isCurrentTargetValid}
            >
              Move
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
