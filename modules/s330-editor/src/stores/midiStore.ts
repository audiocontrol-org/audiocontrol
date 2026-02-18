/**
 * S-330 MIDI store built on shared editor-core factory.
 */

import { createMidiStore, createMockMidiTransport } from '@audiocontrol/editor-core';
import { isMockMidiMode } from '@/mock/mockMode';

const MOCK_INPUT_ID = 's330-mock-in';
const MOCK_OUTPUT_ID = 's330-mock-out';

const mockRuntime = createMockMidiTransport({
  inputs: [{ id: MOCK_INPUT_ID, name: 'Mock S-330 In', manufacturer: 'AudioControl', state: 'connected' }],
  outputs: [{ id: MOCK_OUTPUT_ID, name: 'Mock S-330 Out', manufacturer: 'AudioControl', state: 'connected' }],
  sysExEnabled: true,
  browserInfo: {
    browser: 'Mock MIDI',
    notes: 'Deterministic S-330 mock transport for screenshot and UI validation.',
  },
});

const useMockMidi = isMockMidiMode();

if (useMockMidi && typeof window !== 'undefined') {
  // Ensure deterministic auto-connect in mock mode.
  localStorage.setItem('s330-midi-input', MOCK_INPUT_ID);
  localStorage.setItem('s330-midi-output', MOCK_OUTPUT_ID);
}

export const useMidiStore = createMidiStore<null>({
  deviceName: 's330',
  defaultDeviceId: 0,
  deviceIdRange: { min: 0, max: 16 },
  transport: useMockMidi ? mockRuntime.transport : undefined,
});

// Expose store on window for E2E testing
declare global {
  interface Window {
    __midiStore?: typeof useMidiStore;
    __mockMidiS330?: typeof mockRuntime.controls;
  }
}

if (typeof window !== 'undefined') {
  window.__midiStore = useMidiStore;
  if (useMockMidi) {
    window.__mockMidiS330 = mockRuntime.controls;
  }
}
