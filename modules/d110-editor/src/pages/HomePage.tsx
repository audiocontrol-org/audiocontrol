import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MidiConnectionPage, type MidiConnectionPageConfig, type MidiConnectionPageStore } from '@audiocontrol/editor-core';
import { useMidiStore } from '@/stores';

const STORAGE_KEY_INPUT = 'd110-midi-input';
const STORAGE_KEY_OUTPUT = 'd110-midi-output';

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
    deviceName: 'D-110',
    inputLabel: 'MIDI Input (from D-110)',
    outputLabel: 'MIDI Output (to D-110)',
    deviceIdLabel: 'Device ID',
    deviceIdHelpText: 'Enter the Device ID configured on your D-110 (MIDI -> Rx CH -> DevNo).',
    continueLabel: 'Continue to Tones',
    helpItems: [
      'Connect your D-110 using a MIDI interface.',
      'Choose MIDI ports matching your interface or D-110.',
      'Allow SysEx permission when prompted.',
      'Device ID must match your D-110 setting (default 17).',
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
    <MidiConnectionPage
      config={config}
      store={pageStore}
      deviceIdRange={{ min: 17, max: 32 }}
      onContinue={() => navigate('/tones')}
    />
  );
}
