/**
 * Main application layout
 */

import { ReactNode, useEffect, useCallback, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { MidiStatus } from '@/components/midi/MidiStatus';
import { VideoCapture } from '@/components/video/VideoCapture';
import { useMidiStore } from '@/stores/midiStore';
import { useUIStore, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH } from '@/stores/uiStore';
import { cn } from '@/lib/utils';

/**
 * Panic button component - sends All Notes Off on all channels
 */
function PanicButton() {
  const status = useMidiStore((state) => state.status);
  const sendPanic = useMidiStore((state) => state.sendPanic);

  const handlePanic = useCallback(() => {
    sendPanic();
  }, [sendPanic]);

  const isConnected = status === 'connected';

  return (
    <button
      onClick={handlePanic}
      disabled={!isConnected}
      className={cn(
        'px-3 py-1.5 text-sm font-medium rounded transition-colors',
        isConnected
          ? 'bg-red-600 hover:bg-red-500 text-white'
          : 'bg-s330-muted/30 text-s330-muted cursor-not-allowed'
      )}
      title={isConnected ? 'Send All Notes Off on all channels' : 'Connect to MIDI to enable'}
    >
      PANIC
    </button>
  );
}

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { to: '/', label: 'Connect' },
  { to: '/play', label: 'Play' },
  { to: '/patches', label: 'Patches' },
  { to: '/tones', label: 'Tones' },
];

export function Layout({ children }: LayoutProps) {
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

  return (
    <div className="min-h-screen bg-s330-bg flex flex-col">
      {/* Video Capture Drawer - slides in from left */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full z-50',
          'border-r border-s330-accent bg-s330-panel overflow-y-auto',
          'shadow-xl transition-transform duration-200 ease-in-out',
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ width: drawerWidth }}
      >
        <VideoCapture />
        {/* Resize handle */}
        <div
          onMouseDown={handleResizeStart}
          className={cn(
            'absolute top-0 right-0 w-1 h-full cursor-ew-resize',
            'hover:bg-s330-highlight/50 transition-colors',
            isResizing && 'bg-s330-highlight'
          )}
        />
      </aside>

      {/* Main page wrapper - pushed right when drawer is open */}
      <div
        className="min-h-screen flex flex-col transition-[margin] duration-200"
        style={{ marginLeft: isDrawerOpen ? drawerWidth : 0 }}
      >
        {/* Header */}
        <header className="sticky top-0 z-40 bg-s330-panel border-b border-s330-accent">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo and Drawer Toggle */}
            <div className="flex items-center gap-4">
              <button
                onClick={toggleDrawer}
                className={cn(
                  'p-2 rounded transition-colors',
                  isDrawerOpen
                    ? 'bg-s330-highlight text-white'
                    : 'text-s330-muted hover:text-s330-text hover:bg-s330-accent/50'
                )}
                title={isDrawerOpen ? 'Close S-330 display' : 'Open S-330 display'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </button>
              <h1 className="text-xl font-bold text-s330-text">
                <span className="text-s330-highlight">S-330</span> Editor
              </h1>
              <span className="text-xs text-s330-muted">Roland Sampler</span>
            </div>

            {/* MIDI Status and Panic Button */}
            <div className="flex items-center gap-3">
              <PanicButton />
              <MidiStatus />
            </div>
          </div>

          {/* Navigation */}
          <nav className="mt-3">
            <ul className="flex gap-1">
              {navItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'px-4 py-2 rounded-t-md text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-s330-bg text-s330-text'
                          : 'text-s330-muted hover:text-s330-text hover:bg-s330-accent/50'
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-s330-accent py-4">
          <div className="max-w-7xl mx-auto px-4 text-center text-xs text-s330-muted">
            S-330 Editor uses Web MIDI API for direct browser-to-hardware communication.
            <br />
            Requires Chrome, Edge, or Opera browser.
          </div>
        </footer>
      </div>
      </div>
    </div>
  );
}
