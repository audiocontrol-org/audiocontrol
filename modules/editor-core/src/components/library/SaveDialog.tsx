/**
 * Save dialog with directory picker, name input, and inline folder creation.
 *
 * Generic version of sample-chopper's SaveDialog — consumers provide
 * directory listing and folder creation callbacks.
 */

import React, { useCallback, useEffect, useState } from 'react';

export interface DirectoryItem {
  name: string;
  path: string[];
  depth: number;
}

export interface SaveDialogResult {
  name: string;
  path: string[];
}

export interface SaveDialogProps {
  open: boolean;
  title?: string;
  defaultName: string;
  /** Flattened directory list for the picker */
  directories: DirectoryItem[];
  /** Whether the directory list is loading */
  loading?: boolean;
  /** Error message from directory listing or folder creation */
  error?: string | null;
  /** Called when the user saves */
  onSave: (result: SaveDialogResult) => void;
  /** Called when the user cancels */
  onCancel: () => void;
  /** Called to create a new folder. Returns updated directory list or throws. */
  onCreateFolder?: (parentPath: string[], folderName: string) => Promise<void>;
}

export function SaveDialog({
  open,
  title = 'Save',
  defaultName,
  directories,
  loading,
  error,
  onSave,
  onCancel,
  onCreateFolder,
}: SaveDialogProps): JSX.Element | null {
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const [name, setName] = useState(defaultName);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setName(defaultName);
      setSelectedPath([]);
      setNewFolderName('');
      setCreatingFolder(false);
      setLocalError(null);
    }
  }, [open, defaultName]);

  const handleSave = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({ name: trimmed, path: selectedPath });
  }, [name, selectedPath, onSave]);

  const handleCreateFolder = useCallback(async () => {
    if (!onCreateFolder) return;
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    setCreatingFolder(true);
    setLocalError(null);
    try {
      await onCreateFolder(selectedPath, trimmed);
      setSelectedPath([...selectedPath, trimmed]);
      setNewFolderName('');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to create folder');
    } finally {
      setCreatingFolder(false);
    }
  }, [newFolderName, selectedPath, onCreateFolder]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }, [handleSave, onCancel]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  }, [onCancel]);

  if (!open) return null;

  const displayError = error || localError;
  const selectedPathStr = selectedPath.length > 0 ? selectedPath.join(' / ') : '(top level)';

  return (
    <div className="ac-modal-overlay" onClick={handleOverlayClick}>
      <div className="ac-modal" style={{ maxWidth: '28rem' }} role="dialog" onKeyDown={handleKeyDown}>
        <div className="ac-modal-header">
          <h2 className="ac-modal-title">{title}</h2>
          <button className="ac-modal-close" onClick={onCancel}>&times;</button>
        </div>

        <div className="ac-modal-content">
          {/* Name input */}
          <div style={{ marginBottom: 'var(--ac-space-3, 12px)' }}>
            <label className="ac-label ac-label-block" htmlFor="ac-save-name">Name</label>
            <input
              id="ac-save-name"
              type="text"
              className="ac-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Directory path display */}
          <div style={{ marginBottom: 'var(--ac-space-2, 8px)' }}>
            <span className="ac-label">Directory: </span>
            <span className="ac-text-muted" style={{ fontSize: 'var(--ac-text-sm)' }}>{selectedPathStr}</span>
          </div>

          {/* Loading / Error */}
          {loading && <p className="ac-library-panel-status">Scanning...</p>}
          {displayError && <p className="ac-text-error" style={{ fontSize: 'var(--ac-text-sm)', margin: '8px 0' }}>{displayError}</p>}

          {/* Directory picker */}
          {!loading && (
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
                return (
                  <button
                    key={dirFullPath.join('/')}
                    className={`ac-save-dialog-dir ${isSelected ? 'ac-save-dialog-dir--selected' : ''}`}
                    style={{ paddingLeft: `${0.5 + (dir.depth + 1) * 1.25}rem` }}
                    onClick={() => setSelectedPath(dirFullPath)}
                  >
                    {dir.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* New folder */}
          {onCreateFolder && (
            <div style={{ display: 'flex', gap: 'var(--ac-space-2, 8px)', marginTop: 'var(--ac-space-2, 8px)' }}>
              <input
                type="text"
                className="ac-input"
                style={{ flex: 1 }}
                placeholder="New folder name..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCreateFolder();
                  }
                }}
              />
              <button
                className="ac-btn ac-btn-sm"
                onClick={handleCreateFolder}
                disabled={creatingFolder || !newFolderName.trim()}
              >
                {creatingFolder ? '...' : 'New Folder'}
              </button>
            </div>
          )}
        </div>

        <div className="ac-modal-footer">
          <div />
          <div className="ac-modal-footer-actions">
            <button className="ac-btn ac-btn-sm" onClick={onCancel}>Cancel</button>
            <button
              className="ac-btn ac-btn-sm ac-btn-primary"
              onClick={handleSave}
              disabled={!name.trim()}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
