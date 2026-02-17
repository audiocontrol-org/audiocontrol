import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MidiConnectionPage,
  type MidiConnectionPageConfig,
  type MidiConnectionPageStore,
} from '@audiocontrol/editor-core';
import { useMidiStore } from '@/stores/midiStore';

const STORAGE_KEY_INPUT = 'jv1080-midi-input';
const STORAGE_KEY_OUTPUT = 'jv1080-midi-output';

export function HomePage(): JSX.Element {
  const navigate = useNavigate();
  const midi = useMidiStore();

  const [selectedInputId, setSelectedInputId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_INPUT);
    } catch {
      return null;
    }
  });
  const [selectedOutputId, setSelectedOutputId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_OUTPUT);
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

  const config: MidiConnectionPageConfig = useMemo(() => ({
    deviceName: 'JV-1080',
    inputLabel: 'MIDI Input (from JV-1080)',
    outputLabel: 'MIDI Output (to JV-1080)',
    deviceIdLabel: 'Device ID',
    deviceIdHelpText: 'Set the JV-1080 device ID to match your hardware.',
    continueLabel: 'Continue to Editor',
    helpItems: [
      'Connect your JV-1080 through a MIDI interface.',
      'Pick MIDI ports that correspond to your interface or JV-1080.',
      'Enable SysEx permission when prompted.',
      'Device ID must match the value configured on the hardware.',
    ],
  }), []);

  const pageStore: MidiConnectionPageStore = {
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

  return (
    <div className="ac-page">
      <MidiConnectionPage
        config={config}
        store={pageStore}
        deviceIdRange={{ min: 0, max: 127 }}
        onContinue={() => navigate('/editor')}
      />
    </div>
  );
}
