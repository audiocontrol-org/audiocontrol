/**
 * Simple confirm/cancel modal dialog.
 *
 * Used for delete confirmations and other destructive actions.
 * Renders using ac-modal primitives from editor-core.
 */

import React, { useCallback, useEffect, useRef } from 'react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm button with danger styling */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap: focus first button on open
  useEffect(() => {
    if (open && dialogRef.current) {
      const firstBtn = dialogRef.current.querySelector<HTMLButtonElement>('button');
      firstBtn?.focus();
    }
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  }, [onCancel]);

  if (!open) return null;

  return (
    <div className="ac-modal-overlay" onClick={handleOverlayClick}>
      <div className="ac-modal" ref={dialogRef} style={{ maxWidth: '28rem' }} role="alertdialog">
        <div className="ac-modal-header">
          <h2 className="ac-modal-title">{title}</h2>
        </div>
        <div className="ac-modal-content">
          {typeof message === 'string' ? <p style={{ margin: 0 }}>{message}</p> : message}
        </div>
        <div className="ac-modal-footer">
          <div />
          <div className="ac-modal-footer-actions">
            <button className="ac-btn ac-btn-sm" onClick={onCancel}>
              {cancelLabel}
            </button>
            <button
              className={`ac-btn ac-btn-sm ${danger ? 'ac-btn-danger' : 'ac-btn-primary'}`}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
