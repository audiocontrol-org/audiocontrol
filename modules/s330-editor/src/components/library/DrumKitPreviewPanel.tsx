/**
 * Drum Kit Preview Panel
 *
 * Shows preview of a selected drum kit bundle including:
 * - Kit name and description
 * - List of detected kits with samples
 * - MIDI note mapping visualization
 * - Import to Device button
 */

import { useState, useEffect } from 'react';
import {
  loadDrumKitBundle,
  type DrumKitInfo,
} from '@/lib/library-service';
import {
  midiNoteToName,
  type ResolvedDrumKitBundle,
  type DetectedKit,
} from '@audiocontrol/sampler-library/browser';

interface DrumKitPreviewPanelProps {
  kitInfo: DrumKitInfo | null;
  libraryHandle: FileSystemDirectoryHandle | null;
  onImport?: () => void;
}

/**
 * Format a drum sample type for display
 */
function formatDrumType(type: string): string {
  const typeMap: Record<string, string> = {
    kick: 'Kick',
    snare: 'Snare',
    hhClosed: 'Closed HH',
    hhOpen: 'Open HH',
  };
  return typeMap[type] ?? type;
}

/**
 * Individual kit display showing samples and MIDI notes
 */
function KitDisplay({ kit }: { kit: DetectedKit }): JSX.Element {
  const drumOrder = ['kick', 'snare', 'hhClosed', 'hhOpen'] as const;

  return (
    <div className="bg-s330-bg rounded p-3 text-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-s330-text">
          Kit {String(kit.kitNumber).padStart(2, '0')}
        </span>
        <span className="text-xs text-s330-muted">
          {midiNoteToName(kit.midiNotes.kick)} - {midiNoteToName(kit.midiNotes.hhOpen)}
        </span>
      </div>

      <div className="space-y-1.5">
        {drumOrder.map((type) => {
          const sample = kit.samples[type];
          const midiNote = kit.midiNotes[type];

          return (
            <div
              key={type}
              className="flex items-center gap-2 text-xs"
            >
              <span className="w-8 text-s330-muted">{midiNoteToName(midiNote)}</span>
              <span className="w-16 text-s330-muted">{formatDrumType(type)}</span>
              {sample ? (
                <span className="flex-1 truncate text-s330-text">{sample}</span>
              ) : (
                <span className="flex-1 text-s330-muted/50 italic">missing</span>
              )}
            </div>
          );
        })}
      </div>

      {!kit.isComplete && (
        <div className="mt-2 text-xs text-yellow-500">
          Warning: Kit is incomplete
        </div>
      )}
    </div>
  );
}

/**
 * MIDI note range visualization
 */
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
        <span className="text-sm font-mono text-s330-text">
          {midiNoteToName(startNote)}
        </span>
        <div className="flex-1 h-2 bg-s330-accent/30 rounded relative">
          <div
            className="absolute inset-y-0 left-0 bg-s330-highlight rounded"
            style={{ width: `${((endNote - startNote + 1) / 48) * 100}%` }}
          />
        </div>
        <span className="text-sm font-mono text-s330-text">
          {midiNoteToName(endNote)}
        </span>
      </div>
      <div className="text-xs text-s330-muted mt-1 text-center">
        {endNote - startNote + 1} notes ({bundle.kits.length} kit{bundle.kits.length !== 1 ? 's' : ''} × 4 samples)
      </div>
    </div>
  );
}

/**
 * Loading state component
 */
function LoadingState(): JSX.Element {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="flex items-center gap-2 text-s330-muted">
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        <span>Loading drum kit...</span>
      </div>
    </div>
  );
}

/**
 * Error state component
 */
function ErrorState({ message }: { message: string }): JSX.Element {
  return (
    <div className="text-center text-red-400 text-sm py-8">
      <p>Failed to load: {message}</p>
    </div>
  );
}

export function DrumKitPreviewPanel({
  kitInfo,
  libraryHandle,
  onImport,
}: DrumKitPreviewPanelProps): JSX.Element {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<ResolvedDrumKitBundle | null>(null);

  // Load drum kit bundle when selection changes
  useEffect(() => {
    setBundle(null);
    setError(null);

    if (!kitInfo || !libraryHandle) {
      return;
    }

    const loadBundle = async () => {
      setLoading(true);
      try {
        const resolved = await loadDrumKitBundle(libraryHandle, kitInfo.directoryName);
        setBundle(resolved);
      } catch (err) {
        console.error('[DrumKitPreviewPanel] Failed to load drum kit:', err);
        setError(err instanceof Error ? err.message : 'Failed to load drum kit');
      } finally {
        setLoading(false);
      }
    };

    loadBundle();
  }, [kitInfo, libraryHandle]);

  // Empty state
  if (!kitInfo) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-s330-accent">
          <h3 className="font-bold text-s330-text">Drum Kit Preview</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-s330-muted text-sm">
            <p>Select a drum kit to preview</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-s330-accent">
        <h3 className="font-bold text-s330-text">Drum Kit</h3>
        <p className="text-xs text-s330-muted mt-0.5">{kitInfo.directoryName}</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : bundle ? (
          <div className="space-y-4">
            {/* Kit name and description */}
            <div>
              <h4 className="text-lg font-bold text-s330-text">{bundle.name}</h4>
              {bundle.description && (
                <p className="text-sm text-s330-muted mt-1">{bundle.description}</p>
              )}
            </div>

            {/* Summary stats */}
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

            {/* MIDI range visualization */}
            <MidiRangeVisualization bundle={bundle} />

            {/* Individual kits */}
            <div className="space-y-2">
              <div className="text-xs text-s330-muted uppercase tracking-wide">
                Detected Kits
              </div>
              {bundle.kits.map((kit) => (
                <KitDisplay key={kit.kitNumber} kit={kit} />
              ))}
            </div>

            {/* Warnings */}
            {!bundle.allComplete && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3 text-sm text-yellow-500">
                Some kits have missing samples. Import will proceed with available samples only.
              </div>
            )}

            {/* Import button */}
            {onImport && (
              <button
                onClick={onImport}
                className="w-full ac-btn ac-btn-primary"
              >
                Import to Device
              </button>
            )}
          </div>
        ) : (
          <div className="text-center text-s330-muted text-sm py-8">
            <p>Could not load drum kit</p>
          </div>
        )}
      </div>
    </div>
  );
}
