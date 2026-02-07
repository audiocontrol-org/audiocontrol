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
  const isVideoDocked = useUIStore((state) => state.isVideoDocked);
  const sidebarWidth = useUIStore((state) => state.sidebarWidth);
  const setSidebarWidth = useUIStore((state) => state.setSidebarWidth);

  const [isResizing, setIsResizing] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  // Initialize MIDI on app start
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Handle sidebar resize
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = sidebarWidth;
    e.preventDefault();
  }, [sidebarWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartX.current;
      const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, resizeStartWidth.current + delta));
      setSidebarWidth(newWidth);
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
  }, [isResizing, setSidebarWidth]);

  return (
    <div className="min-h-screen bg-s330-bg flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-s330-panel border-b border-s330-accent">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-4">
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

      {/* Main area with optional sidebar */}
      <div className="flex-1 flex">
        {/* Left sidebar for docked video */}
        {isVideoDocked && (
          <aside
            className="flex-shrink-0 border-r border-s330-accent bg-s330-panel overflow-y-auto relative"
            style={{ width: sidebarWidth }}
          >
            <VideoCapture isDocked />
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
        )}

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

      {/* Video Capture Panel - floating mode (includes front panel controls) */}
      {!isVideoDocked && <VideoCapture />}
    </div>
  );
}
