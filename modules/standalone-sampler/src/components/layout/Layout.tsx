import { type ReactNode } from 'react';
import {
  EditorLayout,
  type EditorLayoutConfig,
} from '@audiocontrol/editor-core';

const layoutConfig: EditorLayoutConfig = {
  editorName: 'Sampler',
  editorSubtitle: 'Software Sampler',
  navItems: [
    { to: '/', label: 'Play' },
    { to: '/program', label: 'Program' },
    { to: '/library', label: 'Library' },
  ],
  buildInfoConfig: {
    editorName: 'Standalone Sampler',
    editorDescription: 'Web-based software sampler',
    githubRepo: 'audiocontrol-org/audiocontrol',
    issueTitlePrefix: '[Standalone Sampler]',
  },
  footerText: 'Standalone Sampler uses Web Audio API for sample playback and Web MIDI API for external controller input.',
};

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps): JSX.Element {
  return (
    <EditorLayout config={layoutConfig}>
      {children}
    </EditorLayout>
  );
}
