import { create } from 'zustand';
import {
  createWebMidiAdapter,
  getBrowserCompatibility,
  isWebMidiSupported,
  requestMidiAccess,
  type ConnectionStatus,
  type MidiIO,
  type MidiPortInfo,
} from '@audiocontrol/shared-midi';

export interface MidiStoreConfig<TClient> {
  deviceName: string;
  defaultDeviceId: number;
  deviceIdRange: { min: number; max: number };
  createClient?: (adapter: MidiIO, deviceId: number) => TClient;
  destroyClient?: (client: TClient) => void;
}

export interface MidiStoreState<TClient> {
  isSupported: boolean;
  browserInfo: ReturnType<typeof getBrowserCompatibility>;
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

function toPortInfo(port: MIDIInput | MIDIOutput): MidiPortInfo {
  const namePrefix = port.type === 'input' ? 'Input' : 'Output';
  return {
    id: port.id,
    name: port.name ?? `${namePrefix} ${port.id}`,
    ...(port.manufacturer ? { manufacturer: port.manufacturer } : {}),
    state: port.state,
  };
}

function clampDeviceId(value: number, range: { min: number; max: number }): number {
  if (Number.isNaN(value)) return range.min;
  if (value < range.min) return range.min;
  if (value > range.max) return range.max;
  return value;
}

function getInputById(inputs: MIDIInputMap, targetId: string): MIDIInput | null {
  let result: MIDIInput | null = null;
  inputs.forEach((input) => {
    if (input.id === targetId) {
      result = input;
    }
  });
  return result;
}

function getOutputById(outputs: MIDIOutputMap, targetId: string): MIDIOutput | null {
  let result: MIDIOutput | null = null;
  outputs.forEach((output) => {
    if (output.id === targetId) {
      result = output;
    }
  });
  return result;
}

export function createMidiStore<TClient>(config: MidiStoreConfig<TClient>) {
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
    isSupported: isWebMidiSupported(),
    browserInfo: getBrowserCompatibility(),
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

        const access = await requestMidiAccess();
        const rawAccess = await navigator.requestMIDIAccess({ sysex: true });

        set({
          inputs: access.inputs,
          outputs: access.outputs,
          sysExEnabled: access.sysExEnabled,
          midiAccess: rawAccess,
        });

        rawAccess.onstatechange = () => {
          void get().refresh();
        };

        if (saved.inputId && saved.outputId) {
          const inputAvailable = access.inputs.some((port) => port.id === saved.inputId);
          const outputAvailable = access.outputs.some((port) => port.id === saved.outputId);
          if (inputAvailable && outputAvailable) {
            await get().connect(saved.inputId, saved.outputId);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to initialize MIDI';
        set({ error: message, status: 'error' });
      }
    },

    refresh: async () => {
      const { midiAccess } = get();
      if (!midiAccess) {
        await get().initialize();
        return;
      }

      try {
        const inputs: MidiPortInfo[] = [];
        const outputs: MidiPortInfo[] = [];

        midiAccess.inputs.forEach((port) => {
          inputs.push(toPortInfo(port));
        });
        midiAccess.outputs.forEach((port) => {
          outputs.push(toPortInfo(port));
        });

        set({ inputs, outputs, error: null });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to refresh ports';
        set({ error: message });
      }
    },

    connect: async (inputId: string, outputId: string) => {
      const { midiAccess, deviceId, inputs, outputs } = get();
      if (!midiAccess) {
        set({ error: 'MIDI not initialized', status: 'error' });
        return;
      }

      try {
        set({ status: 'connecting', error: null });

        const input = getInputById(midiAccess.inputs, inputId);
        const output = getOutputById(midiAccess.outputs, outputId);
        if (!input) throw new Error(`Input port not found: ${inputId}`);
        if (!output) throw new Error(`Output port not found: ${outputId}`);

        await input.open();
        await output.open();

        const adapter = createWebMidiAdapter(input, output);
        const client = config.createClient ? config.createClient(adapter, deviceId) : null;

        set({
          openPorts: { input, output },
          adapter,
          client,
          selectedInputId: inputId,
          selectedOutputId: outputId,
          selectedInput: inputs.find((port) => port.id === inputId) ?? null,
          selectedOutput: outputs.find((port) => port.id === outputId) ?? null,
          status: 'connected',
        });

        saveToStorage(inputId, outputId, deviceId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to connect';
        set({ error: message, status: 'error' });
      }
    },

    disconnect: async () => {
      const { openPorts, client } = get();

      try {
        if (config.destroyClient && client) {
          config.destroyClient(client);
        }

        if (openPorts.input) await openPorts.input.close();
        if (openPorts.output) await openPorts.output.close();

        set({
          openPorts: { input: null, output: null },
          adapter: null,
          client: null,
          selectedInputId: null,
          selectedOutputId: null,
          selectedInput: null,
          selectedOutput: null,
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
