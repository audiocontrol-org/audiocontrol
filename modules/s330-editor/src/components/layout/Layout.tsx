/**
 * Main application layout
 */

import { ReactNode, useEffect, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { MidiStatus } from '@/components/midi/MidiStatus';
import { VideoCapture } from '@/components/video/VideoCapture';
import { useMidiStore } from '@/stores/midiStore';
import { useParameterListener } from '@/hooks/useParameterListener';
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

  // Initialize MIDI on app start
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Listen for hardware parameter changes and trigger UI updates
  useParameterListener();

  return (
    <div className="min-h-screen bg-s330-bg">
      {/* Header */}
      <header className="bg-s330-panel border-b border-s330-accent">
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

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-s330-accent py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-s330-muted">
          S-330 Editor uses Web MIDI API for direct browser-to-hardware communication.
          <br />
          Requires Chrome, Edge, or Opera browser.
        </div>
      </footer>

      {/* Video Capture Panel (includes front panel controls) */}
      <VideoCapture />
    </div>
  );
}
