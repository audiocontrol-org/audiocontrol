/**
 * Trigger Playback Listeners Hook
 *
 * Keyboard and MIDI event listeners that fire slice playback.
 * Pure side-effect hook — no return value.
 * Only active when trigger state is idle or complete, the trigger tab is active,
 * and MIDI learn is not in progress.
 */

import { useEffect, useRef, useCallback } from 'react';
import {
  keyTriggerId,
  midiTriggerId,
  type TriggerId,
  type TriggerState,
} from '@/ui/hooks/useTriggerInput.js';
import type { TriggerPlaybackConfig } from '@/ui/hooks/useTriggerPlayback.js';

const IGNORED_KEYS = new Set([
  'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab',
  'Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6',
  'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
]);

export interface UseTriggerPlaybackListenersParams {
  /** Whether the trigger tab is currently active */
  active: boolean;
  /** Whether MIDI learn is active (suppresses playback listeners) */
  midiLearnActive: boolean;
  /** Current trigger state machine state */
  state: TriggerState;
  /** Current slices (needed to check if slices exist) */
  slices: Array<{ label: string; startSample: number; endSample: number }>;
  /** Effective trigger→slice mapping */
  effectiveMapping: Map<TriggerId, number>;
  /** Play a specific slice by index */
  onPlaySlice: (index: number) => void;
  /** Stop a specific slice by index (for gate mode) */
  onStopSlice: (index: number) => void;
  /** Current playback config (for gate mode detection) */
  playbackConfig: TriggerPlaybackConfig;
}

export function useTriggerPlaybackListeners({
  active,
  midiLearnActive,
  state,
  slices,
  effectiveMapping,
  onPlaySlice,
  onStopSlice,
  playbackConfig,
}: UseTriggerPlaybackListenersParams): void {
  // Refs for stable event handler access (avoids re-subscribing on every render)
  const activeRef = useRef(active);
  const midiLearnActiveRef = useRef(midiLearnActive);
  const stateRef = useRef(state);
  const slicesRef = useRef(slices);
  const effectiveMappingRef = useRef(effectiveMapping);
  const onPlaySliceRef = useRef(onPlaySlice);
  const onStopSliceRef = useRef(onStopSlice);
  const playbackConfigRef = useRef(playbackConfig);

  activeRef.current = active;
  midiLearnActiveRef.current = midiLearnActive;
  stateRef.current = state;
  slicesRef.current = slices;
  effectiveMappingRef.current = effectiveMapping;
  onPlaySliceRef.current = onPlaySlice;
  onStopSliceRef.current = onStopSlice;
  playbackConfigRef.current = playbackConfig;

  const firePlayback = useCallback((triggerId: TriggerId) => {
    if (slicesRef.current.length === 0) return;
    const index = effectiveMappingRef.current.get(triggerId);
    if (index !== undefined) {
      onPlaySliceRef.current(index);
    }
  }, []);

  const fireStopPlayback = useCallback((triggerId: TriggerId) => {
    if (playbackConfigRef.current.playbackMode !== 'gate') return;
    const index = effectiveMappingRef.current.get(triggerId);
    if (index !== undefined) {
      onStopSliceRef.current(index);
    }
  }, []);

  // Keyboard listeners for slice playback (idle/complete, when trigger tab is active)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!activeRef.current) return;
      if (midiLearnActiveRef.current) return;
      const s = stateRef.current;
      if (s !== 'idle' && s !== 'complete') return;
      if (slicesRef.current.length === 0) return;
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
      const s = stateRef.current;
      if (s !== 'idle' && s !== 'complete') return;
      if (slicesRef.current.length === 0) return;

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
      const s = stateRef.current;
      if (s !== 'idle' && s !== 'complete') return;
      if (slicesRef.current.length === 0) return;
      const data = event.data;
      if (!data || data.length < 3) return;
      const status = data[0] & 0xf0;
      const note = data[1];
      const velocity = data[2];

      if (status === 0x90 && velocity > 0) {
        const id = midiTriggerId(note);
        if (effectiveMappingRef.current.has(id)) {
          firePlayback(id);
        }
      } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
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
}
