import { useState, useCallback, useRef, useEffect } from 'react';

export type NotificationLevel = 'info' | 'error';

export interface Notification {
  id: number;
  level: NotificationLevel;
  text: string;
}

export interface UseNotificationsOptions {
  /** Auto-dismiss timeout for info notifications in ms. Default: 5000. */
  autoDismissMs?: number;
}

export interface UseNotificationsResult {
  notifications: Notification[];
  notify: (level: NotificationLevel, text: string) => void;
  dismiss: (id: number) => void;
  clearAll: () => void;
}

/**
 * Manages a notification queue with auto-dismiss for info-level messages.
 * Error notifications persist until explicitly dismissed.
 */
export function useNotifications(
  options: UseNotificationsOptions = {},
): UseNotificationsResult {
  const { autoDismissMs = 5000 } = options;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const nextId = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const notify = useCallback(
    (level: NotificationLevel, text: string) => {
      const id = nextId.current++;
      setNotifications((prev) => [...prev, { id, level, text }]);
      if (level === 'info') {
        const timer = setTimeout(() => {
          timers.current.delete(id);
          setNotifications((prev) => prev.filter((n) => n.id !== id));
        }, autoDismissMs);
        timers.current.set(id, timer);
      }
    },
    [autoDismissMs],
  );

  const clearAll = useCallback(() => {
    for (const timer of timers.current.values()) {
      clearTimeout(timer);
    }
    timers.current.clear();
    setNotifications([]);
  }, []);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of timers.current.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  return { notifications, notify, dismiss, clearAll };
}
