/**
 * Common Sample Preview Panel
 *
 * Right panel for previewing common-area samples and programs
 * with promote-to-device actions. Samples can be promoted to
 * device-specific tones (S-330, S-550) by providing an originalKey.
 */

import { useState, useEffect, useCallback } from 'react';
import type { SampleYaml, ProgramYaml, ToneYaml, StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import { s330SamplePromotion, midiNoteToName, getNestedDirectory } from '@audiocontrol/sampler-library/browser';
import { OperationProgressBar, type OperationProgress } from '@audiocontrol/editor-core';
import { loadCommonSample, loadCommonProgram } from '@/lib/library-service';
import { stringify as stringifyYaml } from 'yaml';

interface CommonSamplePreviewPanelProps {
  selection: { type: 'sample' | 'program'; name: string; path?: string[] } | null;
  libraryHandle: StorageDirectoryHandle | null;
  onPromoteToDevice?: (deviceType: string) => void;
  onOpenInLoopEditor?: (name: string, path?: string[]) => void;
  onOpenInChopper?: (name: string, path?: string[]) => void;
}

/** All S-series devices share a single library section under s330. */
const LIBRARY_DEVICE = 's330' as const;

function LoadingState(): JSX.Element {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="flex items-center gap-2 text-s330-muted">
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        <span>Loading...</span>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }): JSX.Element {
  return (
    <div className="text-center text-red-400 text-sm py-8">
      <p>Failed to load: {message}</p>
    </div>
  );
}

function TagBadges({ tags }: { tags: string[] }): JSX.Element {
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span key={tag} className="px-2 py-0.5 text-xs rounded bg-s330-accent/30 text-s330-text">
          {tag}
        </span>
      ))}
    </div>
  );
}

/** Inline form for promoting a sample to a device tone. */
function PromoteForm({
  onPromote,
  isPromoting,
  promotionProgress,
  promotionResult,
}: {
  onPromote: (originalKey: number) => void;
  isPromoting: boolean;
  promotionProgress?: OperationProgress;
  promotionResult: { success: boolean; message: string } | null;
}): JSX.Element {
  const [originalKey, setOriginalKey] = useState(60);

  return (
    <div className="space-y-3">
      <div className="bg-s330-bg rounded p-3 space-y-3">
        <div className="text-xs text-s330-muted uppercase tracking-wide">
          Promote to Tone
        </div>
        <div>
          <label className="text-xs text-s330-muted block mb-1">Original Key (MIDI 11-108)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={11}
              max={108}
              value={originalKey}
              onChange={(e) => setOriginalKey(Math.min(108, Math.max(11, parseInt(e.target.value, 10) || 60)))}
              className="w-20 px-2 py-1 text-sm bg-s330-bg border border-s330-accent rounded text-s330-text"
            />
            <span className="text-xs text-s330-muted">{midiNoteToName(originalKey)}</span>
          </div>
        </div>
        <button
          onClick={() => onPromote(originalKey)}
          disabled={isPromoting}
          className="w-full ac-btn ac-btn-primary ac-btn-sm"
        >
          {isPromoting ? 'Promoting...' : 'Promote'}
        </button>
      </div>

      {isPromoting && promotionProgress && (
        <OperationProgressBar progress={promotionProgress} />
      )}

      {promotionResult && (
        <div className={`text-sm p-3 rounded ${promotionResult.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
          {promotionResult.message}
        </div>
      )}
    </div>
  );
}

/** Display a SampleYaml's properties in an info grid. */
function SampleDetails({ sample }: { sample: SampleYaml }): JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-lg font-bold text-s330-text">{sample.name}</h4>
        {sample.description && (
          <p className="text-sm text-s330-muted mt-1">{sample.description}</p>
        )}
      </div>

      {sample.tags && sample.tags.length > 0 && <TagBadges tags={sample.tags} />}

      <div className="bg-s330-bg rounded p-3 text-sm space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-s330-muted text-xs">Sample Rate</span>
            <div className="text-s330-text">{sample.sampleRate} Hz</div>
          </div>
          <div>
            <span className="text-s330-muted text-xs">Root Key</span>
            <div className="text-s330-text">
              {sample.rootKey !== undefined ? midiNoteToName(Number(sample.rootKey)) : '--'}
            </div>
          </div>
          <div>
            <span className="text-s330-muted text-xs">Loop Mode</span>
            <div className="text-s330-text capitalize">{sample.loopMode ?? 'oneShot'}</div>
          </div>
          <div>
            <span className="text-s330-muted text-xs">File</span>
            <div className="text-s330-text truncate">{sample.file}</div>
          </div>
        </div>

        {(sample.loopStart !== undefined || sample.loopEnd !== undefined) && (
          <>
            <hr className="border-s330-accent/30" />
            <div className="grid grid-cols-2 gap-2">
              {sample.loopStart !== undefined && (
                <div>
                  <span className="text-s330-muted text-xs">Loop Start</span>
                  <div className="text-s330-text">{sample.loopStart}</div>
                </div>
              )}
              {sample.loopEnd !== undefined && (
                <div>
                  <span className="text-s330-muted text-xs">Loop End</span>
                  <div className="text-s330-text">{sample.loopEnd}</div>
                </div>
              )}
            </div>
          </>
        )}

        {sample.sourceDevice && (
          <>
            <hr className="border-s330-accent/30" />
            <div>
              <span className="text-s330-muted text-xs">Source Device</span>
              <div className="text-s330-text">{sample.sourceDevice}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Display a ProgramYaml's properties and zones. */
function ProgramDetails({ program }: { program: ProgramYaml }): JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-lg font-bold text-s330-text">{program.name}</h4>
        {program.description && (
          <p className="text-sm text-s330-muted mt-1">{program.description}</p>
        )}
      </div>

      {program.tags && program.tags.length > 0 && <TagBadges tags={program.tags} />}

      <div className="bg-s330-bg rounded p-3 text-sm">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <span className="text-s330-muted text-xs">Zones</span>
            <div className="text-s330-text">{program.zones.length}</div>
          </div>
          <div>
            <span className="text-s330-muted text-xs">Polyphony</span>
            <div className="text-s330-text capitalize">{program.polyphony ?? 'poly'}</div>
          </div>
          <div>
            <span className="text-s330-muted text-xs">Playback</span>
            <div className="text-s330-text capitalize">{program.playbackMode ?? 'gate'}</div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-s330-muted uppercase tracking-wide">Zones ({program.zones.length})</div>
        {program.zones.map((zone, i) => (
          <div key={i} className="bg-s330-bg rounded p-2 text-xs space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-5 text-s330-muted text-right">{i}</span>
              <span className="flex-1 text-s330-text font-medium truncate">{zone.label ?? zone.sample}</span>
            </div>
            <div className="flex items-center gap-3 ml-7 text-s330-muted">
              <span>sample: {zone.sample}</span>
              {zone.keyRange && (
                <span>keys: {midiNoteToName(zone.keyRange[0])}-{midiNoteToName(zone.keyRange[1])}</span>
              )}
              {zone.velocityRange && (
                <span>vel: {zone.velocityRange[0]}-{zone.velocityRange[1]}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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

  // Fix the WAV filename in the tone YAML to match the output file
  tone.wave.file = wavFileName;

  onProgress?.({
    currentStep: 1, totalSteps: 3,
    stepLabel: 'Creating tones directory...',
    bytesSent: 0, bytesTotal: 0, bytesSentAllSteps: 0, bytesTotalAllSteps: 0,
  });

  const tonesDir = await getNestedDirectory(libraryHandle, ['library', LIBRARY_DEVICE, 'tones']);

  // Write tone YAML
  onProgress?.({
    currentStep: 1, totalSteps: 3,
    stepLabel: `Writing ${toneName}.yaml...`,
    bytesSent: 0, bytesTotal: 0, bytesSentAllSteps: 0, bytesTotalAllSteps: 0,
  });

  const yamlContent = stringifyYaml(tone);
  const yamlHandle = await tonesDir.getFileHandle(`${toneName}.yaml`, { create: true });
  const yamlWritable = await yamlHandle.createWritable();
  await yamlWritable.write(yamlContent);
  await yamlWritable.close();

  // Copy WAV from common area sample bundle to device tones
  onProgress?.({
    currentStep: 2, totalSteps: 3,
    stepLabel: 'Loading source audio...',
    bytesSent: 0, bytesTotal: 0, bytesSentAllSteps: 0, bytesTotalAllSteps: 0,
  });

  const sampleBundleDir = await getNestedDirectory(libraryHandle, ['library', 'common', 'samples', ...samplePath, sampleDirName]);
  const sourceWavHandle = await sampleBundleDir.getFileHandle('sample.wav');
  const sourceFile = await sourceWavHandle.getFile();
  const wavData = await sourceFile.arrayBuffer();

  // Write WAV to device tones
  onProgress?.({
    currentStep: 3, totalSteps: 3,
    stepLabel: `Writing ${wavFileName}...`,
    bytesSent: 0, bytesTotal: wavData.byteLength, bytesSentAllSteps: 0, bytesTotalAllSteps: wavData.byteLength,
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

export function CommonSamplePreviewPanel({
  selection,
  libraryHandle,
  onPromoteToDevice,
  onOpenInLoopEditor,
  onOpenInChopper,
}: CommonSamplePreviewPanelProps): JSX.Element {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sample, setSample] = useState<SampleYaml | null>(null);
  const [program, setProgram] = useState<ProgramYaml | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);
  const [promotionProgress, setPromotionProgress] = useState<OperationProgress | undefined>(undefined);
  const [promotionResult, setPromotionResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load data when selection changes
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
          const loaded = await loadCommonSample(libraryHandle, selection.name, selection.path);
          setSample(loaded);
        } else {
          const loaded = await loadCommonProgram(libraryHandle, selection.name, selection.path);
          setProgram(loaded);
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

  const handlePromote = useCallback(async (originalKey: number) => {
    if (!libraryHandle || !sample || !selection) return;

    setIsPromoting(true);
    setPromotionResult(null);
    setPromotionProgress(undefined);
    try {
      await promoteSampleToDevice(
        libraryHandle, sample, selection.path ?? [], selection.name, originalKey,
        setPromotionProgress,
      );
      setPromotionResult({ success: true, message: 'Promoted to tones library' });
      onPromoteToDevice?.(LIBRARY_DEVICE);
    } catch (err) {
      console.error('[CommonSamplePreviewPanel] Promotion failed:', err);
      setPromotionResult({ success: false, message: err instanceof Error ? err.message : 'Promotion failed' });
    } finally {
      setIsPromoting(false);
      setPromotionProgress(undefined);
    }
  }, [libraryHandle, sample, selection, onPromoteToDevice]);

  // Empty state
  if (!selection) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-s330-accent">
          <h3 className="font-bold text-s330-text">Preview</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-s330-muted text-sm">
            <p>Select an item to preview</p>
          </div>
        </div>
      </div>
    );
  }

  const headerTitle = selection.type === 'sample' ? 'Common Sample' : 'Common Program';

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-s330-accent">
        <h3 className="font-bold text-s330-text">{headerTitle}</h3>
        <p className="text-xs text-s330-muted mt-0.5">{selection.name}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : sample ? (
          <div className="space-y-4">
            <SampleDetails sample={sample} />
            {(onOpenInLoopEditor || onOpenInChopper) && (
              <div className="flex flex-col gap-2">
                {onOpenInLoopEditor && selection && (
                  <button
                    onClick={() => onOpenInLoopEditor(selection.name, selection.path)}
                    className="w-full ac-btn ac-btn-ghost"
                  >
                    Open in Loop Editor
                  </button>
                )}
                {onOpenInChopper && selection && (
                  <button
                    onClick={() => onOpenInChopper(selection.name, selection.path)}
                    className="w-full ac-btn ac-btn-ghost"
                  >
                    Open in Chopper
                  </button>
                )}
              </div>
            )}
            <hr className="border-s330-accent/30" />
            <PromoteForm
              onPromote={handlePromote}
              isPromoting={isPromoting}
              promotionProgress={promotionProgress}
              promotionResult={promotionResult}
            />
          </div>
        ) : program ? (
          <div className="space-y-4">
            <ProgramDetails program={program} />
            <hr className="border-s330-accent/30" />
            <div className="bg-s330-bg rounded p-3 text-sm text-s330-muted">
              Program promotion to device patches is not yet supported.
            </div>
          </div>
        ) : (
          <div className="text-center text-s330-muted text-sm py-8">
            <p>Could not load data</p>
          </div>
        )}
      </div>
    </div>
  );
}
