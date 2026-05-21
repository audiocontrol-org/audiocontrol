/**
 * useStepHistory
 *
 * Converts a live {@link OperationProgress} stream into a growing
 * {@link ProgressStep}[] log suitable for the v3 stepped-progress UI.
 *
 * `OperationProgress` carries only the CURRENT step's bytes + label;
 * the step-log view needs the HISTORY. This hook accumulates: each
 * time a new `currentStep` arrives, the previous step is marked
 * complete and the new step joins the list as active. On success
 * every step flips to complete; on error the last in-flight step
 * flips to failed and carries the error message.
 *
 * The output is safe to render with `StepRow` from editor-core or
 * with the shared `ac-step-*` CSS classes from
 * `editor-core/src/design/library.css`.
 */

import { useEffect, useState } from 'react';
import type { ProgressStep, StepStatus } from '@audiocontrol/editor-core';
import { type OperationProgress, formatBytes } from '@/types/import-operation';

interface UseStepHistoryOptions {
  progress: OperationProgress | undefined;
  isComplete: boolean;
  /** Coalesced local + operation error. `undefined` and `null` both mean
   *  "no error" so the dialog can pass `localError ?? operationError`
   *  directly without an extra `?? null` coercion at every call site. */
  error: string | null | undefined;
}

export function useStepHistory({
  progress,
  isComplete,
  error,
}: UseStepHistoryOptions): ProgressStep[] {
  const [steps, setSteps] = useState<ProgressStep[]>([]);

  // Reset on idle (no progress, no completion, no error).
  useEffect(() => {
    if (!progress && !isComplete && !error) {
      setSteps([]);
    }
  }, [progress, isComplete, error]);

  // Append or update the current step from incoming progress.
  useEffect(() => {
    if (!progress) return;
    setSteps((prev) => {
      const id = `step-${progress.currentStep}`;
      const stepProgress =
        progress.bytesTotal > 0
          ? Math.round((progress.bytesSent / progress.bytesTotal) * 100)
          : undefined;
      const stepDetail =
        progress.bytesTotal > 0
          ? `${formatBytes(progress.bytesSent)} / ${formatBytes(progress.bytesTotal)}`
          : undefined;
      const completed = prev.map((s) =>
        s.id === id
          ? s
          : { ...s, status: 'complete' as StepStatus, progress: undefined },
      );
      const existing = completed.find((s) => s.id === id);
      const current: ProgressStep = {
        id,
        label: progress.stepLabel,
        status: 'active',
        progress: stepProgress,
        detail: stepDetail,
      };
      return existing
        ? completed.map((s) => (s.id === id ? current : s))
        : [...completed, current];
    });
  }, [progress]);

  // Mark every step complete when the operation finishes cleanly.
  useEffect(() => {
    if (isComplete && !error) {
      setSteps((prev) =>
        prev.map((s) => ({
          ...s,
          status: 'complete' as StepStatus,
          progress: undefined,
        })),
      );
    }
  }, [isComplete, error]);

  // Mark the last in-flight step as failed when an error surfaces.
  // If the error fires before any step has started (precondition
  // miss, BUG-001 shape), emit a single failed row so the operator
  // sees the reason instead of a silent close.
  useEffect(() => {
    if (!error) return;
    setSteps((prev) =>
      prev.length > 0
        ? prev.map((s, i, arr) =>
            i === arr.length - 1
              ? { ...s, status: 'failed' as StepStatus, error }
              : s,
          )
        : [
            {
              id: 'precondition',
              label: 'Export failed',
              status: 'failed' as StepStatus,
              error,
            },
          ],
    );
  }, [error]);

  return steps;
}
