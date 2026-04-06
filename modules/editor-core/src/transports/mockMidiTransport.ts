import type { MidiIO, MidiPortInfo, SysExCallback } from '@audiocontrol/midi-core';
import type {
  MidiTransport,
  MidiTransportBrowserInfo,
  MidiTransportConnection,
  MidiTransportPorts,
} from './types';

export interface MockMidiTransportOptions {
  inputs?: MidiPortInfo[];
  outputs?: MidiPortInfo[];
  sysExEnabled?: boolean;
  browserInfo?: Partial<MidiTransportBrowserInfo>;
}

export interface MockMidiTransportControls {
  emitSysEx: (message: number[]) => void;
  getSentMessages: () => number[][];
  triggerStateChange: () => void;
}

export function createMockMidiTransport(
  options: MockMidiTransportOptions = {}
): { transport: MidiTransport; controls: MockMidiTransportControls } {
  const inputs = options.inputs ?? [
    { id: 'mock-in-1', name: 'Mock MIDI Input 1', state: 'connected' },
  ];
  const outputs = options.outputs ?? [
    { id: 'mock-out-1', name: 'Mock MIDI Output 1', state: 'connected' },
  ];
  const sysExEnabled = options.sysExEnabled ?? true;

  const browserInfo: MidiTransportBrowserInfo = {
    supported: true,
    browser: 'Mock MIDI',
    notes: 'Deterministic transport for tests and screenshot capture.',
    ...options.browserInfo,
  };

  let stateHandler: (() => void) | null = null;
  const listeners = new Set<SysExCallback>();
  const sentMessages: number[][] = [];

  const adapter: MidiIO = {
    send: (message: number[]) => {
      sentMessages.push([...message]);
    },
    onSysEx: (callback: SysExCallback) => {
      listeners.add(callback);
    },
    removeSysExListener: (callback: SysExCallback) => {
      listeners.delete(callback);
    },
  };

  const getPorts = (): MidiTransportPorts => ({
    inputs,
    outputs,
    sysExEnabled,
  });

  return {
    transport: {
      kind: 'mock-midi',
      isSupported: () => true,
      getBrowserInfo: () => browserInfo,
      initialize: async () => getPorts(),
      refresh: async () => getPorts(),
      onStateChange: (handler) => {
        stateHandler = handler;
      },
      connect: async (inputId: string, outputId: string): Promise<MidiTransportConnection> => {
        const inputInfo = inputs.find((port) => port.id === inputId);
        const outputInfo = outputs.find((port) => port.id === outputId);
        if (!inputInfo) throw new Error(`Input port not found: ${inputId}`);
        if (!outputInfo) throw new Error(`Output port not found: ${outputId}`);
        return {
          adapter,
          inputInfo,
          outputInfo,
          disconnect: async () => {},
        };
      },
    },
    controls: {
      emitSysEx: (message: number[]) => {
        listeners.forEach((listener) => listener([...message]));
      },
      getSentMessages: () => [...sentMessages],
      triggerStateChange: () => {
        stateHandler?.();
      },
    },
  };
}
