/**
 * Modal dialog for creating a new folder.
 *
 * Provides a text input for the folder name with auto-focus,
 * Enter/Escape key handling, error display, and creating state.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface CreateFolderDialogProps {
  open: boolean;
  /** Parent path for display context (e.g., ["Projects", "Audio"]) */
  parentPath: string[];
  /** Whether folder creation is in progress */
  creating?: boolean;
  /** Error message to display */
  error?: string;
  /** Called when user confirms with the folder name */
  onConfirm: (name: string) => void;
  /** Called when user cancels */
  onCancel: () => void;
}

export function CreateFolderDialog({
  open,
  parentPath,
  creating,
  error,
  onConfirm,
  onCancel,
}: CreateFolderDialogProps): JSX.Element | null {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset name and focus input when dialog opens
  useEffect(() => {
    if (open) {
      setName('');
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // Escape to close (only when not creating)
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !creating) {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, creating, onCancel]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !creating) {
      onCancel();
    }
  }, [creating, onCancel]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed && !creating) {
      onConfirm(trimmed);
    }
  }, [name, creating, onConfirm]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = name.trim();
      if (trimmed && !creating) {
        onConfirm(trimmed);
      }
    }
  }, [name, creating, onConfirm]);

  if (!open) return null;

  const parentDisplay = parentPath.length > 0
    ? parentPath.join(' / ')
    : 'root';

  const canSubmit = name.trim().length > 0 && !creating;

  return (
    <div className="ac-modal-overlay" onClick={handleOverlayClick}>
      <div className="ac-modal" ref={dialogRef} style={{ maxWidth: '28rem' }} role="dialog">
        <div className="ac-modal-header">
          <h2 className="ac-modal-title">New Folder</h2>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="ac-modal-content">
            <p style={{ margin: '0 0 0.75rem', color: 'var(--ac-text-secondary)' }}>
              Create folder in <strong>{parentDisplay}</strong>
            </p>
            <input
              ref={inputRef}
              type="text"
              className="ac-input"
              placeholder="Folder name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={creating}
              autoComplete="off"
              style={{ width: '100%' }}
            />
            {error && (
              <div className="ac-operation-error" style={{ marginTop: '0.75rem' }}>
                {error}
              </div>
            )}
          </div>
          <div className="ac-modal-footer">
            <div />
            <div className="ac-modal-footer-actions">
              <button
                type="button"
                className="ac-btn ac-btn-sm"
                onClick={onCancel}
                disabled={creating}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="ac-btn ac-btn-sm ac-btn-primary"
                disabled={!canSubmit}
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
