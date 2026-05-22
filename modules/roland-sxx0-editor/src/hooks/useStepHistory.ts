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
  /** Per-step failures keyed by `currentStep` (1-based, matches
   *  `OperationProgress.currentStep`). Used by the batch-export flow
   *  to mark individual items as failed in the step log while the
   *  overall operation continues to the next item — without this, the
   *  hook can only flag the LAST in-flight step as failed (via the
   *  top-level `error`), which is wrong for continue-on-error batches
   *  where step N failed but step N+1 succeeded. Keys not present in
   *  the map are treated as successes when their step transitions out
   *  of "active". */
  stepErrors?: Map<number, string>;
}

export function useStepHistory({
  progress,
  isComplete,
  error,
  stepErrors,
}: UseStepHistoryOptions): ProgressStep[] {
  const stepNumberOf = (id: string): number => {
    const n = parseInt(id.replace('step-', ''), 10);
    return Number.isFinite(n) ? n : -1;
  };
  const settledStatus = (id: string): { status: StepStatus; error?: string } => {
    const failure = stepErrors?.get(stepNumberOf(id));
    return failure
      ? { status: 'failed', error: failure }
      : { status: 'complete' };
  };
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
      const completed = prev.map((s) => {
        if (s.id === id) return s;
        const settled = settledStatus(s.id);
        return { ...s, status: settled.status, error: settled.error, progress: undefined };
      });
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

  // Mark every step complete (or failed-per-stepErrors) when the
  // operation finishes cleanly. The single-item flows never populate
  // stepErrors so this collapses to the prior "all complete" behavior;
  // the batch flow uses it to freeze per-item failures in the final
  // step log alongside the successful items.
  useEffect(() => {
    if (isComplete && !error) {
      setSteps((prev) =>
        prev.map((s) => {
          const settled = settledStatus(s.id);
          return {
            ...s,
            status: settled.status,
            error: settled.error,
            progress: undefined,
          };
        }),
      );
    }
  }, [isComplete, error, stepErrors]);

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
