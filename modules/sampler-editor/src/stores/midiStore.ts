/**
 * MIDI store built on shared editor-core factory.
 *
 * This store is device-agnostic and creates a new instance based on
 * the current device configuration.
 */

import { createMidiStore, createRuntimeMidiTransport } from '@audiocontrol/editor-core';
import type { SamplerDeviceType } from '@/configs/types';

// Store instances keyed by device type
const storeInstances = new Map<string, ReturnType<typeof createMidiStore<null>>>();
const transportInstances = new Map<string, ReturnType<typeof createRuntimeMidiTransport>>();

/**
 * Get mock MIDI port IDs for a device.
 */
function getMockPortIds(deviceType: string) {
  return {
    inputId: `${deviceType}-mock-in`,
    outputId: `${deviceType}-mock-out`,
  };
}

/**
 * Create a runtime MIDI transport for a device.
 */
function createTransportForDevice(deviceType: string) {
  const { inputId, outputId } = getMockPortIds(deviceType);
  const deviceName = deviceType.toUpperCase();

  return createRuntimeMidiTransport({
    deviceName: deviceType,
    mock: {
      inputs: [{ id: inputId, name: `Mock ${deviceName} In`, manufacturer: 'AudioControl', state: 'connected' }],
      outputs: [{ id: outputId, name: `Mock ${deviceName} Out`, manufacturer: 'AudioControl', state: 'connected' }],
      sysExEnabled: true,
      browserInfo: {
        browser: 'Mock MIDI',
        notes: `Deterministic ${deviceName} mock transport for screenshot and UI validation.`,
      },
    },
  });
}

/**
 * Get or create a MIDI store for a device type.
 */
export function getMidiStore(deviceType: SamplerDeviceType) {
  let store = storeInstances.get(deviceType);

  if (!store) {
    // Create transport if needed
    let transport = transportInstances.get(deviceType);
    if (!transport) {
      transport = createTransportForDevice(deviceType);
      transportInstances.set(deviceType, transport);
    }

    // Create store
    store = createMidiStore<null>({
      deviceName: deviceType,
      defaultDeviceId: 0,
      deviceIdRange: { min: 0, max: 16 },
      transport: transport.transport,
    });

    storeInstances.set(deviceType, store);

    // Expose on window for E2E testing
    if (typeof window !== 'undefined') {
      const windowKey = `__midiStore_${deviceType}` as keyof Window;
      (window as unknown as Record<string, unknown>)[windowKey] = store;

      if (transport.mode === 'mock' && transport.controls) {
        const mockKey = `__mockMidi_${deviceType}` as keyof Window;
        (window as unknown as Record<string, unknown>)[mockKey] = transport.controls;
      }
    }
  }

  return store;
}

/**
 * Legacy export for backward compatibility.
 * Components should migrate to using getMidiStore(deviceType) with useDeviceConfig().
 */
export const useMidiStore = getMidiStore('s330');

// Expose store on window for E2E testing (legacy)
declare global {
  interface Window {
    __midiStore?: typeof useMidiStore;
    __mockMidiS330?: NonNullable<ReturnType<typeof createRuntimeMidiTransport>['controls']>;
    __mockMidiS550?: NonNullable<ReturnType<typeof createRuntimeMidiTransport>['controls']>;
  }
}

if (typeof window !== 'undefined') {
  window.__midiStore = useMidiStore;
  const s330Transport = transportInstances.get('s330');
  if (s330Transport?.mode === 'mock' && s330Transport.controls) {
    window.__mockMidiS330 = s330Transport.controls;
  }
}
