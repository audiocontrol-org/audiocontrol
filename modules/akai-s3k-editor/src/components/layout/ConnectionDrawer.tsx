import { useMemo } from 'react';
import { SlideDrawer, MidiConnectionPage, useHomePageStore, type MidiConnectionPageConfig } from '@audiocontrol/editor-core';
import { useMidiStore } from '@/stores/midiStore';

interface ConnectionDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function ConnectionDrawer({ open, onClose }: ConnectionDrawerProps): JSX.Element {
  const midi = useMidiStore();
  const pageStore = useHomePageStore('s3000xl', midi);

  const config: MidiConnectionPageConfig = useMemo(() => ({
    deviceName: 'Akai S3000XL',
    inputLabel: 'MIDI Input (from S3000XL)',
    outputLabel: 'MIDI Output (to S3000XL)',
    deviceIdLabel: 'Device ID',
    deviceIdHelpText: 'Enter the Exclusive Channel shown on your S3000XL (MIDI -> Sys Ex -> Exclusive Channel).',
    continueLabel: 'Done',
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
    <SlideDrawer open={open} title="MIDI Connection" onClose={onClose}>
      <MidiConnectionPage
        config={config}
        store={pageStore}
        deviceIdRange={{ min: 0, max: 127 }}
        onContinue={onClose}
      />
    </SlideDrawer>
  );
}
