/**
 * D-110 Editor Layout
 *
 * Uses shared EditorLayout from @audiocontrol/editor-core
 */

import { type ReactNode, useEffect, useCallback } from 'react';
import {
  EditorLayout,
  PanicButton,
  MidiStatusDisplay,
  type EditorLayoutConfig,
} from '@audiocontrol/editor-core';
import { useMidiStore } from '@/stores/midiStore';

// D-110 Editor layout configuration
const layoutConfig: EditorLayoutConfig = {
  editorName: 'D-110',
  editorSubtitle: 'Roland LA Synthesizer',
  navItems: [
    { to: '/', label: 'Connect' },
    { to: '/tones', label: 'Tones' },
    { to: '/patches', label: 'Patches' },
  ],
  buildInfoConfig: {
    editorName: 'D-110 Editor',
    editorDescription: 'Roland LA Synthesizer',
    githubRepo: 'audiocontrol-org/audiocontrol',
    issueTitlePrefix: '[D-110 Editor]',
  },
  footerText: 'D-110 Editor uses Web MIDI API for direct browser-to-hardware communication. Requires Chrome, Edge, or Opera browser.',
};

/**
 * Header right section with Panic button and MIDI status
 */
function HeaderRight(): JSX.Element {
  const status = useMidiStore((state) => state.status);
  const selectedInput = useMidiStore((state) => state.selectedInput);
  const selectedOutput = useMidiStore((state) => state.selectedOutput);
  const sendPanic = useMidiStore((state) => state.sendPanic);

  const isConnected = status === 'connected';

  const handlePanic = useCallback(() => {
    sendPanic();
  }, [sendPanic]);

  return (
    <>
      <PanicButton onClick={handlePanic} disabled={!isConnected} />
      <MidiStatusDisplay
        isConnected={isConnected}
        inputName={selectedInput?.name}
        outputName={selectedOutput?.name}
      />
    </>
  );
}

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps): JSX.Element {
  const initialize = useMidiStore((state) => state.initialize);

  // Initialize MIDI on app start
  useEffect(() => {
    void initialize();
  }, [initialize]);

  return (
    <EditorLayout config={layoutConfig} headerRight={<HeaderRight />}>
      {children}
    </EditorLayout>
  );
}
