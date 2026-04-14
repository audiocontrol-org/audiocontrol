/**
 * MIDI Learn Hook for Sample Chopper
 *
 * Manages learning-in-progress state: which slice is learning, listens for
 * the next MIDI note-on or keyboard press, then calls onLearn with the
 * slice index and trigger ID.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  keyTriggerId,
  midiTriggerId,
  type TriggerId,
} from '@/ui/hooks/useTriggerInput.js';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/**
 * Convert a MIDI note number to a display name (e.g. 36 -> "C2").
 *
 * DEVIATION: This duplicates midiNoteToName from @audiocontrol/sampler-library.
 * Cannot import from sampler-library here because sample-chopper and sampler-library
 * have a circular dependency (sampler-library depends on sample-chopper). Importing
 * from sampler-library breaks the CJS build. This should not be copied elsewhere --
 * all other modules should import from @audiocontrol/sampler-library or
 * @audiocontrol/editor-core instead.
 */
export function midiNoteToName(note: number): string {
  return `${NOTE_NAMES[note % 12]}${Math.floor(note / 12) - 1}`;
}

/** Convert a TriggerId to a human-readable display name */
export function triggerDisplayName(triggerId: TriggerId): string {
  if (triggerId.startsWith('midi:')) {
    return midiNoteToName(parseInt(triggerId.slice(5)));
  }
  if (triggerId.startsWith('key:')) {
    return triggerId.slice(4).toUpperCase();
  }
  return triggerId;
}

const IGNORED_KEYS = new Set([
  'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab',
  'Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6',
  'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
  ' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'Delete', 'Backspace',
]);

export interface UseMidiLearnParams {
  /** Whether MIDI learn is available (trigger tab active + slices exist) */
  enabled: boolean;
  /** Called when a note/key is learned for a slice */
  onLearn: (sliceIndex: number, triggerId: TriggerId) => void;
}

export interface UseMidiLearnReturn {
  /** Which slice index is currently learning (null if not learning) */
  learningSliceIndex: number | null;
  /** Whether any slice is in learn mode */
  isLearning: boolean;
  /** Start learning for a specific slice */
  startLearning: (sliceIndex: number) => void;
  /** Cancel learning mode */
  cancelLearning: () => void;
}

export function useMidiLearn({
  enabled,
  onLearn,
}: UseMidiLearnParams): UseMidiLearnReturn {
  const [learningSliceIndex, setLearningSliceIndex] = useState<number | null>(null);
  const onLearnRef = useRef(onLearn);
  onLearnRef.current = onLearn;

  const startLearning = useCallback((sliceIndex: number) => {
    setLearningSliceIndex(sliceIndex);
  }, []);

  const cancelLearning = useCallback(() => {
    setLearningSliceIndex(null);
  }, []);

  // Cancel learning when disabled
  useEffect(() => {
    if (!enabled) setLearningSliceIndex(null);
  }, [enabled]);

  // Keyboard listener for learn mode
  useEffect(() => {
    if (learningSliceIndex === null) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat) return;
      if (IGNORED_KEYS.has(event.key)) return;
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

      event.preventDefault();
      event.stopPropagation();
      onLearnRef.current(learningSliceIndex, keyTriggerId(event.key));
      setLearningSliceIndex(null);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [learningSliceIndex]);

  // MIDI listener for learn mode
  useEffect(() => {
    if (learningSliceIndex === null || !navigator.requestMIDIAccess) return;

    let inputs: MIDIInputMap | null = null;

    const handleMidiMessage = (event: MIDIMessageEvent): void => {
      const data = event.data;
      if (!data || data.length < 3) return;
      const status = data[0] & 0xf0;
      const velocity = data[2];
      if (status === 0x90 && velocity > 0) {
        onLearnRef.current(learningSliceIndex, midiTriggerId(data[1]));
        setLearningSliceIndex(null);
      }
    };

    navigator.requestMIDIAccess().then(
      (access) => {
        inputs = access.inputs;
        inputs.forEach((input) => {
          input.addEventListener('midimessage', handleMidiMessage as EventListener);
        });
      },
      () => { /* MIDI not available */ },
    );

    return () => {
      if (inputs) {
        inputs.forEach((input) => {
          input.removeEventListener('midimessage', handleMidiMessage as EventListener);
        });
      }
    };
  }, [learningSliceIndex]);

  return {
    learningSliceIndex,
    isLearning: learningSliceIndex !== null,
    startLearning,
    cancelLearning,
  };
}
