/**
 * Zustand store for MIDI connection state
 *
 * Persists port selection to localStorage for auto-reconnect
 */

import { create } from 'zustand';
import type { MidiPortInfo, ConnectionStatus, S330MidiIO } from '@/core/midi/types';
import {
  isWebMidiSupported,
  getBrowserCompatibility,
  requestMidiAccess,
  createWebMidiAdapter,
} from '@/core/midi/WebMidiAdapter';

// localStorage keys
const STORAGE_KEY_INPUT = 's330-midi-input';
const STORAGE_KEY_OUTPUT = 's330-midi-output';
const STORAGE_KEY_DEVICE_ID = 's330-device-id';

// Helper to save to localStorage
function saveToStorage(inputId: string | null, outputId: string | null, deviceId: number) {
  try {
    if (inputId) localStorage.setItem(STORAGE_KEY_INPUT, inputId);
    else localStorage.removeItem(STORAGE_KEY_INPUT);
    if (outputId) localStorage.setItem(STORAGE_KEY_OUTPUT, outputId);
    else localStorage.removeItem(STORAGE_KEY_OUTPUT);
    localStorage.setItem(STORAGE_KEY_DEVICE_ID, String(deviceId));
  } catch (e) {
    console.warn('[MidiStore] Failed to save to localStorage:', e);
  }
}

// Helper to load from localStorage
function loadFromStorage(): { inputId: string | null; outputId: string | null; deviceId: number } {
  try {
    const inputId = localStorage.getItem(STORAGE_KEY_INPUT);
    const outputId = localStorage.getItem(STORAGE_KEY_OUTPUT);
    const deviceIdStr = localStorage.getItem(STORAGE_KEY_DEVICE_ID);
    const deviceId = deviceIdStr ? parseInt(deviceIdStr, 10) : 0;
    return { inputId, outputId, deviceId: isNaN(deviceId) ? 0 : deviceId };
  } catch (e) {
    console.warn('[MidiStore] Failed to load from localStorage:', e);
    return { inputId: null, outputId: null, deviceId: 0 };
  }
}

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
  sendPanic: () => void;
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
   * Initialize MIDI access and auto-connect to saved ports
   */
  initialize: async () => {
    const { isSupported } = get();
    if (!isSupported) {
      set({ error: 'Web MIDI API not supported in this browser' });
      return;
    }

    try {
      set({ error: null });

      // Load saved preferences
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

      // Listen for device changes
      rawAccess.onstatechange = () => {
        get().refresh();
      };

      // Auto-connect if we have saved port IDs and they're available
      if (saved.inputId && saved.outputId) {
        const inputAvailable = access.inputs.some((p) => p.id === saved.inputId);
        const outputAvailable = access.outputs.some((p) => p.id === saved.outputId);

        if (inputAvailable && outputAvailable) {
          console.log('[MidiStore] Auto-connecting to saved ports...');
          await get().connect(saved.inputId, saved.outputId);
        } else {
          console.log('[MidiStore] Saved ports not available, skipping auto-connect');
        }
      }
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

      // Save to localStorage for auto-reconnect
      saveToStorage(inputId, outputId, get().deviceId);
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
      // Save to localStorage
      const { selectedInputId, selectedOutputId } = get();
      saveToStorage(selectedInputId, selectedOutputId, id);
    }
  },

  /**
   * Send MIDI panic: All Sound Off (CC#120) and All Notes Off (CC#123) on all channels.
   * This immediately silences all notes. Use when notes get stuck during heavy SysEx traffic.
   */
  sendPanic: () => {
    const { adapter } = get();
    if (!adapter) {
      console.warn('[MidiStore] Cannot send panic: no MIDI adapter connected');
      return;
    }

    // Send All Sound Off (CC#120) and All Notes Off (CC#123) on all 16 channels
    for (let channel = 0; channel < 16; channel++) {
      const status = 0xb0 + channel; // Control Change status byte
      // CC#120 - All Sound Off (immediate silence)
      adapter.send([status, 120, 0]);
      // CC#123 - All Notes Off (release all held notes)
      adapter.send([status, 123, 0]);
    }
    console.log('[MidiStore] Panic: sent All Sound Off and All Notes Off on all channels');
  },
}));

// Expose store on window for E2E testing
declare global {
  interface Window {
    __midiStore?: typeof useMidiStore;
  }
}

if (typeof window !== 'undefined') {
  window.__midiStore = useMidiStore;
}
