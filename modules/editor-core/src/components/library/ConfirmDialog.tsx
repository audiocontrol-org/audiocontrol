/**
 * Simple confirm/cancel modal dialog.
 *
 * Used for delete confirmations and other destructive actions.
 * Built on the shared Dialog primitive.
 */

import React from 'react';
import { Dialog } from '@/components/library/Dialog';

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
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      style={{ maxWidth: '28rem' }}
      role="alertdialog"
    >
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
    </Dialog>
  );
}
