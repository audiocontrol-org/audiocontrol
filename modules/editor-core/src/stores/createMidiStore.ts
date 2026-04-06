import { create } from 'zustand';
import {
  type ConnectionStatus,
  type MidiIO,
  type MidiPortInfo,
} from '@audiocontrol/midi-core';
import { createWebMidiTransport } from '../transports/webMidiTransport';
import type { MidiTransport, MidiTransportConnection, MidiTransportPorts } from '../transports/types';

export interface MidiStoreConfig<TClient> {
  deviceName: string;
  defaultDeviceId: number;
  deviceIdRange: { min: number; max: number };
  transport?: MidiTransport;
  createClient?: (adapter: MidiIO, deviceId: number) => TClient;
  destroyClient?: (client: TClient) => void;
}

export interface MidiStoreState<TClient> {
  isSupported: boolean;
  browserInfo: { browser: string; notes: string; supported: boolean; requiresSecureContext?: boolean };
  inputs: MidiPortInfo[];
  outputs: MidiPortInfo[];
  sysExEnabled: boolean;
  status: ConnectionStatus;
  error: string | null;
  selectedInputId: string | null;
  selectedOutputId: string | null;
  selectedInput: MidiPortInfo | null;
  selectedOutput: MidiPortInfo | null;
  adapter: MidiIO | null;
  client: TClient | null;
  deviceId: number;
  midiAccess: MIDIAccess | null;
  openPorts: { input: MIDIInput | null; output: MIDIOutput | null };
}

export interface MidiStoreActions {
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  connect: (inputId: string, outputId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  setDeviceId: (id: number) => void;
  sendPanic: () => void;
}

export type MidiStore<TClient> = MidiStoreState<TClient> & MidiStoreActions;

function clampDeviceId(value: number, range: { min: number; max: number }): number {
  if (Number.isNaN(value)) return range.min;
  if (value < range.min) return range.min;
  if (value > range.max) return range.max;
  return value;
}

export function createMidiStore<TClient>(config: MidiStoreConfig<TClient>) {
  const transport = config.transport ?? createWebMidiTransport();
  let activeConnection: MidiTransportConnection | null = null;

  const storageKeyInput = `${config.deviceName}-midi-input`;
  const storageKeyOutput = `${config.deviceName}-midi-output`;
  const storageKeyDeviceId = `${config.deviceName}-device-id`;

  function saveToStorage(inputId: string | null, outputId: string | null, deviceId: number): void {
    try {
      if (inputId) localStorage.setItem(storageKeyInput, inputId);
      else localStorage.removeItem(storageKeyInput);
      if (outputId) localStorage.setItem(storageKeyOutput, outputId);
      else localStorage.removeItem(storageKeyOutput);
      localStorage.setItem(storageKeyDeviceId, String(deviceId));
    } catch (error) {
      console.warn('[createMidiStore] Failed to save to localStorage', error);
    }
  }

  function loadFromStorage(): { inputId: string | null; outputId: string | null; deviceId: number } {
    try {
      const inputId = localStorage.getItem(storageKeyInput);
      const outputId = localStorage.getItem(storageKeyOutput);
      const rawDeviceId = localStorage.getItem(storageKeyDeviceId);
      const parsedDeviceId = rawDeviceId ? Number.parseInt(rawDeviceId, 10) : config.defaultDeviceId;
      return {
        inputId,
        outputId,
        deviceId: clampDeviceId(parsedDeviceId, config.deviceIdRange),
      };
    } catch (error) {
      console.warn('[createMidiStore] Failed to load from localStorage', error);
      return {
        inputId: null,
        outputId: null,
        deviceId: config.defaultDeviceId,
      };
    }
  }

  return create<MidiStore<TClient>>((set, get) => ({
    isSupported: transport.isSupported(),
    browserInfo: transport.getBrowserInfo(),
    inputs: [],
    outputs: [],
    sysExEnabled: false,
    status: 'disconnected',
    error: null,
    selectedInputId: null,
    selectedOutputId: null,
    selectedInput: null,
    selectedOutput: null,
    adapter: null,
    client: null,
    deviceId: config.defaultDeviceId,
    midiAccess: null,
    openPorts: { input: null, output: null },

    initialize: async () => {
      const { isSupported } = get();
      if (!isSupported) {
        set({ error: 'Web MIDI API not supported in this browser', status: 'error' });
        return;
      }

      try {
        set({ error: null });
        const saved = loadFromStorage();
        set({ deviceId: saved.deviceId });

        const ports = await transport.initialize();
        set({
          inputs: ports.inputs,
          outputs: ports.outputs,
          sysExEnabled: ports.sysExEnabled,
          midiAccess: transport.getNativeAccess ? transport.getNativeAccess() : null,
        });

        transport.onStateChange(() => {
          void get().refresh();
        });

        // Restore saved port selection or auto-connect
        const savedInputAvailable = saved.inputId && ports.inputs.some((p) => p.id === saved.inputId);
        const savedOutputAvailable = saved.outputId && ports.outputs.some((p) => p.id === saved.outputId);

        if (savedInputAvailable && savedOutputAvailable) {
          await get().connect(saved.inputId!, saved.outputId!);
        } else if (transport.kind !== 'web-midi' && ports.inputs.length > 0 && ports.outputs.length > 0) {
          // Non-web transports auto-connect to the first device
          await get().connect(ports.inputs[0].id, ports.outputs[0].id);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to initialize MIDI';
        console.error('[MidiStore] Initialization failed:', message);
        set({ error: message, status: 'error' });
      }
    },

    refresh: async () => {
      if (!get().isSupported) return;
      try {
        const ports = await transport.refresh();
        set({
          inputs: ports.inputs,
          outputs: ports.outputs,
          sysExEnabled: ports.sysExEnabled,
          midiAccess: transport.getNativeAccess ? transport.getNativeAccess() : null,
          error: null,
        });
      } catch (error) {
        // Some transports require initialize before refresh.
        await get().initialize();
      }
    },

    connect: async (inputId: string, outputId: string) => {
      const { deviceId, inputs, outputs } = get();
      if (!get().isSupported) {
        set({ error: 'MIDI not initialized', status: 'error' });
        return;
      }

      try {
        set({ status: 'connecting', error: null });

        const connection = await transport.connect(inputId, outputId);
        activeConnection = connection;
        const client = config.createClient ? config.createClient(connection.adapter, deviceId) : null;

        set({
          openPorts: { input: connection.nativeInput ?? null, output: connection.nativeOutput ?? null },
          adapter: connection.adapter,
          client,
          selectedInputId: inputId,
          selectedOutputId: outputId,
          selectedInput: inputs.find((port) => port.id === inputId) ?? connection.inputInfo,
          selectedOutput: outputs.find((port) => port.id === outputId) ?? connection.outputInfo,
          status: 'connected',
        });

        saveToStorage(inputId, outputId, deviceId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to connect';
        console.error('[MidiStore] Connection failed:', message);
        set({ error: message, status: 'error' });
      }
    },

    disconnect: async () => {
      const { client } = get();

      try {
        if (config.destroyClient && client) {
          config.destroyClient(client);
        }

        if (activeConnection) {
          await activeConnection.disconnect();
          activeConnection = null;
        }

        set({
          openPorts: { input: null, output: null },
          adapter: null,
          client: null,
          selectedInputId: null,
          selectedOutputId: null,
          selectedInput: null,
          selectedOutput: null,
          midiAccess: transport.getNativeAccess ? transport.getNativeAccess() : null,
          status: 'disconnected',
          error: null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to disconnect';
        set({ error: message });
      }
    },

    setDeviceId: (id: number) => {
      if (id < config.deviceIdRange.min || id > config.deviceIdRange.max) return;

      const { selectedInputId, selectedOutputId, adapter, client } = get();
      let nextClient = client;

      if (adapter && config.createClient) {
        if (config.destroyClient && client) {
          config.destroyClient(client);
        }
        nextClient = config.createClient(adapter, id);
      }

      set({ deviceId: id, client: nextClient });
      saveToStorage(selectedInputId, selectedOutputId, id);
    },

    sendPanic: () => {
      const { adapter } = get();
      if (!adapter) return;

      for (let channel = 0; channel < 16; channel += 1) {
        const status = 0xb0 + channel;
        adapter.send([status, 120, 0]);
        adapter.send([status, 123, 0]);
      }
    },
  }));
}
