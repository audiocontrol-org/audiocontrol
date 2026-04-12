/**
 * Typed capability interface for refresh notifications.
 *
 * Hooks accept this instead of a bare `() => void` callback.
 * Guarantees that callers explicitly declare refresh capability.
 */

import { useCallback } from 'react';

/**
 * Notifier that triggers a data refresh in the consumer.
 */
export interface RefreshNotifier {
  notifyRefresh(): void;
}

/**
 * Create a RefreshNotifier from a refresh callback.
 *
 * @param onRefresh - Callback to trigger data refresh (e.g., re-scan library)
 */
export function useRefreshNotifier(onRefresh: () => void): RefreshNotifier {
  const notifyRefresh = useCallback(() => {
    onRefresh();
  }, [onRefresh]);

  return { notifyRefresh };
}
