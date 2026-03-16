/**
 * Trigger Recording Hook
 *
 * Composes useTriggerInput with slice generation logic.
 * Maintains trigger positions and derives SliceDefinitionOutput[] from them.
 * Each trigger is tagged with an identity (key or MIDI note) so that
 * pressing the same key/note during playback plays back the slice it created.
 * Supports polyphony modes, mute groups, and one-shot/gate playback.
 */

import { useState, useCallback, useMemo, useEffect, useRef, type MutableRefObject } from 'react';
import {
  useTriggerInput,
  keyTriggerId,
  midiTriggerId,
  type TriggerState,
  type TriggerId,
} from '@/ui/hooks/useTriggerInput.js';
import type { SliceDefinitionOutput } from '@/ui/hooks/useSampleChopper.js';
import {
  type TriggerPlaybackConfig,
  type PolyphonyMode,
  type PlaybackMode,
  DEFAULT_PLAYBACK_CONFIG,
} from '@/ui/hooks/useTriggerPlayback.js';

interface TriggerEvent {
  samplePosition: number;
  triggerId: TriggerId;
}

const IGNORED_KEYS = new Set([
  'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab',
  'Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6',
  'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
]);

export interface UseTriggerRecordingParams {
  /** Ref for low-latency playback position reads */
  playbackPositionRef: MutableRefObject<number | null>;
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** Start audio playback (full sample) */
  onPlay: () => void;
  /** Stop audio playback */
  onStop: () => void;
  /** Play a specific slice by index */
  onPlaySlice: (index: number) => void;
  /** Stop a specific slice by index (for gate mode) */
  onStopSlice: (index: number) => void;
  /** Total number of samples in the audio */
  totalSamples: number;
  /** Kit labels (comma-separated) for naming slices */
  kitLabels: string;
  /** Whether the trigger tab is currently selected */
  active: boolean;
}

export interface UseTriggerRecordingReturn {
  /** Current trigger state machine state */
  state: TriggerState;
  /** Whether MIDI is available */
  midiAvailable: boolean;
  /** Number of triggers recorded so far */
  triggerCount: number;
  /** Slices derived from trigger positions (available when complete or during recording) */
  recordedSlices: SliceDefinitionOutput[];
  /** Arm the trigger system for recording */
  arm: () => void;
  /** Stop recording early */
  stopRecording: () => void;
  /** Reset to idle and clear all triggers */
  reset: () => void;
  /** Current playback configuration */
  playbackConfig: TriggerPlaybackConfig;
  /** Set polyphony mode */
  setPolyphony: (mode: PolyphonyMode) => void;
  /** Set playback mode */
  setPlaybackMode: (mode: PlaybackMode) => void;
  /** Set mute group for a slice */
  setMuteGroup: (sliceIndex: number, group: number) => void;
}

export function useTriggerRecording({
  playbackPositionRef,
  isPlaying,
  onPlay,
  onStop,
  onPlaySlice,
  onStopSlice,
  totalSamples,
  kitLabels,
  active,
}: UseTriggerRecordingParams): UseTriggerRecordingReturn {
  const [triggerEvents, setTriggerEvents] = useState<TriggerEvent[]>([]);
  const [playbackConfig, setPlaybackConfig] = useState<TriggerPlaybackConfig>(DEFAULT_PLAYBACK_CONFIG);

  const handleTrigger = useCallback((samplePosition: number, triggerId: TriggerId) => {
    setTriggerEvents((prev) => [...prev, { samplePosition, triggerId }]);
  }, []);

  const triggerInput = useTriggerInput({
    playbackPositionRef,
    isPlaying,
    onPlay,
    onStop,
    onTrigger: handleTrigger,
  });

  // Build slices and trigger→slice mapping from recorded events
  const { recordedSlices, triggerToSliceIndex } = useMemo(() => {
    if (triggerEvents.length === 0) {
      return { recordedSlices: [] as SliceDefinitionOutput[], triggerToSliceIndex: new Map<TriggerId, number>() };
    }

    const labels = kitLabels.split(',').map((s) => s.trim());

    // Sort events by position, deduplicate close positions (within 100 samples)
    const sorted = [...triggerEvents].sort((a, b) => a.samplePosition - b.samplePosition);
    const deduped: TriggerEvent[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].samplePosition - deduped[deduped.length - 1].samplePosition > 100) {
        deduped.push(sorted[i]);
      }
    }

    const slices: SliceDefinitionOutput[] = [];
    const mapping = new Map<TriggerId, number>();

    for (let i = 0; i < deduped.length; i++) {
      const startSample = deduped[i].samplePosition;
      const endSample = i < deduped.length - 1 ? deduped[i + 1].samplePosition : totalSamples;
      slices.push({
        label: labels[i % labels.length] ?? `S${i + 1}`,
        startSample,
        endSample,
      });
      if (!mapping.has(deduped[i].triggerId)) {
        mapping.set(deduped[i].triggerId, i);
      }
    }

    return { recordedSlices: slices, triggerToSliceIndex: mapping };
  }, [triggerEvents, totalSamples, kitLabels]);

  // Refs for stable event handler access
  const onPlaySliceRef = useRef(onPlaySlice);
  const onStopSliceRef = useRef(onStopSlice);
  const triggerToSliceIndexRef = useRef(triggerToSliceIndex);
  const recordedSlicesRef = useRef(recordedSlices);
  const stateRef = useRef(triggerInput.state);
  const activeRef = useRef(active);
  const playbackConfigRef = useRef(playbackConfig);

  onPlaySliceRef.current = onPlaySlice;
  onStopSliceRef.current = onStopSlice;
  triggerToSliceIndexRef.current = triggerToSliceIndex;
  recordedSlicesRef.current = recordedSlices;
  stateRef.current = triggerInput.state;
  activeRef.current = active;
  playbackConfigRef.current = playbackConfig;

  const firePlayback = useCallback((triggerId: TriggerId) => {
    const slices = recordedSlicesRef.current;
    if (slices.length === 0) return;
    const mapping = triggerToSliceIndexRef.current;
    const index = mapping.get(triggerId);
    if (index !== undefined) {
      onPlaySliceRef.current(index);
    }
  }, []);

  const fireStopPlayback = useCallback((triggerId: TriggerId) => {
    if (playbackConfigRef.current.playbackMode !== 'gate') return;
    const mapping = triggerToSliceIndexRef.current;
    const index = mapping.get(triggerId);
    if (index !== undefined) {
      onStopSliceRef.current(index);
    }
  }, []);

  // Keyboard listeners for slice playback (idle/complete, when trigger tab is active)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!activeRef.current) return;
      const state = stateRef.current;
      if (state !== 'idle' && state !== 'complete') return;
      if (recordedSlicesRef.current.length === 0) return;
      if (event.repeat) return;
      if (IGNORED_KEYS.has(event.key)) return;
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

      const id = keyTriggerId(event.key);
      if (!triggerToSliceIndexRef.current.has(id)) return;

      event.preventDefault();
      event.stopPropagation();
      firePlayback(id);
    };

    const handleKeyUp = (event: KeyboardEvent): void => {
      if (!activeRef.current) return;
      const state = stateRef.current;
      if (state !== 'idle' && state !== 'complete') return;
      if (recordedSlicesRef.current.length === 0) return;

      const id = keyTriggerId(event.key);
      if (!triggerToSliceIndexRef.current.has(id)) return;

      fireStopPlayback(id);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [firePlayback, fireStopPlayback]);

  // MIDI listener for slice playback (idle/complete)
  useEffect(() => {
    if (!navigator.requestMIDIAccess) return;

    let inputs: MIDIInputMap | null = null;

    const handleMidiMessage = (event: MIDIMessageEvent): void => {
      if (!activeRef.current) return;
      const state = stateRef.current;
      if (state !== 'idle' && state !== 'complete') return;
      if (recordedSlicesRef.current.length === 0) return;
      const data = event.data;
      if (!data || data.length < 3) return;
      const status = data[0] & 0xf0;
      const note = data[1];
      const velocity = data[2];

      if (status === 0x90 && velocity > 0) {
        // Note On
        const id = midiTriggerId(note);
        if (triggerToSliceIndexRef.current.has(id)) {
          firePlayback(id);
        }
      } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
        // Note Off
        const id = midiTriggerId(note);
        if (triggerToSliceIndexRef.current.has(id)) {
          fireStopPlayback(id);
        }
      }
    };

    navigator.requestMIDIAccess().then(
      (access) => {
        inputs = access.inputs;
        inputs.forEach((input) => {
          input.addEventListener('midimessage', handleMidiMessage as EventListener);
        });
      },
      () => { /* MIDI not available */ }
    );

    return () => {
      if (inputs) {
        inputs.forEach((input) => {
          input.removeEventListener('midimessage', handleMidiMessage as EventListener);
        });
      }
    };
  }, [firePlayback, fireStopPlayback]);

  // Config setters
  const setPolyphony = useCallback((mode: PolyphonyMode) => {
    setPlaybackConfig((prev) => ({ ...prev, polyphony: mode }));
  }, []);

  const setPlaybackMode = useCallback((mode: PlaybackMode) => {
    setPlaybackConfig((prev) => ({ ...prev, playbackMode: mode }));
  }, []);

  const setMuteGroup = useCallback((sliceIndex: number, group: number) => {
    setPlaybackConfig((prev) => {
      const muteGroups = [...prev.muteGroups];
      muteGroups[sliceIndex] = group;
      return { ...prev, muteGroups };
    });
  }, []);

  const reset = useCallback(() => {
    triggerInput.reset();
    setTriggerEvents([]);
    setPlaybackConfig(DEFAULT_PLAYBACK_CONFIG);
  }, [triggerInput]);

  return {
    state: triggerInput.state,
    midiAvailable: triggerInput.midiAvailable,
    triggerCount: triggerEvents.length,
    recordedSlices,
    arm: triggerInput.arm,
    stopRecording: triggerInput.stopRecording,
    reset,
    playbackConfig,
    setPolyphony,
    setPlaybackMode,
    setMuteGroup,
  };
}
