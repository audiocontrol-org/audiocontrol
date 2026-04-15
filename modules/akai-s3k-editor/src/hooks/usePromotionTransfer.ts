/**
 * Hook for managing program promotion from S3K library to common area.
 *
 * Encapsulates the promotion operation with loading/error/success state
 * and proper error reporting via the centralized ErrorReporter.
 */

import { useState, useCallback } from 'react';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import type { ErrorReporter } from '@audiocontrol/editor-core';
import { promoteToCommonArea } from '@/lib/program-promotion';

// =========================================================================
// Types
// =========================================================================

export type PromotionStatus =
  | { state: 'idle' }
  | { state: 'promoting'; programName: string }
  | { state: 'success'; programName: string }
  | { state: 'error'; programName: string; message: string };

const IDLE: PromotionStatus = { state: 'idle' };

/** Auto-dismiss delay for success toast (ms). */
const SUCCESS_DISMISS_MS = 3000;

// =========================================================================
// Hook
// =========================================================================

interface UsePromotionTransferArgs {
  root: StorageDirectoryHandle | null;
  errorReporter: ErrorReporter;
  onComplete: () => Promise<void>;
}

export interface PromotionTransfer {
  /** Current promotion status for UI feedback. */
  status: PromotionStatus;
  /** Promote a program from S3K library to common area. */
  promote: (dirName: string) => Promise<void>;
  /** Dismiss the current status (e.g., close success toast). */
  dismiss: () => void;
}

export function usePromotionTransfer({
  root,
  errorReporter,
  onComplete,
}: UsePromotionTransferArgs): PromotionTransfer {
  const [status, setStatus] = useState<PromotionStatus>(IDLE);

  const promote = useCallback(async (dirName: string) => {
    if (!root) {
      errorReporter.report('Cannot promote program: library not connected');
      return;
    }

    setStatus({ state: 'promoting', programName: dirName });

    try {
      const result = await promoteToCommonArea(root, dirName);
      const promotedName = result.name || dirName;

      setStatus({ state: 'success', programName: promotedName });

      // Refresh the library tree so the new common-area program appears
      await onComplete();

      // Auto-dismiss success after a delay
      setTimeout(() => {
        setStatus((current) => {
          // Only dismiss if still showing this success (not replaced by another operation)
          if (current.state === 'success' && current.programName === promotedName) {
            return IDLE;
          }
          return current;
        });
      }, SUCCESS_DISMISS_MS);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to promote program to common area';
      console.error('[promoteToCommonArea]', message, err);
      errorReporter.report(`Promote to common area failed: ${message}`);
      setStatus({ state: 'error', programName: dirName, message });
    }
  }, [root, errorReporter, onComplete]);

  const dismiss = useCallback(() => {
    setStatus(IDLE);
  }, []);

  return { status, promote, dismiss };
}
