/**
 * Create folder dialog — text input for folder name.
 *
 * Renders as a slide-over drawer. Auto-focuses the input,
 * supports Enter to confirm and Escape to cancel.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SlideDrawer } from './SlideDrawer';

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

  useEffect(() => {
    if (open) {
      setName('');
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

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

  const parentDisplay = parentPath.length > 0
    ? parentPath.join(' / ')
    : 'root';

  const canSubmit = name.trim().length > 0 && !creating;

  return (
    <SlideDrawer
      open={open}
      title="New Folder"
      onClose={creating ? () => {} : onCancel}
      footer={
        <>
          <button
            type="button"
            className="ac-btn ac-btn-sm"
            onClick={onCancel}
            disabled={creating}
          >
            Cancel
          </button>
          <button
            type="button"
            className="ac-btn ac-btn-sm ac-btn-primary"
            onClick={() => { const t = name.trim(); if (t && !creating) onConfirm(t); }}
            disabled={!canSubmit}
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
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
      </form>
    </SlideDrawer>
  );
}
