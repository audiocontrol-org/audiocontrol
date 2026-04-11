/**
 * SlideDrawer — slide-over panel from the right edge.
 *
 * Replaces centered modal dialogs for library operations. The library
 * tree stays visible and interactive while the drawer is open.
 *
 * Uses CSS transitions for the slide animation and backdrop opacity.
 * Escape key and backdrop click close the drawer.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface SlideDrawerProps {
  /** Whether the drawer is open */
  open: boolean;
  /** Title shown in the drawer header */
  title: string;
  /** Called when the drawer should close (Escape, backdrop click, close button) */
  onClose: () => void;
  /** Drawer content */
  children: React.ReactNode;
  /** Optional footer content (action buttons) */
  footer?: React.ReactNode;
}

export function SlideDrawer({
  open,
  title,
  onClose,
  children,
  footer,
}: SlideDrawerProps): JSX.Element | null {
  // Animate open/close with a brief delay for CSS transitions
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Delay to allow the closed state to render before transitioning to open
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), 250);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  if (!mounted) return null;

  const state = visible ? 'open' : 'closed';

  return (
    <>
      <div
        className="ac-drawer-overlay"
        data-state={state}
        onClick={handleOverlayClick}
      />
      <div
        ref={panelRef}
        className="ac-drawer-panel"
        data-state={state}
        role="dialog"
        aria-modal="true"
      >
        <div className="ac-drawer-header">
          <h2 className="ac-drawer-title">{title}</h2>
          <button className="ac-drawer-close" onClick={onClose}>&times;</button>
        </div>
        <div className="ac-drawer-content">
          {children}
        </div>
        {footer && (
          <div className="ac-drawer-footer">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
