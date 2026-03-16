/**
 * Trigger Input Hook
 *
 * Captures keyboard and MIDI events for real-time trigger-based sample chopping.
 * Manages a state machine: idle → armed → recording → complete.
 * Each trigger carries an identity string (e.g. "key:a", "midi:60") so that
 * the same key/note can be mapped back to its slice during playback.
 */

import { useState, useCallback, useEffect, useRef, type MutableRefObject } from 'react';

export type TriggerState = 'idle' | 'armed' | 'recording' | 'complete';

/** Identifies the source of a trigger: keyboard key or MIDI note number */
export type TriggerId = string; // "key:<key>" or "midi:<note>"

export function keyTriggerId(key: string): TriggerId {
  return `key:${key.toLowerCase()}`;
}

export function midiTriggerId(note: number): TriggerId {
  return `midi:${note}`;
}

export interface UseTriggerInputParams {
  /** Ref for low-latency playback position reads */
  playbackPositionRef: MutableRefObject<number | null>;
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** Start audio playback (full sample) */
  onPlay: () => void;
  /** Stop audio playback */
  onStop: () => void;
  /** Called for each trigger event with the sample position and trigger identity */
  onTrigger: (samplePosition: number, triggerId: TriggerId) => void;
}

export interface UseTriggerInputReturn {
  /** Current state of the trigger state machine */
  state: TriggerState;
  /** Whether MIDI input is available */
  midiAvailable: boolean;
  /** Transition to armed state */
  arm: () => void;
  /** Stop recording and finalize */
  stopRecording: () => void;
  /** Reset to idle state */
  reset: () => void;
}

const IGNORED_KEYS = new Set([
  'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab',
  'Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6',
  'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
]);

export function useTriggerInput({
  playbackPositionRef,
  isPlaying,
  onPlay,
  onStop,
  onTrigger,
}: UseTriggerInputParams): UseTriggerInputReturn {
  const [state, setState] = useState<TriggerState>('idle');
  const [midiAvailable, setMidiAvailable] = useState(false);
  const stateRef = useRef<TriggerState>('idle');
  const midiAccessRef = useRef<MIDIAccess | null>(null);
  const onPlayRef = useRef(onPlay);
  const onTriggerRef = useRef(onTrigger);

  // Keep refs in sync with latest values
  stateRef.current = state;
  onPlayRef.current = onPlay;
  onTriggerRef.current = onTrigger;

  // Detect MIDI availability on mount
  useEffect(() => {
    if (!navigator.requestMIDIAccess) return;
    navigator.requestMIDIAccess().then(
      (access) => {
        midiAccessRef.current = access;
        setMidiAvailable(true);
      },
      () => setMidiAvailable(false)
    );
  }, []);

  // Handle playback ending → transition to complete
  const wasPlayingRef = useRef(false);
  useEffect(() => {
    if (wasPlayingRef.current && !isPlaying && stateRef.current === 'recording') {
      setState('complete');
    }
    wasPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const fireTrigger = useCallback((id: TriggerId) => {
    if (stateRef.current === 'armed') {
      stateRef.current = 'recording';
      setState('recording');
      onPlayRef.current();
      onTriggerRef.current(0, id);
      return;
    }
    if (stateRef.current === 'recording') {
      const pos = playbackPositionRef.current;
      if (pos !== null && pos > 0) {
        onTriggerRef.current(pos, id);
      }
    }
  }, [playbackPositionRef]);

  // Keyboard listener
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (stateRef.current !== 'armed' && stateRef.current !== 'recording') return;
      if (event.repeat) return;
      if (IGNORED_KEYS.has(event.key)) return;
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

      event.preventDefault();
      event.stopPropagation();
      fireTrigger(keyTriggerId(event.key));
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [fireTrigger]);

  // MIDI listener
  useEffect(() => {
    if (!midiAccessRef.current) return;

    const handleMidiMessage = (event: MIDIMessageEvent): void => {
      if (stateRef.current !== 'armed' && stateRef.current !== 'recording') return;
      const data = event.data;
      if (!data || data.length < 3) return;
      // Note On: status byte 0x90-0x9F with velocity > 0
      const status = data[0] & 0xf0;
      const velocity = data[2];
      if (status === 0x90 && velocity > 0) {
        fireTrigger(midiTriggerId(data[1]));
      }
    };

    const inputs = midiAccessRef.current.inputs;
    inputs.forEach((input) => {
      input.addEventListener('midimessage', handleMidiMessage as EventListener);
    });

    return () => {
      inputs.forEach((input) => {
        input.removeEventListener('midimessage', handleMidiMessage as EventListener);
      });
    };
  }, [fireTrigger, midiAvailable]);

  const arm = useCallback(() => {
    if (stateRef.current === 'idle' || stateRef.current === 'complete') {
      setState('armed');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (stateRef.current === 'recording') {
      onStop();
      setState('complete');
    }
  }, [onStop]);

  const reset = useCallback(() => {
    if (isPlaying) onStop();
    setState('idle');
  }, [isPlaying, onStop]);

  return { state, midiAvailable, arm, stopRecording, reset };
}
