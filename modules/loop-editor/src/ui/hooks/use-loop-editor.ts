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
import type { LoopEditorProps } from '@/ui/LoopEditor';

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
  midiEnabled: boolean;
  setMidiEnabled: (enabled: boolean) => void;
  activeNotes: ReadonlySet<number>;

  // Pre-packaged props for the LoopEditor component
  editorProps: LoopEditorProps;

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

  // MIDI/keyboard playback toggle
  const [midiEnabled, setMidiEnabled] = useState(true);

  // Shared note event dispatch — all input sources (keyboard, MIDI, external)
  // call through these refs. useSamplePlayer wires its handlers here once.
  const noteOnRef = useRef<((note: number, velocity: number) => void) | null>(null);
  const noteOffRef = useRef<((note: number) => void) | null>(null);

  const dispatchNoteOn = useCallback((note: number, velocity: number) => {
    if (!midiEnabled) return;
    noteOnRef.current?.(note, velocity);
  }, [midiEnabled]);
  const dispatchNoteOff = useCallback((note: number) => {
    if (!midiEnabled) return;
    noteOffRef.current?.(note);
  }, [midiEnabled]);

  // The single NoteInput passed to useSamplePlayer — stable reference.
  const playerInputRef = useRef<NoteInput | null>(null);
  if (!playerInputRef.current) {
    playerInputRef.current = {
      onNoteOn(handler) { noteOnRef.current = handler; },
      onNoteOff(handler) { noteOffRef.current = handler; },
      dispose() { noteOnRef.current = null; noteOffRef.current = null; },
    };
  }

  // Built-in keyboard input — created once, always available.
  const keyboardInputRef = useRef<NoteInput | null>(null);
  if (!keyboardInputRef.current) {
    const kbd = createKeyboardNoteInput(rootKey);
    kbd.onNoteOn(dispatchNoteOn);
    kbd.onNoteOff(dispatchNoteOff);
    keyboardInputRef.current = kbd;
  }

  // Web MIDI input — created async, available when MIDI permission is granted.
  useEffect(() => {
    let disposed = false;
    let input: NoteInput | null = null;
    createWebMidiNoteInput()
      .then((result) => {
        if (disposed) { result.dispose(); return; }
        input = result;
        result.onNoteOn(dispatchNoteOn);
        result.onNoteOff(dispatchNoteOff);
      })
      .catch(() => { /* MIDI unavailable — keyboard still works */ });
    return () => {
      disposed = true;
      input?.dispose();
    };
  }, [dispatchNoteOn, dispatchNoteOff]);

  // External input (when provided by consumer)
  useEffect(() => {
    if (!noteInput) return;
    noteInput.onNoteOn(dispatchNoteOn);
    noteInput.onNoteOff(dispatchNoteOff);
    return () => {
      noteInput.onNoteOn(null);
      noteInput.onNoteOff(null);
    };
  }, [noteInput, dispatchNoteOn, dispatchNoteOff]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      keyboardInputRef.current?.dispose();
      keyboardInputRef.current = null;
      playerInputRef.current?.dispose();
    };
  }, []);

  // Synth-core playback — stable input ref, all sources dispatch through it.
  const { activeNotes } = useSamplePlayer({
    samples: playerSamples,
    sampleRate,
    rootKey,
    loopEnabled,
    loopStartSample: loopPoint,
    loopEndSample: endPoint,
    noteInput: playerInputRef.current,
  });

  // Pre-packaged props object for spreading into <LoopEditor {...editorProps} />.
  const editorProps: LoopEditorProps = useMemo(() => ({
    samples,
    sampleRate,
    startPoint: 0,
    loopPoint,
    endPoint,
    onLoopPointChange: setLoopPoint,
    onEndPointChange: setEndPoint,
    candidates,
    selectedCandidateIndex,
    onCandidateSelect: setSelectedCandidateIndex,
    onApplyCandidate: handleApplyCandidate,
    onAutoDetect: handleAutoDetect,
    isSearching,
    searchProgress: progress,
    audio,
    playbackMode,
    onPlaybackModeChange: setPlaybackMode,
    discontinuity,
    crossfadeLength,
    onCrossfadeLengthChange: setCrossfadeLength,
    midiEnabled,
    onMidiEnabledChange: setMidiEnabled,
    activeNoteCount: activeNotes.size,
  }), [
    samples, sampleRate, loopPoint, endPoint, setLoopPoint, setEndPoint,
    candidates, selectedCandidateIndex, setSelectedCandidateIndex,
    handleApplyCandidate, handleAutoDetect, isSearching, progress,
    audio, playbackMode, setPlaybackMode, discontinuity,
    crossfadeLength, setCrossfadeLength, midiEnabled, setMidiEnabled,
    activeNotes.size,
  ]);

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
    editorProps,
    midiEnabled,
    setMidiEnabled,
    activeNotes,
    resetForNewSamples,
  };
}
