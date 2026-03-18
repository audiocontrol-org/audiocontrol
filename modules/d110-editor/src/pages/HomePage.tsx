import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MidiConnectionPage, useHomePageStore, type MidiConnectionPageConfig } from '@audiocontrol/editor-core';
import { useMidiStore } from '@/stores';

export function HomePage(): JSX.Element {
  const navigate = useNavigate();
  const midi = useMidiStore();
  const pageStore = useHomePageStore('d110', midi);

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

  return (
    <div className="ac-page">
      <MidiConnectionPage
        config={config}
        store={pageStore}
        deviceIdRange={{ min: 17, max: 32 }}
        onContinue={() => navigate('/tones')}
      />
    </div>
  );
}
