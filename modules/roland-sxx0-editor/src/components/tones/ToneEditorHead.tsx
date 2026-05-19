/**
 * ToneEditor — detail-head component (Phase 9 Task 4 polish).
 *
 * Extracted from ToneEditor.tsx so the editor stays under the 300–500
 * line target. Renders the eyebrow row, slot+name title, and the
 * full action-button cluster (Export to Library / Export Sample /
 * Import Sample / Chop into Drum Kit) above the parameter tabs.
 *
 * Shared primitives:
 *   - `.ac-detail-eyebrow-*` — uppercase row above the title.
 *
 * Tones-page-scoped primitives:
 *   - `.tones__detail-head` — gradient + bottom rule.
 *   - `.tones__detail-title` — display heading with the slot mark.
 *   - `.tones__detail-actions` — action-button cluster + progress.
 *
 * All existing data-testids on the action buttons are preserved
 * verbatim so test/ui/tones.spec.ts and the capability suite keep
 * working.
 */

import { type SamplerTone, toneHasWaveData } from '@/core/midi/SamplerClient';
import { formatS330Number, cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/Tooltip';

interface ToneEditorHeadProps {
  tone: SamplerTone;
  index: number;
  deviceName: string;
  onUpdate?: (tone: SamplerTone) => void;
  onCommit?: (updatedTone?: SamplerTone) => void;
  onExportSample?: () => void;
  isExporting?: boolean;
  exportProgress?: number;
  onExportToLibrary?: () => void;
  isExportingToLibrary?: boolean;
  onImportSample?: () => void;
  isImporting?: boolean;
  onChopSample?: () => void;
  isLoadingChopWaveData?: boolean;
}

export function ToneEditorHead({
  tone,
  index,
  deviceName,
  onUpdate,
  onCommit,
  onExportSample,
  isExporting = false,
  exportProgress,
  onExportToLibrary,
  isExportingToLibrary = false,
  onImportSample,
  isImporting = false,
  onChopSample,
  isLoadingChopWaveData = false,
}: ToneEditorHeadProps) {
  const hasSampleData = toneHasWaveData(tone);

  return (
    <header className="tones__detail-head">
      <div className="ac-detail-eyebrow-row">
        <span>Tone</span>
        <span className="ac-detail-eyebrow-sep">·</span>
        <span className="ac-detail-eyebrow-accent">Editing</span>
        <span className="ac-detail-eyebrow-sep">·</span>
        <span>Source · {deviceName}</span>
      </div>

      <div className="tones__detail-title-row">
        <h3 className="tones__detail-title">
          <span className="tones__detail-slot">T{formatS330Number(index)}</span>
          <input
            type="text"
            value={tone.name}
            onChange={(e) => onUpdate?.({ ...tone, name: e.target.value.slice(0, 8) })}
            onBlur={() => onCommit?.()}
            placeholder="(unnamed)"
            data-testid="tone-name-input"
            maxLength={8}
            className="ac-input tones__detail-name-input"
          />
        </h3>

        {/* Action cluster — compact icon-button row aligned with the
            title. The previous four-button column-flex chrome ate
            ~120px of vertical space and pushed parameter content below
            the fold; the mockup detail-head has no action cluster at
            all (04-tones.html line 2359). Keeping the actions
            available but rendered as icon-buttons reclaims that space
            while preserving data-testids for existing specs. */}
        <div className="tones__detail-actions">
          <div className="tones__detail-actions-row">
            {onExportToLibrary && (
              <Tooltip content={hasSampleData ? 'Export tone and sample to library' : 'No sample data to export'}>
                <button
                  type="button"
                  onClick={onExportToLibrary}
                  disabled={isExportingToLibrary || isExporting || !hasSampleData}
                  data-testid="export-tone-button"
                  aria-label="Export tone to library"
                  className={cn(
                    'ac-icon-btn',
                    isExportingToLibrary && 'ac-icon-btn--spinning',
                  )}
                >
                  {/* outbound-to-library: arrow exiting a folder */}
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M2 4h4l1 1h6v7H2z" />
                    <path d="M8 11v-5" />
                    <polyline points="5.5 8.5 8 6 10.5 8.5" />
                  </svg>
                </button>
              </Tooltip>
            )}
            {onExportSample && (
              <Tooltip content={hasSampleData ? 'Download this sample as a WAV file' : 'No sample data to export'}>
                <button
                  type="button"
                  onClick={onExportSample}
                  disabled={isExporting || isExportingToLibrary || !hasSampleData}
                  data-testid="export-sample-button"
                  aria-label="Download sample as WAV"
                  className={cn(
                    'ac-icon-btn',
                    isExporting && 'ac-icon-btn--spinning',
                  )}
                >
                  {/* download: arrow pointing down into a tray */}
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M8 2v8" />
                    <polyline points="5 7 8 10 11 7" />
                    <path d="M2.5 12v1.5h11V12" />
                  </svg>
                </button>
              </Tooltip>
            )}
            {onImportSample && (
              <Tooltip content="Import a WAV file from disk to this tone slot">
                <button
                  type="button"
                  onClick={onImportSample}
                  disabled={isImporting || isExporting || isExportingToLibrary}
                  aria-label="Import WAV file to this tone slot"
                  className={cn(
                    'ac-icon-btn',
                    isImporting && 'ac-icon-btn--spinning',
                  )}
                >
                  {/* upload: arrow pointing up out of a tray */}
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M8 14V6" />
                    <polyline points="5 9 8 6 11 9" />
                    <path d="M2.5 4v-1.5h11V4" />
                  </svg>
                </button>
              </Tooltip>
            )}
            {onChopSample && (
              <Tooltip content={hasSampleData ? 'Slice this sample into a drum kit' : 'No sample data to chop'}>
                <button
                  type="button"
                  onClick={onChopSample}
                  disabled={isLoadingChopWaveData || !hasSampleData}
                  data-testid="chop-tone-button"
                  aria-label="Chop sample into drum kit"
                  className={cn(
                    'ac-icon-btn',
                    isLoadingChopWaveData && 'ac-icon-btn--spinning',
                  )}
                >
                  {/* chop: scissors-like fork */}
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <circle cx="4" cy="4" r="2" />
                    <circle cx="4" cy="12" r="2" />
                    <path d="M5.5 5.2L14 13" />
                    <path d="M5.5 10.8L14 3" />
                  </svg>
                </button>
              </Tooltip>
            )}
          </div>
          {isExporting && exportProgress !== undefined && (
            <div className="tones__detail-actions-progress">
              <div className="tones__detail-actions-progress-track">
                <div
                  className="tones__detail-actions-progress-fill"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
              <span>{exportProgress.toFixed(0)}%</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
