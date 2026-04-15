import { type ReactNode, useEffect, useCallback, useMemo } from 'react';
import {
  EditorLayout,
  PanicButton,
  MidiStatusDisplay,
  type EditorLayoutConfig,
} from '@audiocontrol/editor-core';
import { useMidiStore } from '@/stores/midiStore';
import { useConnectionDrawerStore } from '@/stores/connectionDrawerStore';
import { ConnectionDrawer } from '@/components/layout/ConnectionDrawer';

const BASE_PATH = '/akai/s3000xl/editor';

function useLayoutConfig(): EditorLayoutConfig {
  return useMemo(() => ({
    editorName: 'Akai S3000XL',
    editorSubtitle: 'Akai Sampler',
    navItems: [
      { to: `${BASE_PATH}/programs`, label: 'Programs' },
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
  const openConnectionDrawer = useConnectionDrawerStore((state) => state.open);

  const isConnected = status === 'connected';

  const handlePanic = useCallback(() => {
    sendPanic();
  }, [sendPanic]);

  return (
    <>
      <button
        onClick={openConnectionDrawer}
        className="ac-midi-status-btn"
        title="Open MIDI connection settings"
        type="button"
      >
        <MidiStatusDisplay
          isConnected={isConnected}
          inputName={selectedInput?.name}
          outputName={selectedOutput?.name}
        />
      </button>
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
  const drawerOpen = useConnectionDrawerStore((state) => state.isOpen);
  const closeDrawer = useConnectionDrawerStore((state) => state.close);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <EditorLayout
      config={layoutConfig}
      headerRight={<HeaderRight />}
    >
      {children}
      <ConnectionDrawer open={drawerOpen} onClose={closeDrawer} />
    </EditorLayout>
  );
}
