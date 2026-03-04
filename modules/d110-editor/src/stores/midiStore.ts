/**
 * Zustand store for MIDI connection state
 *
 * Manages WebMIDI connection to the D-110 synthesizer.
 * Persists port selection to localStorage for auto-reconnect.
 */

import { create } from 'zustand';
import type {
  MidiPortInfo,
  ConnectionStatus,
  D110MidiIO,
  D110ClientInterface,
  ScanStatus,
  D110ScanResult,
  D110Scanner,
} from '@/core/midi/types';
import {
  isWebMidiSupported,
  getBrowserCompatibility,
  requestMidiAccess,
  createWebMidiAdapter,
} from '@audiocontrol/shared-midi';
import { createD110Client } from '@/core/midi/D110Client';
import { createD110Scanner } from '@/core/midi/D110Scanner';

// localStorage keys
const STORAGE_KEY_INPUT = 'd110-midi-input';
const STORAGE_KEY_OUTPUT = 'd110-midi-output';
const STORAGE_KEY_DEVICE_ID = 'd110-device-id';

function saveToStorage(inputId: string | null, outputId: string | null, deviceId: number): void {
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

function loadFromStorage(): { inputId: string | null; outputId: string | null; deviceId: number } {
  try {
    const inputId = localStorage.getItem(STORAGE_KEY_INPUT);
    const outputId = localStorage.getItem(STORAGE_KEY_OUTPUT);
    const deviceIdStr = localStorage.getItem(STORAGE_KEY_DEVICE_ID);
    const deviceId = deviceIdStr ? parseInt(deviceIdStr, 10) : 17; // Default to 17
    return { inputId, outputId, deviceId: isNaN(deviceId) ? 17 : deviceId };
  } catch (e) {
    console.warn('[MidiStore] Failed to load from localStorage:', e);
    return { inputId: null, outputId: null, deviceId: 17 };
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
  adapter: D110MidiIO | null;
  client: D110ClientInterface | null;
  deviceId: number; // User-facing device ID (17-32)
  midiAccess: MIDIAccess | null;
  openPorts: { input: MIDIInput | null; output: MIDIOutput | null };
  // Scanner state
  scanStatus: ScanStatus;
  scanProgress: string;
  foundDevices: D110ScanResult[];
  scanError: string | null;
  scanner: D110Scanner | null;
}

interface MidiActions {
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  connect: (inputId: string, outputId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  setDeviceId: (id: number) => void;
  sendPanic: () => void;
  // Scanner actions
  startScan: () => Promise<void>;
  cancelScan: () => void;
  selectFoundDevice: (device: D110ScanResult) => Promise<void>;
  dismissScanResults: () => void;
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
  client: null,
  deviceId: 17, // Default D-110 device ID
  midiAccess: null,
  openPorts: { input: null, output: null },
  // Scanner state
  scanStatus: 'idle',
  scanProgress: '',
  foundDevices: [],
  scanError: null,
  scanner: null,

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
        void get().refresh();
      };

      // Auto-connect if we have saved port IDs and they're available
      if (saved.inputId && saved.outputId) {
        const inputAvailable = access.inputs.some((p) => p.id === saved.inputId);
        const outputAvailable = access.outputs.some((p) => p.id === saved.outputId);

        if (inputAvailable && outputAvailable) {
          console.log('[MidiStore] Auto-connecting to saved ports...');
          await get().connect(saved.inputId, saved.outputId);
        } else {
          // Saved ports not available, trigger auto-scan after short delay
          console.log('[MidiStore] Saved ports not available, starting auto-scan...');
          setTimeout(() => {
            void get().startScan();
          }, 500);
        }
      } else {
        // No saved ports, trigger auto-scan after short delay
        console.log('[MidiStore] No saved ports, starting auto-scan...');
        setTimeout(() => {
          void get().startScan();
        }, 500);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize MIDI';
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

  connect: async (inputId: string, outputId: string) => {
    const { midiAccess, deviceId, inputs, outputs } = get();
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

      // Create D-110 client with device ID (convert from user ID 17-32 to SysEx ID 0x10-0x1F)
      const client = createD110Client(adapter, { deviceId: deviceId - 1 });

      set({
        openPorts: { input, output },
        adapter,
        client,
        selectedInputId: inputId,
        selectedOutputId: outputId,
        selectedInput: inputs.find((p) => p.id === inputId) ?? null,
        selectedOutput: outputs.find((p) => p.id === outputId) ?? null,
        status: 'connected',
      });

      saveToStorage(inputId, outputId, deviceId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect';
      set({ error: message, status: 'error' });
    }
  },

  disconnect: async () => {
    const { openPorts } = get();

    try {
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to disconnect';
      set({ error: message });
    }
  },

  setDeviceId: (id: number) => {
    if (id >= 17 && id <= 32) {
      set({ deviceId: id });
      const { selectedInputId, selectedOutputId, adapter } = get();
      saveToStorage(selectedInputId, selectedOutputId, id);

      // Recreate client with new device ID if connected
      if (adapter) {
        const client = createD110Client(adapter, { deviceId: id - 1 });
        set({ client });
      }
    }
  },

  sendPanic: () => {
    const { adapter } = get();
    if (!adapter) {
      console.warn('[MidiStore] Cannot send panic: no MIDI adapter connected');
      return;
    }

    // Send All Sound Off and All Notes Off on all 16 channels
    for (let channel = 0; channel < 16; channel++) {
      const status = 0xb0 + channel;
      adapter.send([status, 120, 0]); // All Sound Off
      adapter.send([status, 123, 0]); // All Notes Off
    }
    console.log('[MidiStore] Panic: sent All Sound Off and All Notes Off on all channels');
  },

  startScan: async () => {
    const { midiAccess, scanner: existingScanner, scanStatus } = get();
    if (!midiAccess) {
      set({ scanError: 'MIDI not initialized', scanStatus: 'error' });
      return;
    }

    // Prevent duplicate scans (React Strict Mode triggers twice)
    if (scanStatus === 'scanning' || existingScanner?.isScanning()) {
      console.log('[MidiStore] Scan already in progress, ignoring duplicate request');
      return;
    }

    const scanner = createD110Scanner(midiAccess, {
      onProgress: (message) => {
        set({ scanProgress: message });
      },
      stopOnFirstDevice: false, // Scan for ALL devices
      onDeviceFound: (device) => {
        // Immediately update UI when device is found - show as option, don't auto-connect
        console.log('[MidiStore] Device found during scan, showing as option');
        const { foundDevices } = get();
        set({
          scanStatus: 'found',
          foundDevices: [...foundDevices, device],
          scanProgress: `Found D-110 on ${device.outputPortName}`,
        });
      },
    });

    set({
      scanner,
      scanStatus: 'scanning',
      scanProgress: 'Starting scan...',
      foundDevices: [],
      scanError: null,
    });

    try {
      const results = await scanner.scan();

      // Update with final results
      if (results.length === 0) {
        set({ scanStatus: 'not_found', scanProgress: '' });
      } else {
        // Show found devices as options - user clicks to connect
        set({
          scanStatus: 'found',
          foundDevices: results,
          scanProgress: '',
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Scan failed';
      set({ scanError: message, scanStatus: 'error', scanProgress: '' });
    }
  },

  cancelScan: () => {
    const { scanner } = get();
    if (scanner?.isScanning()) {
      scanner.cancel();
    }
    set({ scanStatus: 'idle', scanProgress: '', foundDevices: [] });
  },

  selectFoundDevice: async (device: D110ScanResult) => {
    // Set the device ID from the scan result
    set({ deviceId: device.userDeviceId });
    saveToStorage(device.inputPortId, device.outputPortId, device.userDeviceId);

    // Connect to the device
    await get().connect(device.inputPortId, device.outputPortId);

    // Clear scan state after successful connection
    const { status } = get();
    if (status === 'connected') {
      set({ scanStatus: 'idle', foundDevices: [] });
    }
  },

  dismissScanResults: () => {
    set({ scanStatus: 'idle', scanProgress: '', foundDevices: [], scanError: null });
  },
}));
