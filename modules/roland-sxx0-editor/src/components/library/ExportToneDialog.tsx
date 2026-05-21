/**
 * Export Tone to Library Dialog (v3)
 *
 * Right-edge SlideDrawer per the v3 design language: the library
 * tree and device memory stay visible while the drawer is open so
 * the operator keeps source-slot + destination context in view.
 *
 * Two body modes drawn into a single SlideDrawer (so the drawer
 * panel never remounts mid-operation):
 *   - Idle:  tone-name + tone-detail readout + Export action
 *   - Run/Done/Fail: shared step-log (`ac-step-*`) growing in
 *     place as `OperationProgress` ticks
 *
 * Replaces the legacy centered Radix.Dialog. The empty `catch {}`
 * silent-failure shape from BUG-001 disappears here: any thrown
 * error from `onExport` is captured into `localError`, coalesced
 * with `operationError`, and feeds the step log's failed-state row.
 */

import { useState, useCallback, useEffect, type ReactNode } from 'react';
import {
  SlideDrawer,
  StepRow,
  type ProgressStep,
} from '@audiocontrol/editor-core';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import type { S330Tone } from '@audiocontrol/sampler-devices/s330';
import {
  type OperationState,
  isOperationComplete,
} from '@/types/import-operation';
import { useStepHistory } from '@/hooks/useStepHistory';

export interface ExportToneDialogProps extends OperationState {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tone: S330Tone | null;
  toneIndex: number;
  /** Library subfolder the export will land in (e.g. ['DRUMS']). When
   *  non-empty, the eyebrow row surfaces it so the operator sees the
   *  destination before clicking Export. Defaults to []. */
  targetPath?: string[];
  onExport: (toneName: string, toneIndex: number) => Promise<void>;
}

export function ExportToneDialog({
  open,
  onOpenChange,
  tone,
  toneIndex,
  targetPath,
  onExport,
  isOperating,
  progress,
  error: operationError,
}: ExportToneDialogProps): JSX.Element | null {
  const { memoryLayout } = useDeviceConfig();
  const slotLabel = memoryLayout.formatToneSlot(toneIndex);

  const [toneName, setToneName] = useState(tone?.name || `Tone_${slotLabel}`);
  const [localError, setLocalError] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  // Reset on (re)open.
  useEffect(() => {
    if (open) {
      setToneName(tone?.name || `Tone_${slotLabel}`);
      setLocalError(null);
      setHasStarted(false);
    }
  }, [open, tone?.name, slotLabel]);

  const isComplete = isOperationComplete({
    isOperating,
    progress,
    error: operationError,
  });
  const effectiveError = localError ?? operationError;
  const steps = useStepHistory({ progress, isComplete, error: effectiveError });

  const handleExport = useCallback(async () => {
    const trimmed = toneName.trim();
    if (!trimmed) {
      setLocalError('Tone name is required');
      return;
    }
    setLocalError(null);
    setHasStarted(true);
    try {
      await onExport(trimmed, toneIndex);
    } catch (err) {
      // Coalesces with `operationError` via `effectiveError`. Without
      // this, the synchronous precondition throws in the parent hook
      // (e.g. `!libraryHandle`) would vanish — that is BUG-001.
      setLocalError(err instanceof Error ? err.message : 'Export failed');
    }
  }, [toneName, toneIndex, onExport]);

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
    canExport: !!toneName.trim() && !!tone,
    onCancel: handleClose,
    onExport: handleExport,
    onClose: handleClose,
  });

  return (
    <SlideDrawer
      open={open}
      title="Export tone to library"
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
              Tone exported successfully — saved as{' '}
              <span style={{ fontFamily: 'var(--ac-font-mono)' }}>
                {toneName.trim()}.yaml
              </span>
            </>
          }
        />
      ) : (
        <ToneFormBody
          tone={tone}
          slotLabel={slotLabel}
          toneName={toneName}
          setToneName={setToneName}
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

interface ToneFormBodyProps {
  tone: S330Tone | null;
  slotLabel: string;
  toneName: string;
  setToneName: (name: string) => void;
  targetPath: string[];
  error: string | null;
}

function ToneFormBody({
  tone,
  slotLabel,
  toneName,
  setToneName,
  targetPath,
  error,
}: ToneFormBodyProps): JSX.Element {
  return (
    <div className="ac-export-form">
      <div className="ac-detail-eyebrow-row" data-testid="export-tone-destination">
        <span className="ac-detail-eyebrow-accent">TONE</span>
        <span className="ac-detail-eyebrow-sep">·</span>
        <span>{slotLabel}</span>
        <span className="ac-detail-eyebrow-sep">·</span>
        <span>LIBRARY</span>
        <span className="ac-detail-eyebrow-sep">·</span>
        <span>S330</span>
        {targetPath.length > 0 && (
          // Surface the drop-target subfolder so the operator confirms
          // the export will land where they intended. Drops on a folder
          // row populate this from `handleExternalDrop`; drops on the
          // category root leave it empty and we hide the segment.
          <>
            <span className="ac-detail-eyebrow-sep">·</span>
            <span data-testid="export-tone-target-path">{targetPath.join(' / ')}</span>
          </>
        )}
      </div>
      <div className="ac-page-title-rule" aria-hidden="true" />

      <div className="ac-export-form-field">
        <label htmlFor="export-tone-name" className="ac-field-label">
          Tone name
        </label>
        <input
          id="export-tone-name"
          type="text"
          value={toneName}
          onChange={(e) => setToneName(e.target.value)}
          maxLength={32}
          autoFocus
          className={`ac-input ${error ? 'ac-input--error' : ''}`}
          placeholder="Enter tone name"
          data-testid="export-tone-name-input"
        />
        {error && (
          <p className="ac-export-form-error" role="alert">
            {error}
          </p>
        )}
      </div>

      {tone && (
        <dl className="ac-export-summary">
          <ExportSummaryRow label="Sample rate" value={tone.sampleRate} />
          <ExportSummaryRow
            label="Loop mode"
            value={tone.loopMode}
            valueStyle="capitalize"
          />
          <ExportSummaryRow label="Original key" value={String(tone.originalKey)} />
          <ExportSummaryRow label="TVF" value={tone.tvf.enabled ? 'ON' : 'OFF'} />
        </dl>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Body — running / complete / failed step log
// ---------------------------------------------------------------------------

interface StepLogBodyProps {
  steps: ProgressStep[];
  isComplete: boolean;
  hasError: boolean;
  successMessage: ReactNode;
}

export function StepLogBody({
  steps,
  isComplete,
  hasError,
  successMessage,
}: StepLogBodyProps): JSX.Element {
  return (
    <div className="ac-stepped-progress">
      {steps.map((step) => (
        <StepRow key={step.id} step={step} />
      ))}
      {isComplete && !hasError && (
        <div className="ac-step-summary">{successMessage}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

interface ExportSummaryRowProps {
  label: string;
  value: string;
  valueStyle?: 'capitalize';
}

export function ExportSummaryRow({
  label,
  value,
  valueStyle,
}: ExportSummaryRowProps): JSX.Element {
  return (
    <div className="ac-export-summary-row">
      <dt>{label}</dt>
      <dd className={valueStyle === 'capitalize' ? 'ac-capitalize' : undefined}>
        {value}
      </dd>
    </div>
  );
}

interface FooterParams {
  hasStarted: boolean;
  isComplete: boolean;
  hasError: boolean;
  isOperating: boolean;
  canExport: boolean;
  onCancel: () => void;
  onExport: () => void;
  onClose: () => void;
}

export function renderFooter({
  hasStarted,
  isComplete,
  hasError,
  isOperating,
  canExport,
  onCancel,
  onExport,
  onClose,
}: FooterParams): JSX.Element {
  if (!hasStarted) {
    return (
      <>
        <button
          type="button"
          className="ac-btn ac-btn-sm"
          onClick={onCancel}
          data-testid="export-cancel"
        >
          Cancel
        </button>
        <button
          type="button"
          className="ac-btn ac-btn-sm ac-btn-primary"
          onClick={onExport}
          disabled={!canExport}
          data-testid="export-confirm"
        >
          Export
        </button>
      </>
    );
  }
  if (isComplete && !hasError) {
    return (
      <button
        type="button"
        className="ac-btn ac-btn-sm ac-btn-primary"
        onClick={onClose}
        data-testid="export-cancel"
      >
        Done
      </button>
    );
  }
  if (hasError) {
    return (
      <button
        type="button"
        className="ac-btn ac-btn-sm"
        onClick={onClose}
        data-testid="export-cancel"
      >
        Close
      </button>
    );
  }
  // Running: cancel is unavailable today (the export hook has no abort
  // signal). Show the button as disabled so the affordance is visible
  // and the test selector remains stable.
  return (
    <button
      type="button"
      className="ac-btn ac-btn-sm"
      disabled
      data-testid="export-cancel"
      title={isOperating ? 'Export in progress' : ''}
    >
      Cancel
    </button>
  );
}
