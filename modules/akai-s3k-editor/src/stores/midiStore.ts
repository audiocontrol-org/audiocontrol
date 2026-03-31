import { createMidiStore, createRuntimeMidiTransport } from '@audiocontrol/editor-core';

const transport = createRuntimeMidiTransport({
  deviceName: 's3000xl',
  mock: {
    inputs: [{ id: 's3000xl-mock-in', name: 'Mock S3000XL In', manufacturer: 'AudioControl', state: 'connected' }],
    outputs: [{ id: 's3000xl-mock-out', name: 'Mock S3000XL Out', manufacturer: 'AudioControl', state: 'connected' }],
    sysExEnabled: true,
    browserInfo: {
      browser: 'Mock MIDI',
      notes: 'Mock transport for S3000XL development.',
    },
  },
});

export const useMidiStore = createMidiStore<null>({
  deviceName: 's3000xl',
  defaultDeviceId: 0,
  deviceIdRange: { min: 0, max: 127 },
  transport: transport.transport,
});
