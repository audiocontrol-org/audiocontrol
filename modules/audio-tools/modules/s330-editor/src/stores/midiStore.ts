/**
 * Zustand store for MIDI connection state
 */

import { create } from 'zustand';
import type { MidiPortInfo, ConnectionStatus, S330MidiIO } from '@/core/midi/types';
import {
  isWebMidiSupported,
  getBrowserCompatibility,
  requestMidiAccess,
  createWebMidiAdapter,
} from '@/core/midi/WebMidiAdapter';

interface MidiState {
  isSupported: boolean;
  browserInfo: { supported: boolean; browser: string; notes: string };
  inputs: MidiPortInfo[];
  outputs: MidiPortInfo[];
  sysExEnabled: boolean;
  status: ConnectionStatus;
  error: string | null;
  selectedInputId: string | null;
  selectedOutputId: string | null;
  selectedInput: MidiPortInfo | null;
  selectedOutput: MidiPortInfo | null;
  adapter: S330MidiIO | null;
  deviceId: number;
  midiAccess: MIDIAccess | null;
  openPorts: { input: MIDIInput | null; output: MIDIOutput | null };
}

interface MidiActions {
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  connect: (inputId: string, outputId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  setDeviceId: (id: number) => void;
}

type MidiStore = MidiState & MidiActions;

export const useMidiStore = create<MidiStore>((set, get) => ({
  // Initial state
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
  deviceId: 0,
  midiAccess: null,
  openPorts: { input: null, output: null },

  /**
   * Initialize MIDI access
   */
  initialize: async () => {
    const { isSupported } = get();
    if (!isSupported) {
      set({ error: 'Web MIDI API not supported in this browser' });
      return;
    }

    try {
      set({ error: null });
      const access = await requestMidiAccess();
      const rawAccess = await navigator.requestMIDIAccess({ sysex: true });

      set({
        inputs: access.inputs,
        outputs: access.outputs,
        sysExEnabled: access.sysExEnabled,
        midiAccess: rawAccess,
      });

      // Listen for device changes
      rawAccess.onstatechange = () => {
        get().refresh();
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize MIDI';
      set({ error: message, status: 'error' });
    }
  },

  /**
   * Refresh port list
   */
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
        inputs.push({
          id: port.id,
          name: port.name ?? `Input ${port.id}`,
          manufacturer: port.manufacturer ?? undefined,
          state: port.state,
        });
      });

      midiAccess.outputs.forEach((port) => {
        outputs.push({
          id: port.id,
          name: port.name ?? `Output ${port.id}`,
          manufacturer: port.manufacturer ?? undefined,
          state: port.state,
        });
      });

      set({ inputs, outputs, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh ports';
      set({ error: message });
    }
  },

  /**
   * Connect to selected ports
   */
  connect: async (inputId: string, outputId: string) => {
    const { midiAccess, inputs, outputs } = get();
    if (!midiAccess) {
      set({ error: 'MIDI not initialized' });
      return;
    }

    try {
      set({ status: 'connecting', error: null });

      const input = midiAccess.inputs.get(inputId);
      const output = midiAccess.outputs.get(outputId);

      if (!input) throw new Error(`Input port not found: ${inputId}`);
      if (!output) throw new Error(`Output port not found: ${outputId}`);

      await input.open();
      await output.open();

      const adapter = createWebMidiAdapter(input, output);

      set({
        openPorts: { input, output },
        adapter,
        selectedInputId: inputId,
        selectedOutputId: outputId,
        selectedInput: inputs.find((p) => p.id === inputId) ?? null,
        selectedOutput: outputs.find((p) => p.id === outputId) ?? null,
        status: 'connected',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect';
      set({ error: message, status: 'error' });
    }
  },

  /**
   * Disconnect from ports
   */
  disconnect: async () => {
    const { openPorts } = get();

    try {
      if (openPorts.input) await openPorts.input.close();
      if (openPorts.output) await openPorts.output.close();

      set({
        openPorts: { input: null, output: null },
        adapter: null,
        selectedInputId: null,
        selectedOutputId: null,
        selectedInput: null,
        selectedOutput: null,
        status: 'disconnected',
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to disconnect';
      set({ error: message });
    }
  },

  /**
   * Set device ID (protocol value 0-16)
   *
   * Note: The S-330 displays device IDs as 1-17, but uses 0-16 in the protocol.
   * The UI converts display values (1-17) to protocol values (0-16).
   */
  setDeviceId: (id: number) => {
    if (id >= 0 && id <= 16) {
      set({ deviceId: id });
    }
  },
}));
