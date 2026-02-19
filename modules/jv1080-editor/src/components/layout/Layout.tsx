/**
 * JV-1080 Editor Layout
 *
 * Uses shared EditorLayout from @audiocontrol/editor-core
 */

import { type ReactNode, useCallback, useEffect } from 'react';
import {
  EditorLayout,
  MidiStatusDisplay,
  PanicButton,
  type EditorLayoutConfig,
} from '@audiocontrol/editor-core';
import { useMidiStore } from '@/stores/midiStore';

// JV-1080 Editor layout configuration
const layoutConfig: EditorLayoutConfig = {
  editorName: 'JV-1080',
  editorSubtitle: 'Roland Synthesizer Module',
  navItems: [
    { to: '/', label: 'Connect' },
    { to: '/editor', label: 'Editor' },
  ],
  buildInfoConfig: {
    editorName: 'JV-1080 Editor',
    editorDescription: 'Roland Synthesizer Module',
    githubRepo: 'audiocontrol-org/audiocontrol',
    issueTitlePrefix: '[JV-1080 Editor]',
  },
};

function HeaderRight(): JSX.Element {
  const status = useMidiStore((state) => state.status);
  const inputs = useMidiStore((state) => state.inputs);
  const outputs = useMidiStore((state) => state.outputs);
  const selectedInputId = useMidiStore((state) => state.selectedInputId);
  const selectedOutputId = useMidiStore((state) => state.selectedOutputId);
  const sendPanic = useMidiStore((state) => state.sendPanic);

  const selectedInput = inputs.find((port) => port.id === selectedInputId);
  const selectedOutput = outputs.find((port) => port.id === selectedOutputId);
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

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return (
    <EditorLayout config={layoutConfig} headerRight={<HeaderRight />}>
      {children}
    </EditorLayout>
  );
}
