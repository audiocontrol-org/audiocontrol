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

import type { SamplerTone } from '@/core/midi/SamplerClient';
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
  const hasSampleData = tone.wave.endPoint > tone.wave.startPoint;

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

        <div className="tones__detail-actions">
          <div className="tones__detail-actions-row">
            {onExportToLibrary && (
              <Tooltip content={hasSampleData ? 'Export tone and sample to library' : 'No sample data to export'}>
                <button
                  onClick={onExportToLibrary}
                  disabled={isExportingToLibrary || isExporting || !hasSampleData}
                  data-testid="export-tone-button"
                  className={cn(
                    'ac-btn ac-btn-sm',
                    hasSampleData ? 'ac-btn-primary' : 'ac-btn-ghost opacity-50',
                    (isExportingToLibrary || isExporting) && 'opacity-50 cursor-wait',
                  )}
                >
                  {isExportingToLibrary ? (
                    <>
                      <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Exporting...
                    </>
                  ) : (
                    'Export to Library'
                  )}
                </button>
              </Tooltip>
            )}
            {onExportSample && (
              <Tooltip content={hasSampleData ? 'Download this sample as a WAV file' : 'No sample data to export'}>
                <button
                  onClick={onExportSample}
                  disabled={isExporting || isExportingToLibrary || !hasSampleData}
                  data-testid="export-sample-button"
                  className={cn(
                    'ac-btn ac-btn-sm',
                    hasSampleData ? 'ac-btn-secondary' : 'ac-btn-ghost opacity-50',
                    (isExporting || isExportingToLibrary) && 'opacity-50 cursor-wait',
                  )}
                >
                  {isExporting ? (
                    <>
                      <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Exporting...
                    </>
                  ) : (
                    'Export Sample'
                  )}
                </button>
              </Tooltip>
            )}
            {onImportSample && (
              <Tooltip content="Import a WAV file from disk to this tone slot">
                <button
                  onClick={onImportSample}
                  disabled={isImporting || isExporting || isExportingToLibrary}
                  className={cn(
                    'ac-btn ac-btn-sm ac-btn-ghost',
                    (isImporting || isExporting || isExportingToLibrary) && 'opacity-50 cursor-wait',
                  )}
                >
                  {isImporting ? (
                    <>
                      <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Importing...
                    </>
                  ) : (
                    'Import Sample'
                  )}
                </button>
              </Tooltip>
            )}
            {onChopSample && (
              <Tooltip content={hasSampleData ? 'Slice this sample into a drum kit' : 'No sample data to chop'}>
                <button
                  onClick={onChopSample}
                  disabled={isLoadingChopWaveData || !hasSampleData}
                  data-testid="chop-tone-button"
                  className={cn(
                    'ac-btn ac-btn-sm ac-btn-ghost',
                    !hasSampleData && 'opacity-50',
                    isLoadingChopWaveData && 'opacity-50 cursor-wait',
                  )}
                >
                  {isLoadingChopWaveData ? (
                    <>
                      <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Loading...
                    </>
                  ) : (
                    'Chop into Drum Kit'
                  )}
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
