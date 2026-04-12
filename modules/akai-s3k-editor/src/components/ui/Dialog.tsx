/**
 * Lightweight modal dialog component.
 *
 * Uses a portal-free overlay pattern with Tailwind styling. Prevents
 * background scroll and supports Escape-to-close. No external
 * dependencies (Radix Dialog is not in this package's deps).
 */

import { useEffect, useCallback, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Optional CSS class for the content panel */
  className?: string;
}

export function Dialog({ open, onClose, children, className }: DialogProps): JSX.Element | null {
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
    // Prevent background scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, handleKeyDown]);

  // Focus trap: focus content on open
  useEffect(() => {
    if (open && contentRef.current) {
      contentRef.current.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleOverlayClick}
    >
      <div
        ref={contentRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative bg-gray-800 border border-gray-700 rounded-lg shadow-xl',
          'w-full max-w-md p-6 outline-none',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogTitle({ children }: { children: ReactNode }): JSX.Element {
  return (
    <h2 className="text-lg font-semibold text-gray-200 mb-4">{children}</h2>
  );
}

export function DialogDescription({ children }: { children: ReactNode }): JSX.Element {
  return (
    <p className="text-sm text-gray-400 mb-4">{children}</p>
  );
}

export function DialogActions({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="flex justify-end gap-2 mt-4">{children}</div>
  );
}
