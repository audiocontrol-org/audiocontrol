/**
 * Sample Bundle Preview Panel
 *
 * Shows preview of a selected sample bundle (drum kit or chopped sample):
 * - Name and description
 * - Slice count and sample rate
 * - MIDI note mappings
 * - Import to Device / Edit buttons
 *
 * For drum kits, also loads and displays kit-specific info (kits, detected samples).
 * For chopped samples, shows slice list with trigger mappings.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  loadDrumKitBundle,
  loadDrumKitSource,
  loadChoppedSampleManifest,
  type DrumKitInfo,
} from '@/lib/library-service';
import { DrumKitPadList } from '@/components/library/DrumKitPadList';
import {
  midiNoteToName,
  parseNoteName,
  type ResolvedDrumKitBundle,
  type SampleYaml,
  type StorageDirectoryHandle,
} from '@audiocontrol/sampler-library/browser';

/** Resolve a MIDI note that may be a name string or number to a number. */
function resolveNoteNumber(note: string | number): number {
  return typeof note === 'string' ? parseNoteName(note) : note;
}
import type { LibraryTreeNode } from '@/lib/library-service';

// =========================================================================
// Props
// =========================================================================

interface SampleBundlePreviewPanelProps {
  /** For drum kit items */
  kitInfo?: DrumKitInfo | null;
  /** For chopped sample items from tree */
  choppedSampleNode?: LibraryTreeNode | null;
  libraryHandle: StorageDirectoryHandle | null;
  /** Pre-loaded drum kit bundle (for kits in subdirectories) */
  preloadedBundle?: ResolvedDrumKitBundle | null;
  /** Pre-loaded chopped sample manifest */
  preloadedManifest?: SampleYaml | null;
  onImport?: () => void;
  onEditKit?: () => void;
}

// =========================================================================
// Drum Kit sub-components
// =========================================================================

function MidiRangeVisualization({ bundle }: { bundle: ResolvedDrumKitBundle }): JSX.Element {
  if (bundle.kits.length === 0) return <></>;

  const firstKit = bundle.kits[0];
  const lastKit = bundle.kits[bundle.kits.length - 1];
  if (!firstKit || !lastKit) return <></>;

  const startNote = firstKit.midiNotes.kick;
  const endNote = lastKit.midiNotes.hhOpen;

  return (
    <div className="bg-s330-bg rounded p-3">
      <div className="text-xs text-s330-muted mb-2">MIDI Note Range</div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono text-s330-text">{midiNoteToName(startNote)}</span>
        <div className="flex-1 h-2 bg-s330-accent/30 rounded relative">
          <div
            className="absolute inset-y-0 left-0 bg-s330-highlight rounded"
            style={{ width: `${((endNote - startNote + 1) / 48) * 100}%` }}
          />
        </div>
        <span className="text-sm font-mono text-s330-text">{midiNoteToName(endNote)}</span>
      </div>
      <div className="text-xs text-s330-muted mt-1 text-center">
        {endNote - startNote + 1} notes ({bundle.kits.length} kit{bundle.kits.length !== 1 ? 's' : ''} x 4 samples)
      </div>
    </div>
  );
}

// =========================================================================
// Chopped Sample sub-components
// =========================================================================

function ChoppedSampleSliceList({ manifest }: { manifest: SampleYaml }): JSX.Element {
  // Build trigger map for display
  const triggerMap = new Map<number, string>();
  if (manifest.triggers) {
    for (const trigger of manifest.triggers) {
      triggerMap.set(trigger.sliceIndex, trigger.triggerId);
    }
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-s330-muted uppercase tracking-wide">
        Slices ({manifest.slices!.length})
      </div>
      {manifest.slices!.map((slice, i) => {
        const trigger = triggerMap.get(i);
        const midiMatch = trigger?.match(/^midi:(\d+)$/);
        const midiNote = midiMatch ? parseInt(midiMatch[1]!, 10) : undefined;

        return (
          <div key={i} className="bg-s330-bg rounded p-2 text-xs flex items-center gap-2">
            <span className="w-6 text-s330-muted text-right">{i}</span>
            <span className="flex-1 text-s330-text font-medium truncate">{slice.label}</span>
            {midiNote !== undefined && (
              <span className="text-s330-highlight font-mono">{midiNoteToName(midiNote)}</span>
            )}
            {trigger && !midiMatch && (
              <span className="text-s330-muted font-mono">{trigger}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// =========================================================================
// Common sub-components
// =========================================================================

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

// =========================================================================
// Main component
// =========================================================================

export function SampleBundlePreviewPanel({
  kitInfo,
  choppedSampleNode,
  libraryHandle,
  preloadedBundle,
  preloadedManifest,
  onImport,
  onEditKit,
}: SampleBundlePreviewPanelProps): JSX.Element {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<ResolvedDrumKitBundle | null>(null);
  const [manifest, setManifest] = useState<SampleYaml | null>(null);

  // Audio state for drum kit pad preview
  const [audioSamples, setAudioSamples] = useState<Int16Array | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  const isDrumKit = !!kitInfo || !!preloadedBundle;

  const handleLoadAudio = useCallback(async () => {
    if (!libraryHandle || !bundle?.source) return;
    const kitName = kitInfo?.directoryName ?? '';
    if (!kitName) return;

    setIsLoadingAudio(true);
    try {
      const result = await loadDrumKitSource(libraryHandle, kitName, bundle.source);
      setAudioSamples(result.samples);
    } catch (err) {
      console.error('[SampleBundlePreviewPanel] Failed to load audio:', err);
    } finally {
      setIsLoadingAudio(false);
    }
  }, [libraryHandle, bundle, kitInfo]);

  // Load data when selection changes
  useEffect(() => {
    setBundle(null);
    setManifest(null);
    setError(null);
    setAudioSamples(null);

    if (preloadedBundle) {
      setBundle(preloadedBundle);
      return;
    }

    if (preloadedManifest) {
      setManifest(preloadedManifest);
      return;
    }

    if (!libraryHandle) return;

    if (kitInfo) {
      const loadBundle = async () => {
        setLoading(true);
        try {
          const resolved = await loadDrumKitBundle(libraryHandle, kitInfo.directoryName);
          setBundle(resolved);
        } catch (err) {
          console.error('[SampleBundlePreviewPanel] Failed to load drum kit:', err);
          setError(err instanceof Error ? err.message : 'Failed to load drum kit');
        } finally {
          setLoading(false);
        }
      };
      loadBundle();
      return;
    }

    if (choppedSampleNode) {
      const loadManifest = async () => {
        setLoading(true);
        try {
          const loaded = await loadChoppedSampleManifest(
            libraryHandle,
            choppedSampleNode.directoryName || choppedSampleNode.name,
            choppedSampleNode.path
          );
          setManifest(loaded);
        } catch (err) {
          console.error('[SampleBundlePreviewPanel] Failed to load chopped sample:', err);
          setError(err instanceof Error ? err.message : 'Failed to load chopped sample');
        } finally {
          setLoading(false);
        }
      };
      loadManifest();
    }
  }, [kitInfo, choppedSampleNode, libraryHandle, preloadedBundle, preloadedManifest]);

  // Empty state
  if (!kitInfo && !preloadedBundle && !choppedSampleNode && !preloadedManifest) {
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

  const displayName = isDrumKit
    ? (kitInfo?.directoryName ?? bundle?.name ?? 'Drum Kit')
    : (choppedSampleNode?.name ?? manifest?.name ?? 'Sample');

  const headerTitle = isDrumKit ? 'Drum Kit' : 'Chopped Sample';

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-s330-accent">
        <h3 className="font-bold text-s330-text">{headerTitle}</h3>
        <p className="text-xs text-s330-muted mt-0.5">{displayName}</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : bundle ? (
          /* Drum Kit Preview */
          <div className="space-y-4">
            <div>
              <h4 className="text-lg font-bold text-s330-text">{bundle.name}</h4>
              {bundle.description && (
                <p className="text-sm text-s330-muted mt-1">{bundle.description}</p>
              )}
            </div>

            <div className="flex gap-4 text-sm">
              <div className="bg-s330-bg rounded px-3 py-2">
                <span className="text-s330-muted">Kits:</span>{' '}
                <span className="text-s330-text font-medium">{bundle.kits.length}</span>
              </div>
              <div className="bg-s330-bg rounded px-3 py-2">
                <span className="text-s330-muted">Samples:</span>{' '}
                <span className="text-s330-text font-medium">{bundle.totalSamples}</span>
              </div>
              <div className="bg-s330-bg rounded px-3 py-2">
                <span className="text-s330-muted">Rate:</span>{' '}
                <span className="text-s330-text font-medium">{bundle.sampleRate / 1000}kHz</span>
              </div>
            </div>

            <MidiRangeVisualization bundle={bundle} />

            <DrumKitPadList
              bundle={bundle}
              samples={audioSamples}
              sampleRate={bundle.sampleRate}
              isLoadingAudio={isLoadingAudio}
              onLoadAudio={handleLoadAudio}
            />

            {!bundle.allComplete && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3 text-sm text-yellow-500">
                Some kits have missing samples. Import will proceed with available samples only.
              </div>
            )}

            {bundle.source && bundle.slices && (
              <div className="bg-s330-bg rounded p-3 text-sm">
                <div className="flex items-center gap-2 text-s330-muted">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Deferred chopping - slices can be edited</span>
                </div>
              </div>
            )}
          </div>
        ) : manifest ? (
          /* Chopped Sample Preview */
          <div className="space-y-4">
            <div>
              <h4 className="text-lg font-bold text-s330-text">{manifest.name}</h4>
              {manifest.description && (
                <p className="text-sm text-s330-muted mt-1">{manifest.description}</p>
              )}
            </div>

            <div className="flex gap-4 text-sm flex-wrap">
              <div className="bg-s330-bg rounded px-3 py-2">
                <span className="text-s330-muted">Slices:</span>{' '}
                <span className="text-s330-text font-medium">{manifest.slices!.length}</span>
              </div>
              <div className="bg-s330-bg rounded px-3 py-2">
                <span className="text-s330-muted">Source Rate:</span>{' '}
                <span className="text-s330-text font-medium">{manifest.sampleRate / 1000}kHz</span>
              </div>
              {manifest.drumKit && (
                <div className="bg-s330-bg rounded px-3 py-2">
                  <span className="text-s330-muted">Type:</span>{' '}
                  <span className="text-s330-text font-medium">Drum Kit</span>
                </div>
              )}
            </div>

            {manifest.drumKit && (
              <div className="bg-s330-bg rounded p-3 text-sm">
                <div className="text-s330-muted text-xs uppercase tracking-wide mb-2">Drum Kit Metadata</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-s330-muted">Base Note:</span>{' '}
                    <span className="text-s330-text">{midiNoteToName(resolveNoteNumber(manifest.drumKit.baseNote))}</span>
                  </div>
                  {manifest.drumKit.transpose !== undefined && (
                    <div>
                      <span className="text-s330-muted">Transpose:</span>{' '}
                      <span className="text-s330-text">{manifest.drumKit.transpose}</span>
                    </div>
                  )}
                  {manifest.drumKit.velocitySensitivity !== undefined && (
                    <div>
                      <span className="text-s330-muted">Velocity Sens:</span>{' '}
                      <span className="text-s330-text">{manifest.drumKit.velocitySensitivity}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {manifest.playback && (
              <div className="bg-s330-bg rounded p-3 text-sm">
                <div className="text-s330-muted text-xs uppercase tracking-wide mb-2">Playback</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-s330-muted">Polyphony:</span>{' '}
                    <span className="text-s330-text">{manifest.playback.polyphony}</span>
                  </div>
                  <div>
                    <span className="text-s330-muted">Mode:</span>{' '}
                    <span className="text-s330-text">{manifest.playback.playbackMode}</span>
                  </div>
                </div>
              </div>
            )}

            <ChoppedSampleSliceList manifest={manifest} />
          </div>
        ) : (
          <div className="text-center text-s330-muted text-sm py-8">
            <p>Could not load data</p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {(bundle || manifest) && (
        <div className="p-4 border-t border-s330-accent flex flex-col gap-2">
          {onEditKit && bundle && bundle.source && bundle.slices && (
            <button onClick={onEditKit} className="w-full ac-btn ac-btn-secondary">
              Edit Kit
            </button>
          )}
          {onImport && (
            <button onClick={onImport} className="w-full ac-btn ac-btn-primary" data-testid="import-to-device-button">
              Import to Device
            </button>
          )}
        </div>
      )}
    </div>
  );
}
