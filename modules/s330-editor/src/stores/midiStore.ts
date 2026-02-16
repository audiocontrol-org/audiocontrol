/**
 * S-330 MIDI store built on shared editor-core factory.
 */

import { createMidiStore } from '@audiocontrol/editor-core';

export const useMidiStore = createMidiStore<null>({
  deviceName: 's330',
  defaultDeviceId: 0,
  deviceIdRange: { min: 0, max: 16 },
});

// Expose store on window for E2E testing
declare global {
  interface Window {
    __midiStore?: typeof useMidiStore;
  }
}

if (typeof window !== 'undefined') {
  window.__midiStore = useMidiStore;
}
