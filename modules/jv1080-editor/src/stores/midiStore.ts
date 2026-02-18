import { createMidiStore, createRuntimeMidiTransport } from '@audiocontrol/editor-core';
import { Jv1080Client } from '@audiocontrol/sampler-devices/jv1080';

const MOCK_INPUT_ID = 'jv1080-mock-in';
const MOCK_OUTPUT_ID = 'jv1080-mock-out';

const runtimeTransport = createRuntimeMidiTransport({
  deviceName: 'jv1080',
  mock: {
    inputs: [{ id: MOCK_INPUT_ID, name: 'Mock JV-1080 In', manufacturer: 'AudioControl', state: 'connected' }],
    outputs: [{ id: MOCK_OUTPUT_ID, name: 'Mock JV-1080 Out', manufacturer: 'AudioControl', state: 'connected' }],
    sysExEnabled: true,
    browserInfo: {
      browser: 'Mock MIDI',
      notes: 'Deterministic JV-1080 mock transport for screenshot and UI validation.',
    },
  },
});

export const useMidiStore = createMidiStore<Jv1080Client>({
  deviceName: 'jv1080',
  defaultDeviceId: 16,
  deviceIdRange: { min: 0, max: 127 },
  transport: runtimeTransport.transport,
  createClient: (adapter, deviceId) => {
    const client = new Jv1080Client(adapter, { deviceId: deviceId & 0x7f });
    client.connect();
    return client;
  },
  destroyClient: (client) => {
    client.disconnect();
  },
});
