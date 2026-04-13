/**
 * Canonical types for operation progress feedback.
 *
 * {@link OperationProgress} is defined in `@audiocontrol/sampler-library`
 * (the lower-level module) and re-exported here so that editor consumers
 * can import everything progress-related from a single place.
 *
 * UI-specific types ({@link OperationState}) and utility functions
 * ({@link isOperationComplete}, {@link getOverallPercent}, {@link formatBytes})
 * live here because they depend on React/UI patterns that don't belong
 * in sampler-library.
 */

import type { OperationProgress } from '@audiocontrol/sampler-library/browser';

// Re-export the canonical OperationProgress from sampler-library
export type { OperationProgress } from '@audiocontrol/sampler-library/browser';

/**
 * State of an operation, shared across all hooks and dialogs.
 */
export interface OperationState {
  /** Whether an operation is in progress */
  isOperating: boolean;
  /** Structured progress data, undefined when not started */
  progress?: OperationProgress;
  /** Error message from the most recent operation */
  error?: string | null;
}

/**
 * Whether an operation has completed (all steps done).
 */
export function isOperationComplete(state: OperationState): boolean {
  if (state.isOperating || !state.progress) return false;
  const { currentStep, totalSteps, bytesSent, bytesTotal } = state.progress;
  return currentStep >= totalSteps && (bytesTotal === 0 || bytesSent >= bytesTotal);
}

/**
 * Compute overall percentage weighted by bytes, not step count.
 */
export function getOverallPercent(progress: OperationProgress): number {
  const { bytesSent, bytesSentAllSteps, bytesTotalAllSteps } = progress;
  if (bytesTotalAllSteps <= 0) return 0;
  return Math.min(100, Math.floor(((bytesSentAllSteps + bytesSent) / bytesTotalAllSteps) * 100));
}

/**
 * Format byte count for display (e.g., "42,880" or "1.2 MB").
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
