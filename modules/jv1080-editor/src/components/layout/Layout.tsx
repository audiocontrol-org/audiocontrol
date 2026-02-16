import { type ReactNode, useCallback, useEffect } from 'react';
import {
  EditorLayout,
  MidiStatusDisplay,
  PanicButton,
  type EditorLayoutConfig,
} from '@audiocontrol/editor-tools';
import { useMidiStore } from '@/stores/midiStore';

const jv1080Theme = {
  bgPrimary: 'var(--ac-bg-primary)',
  bgPanel: 'var(--ac-bg-panel)',
  border: 'var(--ac-border)',
  textPrimary: 'var(--ac-text-primary)',
  textMuted: 'var(--ac-text-muted)',
  highlight: 'var(--ac-highlight)',
};

const layoutConfig: EditorLayoutConfig = {
  editorName: 'JV-1080',
  editorSubtitle: 'Roland Synthesizer Module',
  navItems: [
    { to: '/', label: 'Connect' },
    { to: '/editor', label: 'Editor' },
  ],
  theme: jv1080Theme,
  buildInfoConfig: {
    editorName: 'JV-1080 Editor',
    editorDescription: 'Roland Synthesizer Module',
    githubRepo: 'audiocontrol-org/audiocontrol',
    issueTitlePrefix: '[JV-1080 Editor]',
    theme: {
      textMuted: jv1080Theme.textMuted,
      textPrimary: jv1080Theme.textPrimary,
      textHighlight: jv1080Theme.highlight,
      bgPrimary: jv1080Theme.bgPrimary,
      bgPanel: jv1080Theme.bgPanel,
      border: jv1080Theme.border,
    },
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
