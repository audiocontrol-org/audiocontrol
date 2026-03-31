/**
 * Shared operation status UI components.
 *
 * Portable progress bar, error banner, and success screen for use
 * across all editors. Uses ac- prefixed CSS classes from editor-core
 * design tokens.
 */

import React, { useEffect, useRef } from 'react';
import type { OperationProgress } from '../types/operation-progress';
import { getOverallPercent, formatBytes } from '../types/operation-progress';

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

export interface OperationProgressBarProps {
  progress: OperationProgress;
}

export function OperationProgressBar({ progress }: OperationProgressBarProps): JSX.Element {
  const overallPercent = getOverallPercent(progress);
  const { currentStep, totalSteps, stepLabel, bytesSent, bytesTotal,
    bytesSentAllSteps, bytesTotalAllSteps } = progress;
  const stepPercent = bytesTotal > 0 ? Math.floor((bytesSent / bytesTotal) * 100) : 0;

  const startTimeRef = useRef<number>(Date.now());
  const prevProgressRef = useRef<OperationProgress | null>(null);

  useEffect(() => {
    const prev = prevProgressRef.current;
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
    <div className="ac-operation-progress">
      <div className="ac-operation-progress-header">
        <span className="ac-operation-progress-label">
          {stepLabel}
          {bytesTotal > 0 && <span className="ac-operation-progress-pct"> {stepPercent}%</span>}
        </span>
        <span className="ac-operation-progress-step">Step {currentStep} of {totalSteps}</span>
      </div>
      <div className="ac-operation-progress-track">
        <div
          className="ac-operation-progress-fill"
          style={{ width: `${overallPercent}%` }}
        />
      </div>
      <div className="ac-operation-progress-footer">
        {bytesTotal > 0 ? (
          <span>{formatBytes(bytesSent)} / {formatBytes(bytesTotal)}</span>
        ) : (
          <span />
        )}
        <span>Overall {overallPercent}%</span>
      </div>
      <div className="ac-operation-progress-footer">
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

export interface OperationErrorBannerProps {
  error: string;
}

export function OperationErrorBanner({ error }: OperationErrorBannerProps): JSX.Element {
  return (
    <div className="ac-operation-error" data-testid="import-error">{error}</div>
  );
}

// =============================================================================
// Success Screen
// =============================================================================

export interface OperationSuccessScreenProps {
  message: string;
  detail?: React.ReactNode;
  onDone: () => void;
}

export function OperationSuccessScreen({
  message,
  detail,
  onDone,
}: OperationSuccessScreenProps): JSX.Element {
  return (
    <div className="ac-operation-success">
      <div className="ac-operation-success-message">
        <svg className="ac-operation-success-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span>{message}</span>
      </div>
      {detail && <div className="ac-operation-success-detail">{detail}</div>}
      <div className="ac-operation-success-actions">
        <button onClick={onDone} className="ac-btn ac-btn-primary">Done</button>
      </div>
    </div>
  );
}

// =============================================================================
// Loading Spinner
// =============================================================================

export interface OperationLoadingSpinnerProps {
  message: string;
}

export function OperationLoadingSpinner({ message }: OperationLoadingSpinnerProps): JSX.Element {
  return (
    <div className="ac-operation-spinner">
      <span className="ac-spinner" />
      <span>{message}</span>
    </div>
  );
}

// =============================================================================
// Button Content (spinner + label)
// =============================================================================

export interface OperationButtonContentProps {
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
        <span className="ac-spinner ac-spinner-sm" />
        {operatingLabel}
      </>
    );
  }
  return <>{label}</>;
}
