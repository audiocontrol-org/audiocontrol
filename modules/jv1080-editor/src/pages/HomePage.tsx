import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MidiConnectionPage, type MidiConnectionPageConfig } from '@audiocontrol/editor-core';
import { useMidiStore } from '@/stores/midiStore';

export function HomePage(): JSX.Element {
  const navigate = useNavigate();
  const store = useMidiStore();

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

  return (
    <MidiConnectionPage
      config={config}
      store={store}
      deviceIdRange={{ min: 0, max: 127 }}
      onContinue={() => navigate('/editor')}
    />
  );
}
