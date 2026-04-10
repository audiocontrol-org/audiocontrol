import { useMemo } from 'react';
import {
  useTriggerPlayback,
  type SliceDefinitionOutput,
} from '@audiocontrol/sample-chopper/ui';
import {
  midiNoteToName,
  type ResolvedDrumKitBundle,
} from '@audiocontrol/sampler-library/browser';

function cn(...classes: (string | false | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

type DrumType = 'kick' | 'snare' | 'hhClosed' | 'hhOpen';

const DRUM_ORDER: readonly DrumType[] = ['kick', 'snare', 'hhClosed', 'hhOpen'];

interface PadInfo {
  kitNumber: number;
  drumType: DrumType;
  midiNote: number;
  label: string;
  sliceIndex: number;
  sample?: string;
}

interface DrumKitPadListProps {
  bundle: ResolvedDrumKitBundle;
  samples: Int16Array | null;
  sampleRate: number;
  isLoadingAudio?: boolean;
  onLoadAudio?: () => void;
}

function formatDrumType(type: string): string {
  const typeMap: Record<string, string> = {
    kick: 'Kick',
    snare: 'Snare',
    hhClosed: 'Closed HH',
    hhOpen: 'Open HH',
  };
  return typeMap[type] ?? type;
}

function buildPads(bundle: ResolvedDrumKitBundle): PadInfo[] {
  const pads: PadInfo[] = [];
  let sliceIndex = 0;

  for (const kit of bundle.kits) {
    for (const drumType of DRUM_ORDER) {
      pads.push({
        kitNumber: kit.kitNumber,
        drumType,
        midiNote: kit.midiNotes[drumType],
        label: `Kit ${String(kit.kitNumber).padStart(2, '0')} ${formatDrumType(drumType)}`,
        sliceIndex,
        sample: kit.samples[drumType],
      });
      sliceIndex++;
    }
  }

  return pads;
}

function detectConflicts(pads: PadInfo[]): Map<number, number[]> {
  const noteMap = new Map<number, number[]>();

  for (const pad of pads) {
    const existing = noteMap.get(pad.midiNote);
    if (existing) {
      existing.push(pad.sliceIndex);
    } else {
      noteMap.set(pad.midiNote, [pad.sliceIndex]);
    }
  }

  const conflicts = new Map<number, number[]>();
  for (const [note, indices] of noteMap) {
    if (indices.length > 1) {
      conflicts.set(note, indices);
    }
  }

  return conflicts;
}

function buildSliceDefinitions(
  bundle: ResolvedDrumKitBundle,
): SliceDefinitionOutput[] {
  if (!bundle.slices) {
    return [];
  }

  return bundle.slices.map((slice) => ({
    label: slice.label,
    startSample: slice.startSample,
    endSample: slice.endSample,
  }));
}

export function DrumKitPadList({
  bundle,
  samples,
  sampleRate,
  isLoadingAudio,
  onLoadAudio,
}: DrumKitPadListProps): JSX.Element {
  const pads = useMemo(() => buildPads(bundle), [bundle]);
  const conflicts = useMemo(() => detectConflicts(pads), [pads]);
  const sliceDefinitions = useMemo(() => buildSliceDefinitions(bundle), [bundle]);

  const conflictNoteSet = useMemo(() => {
    const set = new Set<number>();
    for (const note of conflicts.keys()) {
      set.add(note);
    }
    return set;
  }, [conflicts]);

  const playback = useTriggerPlayback({
    samples,
    sampleRate,
    slices: sliceDefinitions,
    config: { polyphony: 'poly', playbackMode: 'one-shot', muteGroups: [] },
  });

  const padsByKit = useMemo(() => {
    const grouped = new Map<number, PadInfo[]>();
    for (const pad of pads) {
      const existing = grouped.get(pad.kitNumber);
      if (existing) {
        existing.push(pad);
      } else {
        grouped.set(pad.kitNumber, [pad]);
      }
    }
    return grouped;
  }, [pads]);

  return (
    <div className="space-y-3" data-testid="pad-list">
      {!samples && onLoadAudio && bundle.source && (
        <button
          onClick={onLoadAudio}
          disabled={isLoadingAudio}
          className="ac-btn ac-btn-sm ac-btn-ghost"
          data-testid="load-audio-button"
        >
          {isLoadingAudio ? 'Loading...' : 'Load Audio for Preview'}
        </button>
      )}

      {[...padsByKit.entries()].map(([kitNumber, kitPads]) => {
        const firstNote = kitPads[0]?.midiNote ?? 0;
        const lastNote = kitPads[kitPads.length - 1]?.midiNote ?? 0;

        return (
          <div key={kitNumber} className="bg-gray-900 rounded p-3 text-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-100">
                Kit {String(kitNumber).padStart(2, '0')}
              </span>
              <span className="text-xs text-gray-400">
                {midiNoteToName(firstNote)} - {midiNoteToName(lastNote)}
              </span>
            </div>

            <div className="space-y-1.5">
              {kitPads.map((pad) => {
                const hasConflict = conflictNoteSet.has(pad.midiNote);

                return (
                  <div
                    key={pad.sliceIndex}
                    className="flex items-center gap-2 text-xs"
                    data-testid={`pad-${pad.sliceIndex}`}
                  >
                    <button
                      onClick={() => playback.playSlice(pad.sliceIndex)}
                      disabled={!samples || !bundle.slices}
                      data-testid={`pad-play-${pad.sliceIndex}`}
                      className={cn(
                        'w-6 h-6 flex items-center justify-center rounded',
                        'bg-gray-900 hover:bg-gray-700 text-gray-100',
                        'disabled:opacity-30 disabled:cursor-not-allowed',
                      )}
                    >
                      ▶
                    </button>
                    <span
                      className={cn(
                        'w-8 font-mono',
                        hasConflict && 'text-yellow-500',
                      )}
                    >
                      {midiNoteToName(pad.midiNote)}
                    </span>
                    <span className="w-16 text-gray-400">
                      {formatDrumType(pad.drumType)}
                    </span>
                    {pad.sample ? (
                      <span className="flex-1 truncate text-gray-100">
                        {pad.sample}
                      </span>
                    ) : bundle.slices?.[pad.sliceIndex] ? (
                      <span className="flex-1 text-gray-400">
                        {(
                          ((bundle.slices[pad.sliceIndex].endSample -
                            bundle.slices[pad.sliceIndex].startSample) /
                            sampleRate) *
                          1000
                        ).toFixed(0)}
                        ms
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {conflicts.size > 0 && (
        <div
          className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2 text-xs text-yellow-500"
          data-testid="midi-conflict-warning"
        >
          MIDI note conflict:{' '}
          {[...conflicts.entries()]
            .map(
              ([note, indices]) =>
                `${midiNoteToName(note)} assigned to ${indices.length} pads`,
            )
            .join(', ')}
        </div>
      )}
    </div>
  );
}
