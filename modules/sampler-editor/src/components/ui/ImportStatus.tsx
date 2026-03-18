/**
 * Shared operation status UI components.
 *
 * Single source of truth for progress bars, error banners, and success
 * screens used across all import and export dialogs. Eliminates duplicate
 * markup across dialogs.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import type { OperationProgress } from '@/types/import-operation';
import { getOverallPercent, formatBytes } from '@/types/import-operation';
import { cn } from '@/lib/utils';

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

// =============================================================================
// Progress Bar
// =============================================================================

interface OperationProgressBarProps {
  progress: OperationProgress;
}

export function OperationProgressBar({ progress }: OperationProgressBarProps): JSX.Element {
  const overallPercent = getOverallPercent(progress);
  const { currentStep, totalSteps, stepLabel, bytesSent, bytesTotal,
    bytesSentAllSteps, bytesTotalAllSteps } = progress;
  const stepPercent = bytesTotal > 0 ? Math.floor((bytesSent / bytesTotal) * 100) : 0;

  // Track start time — resets when a new operation begins
  const startTimeRef = useRef<number>(Date.now());
  const prevProgressRef = useRef<OperationProgress | null>(null);

  useEffect(() => {
    const prev = prevProgressRef.current;
    // Reset timer when progress restarts (new operation or step 1 with 0 bytes)
    if (!prev || (progress.currentStep === 1 && progress.bytesSent === 0 && progress.bytesSentAllSteps === 0)) {
      startTimeRef.current = Date.now();
    }
    prevProgressRef.current = progress;
  }, [progress]);

  const elapsedMs = Date.now() - startTimeRef.current;
  const totalBytesSoFar = bytesSentAllSteps + bytesSent;
  const bytesRemaining = bytesTotalAllSteps - totalBytesSoFar;
  const bytesPerMs = elapsedMs > 500 && totalBytesSoFar > 0
    ? totalBytesSoFar / elapsedMs
    : 0;
  const estimatedRemainingMs = bytesPerMs > 0 ? bytesRemaining / bytesPerMs : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-s330-muted">
        <span>{stepLabel} {bytesTotal > 0 && <span className="text-s330-text">{stepPercent}%</span>}</span>
        <span>Step {currentStep} of {totalSteps}</span>
      </div>
      <div className="h-2 bg-s330-bg rounded-full overflow-hidden">
        <div
          className="h-full bg-s330-highlight transition-all duration-150 ease-out"
          style={{ width: `${overallPercent}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-s330-muted">
        {bytesTotal > 0 ? (
          <span>{formatBytes(bytesSent)} / {formatBytes(bytesTotal)}</span>
        ) : (
          <span />
        )}
        <span>Overall {overallPercent}%</span>
      </div>
      <div className="flex items-center justify-between text-[10px] text-s330-muted">
        <span>Elapsed: {formatDuration(elapsedMs)}</span>
        {bytesPerMs > 0 && bytesRemaining > 0 && (
          <span>~{formatDuration(estimatedRemainingMs)} remaining</span>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Error Banner
// =============================================================================

interface OperationErrorBannerProps {
  error: string;
}

export function OperationErrorBanner({ error }: OperationErrorBannerProps): JSX.Element {
  return (
    <div className="text-sm text-red-400 bg-red-900/20 rounded p-2">
      {error}
    </div>
  );
}

// =============================================================================
// Success Screen
// =============================================================================

interface OperationSuccessScreenProps {
  message: string;
  detail?: ReactNode;
  onDone: () => void;
}

export function OperationSuccessScreen({
  message,
  detail,
  onDone,
}: OperationSuccessScreenProps): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-green-400">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span>{message}</span>
      </div>
      {detail && (
        <div className="text-sm text-s330-muted">{detail}</div>
      )}
      <div className="flex justify-end">
        <button onClick={onDone} className="ac-btn ac-btn-primary">
          Done
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Loading Spinner
// =============================================================================

interface OperationLoadingSpinnerProps {
  message: string;
}

export function OperationLoadingSpinner({ message }: OperationLoadingSpinnerProps): JSX.Element {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="flex items-center gap-2 text-s330-muted">
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        <span>{message}</span>
      </div>
    </div>
  );
}

// =============================================================================
// Button Content (spinner + label)
// =============================================================================

interface OperationButtonContentProps {
  isOperating: boolean;
  label: string;
  operatingLabel?: string;
}

export function OperationButtonContent({
  isOperating,
  label,
  operatingLabel = 'Working...',
}: OperationButtonContentProps): JSX.Element {
  if (isOperating) {
    return (
      <>
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
        {operatingLabel}
      </>
    );
  }
  return <>{label}</>;
}

// =============================================================================
// Close Button (X in top-right corner)
// =============================================================================

interface DialogCloseButtonProps {
  disabled?: boolean;
}

export function DialogCloseButton({ disabled }: DialogCloseButtonProps): JSX.Element {
  return (
    <button
      className={cn(
        'absolute top-4 right-4 text-s330-muted hover:text-s330-text',
        disabled && 'opacity-50'
      )}
      aria-label="Close"
      disabled={disabled}
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}
