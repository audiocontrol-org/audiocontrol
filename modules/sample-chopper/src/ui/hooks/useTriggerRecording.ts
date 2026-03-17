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

export interface TriggerMapping {
  triggerId: TriggerId;
  sliceIndex: number;
}

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
  /** Restored trigger mappings from a saved sample */
  initialTriggers?: TriggerMapping[];
  /** Restored playback config from a saved sample */
  initialPlaybackConfig?: TriggerPlaybackConfig;
  /** Slices to use for playback when restoring triggers (from initialSlices) */
  initialSlices?: Array<{ label: string; startSample: number; endSample: number }>;
  /** Whether MIDI learn is active (suppresses playback listeners) */
  midiLearnActive?: boolean;
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
  /** Trigger ID → slice index mapping (for saving) */
  triggerMappings: TriggerMapping[];
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
  /** Learn a trigger for a specific slice (MIDI learn) */
  learnTrigger: (sliceIndex: number, triggerId: TriggerId) => void;
  /** Clear a learned trigger for a specific slice */
  clearLearnedTrigger: (sliceIndex: number) => void;
  /** Clear all learned triggers */
  clearAllLearnedTriggers: () => void;
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
  initialTriggers,
  initialPlaybackConfig,
  initialSlices,
  midiLearnActive = false,
}: UseTriggerRecordingParams): UseTriggerRecordingReturn {
  const [triggerEvents, setTriggerEvents] = useState<TriggerEvent[]>([]);
  const [playbackConfig, setPlaybackConfig] = useState<TriggerPlaybackConfig>(
    initialPlaybackConfig ?? DEFAULT_PLAYBACK_CONFIG,
  );

  // Restored mapping from saved trigger data (independent of recording)
  const restoredMapping = useMemo(() => {
    if (!initialTriggers || initialTriggers.length === 0) return null;
    const map = new Map<TriggerId, number>();
    for (const t of initialTriggers) {
      map.set(t.triggerId, t.sliceIndex);
    }
    return map;
  }, [initialTriggers]);

  // Whether we have a restored mapping that enables playback without recording
  const hasRestoredTriggers = restoredMapping !== null && restoredMapping.size > 0;

  // Learned mappings from MIDI learn (triggerId → sliceIndex)
  const [learnedMappings, setLearnedMappings] = useState<Map<TriggerId, number>>(new Map());

  const learnTrigger = useCallback((sliceIndex: number, triggerId: TriggerId) => {
    setLearnedMappings((prev) => {
      const next = new Map(prev);
      // Remove any existing mapping to this slice (one trigger per slice)
      for (const [id, idx] of next) {
        if (idx === sliceIndex) next.delete(id);
      }
      next.set(triggerId, sliceIndex);
      return next;
    });
  }, []);

  const clearLearnedTrigger = useCallback((sliceIndex: number) => {
    setLearnedMappings((prev) => {
      const next = new Map(prev);
      for (const [id, idx] of next) {
        if (idx === sliceIndex) next.delete(id);
      }
      return next;
    });
  }, []);

  const clearAllLearnedTriggers = useCallback(() => {
    setLearnedMappings(new Map());
  }, []);

  // Ref for midiLearnActive so event handlers can read it without re-subscribing
  const midiLearnActiveRef = useRef(midiLearnActive);
  midiLearnActiveRef.current = midiLearnActive;

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

  // Effective mapping: restored ← recorded ← learned (last wins)
  const effectiveMapping = useMemo(() => {
    const merged = new Map<TriggerId, number>();
    if (restoredMapping) {
      for (const [id, idx] of restoredMapping) merged.set(id, idx);
    }
    if (triggerToSliceIndex.size > 0) {
      for (const [id, idx] of triggerToSliceIndex) merged.set(id, idx);
    }
    for (const [id, idx] of learnedMappings) merged.set(id, idx);
    return merged;
  }, [triggerToSliceIndex, restoredMapping, learnedMappings]);

  // Trigger mappings for saving (actual trigger IDs, not generic)
  const triggerMappings = useMemo((): TriggerMapping[] => {
    return [...effectiveMapping.entries()].map(([triggerId, sliceIndex]) => ({
      triggerId,
      sliceIndex,
    }));
  }, [effectiveMapping]);

  // Effective slices: prefer recorded, fall back to initial
  const effectiveSlices = useMemo(() => {
    if (recordedSlices.length > 0) return recordedSlices;
    if (hasRestoredTriggers && initialSlices && initialSlices.length > 0) {
      return initialSlices.map((s) => ({ ...s }));
    }
    return [];
  }, [recordedSlices, hasRestoredTriggers, initialSlices]);

  // Refs for stable event handler access
  const onPlaySliceRef = useRef(onPlaySlice);
  const onStopSliceRef = useRef(onStopSlice);
  const effectiveMappingRef = useRef(effectiveMapping);
  const effectiveSlicesRef = useRef(effectiveSlices);
  const stateRef = useRef(triggerInput.state);
  const activeRef = useRef(active);
  const playbackConfigRef = useRef(playbackConfig);
  const hasRestoredTriggersRef = useRef(hasRestoredTriggers);

  onPlaySliceRef.current = onPlaySlice;
  onStopSliceRef.current = onStopSlice;
  effectiveMappingRef.current = effectiveMapping;
  effectiveSlicesRef.current = effectiveSlices;
  stateRef.current = triggerInput.state;
  activeRef.current = active;
  playbackConfigRef.current = playbackConfig;
  hasRestoredTriggersRef.current = hasRestoredTriggers;

  const firePlayback = useCallback((triggerId: TriggerId) => {
    const slices = effectiveSlicesRef.current;
    if (slices.length === 0) return;
    const mapping = effectiveMappingRef.current;
    const index = mapping.get(triggerId);
    if (index !== undefined) {
      onPlaySliceRef.current(index);
    }
  }, []);

  const fireStopPlayback = useCallback((triggerId: TriggerId) => {
    if (playbackConfigRef.current.playbackMode !== 'gate') return;
    const mapping = effectiveMappingRef.current;
    const index = mapping.get(triggerId);
    if (index !== undefined) {
      onStopSliceRef.current(index);
    }
  }, []);

  // Keyboard listeners for slice playback (idle/complete, when trigger tab is active)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!activeRef.current) return;
      if (midiLearnActiveRef.current) return;
      const state = stateRef.current;
      if (state !== 'idle' && state !== 'complete') return;
      if (effectiveSlicesRef.current.length === 0) return;
      if (event.repeat) return;
      if (IGNORED_KEYS.has(event.key)) return;
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

      const id = keyTriggerId(event.key);
      if (!effectiveMappingRef.current.has(id)) return;

      event.preventDefault();
      event.stopPropagation();
      firePlayback(id);
    };

    const handleKeyUp = (event: KeyboardEvent): void => {
      if (!activeRef.current) return;
      if (midiLearnActiveRef.current) return;
      const state = stateRef.current;
      if (state !== 'idle' && state !== 'complete') return;
      if (effectiveSlicesRef.current.length === 0) return;

      const id = keyTriggerId(event.key);
      if (!effectiveMappingRef.current.has(id)) return;

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
      if (midiLearnActiveRef.current) return;
      const state = stateRef.current;
      if (state !== 'idle' && state !== 'complete') return;
      if (effectiveSlicesRef.current.length === 0) return;
      const data = event.data;
      if (!data || data.length < 3) return;
      const status = data[0] & 0xf0;
      const note = data[1];
      const velocity = data[2];

      if (status === 0x90 && velocity > 0) {
        // Note On
        const id = midiTriggerId(note);
        if (effectiveMappingRef.current.has(id)) {
          firePlayback(id);
        }
      } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
        // Note Off
        const id = midiTriggerId(note);
        if (effectiveMappingRef.current.has(id)) {
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
    setLearnedMappings(new Map());
    setPlaybackConfig(DEFAULT_PLAYBACK_CONFIG);
  }, [triggerInput]);

  return {
    state: triggerInput.state,
    midiAvailable: triggerInput.midiAvailable,
    triggerCount: triggerEvents.length,
    recordedSlices: effectiveSlices,
    triggerMappings,
    arm: triggerInput.arm,
    stopRecording: triggerInput.stopRecording,
    reset,
    playbackConfig,
    setPolyphony,
    setPlaybackMode,
    setMuteGroup,
    learnTrigger,
    clearLearnedTrigger,
    clearAllLearnedTriggers,
  };
}
