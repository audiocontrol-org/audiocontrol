/**
 * Positioned context menu with viewport-aware placement.
 *
 * Renders a dropdown menu at the specified screen position,
 * adjusting to prevent viewport overflow. Dismisses on Escape
 * or click outside.
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';

export interface ContextMenuAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** If true, renders a separator line before this action */
  separator?: boolean;
}

export interface ContextMenuProps {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onClose: () => void;
}

export function ContextMenu({
  x,
  y,
  actions,
  onClose,
}: ContextMenuProps): JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState({ x, y });

  // Adjust position if menu would overflow viewport
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      if (x + rect.width > viewportWidth - 10) {
        adjustedX = viewportWidth - rect.width - 10;
      }
      if (y + rect.height > viewportHeight - 10) {
        adjustedY = viewportHeight - rect.height - 10;
      }

      setAdjustedPosition({ x: adjustedX, y: adjustedY });
    }
  }, [x, y]);

  // Close on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleAction = useCallback((action: ContextMenuAction) => {
    if (!action.disabled) {
      action.onClick();
      onClose();
    }
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="ac-context-menu"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
      role="menu"
    >
      {actions.map((action, index) => {
        if (action.separator) {
          return (
            <div
              key={`separator-${index}`}
              className="ac-context-menu-separator"
            />
          );
        }

        const className = action.disabled
          ? 'ac-context-menu-item ac-context-menu-item--disabled'
          : action.danger
            ? 'ac-context-menu-item ac-context-menu-item--danger'
            : 'ac-context-menu-item';

        return (
          <button
            key={action.label}
            className={className}
            onClick={() => handleAction(action)}
            disabled={action.disabled}
            role="menuitem"
          >
            {action.icon && <span className="ac-context-menu-icon">{action.icon}</span>}
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
