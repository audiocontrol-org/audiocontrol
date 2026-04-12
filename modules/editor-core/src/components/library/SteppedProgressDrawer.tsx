/**
 * SteppedProgressDrawer — slide-over drawer showing a multi-step operation
 * as a live progress log.
 *
 * Standard component for ALL multi-step operations: device transfers,
 * batch operations, disk-to-library saves, program promotion, etc.
 *
 * Each step shows its state:
 *   ○ pending — not yet started
 *   ● active — in progress (optional progress bar)
 *   ✓ complete — finished successfully
 *   ✗ failed — error (message shown inline)
 *
 * The drawer stays open on completion showing all steps with a Done button.
 * No intermediate approval dialogs — the initial confirm starts the entire flow.
 */

import React from 'react';
import { SlideDrawer } from './SlideDrawer';

// =========================================================================
// Types
// =========================================================================

export type StepStatus = 'pending' | 'active' | 'complete' | 'failed';

export interface ProgressStep {
  /** Unique step identifier */
  id: string;
  /** Display label (e.g., "Send sample ARP C1") */
  label: string;
  /** Current status */
  status: StepStatus;
  /** Progress percentage (0-100) for active steps */
  progress?: number;
  /** Detail text (e.g., "11 KB / 22 KB") */
  detail?: string;
  /** Error message for failed steps */
  error?: string;
}

export interface SteppedProgressDrawerProps {
  /** Whether the drawer is open */
  open: boolean;
  /** Title shown in the drawer header */
  title: string;
  /** Called when the drawer should close */
  onClose: () => void;
  /** The list of steps to display */
  steps: ProgressStep[];
  /** Whether the entire operation is complete (shows Done button) */
  isComplete: boolean;
  /** Whether the operation had any failures */
  hasError: boolean;
  /** Optional summary shown below all steps when complete */
  summary?: string;
  /** Called when the user clicks Cancel during an in-progress operation */
  onCancel?: () => void;
}

// =========================================================================
// Step icons
// =========================================================================

function StepIcon({ status }: { status: StepStatus }): JSX.Element {
  switch (status) {
    case 'pending':
      return (
        <span className="ac-step-icon ac-step-icon--pending">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </span>
      );
    case 'active':
      return (
        <span className="ac-step-icon ac-step-icon--active">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="8" cy="8" r="3" fill="currentColor" />
          </svg>
        </span>
      );
    case 'complete':
      return (
        <span className="ac-step-icon ac-step-icon--complete">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      );
    case 'failed':
      return (
        <span className="ac-step-icon ac-step-icon--failed">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M6 6l4 4M10 6l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
      );
  }
}

// =========================================================================
// Step row
// =========================================================================

function StepRow({ step }: { step: ProgressStep }): JSX.Element {
  return (
    <div className={`ac-step-row ac-step-row--${step.status}`}>
      <StepIcon status={step.status} />
      <div className="ac-step-content">
        <div className="ac-step-label">{step.label}</div>
        {step.status === 'active' && step.progress !== undefined && (
          <div className="ac-step-progress">
            <div className="ac-step-progress-bar">
              <div
                className="ac-step-progress-fill"
                style={{ width: `${Math.min(100, step.progress)}%` }}
              />
            </div>
            {step.detail && <span className="ac-step-detail">{step.detail}</span>}
          </div>
        )}
        {step.status === 'active' && step.progress === undefined && step.detail && (
          <div className="ac-step-detail">{step.detail}</div>
        )}
        {step.status === 'complete' && step.detail && (
          <div className="ac-step-detail">{step.detail}</div>
        )}
        {step.status === 'failed' && step.error && (
          <div className="ac-step-error">{step.error}</div>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// Component
// =========================================================================

export function SteppedProgressDrawer({
  open,
  title,
  onClose,
  steps,
  isComplete,
  hasError,
  summary,
  onCancel,
}: SteppedProgressDrawerProps): JSX.Element {
  const canClose = isComplete || hasError;
  const isRunning = !canClose;

  return (
    <SlideDrawer
      open={open}
      title={title}
      onClose={canClose ? onClose : () => {}}
      footer={canClose ? (
        <button
          className={`ac-btn ac-btn-sm ${hasError ? '' : 'ac-btn-primary'}`}
          onClick={onClose}
        >
          {hasError ? 'Close' : 'Done'}
        </button>
      ) : isRunning && onCancel ? (
        <button
          className="ac-btn ac-btn-sm"
          onClick={onCancel}
        >
          Cancel
        </button>
      ) : undefined}
    >
      <div className="ac-stepped-progress">
        {steps.map((step) => (
          <StepRow key={step.id} step={step} />
        ))}
      </div>
      {isComplete && summary && (
        <div className="ac-step-summary">{summary}</div>
      )}
    </SlideDrawer>
  );
}
