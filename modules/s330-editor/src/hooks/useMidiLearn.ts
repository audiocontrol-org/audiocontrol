/**
 * Hook for MIDI learn functionality
 *
 * Listens for incoming MIDI note-on messages from ALL available MIDI inputs
 * and returns the note number. Used for assigning key ranges by playing
 * notes on any connected MIDI controller.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useMidiStore } from '@/stores/midiStore';

export type LearnTarget = 'startKey' | 'endKey' | null;

export interface UseMidiLearnReturn {
  /** Which field is currently learning (null if not learning) */
  learningTarget: LearnTarget;
  /** Start learning for a specific target */
  startLearning: (target: 'startKey' | 'endKey') => void;
  /** Cancel learning mode */
  cancelLearning: () => void;
  /** The last learned note (for display feedback) */
  lastLearnedNote: number | null;
}

/**
 * Hook for MIDI learn functionality
 *
 * @param onLearn Callback when a note is learned. Receives (target, noteNumber).
 * @param minKey Minimum valid MIDI note number (default: 0)
 * @param maxKey Maximum valid MIDI note number (default: 127)
 */
export function useMidiLearn(
  onLearn: (target: 'startKey' | 'endKey', noteNumber: number) => void,
  minKey: number = 0,
  maxKey: number = 127
): UseMidiLearnReturn {
  const [learningTarget, setLearningTarget] = useState<LearnTarget>(null);
  const [lastLearnedNote, setLastLearnedNote] = useState<number | null>(null);
  const midiAccess = useMidiStore((state) => state.midiAccess);
  const callbackRef = useRef(onLearn);

  // Keep callback ref updated
  callbackRef.current = onLearn;

  const startLearning = useCallback((target: 'startKey' | 'endKey') => {
    setLearningTarget(target);
    setLastLearnedNote(null);
  }, []);

  const cancelLearning = useCallback(() => {
    setLearningTarget(null);
  }, []);

  useEffect(() => {
    if (!learningTarget || !midiAccess) {
      return;
    }

    // Store original handlers so we can restore them
    const originalHandlers = new Map<MIDIInput, ((event: MIDIMessageEvent) => void) | null>();

    const handleMidiMessage = (event: MIDIMessageEvent) => {
      const data = event.data;
      if (!data || data.length < 3) return;

      const status = data[0];
      const noteNumber = data[1];
      const velocity = data[2];

      // Check for Note On message (0x90-0x9F) with velocity > 0
      // Note Off can be either 0x80-0x8F or Note On with velocity 0
      const isNoteOn = (status & 0xf0) === 0x90 && velocity > 0;

      if (isNoteOn) {
        // Clamp to valid range
        const clampedNote = Math.max(minKey, Math.min(maxKey, noteNumber));

        setLastLearnedNote(clampedNote);
        callbackRef.current(learningTarget, clampedNote);
        setLearningTarget(null);
      }
    };

    // Attach listener to all available MIDI inputs
    midiAccess.inputs.forEach((input) => {
      // Store original handler
      originalHandlers.set(input, input.onmidimessage);
      // Set our handler
      input.onmidimessage = handleMidiMessage;
    });

    // Cleanup: restore original handlers
    return () => {
      midiAccess.inputs.forEach((input) => {
        const originalHandler = originalHandlers.get(input);
        input.onmidimessage = originalHandler ?? null;
      });
    };
  }, [learningTarget, midiAccess, minKey, maxKey]);

  return {
    learningTarget,
    startLearning,
    cancelLearning,
    lastLearnedNote,
  };
}
