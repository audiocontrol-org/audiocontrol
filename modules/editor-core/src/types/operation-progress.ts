/**
 * Canonical types for operation progress feedback.
 *
 * Shared across all editors for import, export, and library operations.
 * The compiler enforces that every progress update provides structured
 * data — no freeform strings.
 */

/**
 * Structured progress for a multi-step operation.
 *
 * Overall progress is byte-weighted (not step-weighted) so that a
 * 10 MB upload step doesn't appear as equal to a 100-byte metadata
 * write. Use {@link getOverallPercent} to compute the display value.
 */
export interface OperationProgress {
  /** Current step number (1-based) */
  currentStep: number;
  /** Total number of steps in the operation */
  totalSteps: number;
  /** Human-readable label for the current step (e.g., "Uploading KICK1") */
  stepLabel: string;
  /** Bytes transferred in the current step */
  bytesSent: number;
  /** Total bytes to transfer in the current step */
  bytesTotal: number;
  /** Bytes completed in all prior steps (for byte-weighted overall progress) */
  bytesSentAllSteps: number;
  /** Total bytes across ALL steps in the entire operation */
  bytesTotalAllSteps: number;
}

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
