import React from 'react';
import type { Notification } from '@/hooks/useNotifications';

export interface NotificationAreaProps {
  notifications: Notification[];
  onDismiss: (id: number) => void;
}

/**
 * Renders a stack of notification banners with copy and dismiss buttons.
 * Info notifications use the base `.ac-alert` style; errors use `.ac-alert-error`.
 */
export function NotificationArea({ notifications, onDismiss }: NotificationAreaProps) {
  if (notifications.length === 0) return null;

  return (
    <div className="ac-notification-area">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={n.level === 'error' ? 'ac-alert ac-alert-error' : 'ac-alert'}
          role={n.level === 'error' ? 'alert' : 'status'}
        >
          <span className="ac-notification-text">{n.text}</span>
          <div className="ac-notification-actions">
            <button
              className="ac-btn ac-btn-sm"
              onClick={() => navigator.clipboard.writeText(n.text)}
            >
              copy
            </button>
            <button
              className="ac-btn ac-btn-sm"
              onClick={() => onDismiss(n.id)}
            >
              dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
