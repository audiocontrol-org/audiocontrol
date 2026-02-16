/**
 * D-110 MIDI store built on shared editor-core factory.
 */

import { createMidiStore } from '@audiocontrol/editor-core';
import type { D110ClientInterface, D110MidiIO } from '@/core/midi/types';
import { createD110Client } from '@/core/midi/D110Client';

export const useMidiStore = createMidiStore<D110ClientInterface>({
  deviceName: 'd110',
  defaultDeviceId: 17,
  deviceIdRange: { min: 17, max: 32 },
  createClient: (adapter, deviceId) => createD110Client(adapter as D110MidiIO, { deviceId: deviceId - 1 }),
});
