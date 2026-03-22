/**
 * useLoopEditor — composable hook for loop editing state.
 *
 * Owns loop point state, loop detection, audio preview, synth-core
 * MIDI playback, and smoothing. Consumers provide samples and UI
 * chrome; this hook provides everything the LoopEditor component
 * needs plus active voice tracking.
 *
 * Playback modes:
 * - no-loop: one-shot playback, sample plays through and stops
 * - loop: loops at current points with original samples (hear raw splice)
 * - smoothed-loop: loops with crossfade applied (hear smoothed splice)
 *
 * Switching modes while playing polyphonically gives instant A/B/C
 * comparison of splice quality.
 *
 * Used by: LoopEditorDialog (sampler-editor), dev harness (loop-editor/dev).
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createBrowserAudioPlayback } from '@audiocontrol/editor-core';
import type { AudioPlayback } from '@audiocontrol/editor-core';
import { useSamplePlayer, createKeyboardNoteInput, createWebMidiNoteInput } from '@audiocontrol/synth-core';
import type { NoteInput } from '@audiocontrol/synth-core';
import type { LoopCandidate, DiscontinuityAnalysis } from '@audiocontrol/sampler-library';
import { createSmoothedCopy, analyzeDiscontinuity } from '@audiocontrol/sampler-library/browser';
import { useLoopDetection } from '@/ui/hooks/useLoopDetection';

export type PlaybackMode = 'no-loop' | 'loop' | 'smoothed-loop';

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

  // Playback mode (no-loop / loop / smoothed-loop)
  playbackMode: PlaybackMode;
  setPlaybackMode: (mode: PlaybackMode) => void;

  // Smoothing
  crossfadeLength: number;
  setCrossfadeLength: (length: number) => void;

  // Discontinuity analysis at current splice point
  discontinuity: DiscontinuityAnalysis | null;

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
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('loop');
  const [crossfadeLength, setCrossfadeLength] = useState(64);

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

  // Smoothed buffer — recomputed when samples, loop points, or crossfade length change.
  const smoothedSamples = useMemo(() => {
    if (!samples || loopPoint >= endPoint) return null;
    const loopLength = endPoint - loopPoint;
    if (loopLength < crossfadeLength) return null;
    try {
      return createSmoothedCopy(samples, loopPoint, endPoint, {
        mode: 'equal-power',
        crossfadeLength,
      });
    } catch {
      return null;
    }
  }, [samples, loopPoint, endPoint, crossfadeLength]);

  // Discontinuity analysis at current splice point
  const discontinuity = useMemo(() => {
    if (!samples || loopPoint >= endPoint) return null;
    try {
      return analyzeDiscontinuity(samples, loopPoint, endPoint);
    } catch {
      return null;
    }
  }, [samples, loopPoint, endPoint]);

  // Derive useSamplePlayer params from playback mode
  const playerSamples = playbackMode === 'smoothed-loop' ? (smoothedSamples ?? samples) : samples;
  const loopEnabled = playbackMode !== 'no-loop';

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

  // Auto-select first candidate when auto-detect completes
  const prevIsSearchingRef = useRef(false);
  useEffect(() => {
    if (prevIsSearchingRef.current && !isSearching && candidates.length > 0) {
      const best = candidates[0]!;
      setLoopPoint(best.loopStart);
      setEndPoint(best.loopEnd);
      setSelectedCandidateIndex(0);
    }
    prevIsSearchingRef.current = isSearching;
  }, [isSearching, candidates]);

  // Built-in keyboard input — created once, always available.
  const keyboardInputRef = useRef<NoteInput | null>(null);
  if (!keyboardInputRef.current) {
    keyboardInputRef.current = createKeyboardNoteInput(rootKey);
  }

  // Web MIDI input — created async, available when MIDI permission is granted.
  const [midiInput, setMidiInput] = useState<NoteInput | null>(null);
  useEffect(() => {
    let disposed = false;
    let input: NoteInput | null = null;
    createWebMidiNoteInput()
      .then((result) => {
        if (disposed) { result.dispose(); return; }
        input = result;
        setMidiInput(result);
      })
      .catch(() => { /* MIDI unavailable — keyboard still works */ });
    return () => {
      disposed = true;
      input?.dispose();
    };
  }, []);

  // Combine all note inputs into a single NoteInput for useSamplePlayer.
  // Sources: keyboard (always), MIDI (when available), external (when provided).
  const combinedInputRef = useRef<NoteInput | null>(null);
  const allInputs = [keyboardInputRef.current, midiInput, noteInput].filter(Boolean) as NoteInput[];

  const combinedInput = useMemo((): NoteInput => {
    let onNoteOn: ((note: number, velocity: number) => void) | null = null;
    let onNoteOff: ((note: number) => void) | null = null;

    const forward = {
      noteOn: (n: number, v: number) => onNoteOn?.(n, v),
      noteOff: (n: number) => onNoteOff?.(n),
    };

    // Wire all sources
    for (const input of allInputs) {
      input.onNoteOn(forward.noteOn);
      input.onNoteOff(forward.noteOff);
    }

    const combined: NoteInput = {
      onNoteOn(handler) { onNoteOn = handler; },
      onNoteOff(handler) { onNoteOff = handler; },
      dispose() {
        for (const input of allInputs) {
          input.onNoteOn(null);
          input.onNoteOff(null);
        }
      },
    };
    combinedInputRef.current = combined;
    return combined;
    // Re-create when MIDI connects or external input changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midiInput, noteInput]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      keyboardInputRef.current?.dispose();
      keyboardInputRef.current = null;
      combinedInputRef.current?.dispose();
    };
  }, []);

  // Synth-core playback — combined keyboard + MIDI + external input.
  const { activeNotes } = useSamplePlayer({
    samples: playerSamples,
    sampleRate,
    rootKey,
    loopEnabled,
    loopStartSample: loopPoint,
    loopEndSample: endPoint,
    noteInput: combinedInput,
  });

  return {
    loopPoint,
    endPoint,
    setLoopPoint,
    setEndPoint,
    playbackMode,
    setPlaybackMode,
    crossfadeLength,
    setCrossfadeLength,
    discontinuity,
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
