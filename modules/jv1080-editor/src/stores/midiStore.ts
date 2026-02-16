import { createMidiStore } from '@audiocontrol/editor-core';
import { Jv1080Client } from '@audiocontrol/sampler-devices/jv1080';

export const useMidiStore = createMidiStore<Jv1080Client>({
  deviceName: 'jv1080',
  defaultDeviceId: 16,
  deviceIdRange: { min: 0, max: 127 },
  createClient: (adapter, deviceId) => {
    const client = new Jv1080Client(adapter, { deviceId: deviceId & 0x7f });
    client.connect();
    return client;
  },
  destroyClient: (client) => {
    client.disconnect();
  },
});
