import { useEffect, useState } from 'react';
import type { MidiPortInfo } from '@audiocontrol/shared-midi';
import type { MidiConnectionPageStore } from '../components/MidiConnectionPage';

export interface HomePageMidiStore {
  isSupported: boolean;
  browserInfo: { browser: string; notes: string; requiresSecureContext?: boolean };
  sysExEnabled?: boolean;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  error: string | null;
  inputs: MidiPortInfo[];
  outputs: MidiPortInfo[];
  selectedInputId: string | null;
  selectedOutputId: string | null;
  deviceId: number;
  setDeviceId: (id: number) => void;
  refresh: () => Promise<void>;
  connect: (inputId: string, outputId: string) => Promise<void>;
  disconnect: () => Promise<void>;
}

export function useHomePageStore(
  storageKeyPrefix: string,
  midi: HomePageMidiStore,
): MidiConnectionPageStore {
  const [selectedInputId, setSelectedInputId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(`${storageKeyPrefix}-midi-input`);
    } catch {
      return null;
    }
  });
  const [selectedOutputId, setSelectedOutputId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(`${storageKeyPrefix}-midi-output`);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (midi.status === 'connected' && midi.selectedInputId && midi.selectedOutputId) {
      setSelectedInputId(midi.selectedInputId);
      setSelectedOutputId(midi.selectedOutputId);
    }
  }, [midi.status, midi.selectedInputId, midi.selectedOutputId]);

  return {
    isSupported: midi.isSupported,
    browserInfo: midi.browserInfo,
    sysExEnabled: midi.sysExEnabled,
    status: midi.status,
    error: midi.error,
    inputs: midi.inputs,
    outputs: midi.outputs,
    selectedInputId,
    selectedOutputId,
    deviceId: midi.deviceId,
    setSelectedInputId,
    setSelectedOutputId,
    setDeviceId: midi.setDeviceId,
    refresh: midi.refresh,
    connect: async () => {
      if (selectedInputId && selectedOutputId) {
        await midi.connect(selectedInputId, selectedOutputId);
      }
    },
    disconnect: async () => {
      await midi.disconnect();
      setSelectedInputId(null);
      setSelectedOutputId(null);
    },
  };
}
