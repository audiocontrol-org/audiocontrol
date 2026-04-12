import { useEffect, useRef } from 'react';

interface UseWebMidiInputParams {
  onNoteOn: (note: number, velocity: number) => void;
  onNoteOff: (note: number) => void;
  onCc?: (cc: number, value: number) => void;
  enabled?: boolean;
}

/**
 * Hook that listens to all available Web MIDI inputs and forwards
 * note on/off events to the provided callbacks.
 */
export function useWebMidiInput({
  onNoteOn,
  onNoteOff,
  onCc,
  enabled = true,
}: UseWebMidiInputParams): void {
  const callbacksRef = useRef({ onNoteOn, onNoteOff, onCc });
  callbacksRef.current = { onNoteOn, onNoteOff, onCc };

  useEffect(() => {
    if (!enabled || !navigator.requestMIDIAccess) return;

    let inputs: WebMidi.MIDIInput[] = [];

    function handleMidiMessage(event: WebMidi.MIDIMessageEvent): void {
      const [status, note, velocity] = event.data;
      if (status === undefined || note === undefined) return;

      const command = status & 0xf0;

      if (command === 0x90 && velocity !== undefined && velocity > 0) {
        callbacksRef.current.onNoteOn(note, velocity);
      } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
        callbacksRef.current.onNoteOff(note);
      } else if (command === 0xb0 && velocity !== undefined) {
        callbacksRef.current.onCc?.(note, velocity);
      }
    }

    function attachListeners(access: WebMidi.MIDIAccess): void {
      inputs = [];
      for (const input of access.inputs.values()) {
        input.onmidimessage = handleMidiMessage;
        inputs.push(input);
      }
    }

    navigator.requestMIDIAccess().then(
      (access) => {
        attachListeners(access);
        access.onstatechange = () => attachListeners(access);
      },
      () => {
        // Web MIDI not available — silently ignore
      },
    );

    return () => {
      for (const input of inputs) {
        input.onmidimessage = null;
      }
    };
  }, [enabled]);
}
