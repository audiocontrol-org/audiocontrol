/**
 * D-110 MIDI store built on shared editor-core factory.
 */

import { createMidiStore } from '@audiocontrol/editor-core';
import type { D110ClientInterface, D110MidiIO } from '@/core/midi/types';
import { createD110Client } from '@/core/midi/D110Client';
import { createMockMidiTransport } from '@audiocontrol/editor-core';

const MOCK_INPUT_ID = 'd110-mock-in';
const MOCK_OUTPUT_ID = 'd110-mock-out';

const useMockMidi = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('midi') === 'mock';

const mockRuntime = createMockMidiTransport({
  inputs: [{ id: MOCK_INPUT_ID, name: 'Mock D-110 In', manufacturer: 'AudioControl', state: 'connected' }],
  outputs: [{ id: MOCK_OUTPUT_ID, name: 'Mock D-110 Out', manufacturer: 'AudioControl', state: 'connected' }],
  sysExEnabled: true,
  browserInfo: {
    browser: 'Mock MIDI',
    notes: 'Deterministic D-110 mock transport for screenshot and UI validation.',
  },
});

if (useMockMidi && typeof window !== 'undefined') {
  localStorage.setItem('d110-midi-input', MOCK_INPUT_ID);
  localStorage.setItem('d110-midi-output', MOCK_OUTPUT_ID);
}

export const useMidiStore = createMidiStore<D110ClientInterface>({
  deviceName: 'd110',
  defaultDeviceId: 17,
  deviceIdRange: { min: 17, max: 32 },
  transport: useMockMidi ? mockRuntime.transport : undefined,
  createClient: (adapter, deviceId) => createD110Client(adapter as D110MidiIO, { deviceId: deviceId - 1 }),
});
