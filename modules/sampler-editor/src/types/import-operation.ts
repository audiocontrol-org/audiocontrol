/**
 * Canonical interface for import operation state.
 *
 * All import hooks MUST return these fields. All import dialog props
 * MUST include these fields. The compiler enforces that every progress
 * update provides structured data — no freeform strings.
 */

/**
 * Structured progress for a single import step.
 * Every field is required so that the UI can render a consistent
 * display across all import operations.
 */
export interface ImportProgress {
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
 * State of an import operation, shared across all hooks and dialogs.
 */
export interface ImportOperationState {
  /** Whether an import operation is in progress */
  isImporting: boolean;
  /** Structured progress data, undefined when not started */
  importProgress?: ImportProgress;
  /** Error message from the most recent operation */
  importError?: string | null;
}

/**
 * Whether an import operation has completed (all steps done).
 */
export function isImportComplete(state: ImportOperationState): boolean {
  if (state.isImporting || !state.importProgress) return false;
  const { currentStep, totalSteps, bytesSent, bytesTotal } = state.importProgress;
  return currentStep >= totalSteps && (bytesTotal === 0 || bytesSent >= bytesTotal);
}

/**
 * Compute overall percentage weighted by bytes, not step count.
 */
export function getOverallPercent(progress: ImportProgress): number {
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
