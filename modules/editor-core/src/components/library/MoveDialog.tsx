/**
 * Move dialog — directory tree picker for relocating items.
 *
 * Renders as a slide-over drawer from the right edge. The library
 * tree stays visible while the user picks a destination.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { SlideDrawer } from './SlideDrawer';

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

  const isCurrentTargetValid = isValidTarget ? isValidTarget(selectedPath) : true;

  return (
    <SlideDrawer
      open={open}
      title={`Move "${itemName}"`}
      onClose={onCancel}
      footer={
        <>
          <button className="ac-btn ac-btn-sm" onClick={onCancel}>Cancel</button>
          <button
            className="ac-btn ac-btn-sm ac-btn-primary"
            onClick={handleMove}
            disabled={!isCurrentTargetValid}
          >
            Move
          </button>
        </>
      }
    >
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
    </SlideDrawer>
  );
}
