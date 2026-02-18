/**
 * S-330 Editor Layout
 *
 * Uses shared EditorLayout from @audiocontrol/editor-tools
 * with S-330-specific video capture drawer
 */

import { type ReactNode, useEffect, useCallback, useRef, useState } from 'react';
import {
  EditorLayout,
  PanicButton,
  MidiStatusDisplay,
  type EditorLayoutConfig,
} from '@audiocontrol/editor-tools';
import { VideoCapture } from '@/components/video/VideoCapture';
import { useMidiStore } from '@/stores/midiStore';
import { useUIStore, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH } from '@/stores/uiStore';
import { cn } from '@/lib/utils';

// S-330 Editor theme colors
const s330Theme = {
  bgPrimary: 'var(--ac-bg-primary)',
  bgPanel: 'var(--ac-bg-panel)',
  border: 'var(--ac-border)',
  textPrimary: 'var(--ac-text-primary)',
  textMuted: 'var(--ac-text-muted)',
  highlight: 'var(--ac-highlight)',
};

// S-330 Editor layout configuration
const layoutConfig: EditorLayoutConfig = {
  editorName: 'S-330',
  editorSubtitle: 'Roland Sampler',
  navItems: [
    { to: '/', label: 'Connect' },
    { to: '/play', label: 'Play' },
    { to: '/patches', label: 'Patches' },
    { to: '/tones', label: 'Tones' },
  ],
  theme: s330Theme,
  buildInfoConfig: {
    editorName: 'S-330 Editor',
    editorDescription: 'Roland Sampler',
    githubRepo: 'audiocontrol-org/audiocontrol',
    issueTitlePrefix: '[S-330 Editor]',
    theme: {
      textMuted: s330Theme.textMuted,
      textPrimary: s330Theme.textPrimary,
      textHighlight: s330Theme.highlight,
      bgPrimary: s330Theme.bgPrimary,
      bgPanel: s330Theme.bgPanel,
      border: s330Theme.border,
    },
  },
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

/**
 * Video capture drawer toggle button
 */
interface DrawerToggleProps {
  isOpen: boolean;
  drawerWidth: number;
  onToggle: () => void;
}

function DrawerToggle({ isOpen, drawerWidth, onToggle }: DrawerToggleProps): JSX.Element {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'fixed z-50',
        'flex flex-col items-center justify-center gap-1.5',
        'w-12 h-20 rounded-r-md',
        'bg-s330-panel border border-l-0 border-s330-accent',
        'text-s330-muted hover:text-s330-text hover:bg-s330-accent/50',
        'shadow-md transition-[left] duration-200 ease-in-out'
      )}
      style={{
        top: 'calc(var(--ac-page-sticky-top) + 0.25rem)',
        left: isOpen ? drawerWidth : 0,
      }}
      title={isOpen ? 'Close S-330 display' : 'Open S-330 display'}
    >
      {/* Video camera icon */}
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
      </svg>
      {/* Chevron */}
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d={isOpen ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'}
        />
      </svg>
    </button>
  );
}

/**
 * Video capture drawer sidebar
 */
interface DrawerProps {
  isOpen: boolean;
  width: number;
  isResizing: boolean;
  onResizeStart: (e: React.MouseEvent) => void;
}

function Drawer({ isOpen, width, isResizing, onResizeStart }: DrawerProps): JSX.Element {
  return (
    <aside
      className={cn(
        'fixed top-0 left-0 h-full z-50',
        'border-r border-s330-accent bg-s330-panel overflow-y-auto',
        'shadow-xl transition-transform duration-200 ease-in-out',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}
      style={{ width }}
    >
      <VideoCapture />
      {/* Resize handle */}
      <div
        onMouseDown={onResizeStart}
        className={cn(
          'absolute top-0 right-0 w-1 h-full cursor-ew-resize',
          'hover:bg-s330-highlight/50 transition-colors',
          isResizing && 'bg-s330-highlight'
        )}
      />
    </aside>
  );
}

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps): JSX.Element {
  const initialize = useMidiStore((state) => state.initialize);
  const isDrawerOpen = useUIStore((state) => state.isDrawerOpen);
  const toggleDrawer = useUIStore((state) => state.toggleDrawer);
  const drawerWidth = useUIStore((state) => state.drawerWidth);
  const setDrawerWidth = useUIStore((state) => state.setDrawerWidth);

  const [isResizing, setIsResizing] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  // Initialize MIDI on app start
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Handle drawer resize
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = drawerWidth;
    e.preventDefault();
  }, [drawerWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartX.current;
      const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, resizeStartWidth.current + delta));
      setDrawerWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, setDrawerWidth]);

  // S-330 specific: drawer and drawer toggle rendered before header
  const drawerElements = (
    <>
      <Drawer
        isOpen={isDrawerOpen}
        width={drawerWidth}
        isResizing={isResizing}
        onResizeStart={handleResizeStart}
      />
      <DrawerToggle
        isOpen={isDrawerOpen}
        drawerWidth={drawerWidth}
        onToggle={toggleDrawer}
      />
    </>
  );

  return (
    <div style={{ marginLeft: isDrawerOpen ? drawerWidth : 0, transition: 'margin 200ms' }}>
      <EditorLayout
        config={layoutConfig}
        headerRight={<HeaderRight />}
        headerBefore={drawerElements}
      >
        {children}
      </EditorLayout>
    </div>
  );
}
