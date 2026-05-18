/**
 * Common Sample Preview Panel
 *
 * Right column of the Library page when a sample or program in the
 * common (cross-device) area is selected. Renders the lean v3 chrome
 * (.ac-preview-pane + .ac-preview-fields + .ac-pane-action) shared
 * with ItemPreviewPanel via preview-chrome.tsx.
 *
 * Sample-side body: identity + tags + sample metadata fields + open-in
 * actions + Promote-to-Tone form.
 * Program-side body: identity + tags + program metadata + zone list.
 */

import { useState, useEffect, useCallback } from 'react';
import type { SampleYaml, ProgramYaml, ToneYaml, StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import { s330SamplePromotion, midiNoteToName, getNestedDirectory } from '@audiocontrol/sampler-library/browser';
import { OperationProgressBar, type OperationProgress } from '@audiocontrol/editor-core';
import { loadCommonSample, loadCommonProgram } from '@/lib/library-service';
import { stringify as stringifyYaml } from 'yaml';
import {
  PreviewPane,
  PreviewIdentity,
  FieldGrid,
  PaneAction,
  LoadingState,
  ErrorState,
  EmptySlotMessage,
  type FieldDef,
} from '@/components/library/preview-chrome';

interface CommonSamplePreviewPanelProps {
  selection: { type: 'sample' | 'program'; name: string; path?: string[] } | null;
  libraryHandle: StorageDirectoryHandle | null;
  onPromoteToDevice?: (deviceType: string) => void;
  onOpenInLoopEditor?: (name: string, path?: string[]) => void;
  onOpenInChopper?: (name: string, path?: string[]) => void;
  onOpenInSampleEditor?: (name: string, path?: string[]) => void;
}

/** All S-series devices share a single library section under s330. */
const LIBRARY_DEVICE = 's330' as const;

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function Tags({ tags }: { tags: string[] }): JSX.Element {
  return (
    <div className="ac-preview-tags">
      {tags.map((tag) => (
        <span key={tag} className="ac-preview-tag">{tag}</span>
      ))}
    </div>
  );
}

function sampleFields(sample: SampleYaml): FieldDef[] {
  return [
    { label: 'Sample Rate', value: `${sample.sampleRate} Hz` },
    {
      label: 'Root Key',
      value: sample.rootKey !== undefined ? midiNoteToName(Number(sample.rootKey)) : '—',
    },
    { label: 'Loop Mode', value: sample.loopMode ?? 'oneShot' },
    { label: 'File', value: sample.file },
  ];
}

function sampleLoopFields(sample: SampleYaml): FieldDef[] | null {
  if (sample.loopStart === undefined && sample.loopEnd === undefined) return null;
  const fields: FieldDef[] = [];
  if (sample.loopStart !== undefined) fields.push({ label: 'Loop Start', value: sample.loopStart });
  if (sample.loopEnd !== undefined) fields.push({ label: 'Loop End', value: sample.loopEnd });
  return fields;
}

function programFields(program: ProgramYaml): FieldDef[] {
  return [
    { label: 'Zones', value: program.zones.length },
    { label: 'Polyphony', value: program.polyphony ?? 'poly' },
    { label: 'Playback', value: program.playbackMode ?? 'gate' },
  ];
}

// ---------------------------------------------------------------
// Promote-to-tone subsection
// ---------------------------------------------------------------

interface PromoteFormProps {
  onPromote: (originalKey: number) => void;
  isPromoting: boolean;
  promotionProgress?: OperationProgress;
  promotionResult: { success: boolean; message: string } | null;
}

function PromoteForm({
  onPromote,
  isPromoting,
  promotionProgress,
  promotionResult,
}: PromoteFormProps): JSX.Element {
  const [originalKey, setOriginalKey] = useState(60);

  return (
    <>
      <div>
        <div className="ac-preview-subsection-eyebrow">Promote to Tone</div>
        <div className="ac-preview-form-row">
          <label className="ac-field-label" htmlFor="promote-original-key">
            Original Key (MIDI 11–108)
          </label>
          <div className="ac-preview-form-row-controls">
            <input
              id="promote-original-key"
              type="number"
              min={11}
              max={108}
              value={originalKey}
              onChange={(e) =>
                setOriginalKey(
                  Math.min(108, Math.max(11, parseInt(e.target.value, 10) || 60)),
                )
              }
              className="ac-input"
            />
            <span className="ac-preview-form-row-hint">{midiNoteToName(originalKey)}</span>
          </div>
        </div>
      </div>

      <div className="ac-pane-actions">
        <PaneAction
          label="Promote"
          variant="primary"
          onClick={() => onPromote(originalKey)}
          disabled={isPromoting}
          busy={isPromoting}
          busyLabel="Promoting…"
        />
      </div>

      {isPromoting && promotionProgress && (
        <OperationProgressBar progress={promotionProgress} />
      )}

      {promotionResult && (
        <div
          className={
            promotionResult.success
              ? 'ac-preview-result ac-preview-result--ok'
              : 'ac-preview-result ac-preview-result--err'
          }
          role={promotionResult.success ? 'status' : 'alert'}
        >
          {promotionResult.message}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------
// Promotion logic (unchanged)
// ---------------------------------------------------------------

async function promoteSampleToDevice(
  libraryHandle: StorageDirectoryHandle,
  sample: SampleYaml,
  samplePath: string[],
  sampleDirName: string,
  originalKey: number,
  onProgress?: (progress: OperationProgress) => void,
): Promise<void> {
  const tone: ToneYaml = s330SamplePromotion.promote(sample, { originalKey });
  const toneName = sample.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const wavFileName = `${toneName}.wav`;
  tone.wave.file = wavFileName;

  onProgress?.({
    currentStep: 1, totalSteps: 3,
    stepLabel: 'Creating tones directory…',
    bytesSent: 0, bytesTotal: 0, bytesSentAllSteps: 0, bytesTotalAllSteps: 0,
  });

  const tonesDir = await getNestedDirectory(libraryHandle, ['library', LIBRARY_DEVICE, 'tones']);

  onProgress?.({
    currentStep: 1, totalSteps: 3,
    stepLabel: `Writing ${toneName}.yaml…`,
    bytesSent: 0, bytesTotal: 0, bytesSentAllSteps: 0, bytesTotalAllSteps: 0,
  });

  const yamlContent = stringifyYaml(tone);
  const yamlHandle = await tonesDir.getFileHandle(`${toneName}.yaml`, { create: true });
  const yamlWritable = await yamlHandle.createWritable();
  await yamlWritable.write(yamlContent);
  await yamlWritable.close();

  onProgress?.({
    currentStep: 2, totalSteps: 3,
    stepLabel: 'Loading source audio…',
    bytesSent: 0, bytesTotal: 0, bytesSentAllSteps: 0, bytesTotalAllSteps: 0,
  });

  const sampleBundleDir = await getNestedDirectory(
    libraryHandle,
    ['library', 'common', 'samples', ...samplePath, sampleDirName],
  );
  const sourceWavHandle = await sampleBundleDir.getFileHandle('sample.wav');
  const sourceFile = await sourceWavHandle.getFile();
  const wavData = await sourceFile.arrayBuffer();

  onProgress?.({
    currentStep: 3, totalSteps: 3,
    stepLabel: `Writing ${wavFileName}…`,
    bytesSent: 0, bytesTotal: wavData.byteLength,
    bytesSentAllSteps: 0, bytesTotalAllSteps: wavData.byteLength,
  });

  const destWavHandle = await tonesDir.getFileHandle(wavFileName, { create: true });
  const destWritable = await destWavHandle.createWritable();
  await destWritable.write(wavData);
  await destWritable.close();

  onProgress?.({
    currentStep: 3, totalSteps: 3,
    stepLabel: 'Done',
    bytesSent: wavData.byteLength, bytesTotal: wavData.byteLength,
    bytesSentAllSteps: wavData.byteLength, bytesTotalAllSteps: wavData.byteLength,
  });
}

// ---------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------

export function CommonSamplePreviewPanel({
  selection,
  libraryHandle,
  onPromoteToDevice,
  onOpenInLoopEditor,
  onOpenInChopper,
  onOpenInSampleEditor,
}: CommonSamplePreviewPanelProps): JSX.Element {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sample, setSample] = useState<SampleYaml | null>(null);
  const [program, setProgram] = useState<ProgramYaml | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);
  const [promotionProgress, setPromotionProgress] = useState<OperationProgress | undefined>();
  const [promotionResult, setPromotionResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    setSample(null);
    setProgram(null);
    setError(null);
    setPromotionResult(null);

    if (!selection || !libraryHandle) return;

    const load = async () => {
      setLoading(true);
      try {
        if (selection.type === 'sample') {
          setSample(await loadCommonSample(libraryHandle, selection.name, selection.path));
        } else {
          setProgram(await loadCommonProgram(libraryHandle, selection.name, selection.path));
        }
      } catch (err) {
        console.error('[CommonSamplePreviewPanel] Failed to load:', err);
        setError(err instanceof Error ? err.message : 'Failed to load item');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selection, libraryHandle]);

  const handlePromote = useCallback(
    async (originalKey: number) => {
      if (!libraryHandle || !sample || !selection) return;
      setIsPromoting(true);
      setPromotionResult(null);
      setPromotionProgress(undefined);
      try {
        await promoteSampleToDevice(
          libraryHandle,
          sample,
          selection.path ?? [],
          selection.name,
          originalKey,
          setPromotionProgress,
        );
        setPromotionResult({ success: true, message: 'Promoted to tones library' });
        onPromoteToDevice?.(LIBRARY_DEVICE);
      } catch (err) {
        console.error('[CommonSamplePreviewPanel] Promotion failed:', err);
        setPromotionResult({
          success: false,
          message: err instanceof Error ? err.message : 'Promotion failed',
        });
      } finally {
        setIsPromoting(false);
        setPromotionProgress(undefined);
      }
    },
    [libraryHandle, sample, selection, onPromoteToDevice],
  );

  // ---- Empty state ----------------------------------------------
  if (!selection) {
    return (
      <PreviewPane title="Preview">
        <EmptySlotMessage message="Select an item to view details" />
      </PreviewPane>
    );
  }

  const headerTitle = selection.type === 'sample' ? 'Common Sample' : 'Common Program';

  // ---- Pane body --------------------------------------------------
  let body: JSX.Element;
  if (loading) {
    body = <LoadingState />;
  } else if (error) {
    body = <ErrorState message={error} />;
  } else if (sample) {
    const loopFields = sampleLoopFields(sample);
    body = (
      <>
        <PreviewIdentity kind="Common Sample" slot={selection.name} name={sample.name} />
        {sample.description && (
          <p className="ac-preview-description">{sample.description}</p>
        )}
        {sample.tags && sample.tags.length > 0 && <Tags tags={sample.tags} />}
        <FieldGrid fields={sampleFields(sample)} />
        {loopFields && <FieldGrid fields={loopFields} />}
        {sample.sourceDevice && (
          <FieldGrid fields={[{ label: 'Source Device', value: sample.sourceDevice }]} />
        )}
        {(onOpenInLoopEditor || onOpenInChopper || onOpenInSampleEditor) && (
          <div className="ac-pane-actions">
            {onOpenInLoopEditor && (
              <PaneAction
                label="Open in Loop Editor"
                onClick={() => onOpenInLoopEditor(selection.name, selection.path)}
              />
            )}
            {onOpenInChopper && (
              <PaneAction
                label="Open in Chopper"
                onClick={() => onOpenInChopper(selection.name, selection.path)}
              />
            )}
            {onOpenInSampleEditor && (
              <PaneAction
                label="Open in Editor"
                onClick={() => onOpenInSampleEditor(selection.name, selection.path)}
              />
            )}
          </div>
        )}
        <PromoteForm
          onPromote={handlePromote}
          isPromoting={isPromoting}
          promotionProgress={promotionProgress}
          promotionResult={promotionResult}
        />
      </>
    );
  } else if (program) {
    body = (
      <>
        <PreviewIdentity kind="Common Program" slot={selection.name} name={program.name} />
        {program.description && (
          <p className="ac-preview-description">{program.description}</p>
        )}
        {program.tags && program.tags.length > 0 && <Tags tags={program.tags} />}
        <FieldGrid fields={programFields(program)} />
        <div>
          <div className="ac-preview-subsection-eyebrow">Zones ({program.zones.length})</div>
          <div className="ac-preview-tone-list" style={{ borderTop: 'none', paddingTop: 0 }}>
            {program.zones.map((zone, i) => (
              <div key={i} className="ac-preview-zone-row">
                <span className="ac-preview-zone-row-index">{i}</span>
                <span className="ac-preview-zone-row-name">{zone.label ?? zone.sample}</span>
                <div className="ac-preview-zone-row-meta">
                  <span>sample: {zone.sample}</span>
                  {zone.keyRange && (
                    <span>
                      keys: {midiNoteToName(zone.keyRange[0])}–{midiNoteToName(zone.keyRange[1])}
                    </span>
                  )}
                  {zone.velocityRange && (
                    <span>vel: {zone.velocityRange[0]}–{zone.velocityRange[1]}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="ac-preview-result ac-preview-result--err" style={{ borderColor: 'var(--ac-color-border-subtle)', background: 'transparent', color: 'var(--ac-color-text-muted)' }}>
          Program promotion to device patches is not yet supported.
        </div>
      </>
    );
  } else {
    body = <EmptySlotMessage message="Could not load data" />;
  }

  return (
    <PreviewPane title={headerTitle} subtitle={selection.name}>
      {body}
    </PreviewPane>
  );
}
