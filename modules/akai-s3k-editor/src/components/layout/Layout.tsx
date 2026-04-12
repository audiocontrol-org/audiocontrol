import { type ReactNode, useEffect, useCallback, useMemo } from 'react';
import {
  EditorLayout,
  PanicButton,
  MidiStatusDisplay,
  type EditorLayoutConfig,
} from '@audiocontrol/editor-core';
import { useMidiStore } from '@/stores/midiStore';

const BASE_PATH = '/akai/s3000xl/editor';

function useLayoutConfig(): EditorLayoutConfig {
  return useMemo(() => ({
    editorName: 'Akai S3000XL',
    editorSubtitle: 'Akai Sampler',
    navItems: [
      { to: BASE_PATH, label: 'Connect' },
      { to: `${BASE_PATH}/programs`, label: 'Programs' },
      { to: `${BASE_PATH}/compare`, label: 'Compare' },
      { to: `${BASE_PATH}/keygroups`, label: 'Keygroups' },
      { to: `${BASE_PATH}/samples`, label: 'Samples' },
      { to: `${BASE_PATH}/library`, label: 'Library' },
    ],
    buildInfoConfig: {
      editorName: 'S3000XL Editor',
      editorDescription: 'Akai Sampler',
      githubRepo: 'audiocontrol-org/audiocontrol',
      issueTitlePrefix: '[S3000XL Editor]',
    },
  }), []);
}

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
      <MidiStatusDisplay
        isConnected={isConnected}
        inputName={selectedInput?.name}
        outputName={selectedOutput?.name}
      />
      <PanicButton onClick={handlePanic} disabled={!isConnected} />
    </>
  );
}

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps): JSX.Element {
  const layoutConfig = useLayoutConfig();
  const initialize = useMidiStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <EditorLayout
      config={layoutConfig}
      headerRight={<HeaderRight />}
    >
      {children}
    </EditorLayout>
  );
}
