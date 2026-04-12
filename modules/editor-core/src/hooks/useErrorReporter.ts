/**
 * Centralized error reporting for editor operations.
 *
 * Every error is logged to console AND displayed in the UI.
 * Individual call sites cannot opt out of logging — the architecture
 * guarantees it.
 */

import { useCallback } from 'react';

/**
 * Error reporter that guarantees both console logging and UI notification.
 *
 * Hooks accept this instead of a bare `(message: string) => void` callback.
 * The single implementation ensures errors are never silently swallowed.
 */
export interface ErrorReporter {
  report(message: string): void;
}

/**
 * Create an ErrorReporter that logs to console and calls a UI notification callback.
 *
 * @param onDisplayError - Callback to show the error in the UI (e.g., setError state setter)
 */
export function useErrorReporter(
  onDisplayError: (message: string) => void,
): ErrorReporter {
  const report = useCallback((message: string) => {
    console.error('[editor]', message);
    onDisplayError(message);
  }, [onDisplayError]);

  return { report };
}
