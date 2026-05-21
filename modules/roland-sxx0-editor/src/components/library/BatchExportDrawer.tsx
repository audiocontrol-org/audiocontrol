/**
 * Batch Export Drawer (v3)
 *
 * Right-edge SlideDrawer that handles multi-item exports from device
 * memory to library. Drop multi-selected device tones / patches on the
 * library section → useLibraryExport detects `data.indices` and opens
 * this drawer instead of the single-item ExportToneDialog /
 * ExportPatchDialog.
 *
 * Idle body: item list (slot + device name) + destination path.
 * Running body: the same SteppedProgressDrawer step-log that the
 * single-item flows use — each item becomes one step ("Exporting
 * <name>"), advanced by `useLibraryExport.handleBatchExport`.
 *
 * Reuses `StepLogBody` and `renderFooter` from ExportToneDialog so
 * the chrome (footer button states, success/error transitions, etc.)
 * is identical across single and batch flows.
 */

import { useCallback, useEffect, useState } from 'react';
import { SlideDrawer } from '@audiocontrol/editor-core';
import { StepLogBody, renderFooter } from './ExportToneDialog';
import { useStepHistory } from '@/hooks/useStepHistory';
import {
  type OperationState,
  isOperationComplete,
} from '@/types/import-operation';

export interface BatchExportItem {
  /** Device slot index (tone or patch, depending on `kind`). */
  index: number;
  /** Display name shown in the item list + carried into the library
   *  write as the file slug (slugified by exportToneToDirectory /
   *  exportPatchToDirectory downstream). */
  name: string;
  /** Slot label as the device sees it (e.g. "T01", "P15"). Used only
   *  for the item list — the export itself works from `index`. */
  slotLabel: string;
}

export interface BatchExportDrawerProps extends OperationState {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which kind of item the drawer is exporting. Drives the title +
   *  the success message. */
  kind: 'tone' | 'patch';
  items: BatchExportItem[];
  /** Library subfolder the batch will land in. Empty array means the
   *  category root (e.g. tones/ or patches/). Surfaced in the eyebrow
   *  so the operator confirms the destination before clicking Export. */
  targetPath: string[];
  onExport: () => Promise<void>;
}

export function BatchExportDrawer({
  open,
  onOpenChange,
  kind,
  items,
  targetPath,
  onExport,
  isOperating,
  progress,
  error: operationError,
}: BatchExportDrawerProps): JSX.Element | null {
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
  const steps = useStepHistory({ progress, isComplete, error: effectiveError });

  const handleExport = useCallback(async () => {
    setLocalError(null);
    setHasStarted(true);
    try {
      await onExport();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Batch export failed');
    }
  }, [onExport]);

  const handleClose = useCallback(() => {
    if (isOperating) return;
    setLocalError(null);
    onOpenChange(false);
  }, [isOperating, onOpenChange]);

  if (!open) return null;

  const footer = renderFooter({
    hasStarted,
    isComplete,
    hasError: !!effectiveError,
    isOperating,
    canExport: items.length > 0,
    onCancel: handleClose,
    onExport: handleExport,
    onClose: handleClose,
  });

  const title = kind === 'tone'
    ? `Export ${items.length} tones to library`
    : `Export ${items.length} patches to library`;

  const successKindLabel = kind === 'tone' ? 'tones' : 'patches';

  return (
    <SlideDrawer
      open={open}
      title={title}
      onClose={handleClose}
      footer={footer}
    >
      {hasStarted ? (
        <StepLogBody
          steps={steps}
          isComplete={isComplete}
          hasError={!!effectiveError}
          successMessage={`All ${items.length} ${successKindLabel} exported`}
        />
      ) : (
        <BatchFormBody
          kind={kind}
          items={items}
          targetPath={targetPath}
          error={localError}
        />
      )}
    </SlideDrawer>
  );
}

interface BatchFormBodyProps {
  kind: 'tone' | 'patch';
  items: BatchExportItem[];
  targetPath: string[];
  error: string | null;
}

function BatchFormBody({ kind, items, targetPath, error }: BatchFormBodyProps): JSX.Element {
  const eyebrowKindLabel = kind === 'tone' ? 'TONES' : 'PATCHES';
  return (
    <div className="ac-export-form">
      <div className="ac-detail-eyebrow-row" data-testid="batch-export-destination">
        <span className="ac-detail-eyebrow-accent">{eyebrowKindLabel}</span>
        <span className="ac-detail-eyebrow-sep">·</span>
        <span>{items.length} ITEMS</span>
        <span className="ac-detail-eyebrow-sep">·</span>
        <span>LIBRARY</span>
        <span className="ac-detail-eyebrow-sep">·</span>
        <span>S330</span>
        {targetPath.length > 0 && (
          <>
            <span className="ac-detail-eyebrow-sep">·</span>
            <span data-testid="batch-export-target-path">{targetPath.join(' / ')}</span>
          </>
        )}
      </div>
      <div className="ac-page-title-rule" aria-hidden="true" />

      {error && (
        <p className="ac-export-form-error" role="alert">
          {error}
        </p>
      )}

      <ul className="ac-batch-export-list" data-testid="batch-export-item-list">
        {items.map((item) => (
          <li
            key={item.index}
            className="ac-batch-export-row"
            data-testid={`batch-export-item-${item.index}`}
          >
            <span className="ac-batch-export-slot">{item.slotLabel}</span>
            <span className="ac-batch-export-name">{item.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
