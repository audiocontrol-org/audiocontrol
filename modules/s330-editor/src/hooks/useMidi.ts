/**
 * React hook for Web MIDI API state management
 */

import { useState, useEffect, useCallback } from 'react';
import type { MidiPortInfo, ConnectionStatus, S330MidiIO } from '@/core/midi/types';
import {
  isWebMidiSupported,
  getBrowserCompatibility,
  requestMidiAccess,
  createWebMidiAdapter,
} from '@/core/midi/WebMidiAdapter';

export interface UseMidiState {
  isSupported: boolean;
  browserInfo: { supported: boolean; browser: string; notes: string };
  inputs: MidiPortInfo[];
  outputs: MidiPortInfo[];
  sysExEnabled: boolean;
  status: ConnectionStatus;
  error: string | null;
  selectedInput: MidiPortInfo | null;
  selectedOutput: MidiPortInfo | null;
  adapter: S330MidiIO | null;
}

export interface UseMidiActions {
  refresh: () => Promise<void>;
  connect: (inputId: string, outputId: string) => Promise<void>;
  disconnect: () => Promise<void>;
}

export type UseMidiReturn = UseMidiState & UseMidiActions;

/**
 * Hook for managing Web MIDI connection
 */
export function useMidi(): UseMidiReturn {
  const [isSupported] = useState(() => isWebMidiSupported());
  const [browserInfo] = useState(() => getBrowserCompatibility());
  const [inputs, setInputs] = useState<MidiPortInfo[]>([]);
  const [outputs, setOutputs] = useState<MidiPortInfo[]>([]);
  const [sysExEnabled, setSysExEnabled] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [selectedInput, setSelectedInput] = useState<MidiPortInfo | null>(null);
  const [selectedOutput, setSelectedOutput] = useState<MidiPortInfo | null>(null);
  const [adapter, setAdapter] = useState<S330MidiIO | null>(null);
  const [midiAccess, setMidiAccess] = useState<MIDIAccess | null>(null);
  const [openPorts, setOpenPorts] = useState<{ input: MIDIInput | null; output: MIDIOutput | null }>({
    input: null,
    output: null,
  });

  /**
   * Refresh available MIDI ports
   */
  const refresh = useCallback(async () => {
    if (!isSupported) {
      setError('Web MIDI API not supported');
      return;
    }

    try {
      setError(null);
      const access = await requestMidiAccess();
      setInputs(access.inputs);
      setOutputs(access.outputs);
      setSysExEnabled(access.sysExEnabled);

      // Store raw MIDIAccess for later use
      const rawAccess = await navigator.requestMIDIAccess({ sysex: true });
      setMidiAccess(rawAccess);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to access MIDI';
      setError(message);
      setStatus('error');
    }
  }, [isSupported]);

  /**
   * Connect to selected MIDI ports
   */
  const connect = useCallback(async (inputId: string, outputId: string) => {
    if (!midiAccess) {
      setError('MIDI not initialized. Call refresh() first.');
      return;
    }

    try {
      setStatus('connecting');
      setError(null);

      const input = midiAccess.inputs.get(inputId);
      const output = midiAccess.outputs.get(outputId);

      if (!input) {
        throw new Error(`Input port not found: ${inputId}`);
      }
      if (!output) {
        throw new Error(`Output port not found: ${outputId}`);
      }

      await input.open();
      await output.open();

      const newAdapter = createWebMidiAdapter(input, output);

      setOpenPorts({ input, output });
      setAdapter(newAdapter);
      setSelectedInput(inputs.find((p) => p.id === inputId) ?? null);
      setSelectedOutput(outputs.find((p) => p.id === outputId) ?? null);
      setStatus('connected');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect';
      setError(message);
      setStatus('error');
    }
  }, [midiAccess, inputs, outputs]);

  /**
   * Disconnect from MIDI ports
   */
  const disconnect = useCallback(async () => {
    try {
      if (openPorts.input) {
        await openPorts.input.close();
      }
      if (openPorts.output) {
        await openPorts.output.close();
      }

      setOpenPorts({ input: null, output: null });
      setAdapter(null);
      setSelectedInput(null);
      setSelectedOutput(null);
      setStatus('disconnected');
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to disconnect';
      setError(message);
    }
  }, [openPorts]);

  // Initialize on mount
  useEffect(() => {
    if (isSupported) {
      refresh();
    }
  }, [isSupported, refresh]);

  return {
    isSupported,
    browserInfo,
    inputs,
    outputs,
    sysExEnabled,
    status,
    error,
    selectedInput,
    selectedOutput,
    adapter,
    refresh,
    connect,
    disconnect,
  };
}
