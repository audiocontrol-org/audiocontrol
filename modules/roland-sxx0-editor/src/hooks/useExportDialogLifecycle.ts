/**
 * useExportDialogLifecycle
 *
 * Shared state-management hook for the export-dialog family:
 * ExportToneDialog, ExportPatchDialog, and BatchExportDrawer all
 * follow the same lifecycle pattern around the OperationState progress
 * fields:
 *
 *   - localError / setLocalError — captures sync precondition throws
 *     (see ExportToneDialog header re: BUG-001); coalesces with
 *     operationError into effectiveError
 *   - hasStarted / setHasStarted — flips to true once the operator
 *     clicks Export, so the dialog body can swap from idle to running
 *   - useEffect open-reset — clears localError + hasStarted whenever
 *     the dialog opens (so a re-open after a previous failure starts
 *     fresh)
 *   - isComplete / effectiveError / steps — derived from the progress
 *     stream the way every export surface needs them
 *   - handleClose — Cancel button + outside-click handler that no-ops
 *     while the operation is in flight
 *
 * Extracted 2026-05-22 from ExportToneDialog (lines 62-83 + 100-111),
 * ExportPatchDialog (72-93 + 107-124), and BatchExportDrawer
 * (lines ~100-122) per clones.yaml groups e83df277765c (12L) +
 * 82e7ef31c329 (16L). Per-dialog name state stays in the call site
 * because each source differs (tone.name vs patch.common.name vs
 * batch item count).
 *
 * Contract pinned by D-LIB-06/07 (mount), D-LIB-34/35/36 (eyebrow),
 * and D-LIB-EXPORT-LIFECYCLE-01 (open-reset + handleClose).
 */

import { useCallback, useEffect, useState } from 'react';
import type { ProgressStep } from '@audiocontrol/editor-core';

import {
  type OperationProgress,
  isOperationComplete,
} from '@/types/import-operation';
import { useStepHistory } from './useStepHistory';

export interface UseExportDialogLifecycleOptions {
  open: boolean;
  isOperating: boolean;
  progress: OperationProgress | undefined;
  /** Forwarded straight through OperationState.error, which is
   *  optional — undefined and null both mean "no error". */
  operationError: string | null | undefined;
  onOpenChange: (open: boolean) => void;
  /** Optional per-step failure map (used by BatchExportDrawer to mark
   *  individual items as ✗ when some succeeded and others failed).
   *  Forwarded straight to useStepHistory. */
  stepErrors?: Map<number, string>;
}

export interface UseExportDialogLifecycleResult {
  localError: string | null;
  setLocalError: (e: string | null) => void;
  hasStarted: boolean;
  setHasStarted: (b: boolean) => void;
  isComplete: boolean;
  /** localError ?? operationError — the value to feed into the step
   *  log + the inline error banner. */
  effectiveError: string | null | undefined;
  steps: ProgressStep[];
  handleClose: () => void;
}

export function useExportDialogLifecycle({
  open,
  isOperating,
  progress,
  operationError,
  onOpenChange,
  stepErrors,
}: UseExportDialogLifecycleOptions): UseExportDialogLifecycleResult {
  const [localError, setLocalError] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (open) {
      setLocalError(null);
      setHasStarted(false);
    }
  }, [open]);

  const isComplete = isOperationComplete({
    isOperating,
    progress,
    error: operationError,
  });
  const effectiveError = localError ?? operationError;
  const steps = useStepHistory({
    progress,
    isComplete,
    error: effectiveError,
    stepErrors,
  });

  const handleClose = useCallback(() => {
    if (isOperating) return;
    setLocalError(null);
    onOpenChange(false);
  }, [isOperating, onOpenChange]);

  return {
    localError,
    setLocalError,
    hasStarted,
    setHasStarted,
    isComplete,
    effectiveError,
    steps,
    handleClose,
  };
}
