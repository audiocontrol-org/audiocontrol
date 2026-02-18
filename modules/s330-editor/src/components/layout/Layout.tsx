/**
 * S-330 Editor Layout
 *
 * Uses shared EditorLayout from @audiocontrol/editor-core
 * with S-330-specific video capture drawer
 */

import { type ReactNode, useEffect, useCallback, useRef, useState } from 'react';
import {
  EditorLayout,
  PanicButton,
  MidiStatusDisplay,
  type EditorLayoutConfig,
} from '@audiocontrol/editor-core';
import { VideoCapture } from '@/components/video/VideoCapture';
import { useMidiStore } from '@/stores/midiStore';
import { useUIStore, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH } from '@/stores/uiStore';
import { cn } from '@/lib/utils';

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
  buildInfoConfig: {
    editorName: 'S-330 Editor',
    editorDescription: 'Roland Sampler',
    githubRepo: 'audiocontrol-org/audiocontrol',
    issueTitlePrefix: '[S-330 Editor]',
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
      <MidiStatusDisplay
        isConnected={isConnected}
        inputName={selectedInput?.name}
        outputName={selectedOutput?.name}
      />
      <PanicButton onClick={handlePanic} disabled={!isConnected} />
    </>
  );
}

/**
 * Video capture drawer toggle button
 */
interface DrawerToggleProps {
  isOpen: boolean;
  drawerWidth: number;
  topPx: number | null;
  onToggle: () => void;
}

function DrawerToggle({ isOpen, drawerWidth, topPx, onToggle }: DrawerToggleProps): JSX.Element {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'fixed z-40',
        'flex flex-col items-center justify-center gap-1.5',
        'w-[18px] h-12 rounded-r',
        'bg-s330-panel border border-l-0 border-s330-accent',
        'text-s330-muted hover:text-s330-text hover:bg-s330-accent/50',
        'transition-[left] duration-200 ease-in-out'
      )}
      style={{
        top: topPx !== null ? `${Math.round(topPx)}px` : 'var(--ac-page-content-top)',
        left: isOpen ? `${drawerWidth - 1}px` : '0px',
      }}
      title={isOpen ? 'Close S-330 display' : 'Open S-330 display'}
    >
      {/* Video camera icon */}
      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
      </svg>
      {/* Chevron */}
      <svg className="w-1.5 h-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  const drawerTop = 'calc(var(--ac-page-content-top) - var(--ac-page-space))';

  return (
    <aside
      className={cn(
        'fixed left-0 z-30',
        'border-r border-s330-accent bg-s330-panel overflow-y-auto',
        'shadow-xl transition-transform duration-200 ease-in-out',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}
      style={{
        top: drawerTop,
        left: '0px',
        width,
        height: `calc(100vh - ${drawerTop})`,
      }}
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
  const [drawerToggleTopPx, setDrawerToggleTopPx] = useState<number | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;

    const updateToggleTop = () => {
      const target = root.querySelector<HTMLElement>('.ac-list-detail-grid .card, .card');
      if (!target) return;

      setDrawerToggleTopPx(target.getBoundingClientRect().top);
    };

    // Use ResizeObserver to detect when content layout changes
    const resizeObserver = new ResizeObserver(updateToggleTop);
    resizeObserver.observe(root);

    window.addEventListener('resize', updateToggleTop);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateToggleTop);
    };
  }, [children, isDrawerOpen, drawerWidth]);

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
        topPx={drawerToggleTopPx}
        onToggle={toggleDrawer}
      />
    </>
  );

  return (
    <EditorLayout
      config={layoutConfig}
      headerRight={<HeaderRight />}
    >
      {drawerElements}
      <div
        ref={contentRef}
        style={{
          ['--ac-page-offset-inline' as string]: isDrawerOpen
            ? `calc(${drawerWidth}px + var(--ac-page-section-gap) - 18px)`
            : '0px',
        }}
      >
        {children}
      </div>
    </EditorLayout>
  );
}
