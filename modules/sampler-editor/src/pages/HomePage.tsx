import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MidiConnectionPage, useHomePageStore, type MidiConnectionPageConfig } from '@audiocontrol/editor-core';
import { useMidiStore } from '@/stores/midiStore';
import { useDeviceConfig } from '@/context/DeviceConfigContext';

export function HomePage(): JSX.Element {
  const navigate = useNavigate();
  const midi = useMidiStore();
  const { deviceType, deviceName } = useDeviceConfig();
  const pageStore = useHomePageStore(deviceType, midi);

  const config: MidiConnectionPageConfig = useMemo(() => ({
    deviceName,
    inputLabel: `MIDI Input (from ${deviceName})`,
    outputLabel: `MIDI Output (to ${deviceName})`,
    deviceIdLabel: 'Device ID',
    deviceIdHelpText: `Enter the Device ID shown on your ${deviceName} screen (MIDI -> Device ID).`,
    continueLabel: 'Continue to Patches',
    helpItems: [
      `Connect your ${deviceName} using a MIDI interface.`,
      `Choose MIDI ports matching your interface or ${deviceName}.`,
      'Allow SysEx permission when prompted.',
      `${deviceName} displays IDs 1-17 but protocol values are 0-16.`,
    ],
    secureContextTitle: 'Secure Connection Required',
    secureContextHelpItems: [
      'Use localhost or 127.0.0.1 for local development.',
      'Or deploy this editor using HTTPS.',
    ],
    deviceIdDisplayOffset: 1,
  }), [deviceName]);

  return (
    <div className="ac-page ac-page-shell">
      <div className="ac-page-sticky-header">
        <div className="ac-page-header">
          <h2 className="text-xl font-bold text-s330-text">Connect</h2>
        </div>
      </div>
      <MidiConnectionPage
        config={config}
        store={pageStore}
        deviceIdRange={{ min: 0, max: 16 }}
        onContinue={() => navigate('/patches')}
      />
    </div>
  );
}
