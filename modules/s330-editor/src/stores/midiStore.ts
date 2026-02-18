/**
 * S-330 MIDI store built on shared editor-core factory.
 */

import { createMidiStore, createRuntimeMidiTransport } from '@audiocontrol/editor-core';

const MOCK_INPUT_ID = 's330-mock-in';
const MOCK_OUTPUT_ID = 's330-mock-out';

const runtimeTransport = createRuntimeMidiTransport({
  deviceName: 's330',
  mock: {
    inputs: [{ id: MOCK_INPUT_ID, name: 'Mock S-330 In', manufacturer: 'AudioControl', state: 'connected' }],
    outputs: [{ id: MOCK_OUTPUT_ID, name: 'Mock S-330 Out', manufacturer: 'AudioControl', state: 'connected' }],
    sysExEnabled: true,
    browserInfo: {
      browser: 'Mock MIDI',
      notes: 'Deterministic S-330 mock transport for screenshot and UI validation.',
    },
  },
});

export const useMidiStore = createMidiStore<null>({
  deviceName: 's330',
  defaultDeviceId: 0,
  deviceIdRange: { min: 0, max: 16 },
  transport: runtimeTransport.transport,
});

// Expose store on window for E2E testing
declare global {
  interface Window {
    __midiStore?: typeof useMidiStore;
    __mockMidiS330?: NonNullable<typeof runtimeTransport.controls>;
  }
}

if (typeof window !== 'undefined') {
  window.__midiStore = useMidiStore;
  if (runtimeTransport.mode === 'mock' && runtimeTransport.controls) {
    window.__mockMidiS330 = runtimeTransport.controls;
  }
}
