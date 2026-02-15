import { create } from 'zustand';
import {
  createWebMidiAdapter,
  getBrowserCompatibility,
  isWebMidiSupported,
  requestMidiAccess,
  type MidiPortInfo,
} from '@audiocontrol/shared-midi';
import { Jv1080Client } from '@audiocontrol/sampler-devices/jv1080';

const STORAGE_KEY_INPUT = 'jv1080-midi-input';
const STORAGE_KEY_OUTPUT = 'jv1080-midi-output';
const STORAGE_KEY_DEVICE_ID = 'jv1080-device-id';

interface MidiState {
  isSupported: boolean;
  browserInfo: ReturnType<typeof getBrowserCompatibility>;
  inputs: MidiPortInfo[];
  outputs: MidiPortInfo[];
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  error: string | null;
  selectedInputId: string | null;
  selectedOutputId: string | null;
  deviceId: number;
  midiAccess: MIDIAccess | null;
  openPorts: { input: MIDIInput | null; output: MIDIOutput | null };
  client: Jv1080Client | null;
  initialize: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
  setSelectedInputId: (id: string) => void;
  setSelectedOutputId: (id: string) => void;
  setDeviceId: (value: number) => void;
}

function loadStored() {
  try {
    const inputId = localStorage.getItem(STORAGE_KEY_INPUT);
    const outputId = localStorage.getItem(STORAGE_KEY_OUTPUT);
    const deviceIdRaw = localStorage.getItem(STORAGE_KEY_DEVICE_ID);
    const parsed = Number.parseInt(deviceIdRaw ?? '16', 10);
    const deviceId = Number.isNaN(parsed) ? 16 : Math.max(0, Math.min(127, parsed));
    return { inputId, outputId, deviceId };
  } catch {
    return { inputId: null, outputId: null, deviceId: 16 };
  }
}

function saveStored(inputId: string | null, outputId: string | null, deviceId: number): void {
  try {
    if (inputId) localStorage.setItem(STORAGE_KEY_INPUT, inputId);
    else localStorage.removeItem(STORAGE_KEY_INPUT);
    if (outputId) localStorage.setItem(STORAGE_KEY_OUTPUT, outputId);
    else localStorage.removeItem(STORAGE_KEY_OUTPUT);
    localStorage.setItem(STORAGE_KEY_DEVICE_ID, String(deviceId));
  } catch {
    // ignore storage failures
  }
}

export const useMidiStore = create<MidiState>((set, get) => ({
  isSupported: isWebMidiSupported(),
  browserInfo: getBrowserCompatibility(),
  inputs: [],
  outputs: [],
  status: 'disconnected',
  error: null,
  selectedInputId: null,
  selectedOutputId: null,
  deviceId: 16,
  midiAccess: null,
  openPorts: { input: null, output: null },
  client: null,

  initialize: async () => {
    if (!get().isSupported) {
      set({ error: 'Web MIDI API not supported in this browser', status: 'error' });
      return;
    }

    try {
      const saved = loadStored();
      const accessInfo = await requestMidiAccess();
      const rawAccess = await navigator.requestMIDIAccess({ sysex: true });

      set({
        inputs: accessInfo.inputs,
        outputs: accessInfo.outputs,
        selectedInputId: saved.inputId,
        selectedOutputId: saved.outputId,
        deviceId: saved.deviceId,
        midiAccess: rawAccess,
        status: 'disconnected',
        error: null,
      });

      rawAccess.onstatechange = () => {
        void get().refresh();
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to initialize MIDI';
      set({ error: message, status: 'error' });
    }
  },

  refresh: async () => {
    const access = get().midiAccess;
    if (!access) return;

    const inputs: MidiPortInfo[] = [];
    const outputs: MidiPortInfo[] = [];

    access.inputs.forEach((port) => {
      inputs.push({
        id: port.id,
        name: port.name ?? `Input ${port.id}`,
        manufacturer: port.manufacturer ?? undefined,
        state: port.state,
      });
    });

    access.outputs.forEach((port) => {
      outputs.push({
        id: port.id,
        name: port.name ?? `Output ${port.id}`,
        manufacturer: port.manufacturer ?? undefined,
        state: port.state,
      });
    });

    set({ inputs, outputs });
  },

  connect: async () => {
    const state = get();
    if (!state.midiAccess || !state.selectedInputId || !state.selectedOutputId) {
      set({ error: 'Select both MIDI ports before connecting', status: 'error' });
      return;
    }

    try {
      set({ status: 'connecting', error: null });

      const input = state.midiAccess.inputs.get(state.selectedInputId);
      const output = state.midiAccess.outputs.get(state.selectedOutputId);
      if (!input || !output) {
        throw new Error('Selected MIDI ports are no longer available');
      }

      await input.open();
      await output.open();

      const adapter = createWebMidiAdapter(input, output);
      const client = new Jv1080Client(adapter, { deviceId: state.deviceId & 0x7f });
      client.connect();

      set({
        openPorts: { input, output },
        status: 'connected',
        error: null,
        client,
      });

      saveStored(state.selectedInputId, state.selectedOutputId, state.deviceId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect MIDI';
      set({ status: 'error', error: message });
    }
  },

  disconnect: async () => {
    const { openPorts, client } = get();
    client?.disconnect();
    if (openPorts.input) await openPorts.input.close();
    if (openPorts.output) await openPorts.output.close();

    set({
      openPorts: { input: null, output: null },
      status: 'disconnected',
      client: null,
      error: null,
    });
  },

  setSelectedInputId: (id: string) => set({ selectedInputId: id || null }),
  setSelectedOutputId: (id: string) => set({ selectedOutputId: id || null }),
  setDeviceId: (value: number) => {
    const clamped = Math.max(0, Math.min(127, Math.floor(value)));
    set({ deviceId: clamped });
    const { selectedInputId, selectedOutputId } = get();
    saveStored(selectedInputId, selectedOutputId, clamped);
  },
}));
