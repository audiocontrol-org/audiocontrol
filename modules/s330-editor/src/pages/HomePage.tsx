import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MidiConnectionPage, type MidiConnectionPageConfig, type MidiConnectionPageStore } from '@audiocontrol/editor-core';
import { useMidiStore } from '@/stores/midiStore';

const STORAGE_KEY_INPUT = 's330-midi-input';
const STORAGE_KEY_OUTPUT = 's330-midi-output';

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
    deviceName: 'S-330',
    inputLabel: 'MIDI Input (from S-330)',
    outputLabel: 'MIDI Output (to S-330)',
    deviceIdLabel: 'Device ID',
    deviceIdHelpText: 'Enter the Device ID shown on your S-330 screen (MIDI -> Device ID).',
    continueLabel: 'Continue to Patches',
    helpItems: [
      'Connect your S-330 using a MIDI interface.',
      'Choose MIDI ports matching your interface or S-330.',
      'Allow SysEx permission when prompted.',
      'S-330 displays IDs 1-17 but protocol values are 0-16.',
    ],
    secureContextTitle: 'Secure Connection Required',
    secureContextHelpItems: [
      'Use localhost or 127.0.0.1 for local development.',
      'Or deploy this editor using HTTPS.',
    ],
    deviceIdDisplayOffset: 1,
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
        deviceIdRange={{ min: 0, max: 16 }}
        onContinue={() => navigate('/patches')}
      />
    </div>
  );
}
