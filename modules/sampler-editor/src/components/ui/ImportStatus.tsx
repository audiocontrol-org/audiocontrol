/**
 * Shared import status UI components.
 *
 * Single source of truth for progress bars, error banners, and success
 * screens used across all import dialogs. Eliminates six copies of the
 * same markup.
 */

import type { ReactNode } from 'react';
import type { ImportProgress } from '@/types/import-operation';
import { getOverallPercent, formatBytes } from '@/types/import-operation';
import { cn } from '@/lib/utils';

// =============================================================================
// Progress Bar
// =============================================================================

interface ImportProgressBarProps {
  progress: ImportProgress;
}

export function ImportProgressBar({ progress }: ImportProgressBarProps): JSX.Element {
  const overallPercent = getOverallPercent(progress);
  const { currentStep, totalSteps, stepLabel, bytesSent, bytesTotal } = progress;
  const stepPercent = bytesTotal > 0 ? Math.floor((bytesSent / bytesTotal) * 100) : 0;

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
    </div>
  );
}

// =============================================================================
// Error Banner
// =============================================================================

interface ImportErrorBannerProps {
  error: string;
}

export function ImportErrorBanner({ error }: ImportErrorBannerProps): JSX.Element {
  return (
    <div className="text-sm text-red-400 bg-red-900/20 rounded p-2">
      {error}
    </div>
  );
}

// =============================================================================
// Success Screen
// =============================================================================

interface ImportSuccessScreenProps {
  message: string;
  detail?: ReactNode;
  onDone: () => void;
}

export function ImportSuccessScreen({
  message,
  detail,
  onDone,
}: ImportSuccessScreenProps): JSX.Element {
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

interface ImportLoadingSpinnerProps {
  message: string;
}

export function ImportLoadingSpinner({ message }: ImportLoadingSpinnerProps): JSX.Element {
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
// Import Button Content (spinner + label)
// =============================================================================

interface ImportButtonContentProps {
  isImporting: boolean;
  label: string;
  importingLabel?: string;
}

export function ImportButtonContent({
  isImporting,
  label,
  importingLabel = 'Importing...',
}: ImportButtonContentProps): JSX.Element {
  if (isImporting) {
    return (
      <>
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
        {importingLabel}
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
