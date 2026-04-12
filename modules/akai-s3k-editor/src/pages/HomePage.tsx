import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MidiConnectionPage, useHomePageStore, type MidiConnectionPageConfig } from '@audiocontrol/editor-core';
import { useMidiStore } from '@/stores/midiStore';

const BASE_PATH = '/akai/s3000xl/editor';

export function HomePage(): JSX.Element {
  const navigate = useNavigate();
  const midi = useMidiStore();
  const pageStore = useHomePageStore('s3000xl', midi);
  const hasAutoNavigated = useRef(false);

  // Auto-redirect to Programs page after successful connection
  useEffect(() => {
    if (midi.status === 'connected' && !hasAutoNavigated.current) {
      hasAutoNavigated.current = true;
      navigate(`${BASE_PATH}/programs`);
    }
    if (midi.status !== 'connected') {
      hasAutoNavigated.current = false;
    }
  }, [midi.status, navigate]);

  const config: MidiConnectionPageConfig = useMemo(() => ({
    deviceName: 'Akai S3000XL',
    inputLabel: 'MIDI Input (from S3000XL)',
    outputLabel: 'MIDI Output (to S3000XL)',
    deviceIdLabel: 'Device ID',
    deviceIdHelpText: 'Enter the Exclusive Channel shown on your S3000XL (MIDI -> Sys Ex -> Exclusive Channel).',
    continueLabel: 'Continue to Programs',
    helpItems: [
      'Connect your S3000XL using a MIDI interface.',
      'Choose MIDI ports matching your interface.',
      'Allow SysEx permission when prompted.',
    ],
    secureContextTitle: 'Secure Connection Required',
    secureContextHelpItems: [
      'Use localhost or 127.0.0.1 for local development.',
      'Or deploy this editor using HTTPS.',
    ],
    deviceIdDisplayOffset: 0,
  }), []);

  return (
    <div className="ac-page ac-page-shell">
      <div className="ac-page-sticky-header">
        <div className="ac-page-header">
          <h2 className="text-xl font-bold">Connect</h2>
        </div>
      </div>
      <MidiConnectionPage
        config={config}
        store={pageStore}
        deviceIdRange={{ min: 0, max: 127 }}
        onContinue={() => navigate(`${BASE_PATH}/programs`)}
      />
    </div>
  );
}
