/**
 * Low-level modal dialog primitive.
 *
 * Handles escape-to-close, overlay click-to-close, focus trap, and
 * background scroll prevention. Uses ac-modal design system classes.
 *
 * Higher-level dialogs (ConfirmDialog, SaveDialog, etc.) compose this
 * primitive rather than reimplementing modal behavior.
 */

import { useEffect, useCallback, useRef, type ReactNode } from 'react';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Optional CSS class appended to the modal content panel */
  className?: string;
  /** Optional inline styles for the modal content panel */
  style?: React.CSSProperties;
  /** ARIA role — defaults to "dialog", use "alertdialog" for confirmations */
  role?: 'dialog' | 'alertdialog';
}

export function Dialog({
  open,
  onClose,
  children,
  className,
  style,
  role = 'dialog',
}: DialogProps): JSX.Element | null {
  const contentRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose],
  );

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, handleKeyDown]);

  // Focus trap: focus content panel on open
  useEffect(() => {
    if (open && contentRef.current) {
      contentRef.current.focus();
    }
  }, [open]);

  if (!open) return null;

  const panelClass = className ? `ac-modal ${className}` : 'ac-modal';

  return (
    <div className="ac-modal-overlay" onClick={handleOverlayClick}>
      <div
        ref={contentRef}
        tabIndex={-1}
        role={role}
        aria-modal="true"
        className={panelClass}
        style={style}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogTitle({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="ac-modal-header">
      <h2 className="ac-modal-title">{children}</h2>
    </div>
  );
}

export function DialogDescription({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="ac-modal-content">
      {typeof children === 'string' ? <p style={{ margin: 0 }}>{children}</p> : children}
    </div>
  );
}

export function DialogActions({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="ac-modal-footer">
      <div />
      <div className="ac-modal-footer-actions">{children}</div>
    </div>
  );
}
