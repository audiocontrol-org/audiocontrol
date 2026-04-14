/**
 * Typed capability interface for operation progress reporting.
 *
 * Hooks accept this instead of a bare `(progress: OperationProgress) => void` callback.
 * Guarantees structured progress data flows through a single contract.
 */

import { useCallback } from 'react';
import type { OperationProgress } from '@/types/operation-progress';

/**
 * Reporter that delivers structured progress updates.
 */
export interface ProgressReporter {
  report(progress: OperationProgress): void;
}

/**
 * Create a ProgressReporter from a progress callback.
 *
 * @param onProgress - Callback to receive structured progress updates
 */
export function useProgressReporter(
  onProgress: (progress: OperationProgress) => void,
): ProgressReporter {
  const report = useCallback((progress: OperationProgress) => {
    onProgress(progress);
  }, [onProgress]);

  return { report };
}
