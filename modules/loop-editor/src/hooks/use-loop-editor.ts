/**
 * useLoopEditor — composable hook for loop editing state.
 *
 * Owns loop point state, loop detection, audio preview, and synth-core
 * MIDI playback. Consumers provide samples and UI chrome; this hook
 * provides everything the LoopEditor component needs plus active voice
 * tracking.
 *
 * Used by: LoopEditorDialog (sampler-editor), dev harness (loop-editor/dev).
 */

import { useState, useCallback, useMemo } from 'react';
import { createBrowserAudioPlayback } from '@audiocontrol/editor-core';
import type { AudioPlayback } from '@audiocontrol/editor-core';
import { useSamplePlayer } from '@audiocontrol/synth-core';
import type { NoteInput } from '@audiocontrol/synth-core';
import type { LoopCandidate } from '@audiocontrol/sampler-library';
import { useLoopDetection } from '@/ui/hooks/useLoopDetection';

export interface UseLoopEditorParams {
  /** Audio samples (16-bit signed integers). */
  samples: Int16Array | null;
  /** Sample rate in Hz. */
  sampleRate: number;
  /** Initial loop start point in samples. */
  initialLoopStart?: number;
  /** Initial loop end point in samples. Defaults to sample length. */
  initialLoopEnd?: number;
  /** Root key (MIDI note) for pitched playback. Default 60. */
  rootKey?: number;
  /** Note input source for MIDI/keyboard playback. */
  noteInput?: NoteInput | null;
}

export interface UseLoopEditorReturn {
  // Loop state
  loopPoint: number;
  endPoint: number;
  setLoopPoint: (point: number) => void;
  setEndPoint: (point: number) => void;

  // Loop detection
  isSearching: boolean;
  searchProgress: ReturnType<typeof useLoopDetection>['progress'];
  candidates: LoopCandidate[];
  selectedCandidateIndex: number | undefined;
  setSelectedCandidateIndex: (index: number | undefined) => void;
  handleAutoDetect: () => void;
  handleApplyCandidate: (loopStart: number, loopEnd: number) => void;
  loopDetectionError: string | null;
  clearResults: () => void;

  // Audio preview
  audio: AudioPlayback;

  // Synth-core playback
  activeNotes: ReadonlySet<number>;

  // Reset — call when loading new sample data
  resetForNewSamples: (loopStart?: number, loopEnd?: number) => void;
}

export function useLoopEditor(params: UseLoopEditorParams): UseLoopEditorReturn {
  const {
    samples,
    sampleRate,
    initialLoopStart,
    initialLoopEnd,
    rootKey = 60,
    noteInput = null,
  } = params;

  // Loop state
  const [loopPoint, setLoopPoint] = useState(initialLoopStart ?? 0);
  const [endPoint, setEndPoint] = useState(initialLoopEnd ?? (samples?.length ?? 0));
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState<number | undefined>(undefined);

  // Reset state when loading new samples
  const [prevSamples, setPrevSamples] = useState<Int16Array | null>(null);
  if (samples !== prevSamples) {
    setPrevSamples(samples);
    setLoopPoint(initialLoopStart ?? 0);
    setEndPoint(initialLoopEnd ?? (samples?.length ?? 0));
    setSelectedCandidateIndex(undefined);
  }

  const resetForNewSamples = useCallback((loopStart?: number, loopEnd?: number) => {
    setLoopPoint(loopStart ?? 0);
    setEndPoint(loopEnd ?? (samples?.length ?? 0));
    setSelectedCandidateIndex(undefined);
  }, [samples]);

  // Audio preview (single-voice play/stop buttons)
  const audio = useMemo(() => createBrowserAudioPlayback(), []);

  // Loop detection
  const {
    isSearching,
    progress,
    candidates,
    error: loopDetectionError,
    searchLoopPoints,
    clearResults,
  } = useLoopDetection();

  const handleAutoDetect = useCallback(() => {
    if (!samples) return;
    clearResults();
    setSelectedCandidateIndex(undefined);
    searchLoopPoints(new Int16Array(samples), sampleRate, endPoint);
  }, [samples, sampleRate, endPoint, clearResults, searchLoopPoints]);

  const handleApplyCandidate = useCallback((loopStart: number, loopEnd: number) => {
    setLoopPoint(loopStart);
    setEndPoint(loopEnd);
  }, []);

  // Synth-core MIDI playback
  const { activeNotes } = useSamplePlayer({
    samples,
    sampleRate,
    rootKey,
    loopEnabled: true,
    loopStartSample: loopPoint,
    loopEndSample: endPoint,
    noteInput,
  });

  return {
    loopPoint,
    endPoint,
    setLoopPoint,
    setEndPoint,
    isSearching,
    searchProgress: progress,
    candidates,
    selectedCandidateIndex,
    setSelectedCandidateIndex,
    handleAutoDetect,
    handleApplyCandidate,
    loopDetectionError,
    clearResults,
    audio,
    activeNotes,
    resetForNewSamples,
  };
}
