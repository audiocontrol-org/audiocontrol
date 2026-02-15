/**
 * D-110 Editor Layout
 *
 * Uses shared EditorLayout from @audiocontrol/editor-tools
 */

import { type ReactNode, useEffect, useCallback } from 'react';
import {
  EditorLayout,
  PanicButton,
  MidiStatusDisplay,
  type EditorLayoutConfig,
} from '@audiocontrol/editor-tools';
import { useMidiStore } from '@/stores/midiStore';

// D-110 Editor theme colors
const d110Theme = {
  bgPrimary: '#111827',      // gray-900
  bgPanel: '#1f2937',        // gray-800
  border: '#374151',         // gray-700
  textPrimary: '#e5e7eb',    // gray-200
  textMuted: '#6b7280',      // gray-500
  highlight: '#60a5fa',      // blue-400
};

// D-110 Editor layout configuration
const layoutConfig: EditorLayoutConfig = {
  editorName: 'D-110',
  editorSubtitle: 'Roland LA Synthesizer',
  navItems: [
    { to: '/', label: 'Connect' },
    { to: '/tones', label: 'Tones' },
    { to: '/patches', label: 'Patches' },
  ],
  theme: d110Theme,
  buildInfoConfig: {
    editorName: 'D-110 Editor',
    editorDescription: 'Roland LA Synthesizer',
    githubRepo: 'audiocontrol-org/audiocontrol',
    issueTitlePrefix: '[D-110 Editor]',
    theme: {
      textMuted: d110Theme.textMuted,
      textPrimary: d110Theme.textPrimary,
      textHighlight: d110Theme.highlight,
      bgPrimary: d110Theme.bgPrimary,
      bgPanel: d110Theme.bgPanel,
      border: d110Theme.border,
    },
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
