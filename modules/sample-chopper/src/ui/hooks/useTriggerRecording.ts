/**
 * Trigger Recording Hook
 *
 * Composes useTriggerInput with slice generation logic.
 * Maintains trigger positions and derives SliceDefinitionOutput[] from them.
 * Each trigger is tagged with an identity (key or MIDI note) so that
 * pressing the same key/note during playback plays back the slice it created.
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
}

export function useTriggerRecording({
  playbackPositionRef,
  isPlaying,
  onPlay,
  onStop,
  onPlaySlice,
  totalSamples,
  kitLabels,
  active,
}: UseTriggerRecordingParams): UseTriggerRecordingReturn {
  const [triggerEvents, setTriggerEvents] = useState<TriggerEvent[]>([]);

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
      // Map the first trigger with this ID to its slice index.
      // If the same key was pressed multiple times, the first occurrence wins.
      if (!mapping.has(deduped[i].triggerId)) {
        mapping.set(deduped[i].triggerId, i);
      }
    }

    return { recordedSlices: slices, triggerToSliceIndex: mapping };
  }, [triggerEvents, totalSamples, kitLabels]);

  // Refs for stable event handler access
  const onPlaySliceRef = useRef(onPlaySlice);
  const triggerToSliceIndexRef = useRef(triggerToSliceIndex);
  const recordedSlicesRef = useRef(recordedSlices);
  const stateRef = useRef(triggerInput.state);
  const activeRef = useRef(active);

  onPlaySliceRef.current = onPlaySlice;
  triggerToSliceIndexRef.current = triggerToSliceIndex;
  recordedSlicesRef.current = recordedSlices;
  stateRef.current = triggerInput.state;
  activeRef.current = active;

  const firePlayback = useCallback((triggerId: TriggerId) => {
    const slices = recordedSlicesRef.current;
    if (slices.length === 0) return;
    const mapping = triggerToSliceIndexRef.current;
    const index = mapping.get(triggerId);
    if (index !== undefined) {
      onPlaySliceRef.current(index);
    }
  }, []);

  // Keyboard listener for slice playback (idle/complete, when trigger tab is active)
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

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [firePlayback]);

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
      const velocity = data[2];
      if (status === 0x90 && velocity > 0) {
        const id = midiTriggerId(data[1]);
        if (triggerToSliceIndexRef.current.has(id)) {
          firePlayback(id);
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
  }, [firePlayback]);

  const reset = useCallback(() => {
    triggerInput.reset();
    setTriggerEvents([]);
  }, [triggerInput]);

  return {
    state: triggerInput.state,
    midiAvailable: triggerInput.midiAvailable,
    triggerCount: triggerEvents.length,
    recordedSlices,
    arm: triggerInput.arm,
    stopRecording: triggerInput.stopRecording,
    reset,
  };
}
