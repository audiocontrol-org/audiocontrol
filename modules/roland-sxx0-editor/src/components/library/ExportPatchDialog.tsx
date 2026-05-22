/**
 * Export Patch to Library Dialog (v3)
 *
 * Right-edge SlideDrawer per the v3 design language. Mirrors
 * {@link ExportToneDialog}'s chrome — same eyebrow + hairline +
 * step-log + footer ladder — so the two sibling export flows
 * stay visually identical. The only differences are the
 * eyebrow's category token (PATCH instead of TONE), the
 * detail-summary rows, and the "exported successfully" message
 * format.
 *
 * Like the tone variant, this dialog no longer suffers BUG-001's
 * silent-failure shape: synchronous throws from the parent hook's
 * precondition guards are captured into `localError`, coalesce
 * with `operationError`, and surface as a failed step in the log.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { SlideDrawer } from '@audiocontrol/editor-core';
import type { S330Patch } from '@audiocontrol/sampler-devices/s330';
import {
  type OperationState,
  isOperationComplete,
} from '@/types/import-operation';
import { getPatchToneDependencies } from '@/lib/library-service';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { useStepHistory } from '@/hooks/useStepHistory';
import { DestinationEyebrow } from '@/components/library/DestinationEyebrow';
import {
  StepLogBody,
  ExportSummaryRow,
  renderFooter,
} from '@/components/library/ExportToneDialog';

export interface ExportPatchDialogProps extends OperationState {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patch: S330Patch | null;
  patchIndex: number;
  /** Library subfolder the export will land in. See ExportToneDialog. */
  targetPath?: string[];
  onExport: (patchName: string, patchIndex: number) => Promise<void>;
}

export function ExportPatchDialog({
  open,
  onOpenChange,
  patch,
  patchIndex,
  targetPath,
  onExport,
  isOperating,
  progress,
  error: operationError,
}: ExportPatchDialogProps): JSX.Element | null {
  const { memoryLayout, deviceName } = useDeviceConfig();
  const slotLabel = memoryLayout.formatPatchSlot(patchIndex);
  // Device-aware default name (S-330: Patch_P11..Patch_P28; S-550:
  // Patch_I11..Patch_IV28). The `Patch_` prefix preserves the
  // "this is a name, not a slot id" affordance — the default is
  // written to disk as the patch directory name, and a bare
  // `II11/` directory is uncomfortable as a filename.
  const defaultPatchName = `Patch_${slotLabel}`;

  const [patchName, setPatchName] = useState(
    patch?.common.name || defaultPatchName,
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  const referencedToneCount = useMemo(
    () => (patch ? getPatchToneDependencies(patch).length : 0),
    [patch],
  );

  useEffect(() => {
    if (open) {
      setPatchName(patch?.common.name || defaultPatchName);
      setLocalError(null);
      setHasStarted(false);
    }
  }, [open, patch?.common.name, defaultPatchName]);

  const isComplete = isOperationComplete({
    isOperating,
    progress,
    error: operationError,
  });
  const effectiveError = localError ?? operationError;
  const steps = useStepHistory({ progress, isComplete, error: effectiveError });

  const handleExport = useCallback(async () => {
    const trimmed = patchName.trim();
    if (!trimmed) {
      setLocalError('Patch name is required');
      return;
    }
    setLocalError(null);
    setHasStarted(true);
    try {
      await onExport(trimmed, patchIndex);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Export failed');
    }
  }, [patchName, patchIndex, onExport]);

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
    canExport: !!patchName.trim() && !!patch,
    onCancel: handleClose,
    onExport: handleExport,
    onClose: handleClose,
  });

  return (
    <SlideDrawer
      open={open}
      title="Export patch to library"
      onClose={handleClose}
      footer={footer}
    >
      {hasStarted ? (
        <StepLogBody
          steps={steps}
          isComplete={isComplete}
          hasError={!!effectiveError}
          successMessage={
            <>
              Patch bundle exported successfully — saved to{' '}
              <span style={{ fontFamily: 'var(--ac-font-mono)' }}>
                {patchName.trim()}/
              </span>{' '}
              with {referencedToneCount} tone
              {referencedToneCount !== 1 ? 's' : ''}
            </>
          }
        />
      ) : (
        <PatchFormBody
          patch={patch}
          slotLabel={slotLabel}
          deviceName={deviceName}
          patchName={patchName}
          setPatchName={setPatchName}
          referencedToneCount={referencedToneCount}
          targetPath={targetPath ?? []}
          error={localError}
        />
      )}
    </SlideDrawer>
  );
}

// ---------------------------------------------------------------------------
// Body — idle form
// ---------------------------------------------------------------------------

interface PatchFormBodyProps {
  patch: S330Patch | null;
  slotLabel: string;
  /** Active device name from useDeviceConfig — routed in instead of
   *  hardcoded so the eyebrow shows S-330 / S-550 correctly per
   *  active surface. AUDIT-20260521-02. */
  deviceName: string;
  patchName: string;
  setPatchName: (name: string) => void;
  referencedToneCount: number;
  targetPath: string[];
  error: string | null;
}

function PatchFormBody({
  patch,
  slotLabel,
  deviceName,
  patchName,
  setPatchName,
  referencedToneCount,
  targetPath,
  error,
}: PatchFormBodyProps): JSX.Element {
  return (
    <div className="ac-export-form">
      <DestinationEyebrow
        kindLabel="PATCH"
        leftField={slotLabel}
        deviceName={deviceName}
        targetPath={targetPath}
        testIdPrefix="export-patch"
      />
      <div className="ac-page-title-rule" aria-hidden="true" />

      <div className="ac-export-form-field">
        <label htmlFor="export-patch-name" className="ac-field-label">
          Patch name
        </label>
        <input
          id="export-patch-name"
          type="text"
          value={patchName}
          onChange={(e) => setPatchName(e.target.value)}
          maxLength={32}
          autoFocus
          className={`ac-input ${error ? 'ac-input--error' : ''}`}
          placeholder="Enter patch name"
          data-testid="export-patch-name-input"
        />
        {error && (
          <p className="ac-export-form-error" role="alert">
            {error}
          </p>
        )}
      </div>

      {patch && (
        <dl className="ac-export-summary">
          <ExportSummaryRow
            label="Key mode"
            value={patch.common.keyMode}
            valueStyle="capitalize"
          />
          <ExportSummaryRow label="Level" value={String(patch.common.level)} />
          <ExportSummaryRow
            label="Bender range"
            value={String(patch.common.benderRange)}
          />
          <ExportSummaryRow
            label="Output"
            value={
              patch.common.outputAssign === 8
                ? 'TONE'
                : String(patch.common.outputAssign)
            }
          />
          <ExportSummaryRow
            label="Dependent tones"
            value={`${referencedToneCount} tone${referencedToneCount !== 1 ? 's' : ''} will be exported`}
          />
        </dl>
      )}
    </div>
  );
}
